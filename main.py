import os
import secrets
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlmodel import Session, func, select

from auth import (
    APP_PASSWORD,
    is_login_locked_out,
    record_failed_login,
    record_successful_login,
    require_login,
)
from baseline import get_baseline
from charting import build_heatmap_html, build_line_svg, build_meter_html, status_chip_html
from content.bonus_tasks import BONUS_TASKS
from content.gym_exercises import SEED_EXERCISES
from content.milestones import badge_progress, level_for_points
from content.projections import (
    compute_streak,
    confidence_score,
    meal_adherence_pct,
    slack_impact_date,
    training_adherence_pct,
    week_start as get_week_start,
)
from database import engine, get_session, init_db
import edamam_sync
import fitchef_sync
from models import BodyLog, BonusLog, Exercise, HydrationLog, MealLog, Profile, Workout, WorkoutSet
from quest_engine import sync_system_quests
from routers import body, bonus, cardio, gym, home, meals, padel, recovery, reminders, settings, simulate, training, webhooks
from routers.meals import HYDRATION_TARGET_ML, PLAN_START_DATE, SLOT_ICONS, SLOT_LABELS
from validation import ValidationError, error_redirect

load_dotenv()


def _seed_profile():
    with Session(engine) as session:
        existing = session.exec(select(Profile)).first()
        if not existing:
            session.add(Profile())
            session.commit()


def _seed_exercises():
    with Session(engine) as session:
        existing_names = set(session.exec(select(Exercise.name)).all())
        added = False
        for muscle_group, name, equipment in SEED_EXERCISES:
            if name not in existing_names:
                session.add(Exercise(name=name, muscle_group=muscle_group, equipment=equipment))
                added = True
        if added:
            session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_profile()
    _seed_exercises()
    yield


app = FastAPI(title="Fitness OS", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev-secret-change-me"),
    https_only=os.getenv("RENDER") is not None,  # Render sets RENDER=true on every service; false for local http dev
    same_site="lax",
    max_age=14 * 24 * 60 * 60,
)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self'; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'self'"
)


@app.middleware("http")
async def response_hardening(request: Request, call_next):
    """Two things every response on this app needs, static assets aside:
    (1) never cached — every page shows personal health/training data
    that changes on every log/edit/delete, so a browser's back/forward
    cache serving a stale copy (e.g. a just-deleted session still
    showing) or a shared machine's disk cache retaining it are both real
    risks; (2) standard hardening headers, since this is a password-gated
    app carrying sensitive personal data over the open internet."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if not request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Content-Security-Policy"] = _CSP
    return response

app.include_router(body.router)
app.include_router(gym.router)
app.include_router(padel.router)
app.include_router(meals.router)
app.include_router(reminders.router)
app.include_router(settings.router)
app.include_router(home.router)
app.include_router(recovery.router)
app.include_router(bonus.router)
app.include_router(simulate.router)
app.include_router(cardio.router)
app.include_router(training.router)
app.include_router(webhooks.router)


def _referer_path(request: Request) -> str:
    """Extract just the path+query from the Referer header — never redirect
    to a raw header value directly (open-redirect risk if it were ever
    absolute/cross-origin), and this is always our own same-origin form
    page anyway since it's how the user got to the form that failed."""
    referer = request.headers.get("referer", "")
    parsed = urlparse(referer)
    return f"{parsed.path}{'?' + parsed.query if parsed.query else ''}" or "/"


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    """Domain-range checks (validation.py) — weight/RPE/reps out of a sane
    range, an invalid choice, etc. Redirect back to the form with the
    message instead of a bare 500."""
    return RedirectResponse(url=error_redirect(_referer_path(request), exc.message), status_code=303)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    """FastAPI/Pydantic's built-in check — a missing required field or a
    value that doesn't match its expected type (e.g. letters typed into a
    number field bypassing the browser's own input type). Redirect with a
    plain-language message instead of the raw JSON 422 body."""
    errors = exc.errors()
    if errors:
        field = str(errors[0].get("loc", ["input"])[-1]).replace("_", " ")
        message = f"'{field}' is missing or not the right kind of value — please check and try again."
    else:
        message = "Some of that input wasn't valid — please check and try again."
    return RedirectResponse(url=error_redirect(_referer_path(request), message), status_code=303)


@app.get("/login")
def login_form(request: Request):
    return templates.TemplateResponse(request, "login.html", {"request": request, "logged_in": False, "error": None})


