from collections import Counter
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_sparkline_svg
from database import get_session
from models import Workout

router = APIRouter()
templates = Jinja2Templates(directory="templates")

RESULT_LABELS = {"win": "Win", "loss": "Loss", "draw": "Draw"}
PAIN_PATTERN_LOOKBACK = 5
PAIN_PATTERN_THRESHOLD = 3


@router.get("/padel", dependencies=[Depends(require_login)])
def padel_list(request: Request, edit: Optional[int] = None, session: Session = Depends(get_session)):
    sessions = session.exec(
        select(Workout).where(Workout.workout_type == "padel").order_by(Workout.log_date.desc())
    ).all()
    recent_durations = [s.duration_min for s in reversed(sessions[:12]) if s.duration_min]

    record = Counter(s.result for s in sessions if s.result in RESULT_LABELS)
    record_str = f"{record['win']}W – {record['loss']}L – {record['draw']}D" if record else None

    recent_pain = [s for s in sessions[:PAIN_PATTERN_LOOKBACK] if s.pain_note]
    pain_flag = (
        f"You've noted discomfort in {len(recent_pain)} of your last {min(len(sessions), PAIN_PATTERN_LOOKBACK)} padel sessions — worth mentioning to someone if it keeps up."
        if len(recent_pain) >= PAIN_PATTERN_THRESHOLD
        else None
    )

    edit_workout = None
    if edit:
        edit_workout = next((s for s in sessions if s.id == edit), None)

    return templates.TemplateResponse(
        "padel.html",
        {
            "request": request,
            "logged_in": True,
            "sessions": sessions,
            "today": date.today().isoformat(),
            "duration_svg": build_sparkline_svg(recent_durations) if len(recent_durations) >= 2 else "",
            "record_str": record_str,
            "pain_flag": pain_flag,
            "result_labels": RESULT_LABELS,
            "edit_workout": edit_workout,
        },
    )


@router.post("/padel", dependencies=[Depends(require_login)])
def add_padel_session(
    workout_id: Optional[int] = Form(None),
    log_date: date = Form(...),
    duration_min: Optional[int] = Form(90),
    notes: Optional[str] = Form(None),
    session_rpe: Optional[int] = Form(None),
    result: Optional[str] = Form(None),
    pain_note: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    existing = session.get(Workout, workout_id) if workout_id else None
    if existing and existing.workout_type == "padel":
        existing.log_date = log_date
        existing.duration_min = duration_min
        existing.notes = notes
        existing.session_rpe = session_rpe
        existing.result = result or None
        existing.pain_note = pain_note or None
        session.add(existing)
    else:
        session.add(
            Workout(
                log_date=log_date,
                workout_type="padel",
                duration_min=duration_min,
                notes=notes,
                session_rpe=session_rpe,
                result=result or None,
                pain_note=pain_note or None,
            )
        )
    session.commit()
    return RedirectResponse(url="/padel", status_code=303)


@router.post("/padel/{workout_id}/delete", dependencies=[Depends(require_login)])
def delete_padel_session(workout_id: int, session: Session = Depends(get_session)):
    workout = session.get(Workout, workout_id)
    if not workout or workout.workout_type != "padel":
        raise HTTPException(status_code=404)
    session.delete(workout)
    session.commit()
    return RedirectResponse(url="/padel", status_code=303)
