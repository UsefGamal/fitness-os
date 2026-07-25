from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from sqlmodel import Session

from auth import require_login
from content.gym_program import next_program_day
from database import get_session
from routers.meals import PLAN_START_DATE
from training_counter import count_training_sessions, deload_due, weeks_since_last_deload

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/training", dependencies=[Depends(require_login)])
def training_hub(request: Request, session: Session = Depends(get_session)):
    next_day = next_program_day(count_training_sessions(session))
    return templates.TemplateResponse(
        "training.html",
        {
            "request": request,
            "logged_in": True,
            "next_day": next_day,
            "deload_due": deload_due(session, PLAN_START_DATE),
            "weeks_since_deload": weeks_since_last_deload(session, PLAN_START_DATE),
        },
    )
