from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from content.home_program import ALTERNATE_EXERCISES, HOME_MUSCLE_GROUPS, PROGRAM, next_program_day
from database import get_session
from models import ChecklistItemLog, Workout
from routers.meals import PLAN_START_DATE
from training_counter import count_training_sessions, deload_due, weeks_since_last_deload
from validation import require_max_length, require_not_future, require_range

router = APIRouter()
templates = Jinja2Templates(directory="templates")

PROGRAM_LABELS = {day["label"] for day in PROGRAM}

PROGRESSION_NOTE = (
    "No weight to add at home, so progress by reps instead: if a movement "
    "feels easy at the top of the rep range, add a couple more reps next "
    "time, or move to the harder variation noted in the exercise name."
)


@router.get("/home", dependencies=[Depends(require_login)])
def home_list(request: Request, session: Session = Depends(get_session)):
    workouts = session.exec(
        select(Workout).where(Workout.workout_type == "home").order_by(Workout.log_date.desc())
    ).all()
    summaries = []
    for w in workouts:
        item_count = len(
            session.exec(select(ChecklistItemLog).where(ChecklistItemLog.workout_id == w.id)).all()
        )
        summaries.append({"workout": w, "item_count": item_count})

    next_day = next_program_day(count_training_sessions(session))

    return templates.TemplateResponse(
        request,
        "home_list.html",
        {
            "request": request,
            "logged_in": True,
            "summaries": summaries,
            "today": date.today().isoformat(),
            "next_day": next_day,
            "deload_due": deload_due(session, PLAN_START_DATE),
            "weeks_since_deload": weeks_since_last_deload(session, PLAN_START_DATE),
        },
    )


@router.post("/home/new", dependencies=[Depends(require_login)])
def create_home_session(
    log_date: date = Form(...),
    duration_min: int | None = Form(None),
    notes: str | None = Form(None),
    is_deload: bool = Form(False),
    session: Session = Depends(get_session),
):
    require_not_future(log_date, "Date", date.today())
    require_range(duration_min, 1, 600, "Duration")
    require_max_length(notes, 200, "Notes")

    if not notes:
        notes = next_program_day(count_training_sessions(session))["label"]

    workout = Workout(log_date=log_date, workout_type="home", duration_min=duration_min, notes=notes, is_deload=is_deload)
    session.add(workout)
    session.commit()
    session.refresh(workout)
    return RedirectResponse(url=f"/home/{workout.id}", status_code=303)


@router.get("/home/{workout_id}", dependencies=[Depends(require_login)])
def home_detail(workout_id: int, request: Request, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)

    logs = session.exec(
        select(ChecklistItemLog).where(ChecklistItemLog.workout_id == workout_id)
    ).all()
    done_items = {log.item_name for log in logs if log.completed}

    program_checklist = None
    targeted_muscles = []
    if workout.notes in PROGRAM_LABELS:
        program_day = next(d for d in PROGRAM if d["label"] == workout.notes)
        checklist = []
        muscle_set = set()
        for spec in program_day["exercises"]:
            prior = session.exec(
                select(ChecklistItemLog, Workout)
                .join(Workout, ChecklistItemLog.workout_id == Workout.id)
                .where(
                    ChecklistItemLog.item_name == spec["name"],
                    ChecklistItemLog.workout_id != workout_id,
                    ChecklistItemLog.reps_achieved.is_not(None),
                )
                .order_by(Workout.log_date.desc())
            ).first()
            last_performance = None
            if prior:
                log, w = prior
                last_performance = f"{log.reps_achieved} on {w.log_date}"
            muscle_group = HOME_MUSCLE_GROUPS.get(spec["name"])
            if muscle_group:
                muscle_set.add(muscle_group)
            checklist.append(
                {
                    "name": spec["name"],
                    "reps": spec["reps"],
                    "done": spec["name"] in done_items,
                    "last_performance": last_performance,
                    "alternatives": ALTERNATE_EXERCISES.get(spec["name"], []),
                }
            )
        program_checklist = {
            "label": program_day["label"],
            "focus": program_day["focus"],
            "warmup": program_day.get("warmup", []),
            "cooldown": program_day.get("cooldown", []),
            "exercises": checklist,
        }
        targeted_muscles = sorted(muscle_set)

    return templates.TemplateResponse(
        request,
        "home_detail.html",
        {
            "request": request,
            "logged_in": True,
            "workout": workout,
            "program_checklist": program_checklist,
            "progression_note": PROGRESSION_NOTE,
            "targeted_muscles": targeted_muscles,
        },
    )


@router.post("/home/{workout_id}/notes", dependencies=[Depends(require_login)])
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
    return RedirectResponse(url=f"/home/{workout_id}", status_code=303)


@router.post("/home/{workout_id}/delete", dependencies=[Depends(require_login)])
def delete_home_session(workout_id: int, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)
    for log in session.exec(select(ChecklistItemLog).where(ChecklistItemLog.workout_id == workout_id)).all():
        session.delete(log)
    session.delete(workout)
    session.commit()
    return RedirectResponse(url="/home", status_code=303)


@router.post("/home/{workout_id}/log", dependencies=[Depends(require_login)])
def log_item(
    workout_id: int,
    item_name: str = Form(...),
    reps_achieved: int | None = Form(None),
    session: Session = Depends(get_session),
):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)
    require_range(reps_achieved, 0, 500, "Reps achieved")

    existing = session.exec(
        select(ChecklistItemLog).where(
            ChecklistItemLog.workout_id == workout_id, ChecklistItemLog.item_name == item_name
        )
    ).first()
    if existing:
        existing.completed = True
        existing.reps_achieved = reps_achieved
        session.add(existing)
    else:
        session.add(
            ChecklistItemLog(
                workout_id=workout_id, item_name=item_name, completed=True, reps_achieved=reps_achieved
            )
        )
    session.commit()
    return RedirectResponse(url=f"/home/{workout_id}", status_code=303)
