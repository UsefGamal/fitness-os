from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_sparkline_svg
from content.cardio_program import ALTERNATIVES, CARDIO_SESSION
from database import get_session
from models import Workout

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/cardio", dependencies=[Depends(require_login)])
def cardio_list(request: Request, session: Session = Depends(get_session)):
    sessions = session.exec(
        select(Workout).where(Workout.workout_type == "cardio").order_by(Workout.log_date.desc())
    ).all()
    recent_durations = [s.duration_min for s in reversed(sessions[:12]) if s.duration_min]
    return templates.TemplateResponse(
        "cardio.html",
        {
            "request": request,
            "logged_in": True,
            "sessions": sessions,
            "today": date.today().isoformat(),
            "cardio_session": CARDIO_SESSION,
            "alternatives": ALTERNATIVES,
            "duration_svg": build_sparkline_svg(recent_durations) if len(recent_durations) >= 2 else "",
        },
    )


@router.post("/cardio", dependencies=[Depends(require_login)])
def add_cardio_session(
    log_date: date = Form(...),
    duration_min: Optional[int] = Form(22),
    notes: Optional[str] = Form(None),
    session_rpe: Optional[int] = Form(None),
    session: Session = Depends(get_session),
):
    session.add(
        Workout(log_date=log_date, workout_type="cardio", duration_min=duration_min, notes=notes, session_rpe=session_rpe)
    )
    session.commit()
    return RedirectResponse(url="/cardio", status_code=303)
