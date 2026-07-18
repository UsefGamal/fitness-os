from datetime import date

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, func, select

from auth import require_login
from content.bonus_tasks import BONUS_TASKS, BONUS_TASKS_BY_KEY
from content.milestones import badge_progress
from database import get_session
from models import BonusLog

router = APIRouter()
templates = Jinja2Templates(directory="templates")


def _total_points(session: Session) -> int:
    total = session.exec(select(func.sum(BonusLog.points))).first()
    return total or 0


@router.get("/bonus", dependencies=[Depends(require_login)])
def bonus_page(request: Request, session: Session = Depends(get_session)):
    today = date.today()
    today_logs = session.exec(select(BonusLog).where(BonusLog.log_date == today)).all()
    done_keys = {log.task_key for log in today_logs}

    tasks = [
        {**task, "done": task["key"] in done_keys}
        for task in BONUS_TASKS
    ]

    total_points = _total_points(session)
    current_badge, next_milestone = badge_progress(total_points)

    progress_pct = None
    if next_milestone:
        floor = current_badge[0] if current_badge else 0
        span = next_milestone[0] - floor
        progress_pct = round(((total_points - floor) / span) * 100) if span else 100

    return templates.TemplateResponse(
        "bonus.html",
        {
            "request": request,
            "logged_in": True,
            "tasks": tasks,
            "total_points": total_points,
            "current_badge": current_badge,
            "next_milestone": next_milestone,
            "progress_pct": progress_pct,
        },
    )


@router.post("/bonus/toggle", dependencies=[Depends(require_login)])
def toggle_bonus(task_key: str = Form(...), session: Session = Depends(get_session)):
    today = date.today()
    existing = session.exec(
        select(BonusLog).where(BonusLog.log_date == today, BonusLog.task_key == task_key)
    ).first()
    if existing:
        session.delete(existing)
    else:
        task = BONUS_TASKS_BY_KEY.get(task_key)
        if task:
            session.add(BonusLog(log_date=today, task_key=task_key, points=task["points"]))
    session.commit()
    return RedirectResponse(url="/bonus", status_code=303)
