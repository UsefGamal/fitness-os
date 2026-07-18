import os
from datetime import date, timedelta

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlmodel import Session, func, select

from auth import APP_PASSWORD, is_logged_in
from baseline import get_baseline
from content.gym_exercises import SEED_EXERCISES
from content.meal_plan import get_day
from content.milestones import badge_progress, level_for_points
from content.projections import (
    compute_streak,
    confidence_score,
    meal_adherence_pct,
    slack_impact_date,
    training_adherence_pct,
)
from database import get_session, init_db
from models import BonusLog, Exercise, MealLog, Profile, Workout
from routers import body, bonus, gym, home, meals, padel, recovery, reminders, settings, simulate
from routers.meals import PLAN_START_DATE

load_dotenv()

app = FastAPI(title="Fitness OS")
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", "dev-secret-change-me"))
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

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


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_profile()
    _seed_exercises()


def _seed_profile():
    from database import engine

    with Session(engine) as session:
        existing = session.exec(select(Profile)).first()
        if not existing:
            session.add(Profile())
            session.commit()


def _seed_exercises():
    from database import engine

    with Session(engine) as session:
        existing_names = set(session.exec(select(Exercise.name)).all())
        added = False
        for muscle_group, name, equipment in SEED_EXERCISES:
            if name not in existing_names:
                session.add(Exercise(name=name, muscle_group=muscle_group, equipment=equipment))
                added = True
        if added:
            session.commit()


@app.get("/login")
def login_form(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "logged_in": False, "error": None})


@app.post("/login")
def login_submit(request: Request, password: str = Form(...)):
    if password == APP_PASSWORD:
        request.session["authed"] = True
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(
        "login.html",
        {"request": request, "logged_in": False, "error": "Wrong password."},
        status_code=401,
    )


@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


@app.get("/more")
def more_page(request: Request):
    if not is_logged_in(request):
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse("more.html", {"request": request, "logged_in": True})


WORKOUT_TYPE_LABELS = {"gym": "Gym", "home": "Home Session", "recovery": "Active Recovery", "padel": "Padel"}
WORKOUT_TYPE_ICONS = {"gym": "🏋️", "home": "🤸", "recovery": "🧘", "padel": "🎾"}
MEAL_SLOTS_PER_DAY = 5


@app.get("/")
def dashboard(request: Request, session: Session = Depends(get_session)):
    if not is_logged_in(request):
        return RedirectResponse(url="/login", status_code=303)

    today = date.today()
    baseline = get_baseline(session, today)
    profile = baseline["profile"]
    current_weight = baseline["current_weight"]
    start_weight = baseline["start_weight"]
    goal_mid = baseline["goal_mid"]
    actual_rate = baseline["actual_rate"]
    target_rate = baseline["target_rate"]
    predicted_date = baseline["baseline_date"]
    days_to_due = (profile.due_date - today).days if profile.due_date else None

    goal_progress_pct = None
    if start_weight is not None and current_weight is not None and start_weight != goal_mid:
        raw = (start_weight - current_weight) / (start_weight - goal_mid) * 100
        goal_progress_pct = round(min(100, max(0, raw)))

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

    # ── Points, level & badge ────────────────────────────────────
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

    # ── This week ────────────────────────────────────────────────
    week_start = today - timedelta(days=today.weekday())
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
        meal_day = get_day(day_number)
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
                        "icon": WORKOUT_TYPE_ICONS.get(w.workout_type, "✅"),
                        "notes": w.notes,
                    }
                    for w in workouts_by_date.get(day_date, [])
                ],
            }
        )

    today_logged = bool(workouts_by_date.get(today))

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "logged_in": True,
            "profile": profile,
            "days_to_due": days_to_due,
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
        },
    )


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
