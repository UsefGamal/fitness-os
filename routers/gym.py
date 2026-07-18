from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from database import get_session
from models import Exercise, Workout, WorkoutSet

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/gym", dependencies=[Depends(require_login)])
def gym_list(request: Request, session: Session = Depends(get_session)):
    workouts = session.exec(
        select(Workout).where(Workout.workout_type == "gym").order_by(Workout.log_date.desc())
    ).all()
    summaries = []
    for w in workouts:
        set_count = len(session.exec(select(WorkoutSet).where(WorkoutSet.workout_id == w.id)).all())
        summaries.append({"workout": w, "set_count": set_count})
    return templates.TemplateResponse(
        "gym_list.html",
        {"request": request, "logged_in": True, "summaries": summaries, "today": date.today().isoformat()},
    )


@router.post("/gym/new", dependencies=[Depends(require_login)])
def create_gym_session(
    log_date: date = Form(...),
    duration_min: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    workout = Workout(log_date=log_date, workout_type="gym", duration_min=duration_min, notes=notes)
    session.add(workout)
    session.commit()
    session.refresh(workout)
    return RedirectResponse(url=f"/gym/{workout.id}", status_code=303)


@router.get("/gym/{workout_id}", dependencies=[Depends(require_login)])
def gym_detail(workout_id: int, request: Request, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)

    exercises = session.exec(select(Exercise).order_by(Exercise.muscle_group, Exercise.name)).all()
    sets = session.exec(
        select(WorkoutSet).where(WorkoutSet.workout_id == workout_id).order_by(WorkoutSet.id)
    ).all()

    exercise_by_id = {e.id: e for e in exercises}
    sets_view = [
        {
            "exercise_name": exercise_by_id[s.exercise_id].name if s.exercise_id in exercise_by_id else "?",
            "set_number": s.set_number,
            "reps": s.reps,
            "weight_kg": s.weight_kg,
        }
        for s in sets
    ]

    last_performance = {}
    for ex in exercises:
        prior = session.exec(
            select(WorkoutSet, Workout)
            .join(Workout, WorkoutSet.workout_id == Workout.id)
            .where(WorkoutSet.exercise_id == ex.id, Workout.id != workout_id)
            .order_by(Workout.log_date.desc(), WorkoutSet.set_number.desc())
        ).first()
        if prior:
            wset, w = prior
            last_performance[ex.id] = f"{wset.reps} reps @ {wset.weight_kg}kg on {w.log_date}"

    next_set_number = len(sets) + 1

    return templates.TemplateResponse(
        "gym_detail.html",
        {
            "request": request,
            "logged_in": True,
            "workout": workout,
            "exercises": exercises,
            "sets_view": sets_view,
            "last_performance": last_performance,
            "next_set_number": next_set_number,
        },
    )


@router.post("/gym/{workout_id}/sets", dependencies=[Depends(require_login)])
def add_set(
    workout_id: int,
    exercise_id: int = Form(...),
    reps: int = Form(...),
    weight_kg: float = Form(...),
    session: Session = Depends(get_session),
):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)

    existing_count = len(
        session.exec(select(WorkoutSet).where(WorkoutSet.workout_id == workout_id)).all()
    )
    workout_set = WorkoutSet(
        workout_id=workout_id,
        exercise_id=exercise_id,
        set_number=existing_count + 1,
        reps=reps,
        weight_kg=weight_kg,
    )
    session.add(workout_set)
    session.commit()
    return RedirectResponse(url=f"/gym/{workout_id}", status_code=303)
