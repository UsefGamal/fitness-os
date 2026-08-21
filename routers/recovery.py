from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from clock import today as get_today
from content.recovery_program import RECOVERY_CHECKLIST
from database import get_session
from models import ChecklistItemLog, Workout
from validation import require_max_length, require_not_future, require_range

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/recovery", dependencies=[Depends(require_login)])
def recovery_list(request: Request, session: Session = Depends(get_session)):
    workouts = session.exec(
        select(Workout).where(Workout.workout_type == "recovery").order_by(Workout.log_date.desc())
    ).all()
    return templates.TemplateResponse(
        request,
        "recovery_list.html",
        {"request": request, "logged_in": True, "workouts": workouts, "today": get_today().isoformat()},
    )


@router.post("/recovery/new", dependencies=[Depends(require_login)])
def create_recovery_session(
    log_date: date = Form(...),
    notes: str | None = Form(None),
    session: Session = Depends(get_session),
):
    require_not_future(log_date, "Date", get_today())
    require_max_length(notes, 200, "Notes")
    workout = Workout(log_date=log_date, workout_type="recovery", notes=notes)
    session.add(workout)
    session.commit()
    session.refresh(workout)
    return RedirectResponse(url=f"/recovery/{workout.id}", status_code=303)


@router.get("/recovery/{workout_id}", dependencies=[Depends(require_login)])
def recovery_detail(workout_id: int, request: Request, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)

    logs = session.exec(
        select(ChecklistItemLog).where(ChecklistItemLog.workout_id == workout_id)
    ).all()
    done_items = {log.item_name for log in logs if log.completed}

    checklist = [{"name": item, "done": item in done_items} for item in RECOVERY_CHECKLIST]

    return templates.TemplateResponse(
        request,
        "recovery_detail.html",
        {"request": request, "logged_in": True, "workout": workout, "checklist": checklist},
    )


@router.post("/recovery/{workout_id}/notes", dependencies=[Depends(require_login)])
def update_session_notes(
    workout_id: int,
    session_rpe: int | None = Form(None),
    pain_note: str | None = Form(None),
    session: Session = Depends(get_session),
):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)
    require_range(session_rpe, 1, 10, "Session RPE")
    require_max_length(pain_note, 300, "Pain note")
    workout.session_rpe = session_rpe
    workout.pain_note = pain_note or None
    session.add(workout)
    session.commit()
    return RedirectResponse(url=f"/recovery/{workout_id}", status_code=303)


@router.post("/recovery/{workout_id}/delete", dependencies=[Depends(require_login)])
def delete_recovery_session(workout_id: int, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)
    for log in session.exec(select(ChecklistItemLog).where(ChecklistItemLog.workout_id == workout_id)).all():
        session.delete(log)
    # See the matching comment in routers/gym.py's delete_gym_session — without
    # a relationship() between Workout and ChecklistItemLog, this flush is what
    # forces the child deletes before the parent delete on Postgres.
    session.flush()
    session.delete(workout)
    session.commit()
    return RedirectResponse(url="/recovery", status_code=303)


@router.post("/recovery/{workout_id}/log", dependencies=[Depends(require_login)])
def log_item(
    workout_id: int,
    item_name: str = Form(...),
    session: Session = Depends(get_session),
):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)

    existing = session.exec(
        select(ChecklistItemLog).where(
            ChecklistItemLog.workout_id == workout_id, ChecklistItemLog.item_name == item_name
        )
    ).first()
    if existing:
        existing.completed = True
        session.add(existing)
    else:
        session.add(ChecklistItemLog(workout_id=workout_id, item_name=item_name, completed=True))
    session.commit()
    return RedirectResponse(url=f"/recovery/{workout_id}", status_code=303)