@app.post("/login")
def login_submit(request: Request, password: str = Form(...)):
    if is_login_locked_out():
        return templates.TemplateResponse(
            request,
            "login.html",
            {"request": request, "logged_in": False, "error": "Too many attempts — wait a minute and try again."},
            status_code=429,
        )
    if secrets.compare_digest(password, APP_PASSWORD):
        record_successful_login()
        request.session["authed"] = True
        return RedirectResponse(url="/", status_code=303)
    record_failed_login()
    return templates.TemplateResponse(
        request,
        "login.html",
        {"request": request, "logged_in": False, "error": "Wrong password."},
        status_code=401,
    )


@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


@app.get("/more", dependencies=[Depends(require_login)])
def more_page(request: Request, session: Session = Depends(get_session)):
    fitchef_sync_status = fitchef_sync.latest_sync(session)
    if fitchef_sync_status and fitchef_sync_status.status not in ("complete", "error"):
        fitchef_sync_status = fitchef_sync.advance_sync(session, fitchef_sync_status)
    edamam_sync_status = edamam_sync.latest_sync(session)
    return templates.TemplateResponse(
        request,
        "more.html",
        {
            "request": request,
            "logged_in": True,
            "fitchef_sync": fitchef_sync_status,
            "edamam_sync": edamam_sync_status,
            "edamam_sync_stale": bool(edamam_sync_status and edamam_sync.is_pending_stale(edamam_sync_status)),
            "just_synced": request.query_params.get("synced") == "1",
        },
    )


@app.get("/help", dependencies=[Depends(require_login)])
def help_page(request: Request):
    return templates.TemplateResponse(request, "help.html", {"request": request, "logged_in": True})


WORKOUT_TYPE_LABELS = {"gym": "Gym", "home": "Home Session", "recovery": "Active Recovery", "padel": "Padel", "cardio": "Cardio"}
WORKOUT_TYPE_ICONS = {"gym": "dumbbell", "home": "house", "recovery": "heart", "padel": "racket", "cardio": "heart-pulse"}
MEAL_SLOTS_PER_DAY = 5

CONFIDENCE_STATUS = {
    "On Track": ("good", "check"),
    "Slightly Behind": ("warning", "activity"),
    "At Risk": ("critical", "alert"),
    "Not enough data yet": ("warning", "activity"),
}


def _weekly_adherence_outcome_insight(session: Session, today: date, weeks: int = 8) -> Optional[str]:
    """'Weeks you hit >=80% meal adherence, you lost X more' — or None if
    there isn't enough history yet to say anything meaningful."""
    high_changes = []
    low_changes = []
    for i in range(weeks):
        week_end = today - timedelta(days=7 * i)
        week_start = week_end - timedelta(days=6)
        completed = len(
            session.exec(
                select(MealLog).where(
                    MealLog.log_date >= week_start, MealLog.log_date <= week_end, MealLog.completed == True  # noqa: E712
                )
            ).all()
        )
        adherence = meal_adherence_pct(completed, MEAL_SLOTS_PER_DAY * 7)
        week_logs = session.exec(
            select(BodyLog)
            .where(BodyLog.log_date >= week_start, BodyLog.log_date <= week_end)
            .order_by(BodyLog.log_date)
        ).all()
        if len(week_logs) < 2:
            continue
        change = week_logs[0].weight_kg - week_logs[-1].weight_kg  # positive = lost weight
        (high_changes if adherence >= 80 else low_changes).append(change)

    if not high_changes or not low_changes:
        return None
    avg_high = sum(high_changes) / len(high_changes)
    avg_low = sum(low_changes) / len(low_changes)
    diff = round(avg_high - avg_low, 2)
    if diff <= 0:
        return None
    return f"On weeks you hit 80%+ meal adherence, you lost {diff}kg more on average than lower-adherence weeks."


