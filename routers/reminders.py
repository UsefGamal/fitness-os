import os
import secrets
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from sqlmodel import Session, func, select

from clock import today as get_today
from content.email_digest import build_daily_digest_html
from content.projections import compute_streak, meal_adherence_pct
from content.weekly_recap_email import build_weekly_recap_html
from database import engine, get_session
from models import BodyLog, BonusLog, MealLog, ReminderLog, Workout
from training_counter import count_training_sessions

router = APIRouter()

CRON_SECRET = os.getenv("CRON_SECRET", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DIGEST_EMAIL_TO = os.getenv("DIGEST_EMAIL_TO", "")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://fitness-os.onrender.com")


def _check_cron_secret(secret_qs: str | None, secret_header: str | None) -> None:
    """Accepts the secret via the `?secret=` query param (the original
    cron-job.org setup) or an `X-Cron-Secret` header (preferred — query
    strings end up in access logs and referrer headers, a header doesn't).
    Both are constant-time compared."""
    provided = secret_header or secret_qs or ""
    if not CRON_SECRET or not secrets.compare_digest(provided, CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid cron secret")


def _send_email(subject: str, html: str) -> None:
    if not RESEND_API_KEY or not DIGEST_EMAIL_TO:
        raise RuntimeError("RESEND_API_KEY or DIGEST_EMAIL_TO not configured")

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": "Fitness OS <onboarding@resend.dev>",
            "to": [DIGEST_EMAIL_TO],
            "subject": subject,
            "html": html,
        },
        timeout=15,
    )
    response.raise_for_status()


def latest_reminder(session: Session, reminder_type: str) -> ReminderLog | None:
    """Most recent attempt of this reminder type, any status — drives the
    /more page's digest-status display."""
    return session.exec(
        select(ReminderLog)
        .where(ReminderLog.reminder_type == reminder_type)
        .order_by(ReminderLog.sent_at.desc())
    ).first()


@router.get("/healthz-warm")
def healthz_warm():
    """Lightweight, no-DB endpoint a keep-alive cron can hit every ~10 min
    to stop the Render free-tier instance from sleeping — so the real
    daily-digest cron doesn't land on a cold start."""
    return {"status": "ok"}


def _run_daily_digest(today: date, training_session_count: int) -> None:
    """Runs after the route has already responded — see sync-job-pattern.
    Own DB session since the request-scoped one used by the route is
    already closed by the time this executes. Building the digest HTML and
    calling Resend can take a few seconds, and on a cold Render instance
    the whole request can take much longer than that — cron-job.org's free
    tier times out a job after 30 seconds and would report a false failure
    (or the connection getting dropped mid-request) if this ran inline in
    the route instead of in the background."""
    with Session(engine) as session:
        try:
            subject, html = build_daily_digest_html(session, today, training_session_count, APP_BASE_URL)
            _send_email(subject, html)
            session.add(ReminderLog(log_date=today, reminder_type="daily_digest", status="sent"))
        except Exception as exc:  # noqa: BLE001 — a background task must never raise unhandled
            session.add(
                ReminderLog(log_date=today, reminder_type="daily_digest", status="error", error_detail=str(exc)[:300])
            )
        session.commit()


@router.get("/cron/daily-digest")
def daily_digest(
    background_tasks: BackgroundTasks,
    secret: str | None = Query(None),
    x_cron_secret: str | None = Header(None),
    force: bool = Query(False),
    session: Session = Depends(get_session),
):
    _check_cron_secret(secret, x_cron_secret)

    today = get_today()

    # Only a *successful* prior attempt counts as "already sent" — an
    # earlier error today doesn't block a later cron ping from retrying,
    # without needing &force=true.
    already_sent = session.exec(
        select(ReminderLog).where(
            ReminderLog.log_date == today, ReminderLog.reminder_type == "daily_digest", ReminderLog.status == "sent"
        )
    ).first()
    if already_sent and not force:
        return {"status": "skipped", "reason": "already sent today — add &force=true to resend"}

    # Gym and Home share one rotation counter (see training_counter.py) —
    # using a gym-only count here would desync the digest's "next up" day
    # from what /gym and /home themselves show once the user alternates
    # between the two.
    training_session_count = count_training_sessions(session)
    background_tasks.add_task(_run_daily_digest, today, training_session_count)
    return {"status": "queued"}


def _run_weekly_recap(today: date) -> None:
    """Background counterpart to _run_daily_digest — same reasoning."""
    with Session(engine) as session:
        try:
            week_start = today - timedelta(days=6)

            week_logs = session.exec(
                select(BodyLog)
                .where(BodyLog.log_date >= week_start, BodyLog.log_date <= today)
                .order_by(BodyLog.log_date)
            ).all()
            weight_change = round(week_logs[-1].weight_kg - week_logs[0].weight_kg, 1) if len(week_logs) >= 2 else None

            meals_completed = len(
                session.exec(
                    select(MealLog).where(
                        MealLog.log_date >= week_start, MealLog.log_date <= today, MealLog.completed == True  # noqa: E712
                    )
                ).all()
            )
            meal_adherence = meal_adherence_pct(meals_completed, 5 * 7)

            training_sessions = len(
                session.exec(select(Workout).where(Workout.log_date >= week_start, Workout.log_date <= today)).all()
            )

            points_earned = (
                session.exec(
                    select(func.sum(BonusLog.points)).where(
                        BonusLog.log_date >= week_start, BonusLog.log_date <= today
                    )
                ).first()
                or 0
            )

            all_workout_dates = set(session.exec(select(Workout.log_date)).all())
            streak = compute_streak(all_workout_dates, today)

            insight = None
            if meal_adherence >= 80:
                insight = "Adherence was excellent this week — this is exactly the kind of week that adds up over a 6-month cut."
            elif meal_adherence < 50:
                insight = "A tougher week on adherence — no need to overcorrect, just aim to hit more meals as planned next week."

            subject, html = build_weekly_recap_html(
                week_start, today, weight_change, meal_adherence, training_sessions, points_earned, streak, insight, APP_BASE_URL
            )
            _send_email(subject, html)
            session.add(ReminderLog(log_date=today, reminder_type="weekly_recap", status="sent"))
        except Exception as exc:  # noqa: BLE001 — a background task must never raise unhandled
            session.add(
                ReminderLog(log_date=today, reminder_type="weekly_recap", status="error", error_detail=str(exc)[:300])
            )
        session.commit()


@router.get("/cron/weekly-recap")
def weekly_recap(
    background_tasks: BackgroundTasks,
    secret: str | None = Query(None),
    x_cron_secret: str | None = Header(None),
    force: bool = Query(False),
    session: Session = Depends(get_session),
):
    _check_cron_secret(secret, x_cron_secret)

    today = get_today()

    already_sent = session.exec(
        select(ReminderLog).where(
            ReminderLog.log_date == today, ReminderLog.reminder_type == "weekly_recap", ReminderLog.status == "sent"
        )
    ).first()
    if already_sent and not force:
        return {"status": "skipped", "reason": "already sent today — add &force=true to resend"}

    background_tasks.add_task(_run_weekly_recap, today)
    return {"status": "queued"}
