import os
from datetime import date

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from content.email_digest import build_daily_digest_html
from database import get_session
from models import ReminderLog, Workout

router = APIRouter()

CRON_SECRET = os.getenv("CRON_SECRET", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DIGEST_EMAIL_TO = os.getenv("DIGEST_EMAIL_TO", "")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://fitness-os.onrender.com")


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


@router.get("/cron/daily-digest")
def daily_digest(secret: str = Query(...), session: Session = Depends(get_session)):
    if not CRON_SECRET or secret != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    today = date.today()

    already_sent = session.exec(
        select(ReminderLog).where(
            ReminderLog.log_date == today, ReminderLog.reminder_type == "daily_digest"
        )
    ).first()
    if already_sent:
        return {"status": "skipped", "reason": "already sent today"}

    gym_session_count = len(
        session.exec(select(Workout).where(Workout.workout_type == "gym")).all()
    )

    subject, html = build_daily_digest_html(today, gym_session_count, APP_BASE_URL)
    _send_email(subject, html)

    session.add(ReminderLog(log_date=today, reminder_type="daily_digest"))
    session.commit()

    return {"status": "sent"}
