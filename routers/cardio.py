from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_sparkline_svg
from content.cardio_program import ALTERNATIVES, CARDIO_SESSION
from database import get_session
from models import Workout
from validation import require_max_length, require_not_future, require_range

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/cardio", dependencies=[Depends(require_login)])
def cardio_list(request: Request, edit: int | None = None, session: Session = Depends(get_session)):
    sessions = session.exec(
        select(Workout).where(Workout.workout_type == "cardio").order_by(Workout.log_date.desc())
    ).all()
    recent_durations = [s.duration_min for s in reversed(sessions[:12]) if s.duration_min]

    edit_workout = None
    if edit:
        edit_workout = next((s for s in sessions if s.id == edit), None)

    return templates.TemplateResponse(
        request,
        "cardio.html",
        {
            "request": request,
            "logged_in": True,
            "sessions": sessions,
            "today": date.today().isoformat(),
            "cardio_session": CARDIO_SESSION,
            "alternatives": ALTERNATIVES,
            "duration_svg": build_sparkline_svg(recent_durations) if len(recent_durations) >= 2 else "",
            "edit_workout": edit_workout,
        },
    )


@router.post("/cardio", dependencies=[Depends(require_login)])
def add_cardio_session(
    workout_id: int | None = Form(None),
    log_date: date = Form(...),
    duration_min: int | None = Form(22),
    notes: str | None = Form(None),
    session_rpe: int | None = Form(None),
    session: Session = Depends(get_session),
):
    require_not_future(log_date, "Date", date.today())
    require_range(duration_min, 1, 600, "Duration")
    require_range(session_rpe, 1, 10, "RPE")
    require_max_length(notes, 300, "Notes")

    existing = session.get(Workout, workout_id) if workout_id else None
    if existing and existing.workout_type == "cardio":
        existing.log_date = log_date
        existing.duration_min = duration_min
        existing.notes = notes
        existing.session_rpe = session_rpe
        session.add(existing)
    else:
        session.add(
            Workout(log_date=log_date, workout_type="cardio", duration_min=duration_min, notes=notes, session_rpe=session_rpe)
        )
    session.commit()
    return RedirectResponse(url="/cardio", status_code=303)


@router.post("/cardio/{workout_id}/delete", dependencies=[Depends(require_login)])
def delete_cardio_session(workout_id: int, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout or workout.workout_type != "cardio":
        raise HTTPException(status_code=404)
    session.delete(workout)
    session.commit()
    return RedirectResponse(url="/cardio", status_code=303)
