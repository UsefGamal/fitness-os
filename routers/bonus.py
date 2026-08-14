from datetime import date

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, func, select

from auth import require_login
from clock import today as get_today
from content.bonus_tasks import BONUS_TASKS, BONUS_TASKS_BY_KEY
from content.milestones import badge_progress
from content.projections import week_start as _week_start
from database import get_session
from models import BonusLog
from quest_engine import sync_system_quests
from validation import ValidationError

router = APIRouter()
templates = Jinja2Templates(directory="templates")


def _total_points(session: Session) -> int:
    total = session.exec(select(func.sum(BonusLog.points))).first()
    return total or 0


def _done_keys(session: Session, today: date) -> set[str]:
    """Which task keys currently count as 'done', per their own cadence."""
    week_start = _week_start(today)
    done: set[str] = set()

    daily_keys = {t["key"] for t in BONUS_TASKS if t["frequency"] == "daily"}
    if daily_keys:
        rows = session.exec(
            select(BonusLog.task_key).where(BonusLog.log_date == today, BonusLog.task_key.in_(daily_keys))
        ).all()
        done.update(rows)

    weekly_keys = {t["key"] for t in BONUS_TASKS if t["frequency"] == "weekly"}
    if weekly_keys:
        rows = session.exec(
            select(BonusLog.task_key).where(BonusLog.log_date >= week_start, BonusLog.task_key.in_(weekly_keys))
        ).all()
        done.update(rows)

    once_keys = {t["key"] for t in BONUS_TASKS if t["frequency"] == "once"}
    if once_keys:
        rows = session.exec(select(BonusLog.task_key).where(BonusLog.task_key.in_(once_keys))).all()
        done.update(rows)

    return done


@router.get("/bonus", dependencies=[Depends(require_login)])
def bonus_page(request: Request, session: Session = Depends(get_session)):
    today = get_today()
    sync_system_quests(session, today)
    done_keys = _done_keys(session, today)

    tasks_by_frequency: dict[str, list[dict]] = {"daily": [], "weekly": [], "once": []}
    for task in BONUS_TASKS:
        tasks_by_frequency[task["frequency"]].append({**task, "done": task["key"] in done_keys})

    total_points = _total_points(session)
    current_badge, next_milestone = badge_progress(total_points)

    progress_pct = None
    if next_milestone:
        floor = current_badge[0] if current_badge else 0
        span = next_milestone[0] - floor
        progress_pct = round(((total_points - floor) / span) * 100) if span else 100

    return templates.TemplateResponse(
        request,
        "bonus.html",
        {
            "request": request,
            "logged_in": True,
            "daily_tasks": tasks_by_frequency["daily"],
            "weekly_tasks": tasks_by_frequency["weekly"],
            "once_tasks": tasks_by_frequency["once"],
            "total_points": total_points,
            "current_badge": current_badge,
            "next_milestone": next_milestone,
            "progress_pct": progress_pct,
        },
    )


@router.post("/bonus/toggle", dependencies=[Depends(require_login)])
def toggle_bonus(task_key: str = Form(...), session: Session = Depends(get_session)):
    task = BONUS_TASKS_BY_KEY.get(task_key)
    if not task:
        raise ValidationError("That quest doesn't exist.")
    if task["frequency"] != "daily":
        raise ValidationError("This quest is tracked automatically from your logged activity — nothing to mark by hand.")

    today = get_today()
    existing = session.exec(
        select(BonusLog).where(BonusLog.log_date == today, BonusLog.task_key == task_key)
    ).first()

    if existing:
        session.delete(existing)
    else:
        session.add(BonusLog(log_date=today, task_key=task_key, points=task["points"]))
    session.commit()
    return RedirectResponse(url="/bonus", status_code=303)
