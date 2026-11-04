import re
from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_bar_svg, build_sparkline_svg
from clock import today as get_today
from content.gym_program import GLOSSARY, PROGRAM, PROGRESSION_NOTE, SESSION_TIME, TEMPO, program_day_for
from database import get_session
from models import Exercise, Workout, WorkoutSet
from routers.meals import PLAN_START_DATE
from training_counter import deload_due, weeks_since_last_deload
from validation import ValidationError, require_max_length, require_not_future, require_range

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

    today = get_today()
    next_day = program_day_for(today)
    today_session = next((s["workout"] for s in summaries if s["workout"].log_date == today), None)

    return templates.TemplateResponse(
        request,
        "gym_list.html",
        {
            "request": request,
            "logged_in": True,
            "summaries": summaries,
            "today": today.isoformat(),
            "today_session": today_session,
            "next_day": next_day,
            "session_time": SESSION_TIME,
            "deload_due": deload_due(session, PLAN_START_DATE),
            "weeks_since_deload": weeks_since_last_deload(session, PLAN_START_DATE),
        },
    )


@router.get("/gym/progress", dependencies=[Depends(require_login)])
def gym_progress(request: Request, session: Session = Depends(get_session)):
    exercises = session.exec(select(Exercise).order_by(Exercise.muscle_group, Exercise.name)).all()

    strength_charts = []
    for ex in exercises:
        rows = session.exec(
            select(Workout.log_date, WorkoutSet.weight_kg)
            .join(WorkoutSet, WorkoutSet.workout_id == Workout.id)
            .where(WorkoutSet.exercise_id == ex.id)
            .order_by(Workout.log_date)
        ).all()
        # Top set (max weight) per session date.
        top_by_date: dict = {}
        for log_date_val, weight in rows:
            top_by_date[log_date_val] = max(top_by_date.get(log_date_val, 0), weight)
        dates = sorted(top_by_date)
        if len(dates) < 2:
            continue
        weights = [top_by_date[d] for d in dates]
        delta = weights[-1] - weights[0]
        strength_charts.append(
            {
                "name": ex.name,
                "muscle_group": ex.muscle_group,
                "current": weights[-1],
                "delta": delta,
                "svg": build_sparkline_svg(weights),
                # Accessibility twin for the sparkline above — see
                # frontend-design's "accessibility twin" convention.
                "rows": list(zip(dates, weights, strict=True)),
            }
        )

    gym_workouts = session.exec(
        select(Workout).where(Workout.workout_type == "gym").order_by(Workout.log_date.desc())
    ).all()[:12]
    gym_workouts = list(reversed(gym_workouts))

    volumes = []
    rpes = []
    for w in gym_workouts:
        sets = session.exec(select(WorkoutSet).where(WorkoutSet.workout_id == w.id)).all()
        volumes.append(sum(s.reps * s.weight_kg for s in sets))
        set_rpes = [s.rpe for s in sets if s.rpe is not None]
        rpes.append(sum(set_rpes) / len(set_rpes) if set_rpes else None)

    volume_svg = build_bar_svg(volumes) if any(volumes) else ""
    # Table twin for volume_svg — same (date, volume) pairs the bar chart
    # plots, including zero-volume sessions so the two never disagree.
    volume_rows = list(zip([w.log_date for w in gym_workouts], volumes, strict=True))
    rpe_values = [r for r in rpes if r is not None]
    rpe_svg = build_sparkline_svg(rpe_values) if len(rpe_values) >= 2 else ""
    # Table twin for rpe_svg — dates re-paired with their non-None RPE,
    # since rpe_values itself (what the sparkline plots) drops the dates.
    rpe_rows = [(w.log_date, r) for w, r in zip(gym_workouts, rpes, strict=True) if r is not None]

    return templates.TemplateResponse(
        request,
        "gym_progress.html",
        {
            "request": request,
            "logged_in": True,
            "strength_charts": strength_charts,
            "volume_svg": volume_svg,
            "volume_rows": volume_rows,
            "session_count": len(gym_workouts),
            "rpe_svg": rpe_svg,
            "rpe_rows": rpe_rows,
            "latest_rpe": rpe_values[-1] if rpe_values else None,
        },
    )


