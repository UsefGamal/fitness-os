from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from sqlmodel import Session

from auth import require_login
from clock import today as get_today
from content.gym_program import SESSION_TIME, program_day_for, week_view
from database import get_session
from routers.meals import PLAN_START_DATE
from training_counter import deload_due, weeks_since_last_deload

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/training", dependencies=[Depends(require_login)])
def training_hub(request: Request, session: Session = Depends(get_session)):
    today = get_today()
    next_day = program_day_for(today)
    return templates.TemplateResponse(
        request,
        "training.html",
        {
            "request": request,
            "logged_in": True,
            "next_day": next_day,
            "week": week_view(today),
            "session_time": SESSION_TIME,
            "deload_due": deload_due(session, PLAN_START_DATE),
            "weeks_since_deload": weeks_since_last_deload(session, PLAN_START_DATE),
        },
    )
