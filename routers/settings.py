from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from database import get_session
from models import Profile

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