@router.post("/gym/new", dependencies=[Depends(require_login)])
def create_gym_session(
    log_date: date = Form(...),
    duration_min: int | None = Form(None),
    notes: str | None = Form(None),
    is_deload: bool = Form(False),
    session: Session = Depends(get_session),
):
    require_not_future(log_date, "Date", get_today())
    require_range(duration_min, 1, 600, "Duration")
    require_max_length(notes, 200, "Notes")

    if not notes:
        notes = program_day_for(log_date)["label"]

    # Upsert by date — matches body/cardio/padel's own convention (see
    # new-logged-entity skill). Without this, re-submitting "Start a
    # session" for a day that already has one (e.g. re-opening the app
    # mid-workout) silently created a second Workout row for the same day,
    # splitting that day's sets across two sessions instead of one.
    existing = session.exec(
        select(Workout).where(Workout.log_date == log_date, Workout.workout_type == "gym")
    ).first()
    if existing:
        existing.duration_min = duration_min
        existing.notes = notes
        existing.is_deload = is_deload
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return RedirectResponse(url=f"/gym/{existing.id}", status_code=303)

    workout = Workout(log_date=log_date, workout_type="gym", duration_min=duration_min, notes=notes, is_deload=is_deload)
    session.add(workout)
    session.commit()
    session.refresh(workout)
    return RedirectResponse(url=f"/gym/{workout.id}", status_code=303)


def _rep_range_top(reps_str: str) -> int | None:
    match = re.match(r"(\d+)-(\d+)", reps_str)
    if match:
        return int(match.group(2))
    return None


def _suggest_next_weight(
    exercise: Exercise, last_reps: int, last_weight: float, target_reps: str, last_rpe: float | None = None
) -> str:
    top = _rep_range_top(target_reps)
    if top is None:
        return f"same as last time ({last_weight}kg)"
    increment = 5 if exercise.muscle_group == "Legs" else 2.5
    if last_reps >= top:
        if last_rpe is not None and last_rpe >= 9:
            return f"repeat {last_weight}kg (hit {last_reps} reps but RPE {last_rpe:g} was maxed out — hold before adding more)"
        return f"try {last_weight + increment}kg (you hit {last_reps} reps last time)"
    if last_rpe is not None and last_rpe <= 7:
        return f"try {last_weight + increment}kg (missed the rep target but RPE {last_rpe:g} felt easy — push the weight)"
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
            "id": s.id,
            "exercise_id": s.exercise_id,
            "exercise_name": exercise_by_id[s.exercise_id].name if s.exercise_id in exercise_by_id else "?",
            "set_number": s.set_number,
            "reps": s.reps,
            "weight_kg": s.weight_kg,
            "rpe": s.rpe,
        }
        for s in sets
    ]

    session_volume = sum(s.reps * s.weight_kg for s in sets)

    # Most recent set *this session*, per exercise — takes priority over
    # last_performance_raw below for prefill purposes, since "same as the
    # set I just logged 90 seconds ago" is a far more common next action
    # than "same as last session". `sets` is ordered by id ascending, so
    # each iteration below simply overwrites with the latest.
    prefill_raw = {}
    for s in sets:
        prefill_raw[s.exercise_id] = (s.reps, s.weight_kg)

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
            rpe_note = f" @ RPE {wset.rpe:g}" if wset.rpe is not None else ""
            last_performance[ex.id] = f"{wset.reps} reps @ {wset.weight_kg}kg{rpe_note} on {w.log_date}"
            last_performance_raw[ex.id] = (wset.reps, wset.weight_kg, wset.rpe)
            prefill_raw.setdefault(ex.id, (wset.reps, wset.weight_kg))

    next_set_number = len(sets) + 1

    program_checklist = None
    targeted_muscles = []
    rest_seconds_by_exercise: dict[int, int] = {}
    if workout.notes in PROGRAM_LABELS:
        program_day = next(d for d in PROGRAM if d["label"] == workout.notes)
        checklist = []
        muscle_set = set()
        pair_seen: dict[str, int] = {}
        for spec in program_day["exercises"]:
            spec_ex = exercise_by_name.get(spec["name"])
            suggestion = "no prior data yet: pick a weight that leaves the Pre* reps in the tank"
            if spec_ex and spec_ex.id in last_performance_raw:
                last_reps, last_weight, last_rpe = last_performance_raw[spec_ex.id]
                suggestion = _suggest_next_weight(spec_ex, last_reps, last_weight, spec["reps"], last_rpe)
            alternatives = []
            if spec.get("alternative"):
                alternatives.append({"name": spec["alternative"], "equipment": "trainer's backup"})
            if spec_ex:
                muscle_set.add(spec_ex.muscle_group)
                alternatives += [
                    {"name": other.name, "equipment": other.equipment}
                    for other in exercises
                    if other.muscle_group == spec_ex.muscle_group and other.name not in (spec_ex.name, spec.get("alternative"))
                ]
                # Rest timer default per exercise, parsed from the plan's
                # "2m" / "1.5-2m" / "45s per arm" (content/gym_program.py's
                # rest_seconds); exercises outside today's program fall back
                # to a flat default in the template instead of guessing.
                if spec["rest_sec"]:
                    rest_seconds_by_exercise.setdefault(spec_ex.id, spec["rest_sec"])
            pair = spec.get("pair") if spec.get("type") == "paired" else None
            pair_index = None
            if pair:
                pair_index = pair_seen.get(pair, 0) + 1
                pair_seen[pair] = pair_index
            checklist.append(
                {
                    "name": spec["name"],
                    "exercise_id": spec_ex.id if spec_ex else None,
                    "sets": spec["sets"],
                    "reps": spec["reps"],
                    "rest": spec.get("rest", ""),
                    "rir": spec.get("rir"),
                    "pair": f"{pair}{pair_index}" if pair else None,
                    "note": spec.get("note"),
                    "video": spec.get("video"),
                    "video_alt_angle": spec.get("video_alt_angle"),
                    "film_form": spec.get("film_form", False),
                    "warm_up": (
                        {
                            "sets": spec["warm_up_sets"],
                            "reps": spec.get("warm_up_reps", spec["reps"]),
                            "rest": spec.get("warm_up_rest", ""),
                            "pct": spec.get("warm_up_pct"),
                        }
                        if spec.get("warm_up_sets")
                        else None
                    ),
                    "suggestion": suggestion,
                    "alternatives": alternatives,
                }
            )
        program_checklist = {
            "label": program_day["label"],
            "focus": program_day["focus"],
            "pre_cardio": program_day["pre_cardio"],
            "warmup_items": program_day["warmup_items"],
            "cooldown": program_day.get("cooldown", []),
            "exercises": checklist,
        }
        targeted_muscles = sorted(muscle_set)

    return templates.TemplateResponse(
        request,
        "gym_detail.html",
        {
            "request": request,
            "logged_in": True,
            "workout": workout,
            "exercises": exercises,
            "sets_view": sets_view,
            "last_performance": last_performance,
            "prefill_raw": prefill_raw,
            "rest_seconds_by_exercise": rest_seconds_by_exercise,
            "next_set_number": next_set_number,
            "program_checklist": program_checklist,
            "progression_note": PROGRESSION_NOTE,
            "glossary": GLOSSARY,
            "tempo": TEMPO,
            "targeted_muscles": targeted_muscles,
            "session_volume": round(session_volume),
        },
    )