@app.get("/", dependencies=[Depends(require_login)])
def dashboard(request: Request, session: Session = Depends(get_session)):
    today = date.today()

    # ── Pain-pattern flag (across every training type) ──────────────
    recent_workouts_any = session.exec(select(Workout).order_by(Workout.log_date.desc())).all()[:5]
    recent_pain_count = len([w for w in recent_workouts_any if w.pain_note])
    pain_pattern_flag = (
        f"You've noted discomfort in {recent_pain_count} of your last {len(recent_workouts_any)} sessions — worth keeping an eye on."
        if recent_pain_count >= 3
        else None
    )

    baseline = get_baseline(session, today)
    profile = baseline["profile"]
    current_weight = baseline["current_weight"]
    start_weight = baseline["start_weight"]
    goal_mid = baseline["goal_mid"]
    actual_rate = baseline["actual_rate"]
    target_rate = baseline["target_rate"]
    predicted_date = baseline["baseline_date"]

    goal_progress_pct = None
    if start_weight is not None and current_weight is not None and start_weight != goal_mid:
        raw = (start_weight - current_weight) / (start_weight - goal_mid) * 100
        goal_progress_pct = round(min(100, max(0, raw)))

    # ── Today's checklist (meals + quests + hydration, one glance) ──
    today_meal_logs = session.exec(select(MealLog).where(MealLog.log_date == today)).all()
    completed_meal_slots = {log.meal_slot for log in today_meal_logs if log.completed}
    today_meals_status = [
        {
            "slot": slot,
            "label": SLOT_LABELS.get(slot, slot),
            "icon": SLOT_ICONS.get(slot, "plate"),
            "done": slot in completed_meal_slots,
        }
        for slot in ["breakfast", "snack1", "lunch", "snack2", "dinner"]
    ]
    meals_done_count = len(completed_meal_slots)

    daily_quest_keys = {t["key"] for t in BONUS_TASKS if t["frequency"] == "daily"}
    today_bonus_logs = session.exec(select(BonusLog).where(BonusLog.log_date == today)).all()
    quests_done_count = len({log.task_key for log in today_bonus_logs} & daily_quest_keys)
    quests_total_count = len(daily_quest_keys)

    today_hydration_log = session.exec(select(HydrationLog).where(HydrationLog.log_date == today)).first()
    today_hydration_ml = today_hydration_log.ml if today_hydration_log else 0
    hydration_meter_today = build_meter_html(today_hydration_ml, HYDRATION_TARGET_ML, "Water", "ml")

    # ── Confidence & prediction ─────────────────────────────────
    two_weeks_ago = today - timedelta(days=14)
    recent_sessions = session.exec(
        select(Workout).where(
            Workout.log_date >= two_weeks_ago, Workout.workout_type.in_(["gym", "home", "padel"])
        )
    ).all()
    train_adherence = training_adherence_pct(len(recent_sessions))

    meals_completed = session.exec(
        select(MealLog).where(MealLog.log_date >= two_weeks_ago, MealLog.completed == True)  # noqa: E712
    ).all()
    meal_adherence = meal_adherence_pct(len(meals_completed), MEAL_SLOTS_PER_DAY * 14)

    combined_adherence = round((train_adherence + meal_adherence) / 2, 1)
    confidence, confidence_label = confidence_score(actual_rate, target_rate, combined_adherence)
    slack_date = slack_impact_date(predicted_date, missed_weeks=2)
    status_kind, status_icon = CONFIDENCE_STATUS.get(confidence_label, ("warning", "activity"))
    confidence_chip = status_chip_html(status_kind, confidence_label, status_icon)

    # ── Progress-to-goal chart: kg lost so far (ascending as you approach
    # goal), with a dashed band for the amount you need to lose to land
    # inside the goal_weight_low..goal_weight_high range. Plotting raw
    # weight here reads backwards — it trends *down* toward the goal, which
    # looks like regression rather than progress. ─────────────────────
    body_logs = session.exec(select(BodyLog).order_by(BodyLog.log_date)).all()
    if start_weight is not None:
        progress_series = [round(start_weight - log.weight_kg, 2) for log in body_logs]
        goal_band = (
            round(start_weight - profile.goal_weight_high_kg, 2),
            round(start_weight - profile.goal_weight_low_kg, 2),
        )
        weight_chart_svg = build_line_svg(progress_series, reference_band=goal_band, label_suffix=" kg lost")
    else:
        weight_chart_svg = ""

    # ── Avg training RPE, last 14 days (session + per-set) ──────────
    recent_gym_workouts = session.exec(
        select(Workout).where(Workout.log_date >= two_weeks_ago, Workout.workout_type == "gym")
    ).all()
    rpe_pool = []
    for w in recent_gym_workouts:
        set_rpes = session.exec(
            select(WorkoutSet.rpe).where(WorkoutSet.workout_id == w.id, WorkoutSet.rpe.is_not(None))
        ).all()
        rpe_pool.extend(set_rpes)
    for w in recent_sessions:
        if w.session_rpe is not None:
            rpe_pool.append(w.session_rpe)
    avg_rpe = round(sum(rpe_pool) / len(rpe_pool), 1) if rpe_pool else None

    # ── Weekly weight delta ──────────────────────────────────────────
    week_ago_logs = [log for log in body_logs if log.log_date <= today - timedelta(days=7)]
    weekly_weight_delta = (
        round(current_weight - week_ago_logs[-1].weight_kg, 1)
        if current_weight is not None and week_ago_logs
        else None
    )

    adherence_insight = _weekly_adherence_outcome_insight(session, today)

    # ── Points, level & badge ────────────────────────────────────
    sync_system_quests(session, today)
    total_points = session.exec(select(func.sum(BonusLog.points))).first() or 0
    current_badge, next_milestone = badge_progress(total_points)
    level = level_for_points(total_points)
    badge_progress_pct = None
    if next_milestone:
        floor = current_badge[0] if current_badge else 0
        span = next_milestone[0] - floor
        badge_progress_pct = round(((total_points - floor) / span) * 100) if span else 100

    # ── Streak ────────────────────────────────────────────────────
    all_workout_dates = set(session.exec(select(Workout.log_date)).all())
    streak = compute_streak(all_workout_dates, today)

    # ── Streak heatmap (last 35 days, GitHub-contribution style) ────
    heatmap_days = 35
    heatmap_cells = []
    for i in range(heatmap_days - 1, -1, -1):
        d = today - timedelta(days=i)
        level = 4 if d in all_workout_dates else 0
        heatmap_cells.append({"date": d.isoformat(), "level": level, "title": f"{d.isoformat()}{' — trained' if level else ''}"})
    streak_heatmap_html = build_heatmap_html(heatmap_cells)

    # ── This week ────────────────────────────────────────────────
    week_start = get_week_start(today)
    week_workouts = session.exec(
        select(Workout).where(Workout.log_date >= week_start, Workout.log_date < week_start + timedelta(days=7))
    ).all()
    workouts_by_date = {}
    for w in week_workouts:
        workouts_by_date.setdefault(w.log_date, []).append(w)

    day_cards = []
    for i in range(7):
        day_date = week_start + timedelta(days=i)
        day_number = (day_date - PLAN_START_DATE).days + 1
        meal_day = edamam_sync.get_active_day(session, day_number)
        day_cards.append(
            {
                "date": day_date,
                "is_today": day_date == today,
                "weekday": day_date.strftime("%a"),
                "meal_label": meal_day["label"],
                "meal_kcal": meal_day["totals"]["kcal"],
                "workouts": [
                    {
                        "type_label": WORKOUT_TYPE_LABELS.get(w.workout_type, w.workout_type),
                        "icon": WORKOUT_TYPE_ICONS.get(w.workout_type, "activity"),
                        "notes": w.notes,
                    }
                    for w in workouts_by_date.get(day_date, [])
                ],
            }
        )

    today_logged = bool(workouts_by_date.get(today))

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "request": request,
            "logged_in": True,
            "profile": profile,
            "start_weight": start_weight,
            "current_weight": current_weight,
            "goal_mid": goal_mid,
            "goal_progress_pct": goal_progress_pct,
            "actual_rate": actual_rate,
            "target_rate": target_rate,
            "confidence": confidence,
            "confidence_label": confidence_label,
            "predicted_date": predicted_date,
            "slack_date": slack_date,
            "total_points": total_points,
            "level": level,
            "streak": streak,
            "current_badge": current_badge,
            "next_milestone": next_milestone,
            "badge_progress_pct": badge_progress_pct,
            "day_cards": day_cards,
            "today_logged": today_logged,
            "confidence_chip": confidence_chip,
            "weight_chart_svg": weight_chart_svg,
            "streak_heatmap_html": streak_heatmap_html,
            "avg_rpe": avg_rpe,
            "weekly_weight_delta": weekly_weight_delta,
            "meal_adherence": meal_adherence,
            "adherence_insight": adherence_insight,
            "today_meals_status": today_meals_status,
            "meals_done_count": meals_done_count,
            "quests_done_count": quests_done_count,
            "quests_total_count": quests_total_count,
            "hydration_meter_today": hydration_meter_today,
            "pain_pattern_flag": pain_pattern_flag,
        },
    )


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
