from datetime import date, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from content.meal_plan import get_day
from database import get_session
from models import MealLog

router = APIRouter()
templates = Jinja2Templates(directory="templates")

PLAN_START_DATE = date(2026, 8, 1)  # day 1 of the rotation — real program start date

SLOT_LABELS = {
    "breakfast": "Breakfast",
    "snack1": "Morning Snack",
    "lunch": "Lunch",
    "snack2": "Afternoon Snack",
    "dinner": "Dinner",
}

SLOT_ICONS = {
    "breakfast": "🌅",
    "snack1": "🍎",
    "lunch": "🍽️",
    "snack2": "🥜",
    "dinner": "🌙",
}


def _day_number_for(d: date) -> int:
    return (d - PLAN_START_DATE).days + 1


@router.get("/meals", dependencies=[Depends(require_login)])
def meals_page(request: Request, view_date: str = None, session: Session = Depends(get_session)):
    current = date.fromisoformat(view_date) if view_date else date.today()
    day_number = _day_number_for(current)
    plan = get_day(day_number)

    logs = session.exec(select(MealLog).where(MealLog.log_date == current)).all()
    completed_slots = {log.meal_slot for log in logs if log.completed}

    for meal in plan["meals"]:
        meal["label"] = SLOT_LABELS.get(meal["slot"], meal["slot"])
        meal["icon"] = SLOT_ICONS.get(meal["slot"], "🍽️")
        meal["done"] = meal["slot"] in completed_slots

    return templates.TemplateResponse(
        "meals.html",
        {
            "request": request,
            "logged_in": True,
            "plan": plan,
            "current_date": current.isoformat(),
            "prev_date": (current - timedelta(days=1)).isoformat(),
            "next_date": (current + timedelta(days=1)).isoformat(),
            "is_today": current == date.today(),
        },
    )


@router.post("/meals/toggle", dependencies=[Depends(require_login)])
def toggle_meal(
    log_date: str = Form(...),
    meal_slot: str = Form(...),
    session: Session = Depends(get_session),
):
    d = date.fromisoformat(log_date)
    existing = session.exec(
        select(MealLog).where(MealLog.log_date == d, MealLog.meal_slot == meal_slot)
    ).first()
    if existing:
        existing.completed = not existing.completed
        session.add(existing)
    else:
        session.add(MealLog(log_date=d, meal_slot=meal_slot, completed=True))
    session.commit()
    return RedirectResponse(url=f"/meals?view_date={log_date}", status_code=303)