@router.post("/gym/{workout_id}/sets", dependencies=[Depends(require_login)])
def add_set(
    workout_id: int,
    exercise_id: int = Form(...),
    reps: int = Form(...),
    weight_kg: float = Form(...),
    rpe: float | None = Form(None),
    session: Session = Depends(get_session),
):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)

    require_range(reps, 1, 100, "Reps")
    require_range(weight_kg, 0, 500, "Weight")
    require_range(rpe, 1, 10, "RPE")
    if not session.get(Exercise, exercise_id):
        raise ValidationError("That exercise doesn't exist — please pick one from the list.")

    existing_count = len(
        session.exec(select(WorkoutSet).where(WorkoutSet.workout_id == workout_id)).all()
    )
    workout_set = WorkoutSet(
        workout_id=workout_id,
        exercise_id=exercise_id,
        set_number=existing_count + 1,
        reps=reps,
        weight_kg=weight_kg,
        rpe=rpe,
    )
    session.add(workout_set)
    session.commit()
    return RedirectResponse(url=f"/gym/{workout_id}", status_code=303)


@router.post("/gym/{workout_id}/notes", dependencies=[Depends(require_login)])
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
    return RedirectResponse(url=f"/gym/{workout_id}", status_code=303)


@router.post("/gym/{workout_id}/sets/{set_id}/delete", dependencies=[Depends(require_login)])
def delete_set(workout_id: int, set_id: int, session: Session = Depends(get_session)):
    workout_set = session.get(WorkoutSet, set_id)
    if workout_set and workout_set.workout_id == workout_id:
        session.delete(workout_set)
        session.commit()
    return RedirectResponse(url=f"/gym/{workout_id}", status_code=303)


@router.post("/gym/{workout_id}/delete", dependencies=[Depends(require_login)])
def delete_gym_session(workout_id: int, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout:
        raise HTTPException(status_code=404)
    for workout_set in session.exec(select(WorkoutSet).where(WorkoutSet.workout_id == workout_id)).all():
        session.delete(workout_set)
    # Without an ORM relationship() between Workout and WorkoutSet, SQLAlchemy's
    # unit-of-work has no dependency info ordering these two pending deletes —
    # it can emit the workout DELETE before the sets' DELETEs in the same flush,
    # which Postgres rejects (FK violation); SQLite is lenient enough to let it
    # slide, which is how this stayed invisible in local dev. Flushing the child
    # deletes first forces the correct order without needing a relationship.
    session.flush()
    session.delete(workout)
    session.commit()
    return RedirectResponse(url="/gym", status_code=303)
