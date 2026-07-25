import re
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from content.gym_program import PROGRAM, PROGRESSION_NOTE, next_program_day
from database import get_session
from models import Exercise, Workout, WorkoutSet
from training_counter import count_training_sessions

router = APIRouter()
templates = Jinja2Templates(directory="templates")

PROGRAM_LABELS = {day["label"] for day in PROGRAM}


@router.get("/gym", dependencies=[Depends(require_login)])
def gym_list(request: Request, session: Session = Depends(get_session)):
    workouts = session.exec(
        select(Workout).where(Workout.workout_type == "gym").order_by(Workout.log_date.desc())
    ).all()
    summaries = []
    for w in workouts:
        set_count = len(session.exec(select(WorkoutSet).where(WorkoutSet.workout_id == w.id)).all())
        summaries.append({"workout": w, "set_count": set_count})

    next_day = next_program_day(count_training_sessions(session))

    return templates.TemplateResponse(
        "gym_list.html",
        {
            "request": request,
            "logged_in": True,
            "summaries": summaries,
            "today": date.today().isoformat(),
            "next_day": next_day,
        },
    )


@router.post("/gym/new", dependencies=[Depends(require_login)])
def create_gym_session(
    log_date: date = Form(...),
    duration_min: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    if not notes:
        notes = next_program_day(count_training_sessions(session))["label"]

    workout = Workout(log_date=log_date, workout_type="gym", duration_min=duration_min, notes=notes)
    session.add(workout)
    session.commit()
    session.refresh(workout)
    return RedirectResponse(url=f"/gym/{workout.id}", status_code=303)


def _rep_range_top(reps_str: str) -> Optional[int]:
    match = re.match(r"(\d+)-(\d+)", reps_str)
    if match:
        return int(match.group(2))
    return None


def _suggest_next_weight(exercise: Exercise, last_reps: int, last_weight: float, target_reps: str) -> str:
    top = _rep_range_top(target_reps)
    if top is None:
        return f"same as last time ({last_weight}kg)"
    increment = 5 if exercise.muscle_group == "Legs" else 2.5
    if last_reps >= top:
        return f"try {last_weight + increment}kg (you hit {last_reps} reps last time)"
    return f"repeat {last_weight}kg (aim for {top} reps)"


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
    exercise_by_name = {e.name: e for e in exercises}
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
    last_performance_raw = {}
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
            last_performance_raw[ex.id] = (wset.reps, wset.weight_kg)

    next_set_number = len(sets) + 1

    program_checklist = None
    targeted_muscles = []
    if workout.notes in PROGRAM_LABELS:
        program_day = next(d for d in PROGRAM if d["label"] == workout.notes)
        checklist = []
        muscle_set = set()
        for spec in program_day["exercises"]:
            ex = exercise_by_name.get(spec["name"])
            suggestion = "no prior data yet — pick a comfortable starting weight"
            if ex and ex.id in last_performance_raw:
                last_reps, last_weight = last_performance_raw[ex.id]
                suggestion = _suggest_next_weight(ex, last_reps, last_weight, spec["reps"])
            alternatives = []
            if ex:
                muscle_set.add(ex.muscle_group)
                alternatives = [
                    {"name": other.name, "equipment": other.equipment}
                    for other in exercises
                    if other.muscle_group == ex.muscle_group and other.name != ex.name
                ]
            checklist.append(
                {
                    "name": spec["name"],
                    "sets": spec["sets"],
                    "reps": spec["reps"],
                    "rest": spec["rest"],
                    "suggestion": suggestion,
                    "alternatives": alternatives,
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
        "gym_detail.html",
        {
            "request": request,
            "logged_in": True,
            "workout": workout,
            "exercises": exercises,
            "sets_view": sets_view,
            "last_performance": last_performance,
            "next_set_number": next_set_number,
            "program_checklist": program_checklist,
            "progression_note": PROGRESSION_NOTE,
            "targeted_muscles": targeted_muscles,
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
