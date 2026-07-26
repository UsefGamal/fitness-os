from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from database import get_session
from models import Profile
from validation import ValidationError, require_choice, require_max_length, require_range

router = APIRouter()
templates = Jinja2Templates(directory="templates")

FITNESS_LEVELS = ["beginner", "intermediate", "advanced"]


@router.get("/settings", dependencies=[Depends(require_login)])
def settings_page(request: Request, session: Session = Depends(get_session)):
    profile = session.exec(select(Profile)).first()
    return templates.TemplateResponse(
        "settings.html",
        {
            "request": request,
            "logged_in": True,
            "profile": profile,
            "fitness_levels": FITNESS_LEVELS,
            "saved": request.query_params.get("saved") == "1",
        },
    )


@router.post("/settings", dependencies=[Depends(require_login)])
def update_settings(
    height_cm: float = Form(...),
    date_of_birth: date = Form(...),
    goal_weight_low_kg: float = Form(...),
    goal_weight_high_kg: float = Form(...),
    goal_date: date = Form(...),
    activity_notes: str = Form(""),
    fitness_level: str = Form(...),
    start_weight_kg: Optional[float] = Form(None),
    session: Session = Depends(get_session),
):
    require_range(height_cm, 100, 250, "Height")
    require_range(start_weight_kg, 20, 400, "Starting weight")
    require_range(goal_weight_low_kg, 20, 400, "Goal weight (low)")
    require_range(goal_weight_high_kg, 20, 400, "Goal weight (high)")
    if goal_weight_low_kg > goal_weight_high_kg:
        raise ValidationError("Goal weight (low) can't be higher than goal weight (high).")
    require_choice(fitness_level, FITNESS_LEVELS, "Fitness level")
    require_max_length(activity_notes, 300, "Activity notes")
    today = date.today()
    if date_of_birth >= today:
        raise ValidationError("Date of birth must be in the past.")
    if (today - date_of_birth).days > 130 * 365:
        raise ValidationError("Date of birth doesn't look right.")

    profile = session.exec(select(Profile)).first()
    profile.height_cm = height_cm
    profile.date_of_birth = date_of_birth
    profile.goal_weight_low_kg = goal_weight_low_kg
    profile.goal_weight_high_kg = goal_weight_high_kg
    profile.goal_date = goal_date
    profile.activity_notes = activity_notes
    profile.fitness_level = fitness_level
    profile.start_weight_kg = start_weight_kg
    session.add(profile)
    session.commit()
    return RedirectResponse(url="/settings?saved=1", status_code=303)
