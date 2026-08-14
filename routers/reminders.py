import os
import secrets
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlmodel import Session, func, select

from content.email_digest import build_daily_digest_html
from content.projections import compute_streak, meal_adherence_pct
from content.weekly_recap_email import build_weekly_recap_html
from database import get_session
from models import BodyLog, BonusLog, MealLog, ReminderLog, Workout

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


@router.get("/healthz-warm")
def healthz_warm():
    """Lightweight, no-DB endpoint a keep-alive cron can hit every ~10 min
    to stop the Render free-tier instance from sleeping — so the real
    daily-digest cron doesn't land on a cold start."""
    return {"status": "ok"}


@router.get("/cron/daily-digest")
def daily_digest(
    secret: str | None = Query(None),
    x_cron_secret: str | None = Header(None),
    force: bool = Query(False),
    session: Session = Depends(get_session),
):
    _check_cron_secret(secret, x_cron_secret)

    today = date.today()

    try:
        already_sent = session.exec(
            select(ReminderLog).where(
                ReminderLog.log_date == today, ReminderLog.reminder_type == "daily_digest"
            )
        ).first()
        if already_sent and not force:
            return {"status": "skipped", "reason": "already sent today — add &force=true to resend"}

        gym_session_count = len(
            session.exec(select(Workout).where(Workout.workout_type == "gym")).all()
        )

        subject, html = build_daily_digest_html(session, today, gym_session_count, APP_BASE_URL)
        _send_email(subject, html)

        if not already_sent:
            session.add(ReminderLog(log_date=today, reminder_type="daily_digest"))
            session.commit()

        return {"status": "sent", "forced": force}
    except Exception as exc:
        # Small, structured error body — a bare 500 with no detail is
        # both unhelpful to debug and (per some cron monitors) can be
        # reported in confusing ways. Never let this route's response
        # grow large regardless of what failed.
        return {"status": "error", "detail": str(exc)[:300]}


@router.get("/cron/weekly-recap")
def weekly_recap(
    secret: str | None = Query(None),
    x_cron_secret: str | None = Header(None),
    force: bool = Query(False),
    session: Session = Depends(get_session),
):
    _check_cron_secret(secret, x_cron_secret)

    today = date.today()

    try:
        already_sent = session.exec(
            select(ReminderLog).where(
                ReminderLog.log_date == today, ReminderLog.reminder_type == "weekly_recap"
            )
        ).first()
        if already_sent and not force:
            return {"status": "skipped", "reason": "already sent today — add &force=true to resend"}

        week_start = today - timedelta(days=6)

        week_logs = session.exec(
            select(BodyLog).where(BodyLog.log_date >= week_start, BodyLog.log_date <= today).order_by(BodyLog.log_date)
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
                select(func.sum(BonusLog.points)).where(BonusLog.log_date >= week_start, BonusLog.log_date <= today)
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

        if not already_sent:
            session.add(ReminderLog(log_date=today, reminder_type="weekly_recap"))
            session.commit()

        return {"status": "sent", "forced": force}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)[:300]}
