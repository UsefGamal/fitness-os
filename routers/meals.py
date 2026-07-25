from datetime import date, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from content.eating_out_guide import EATING_OUT_TIPS
from content.meal_plan import DRINK_OPTIONS, display_name, get_day
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
    "breakfast": "sunrise",
    "snack1": "apple",
    "lunch": "plate",
    "snack2": "nut",
    "dinner": "moon",
}

# Which eating-out tip bucket each slot pulls from.
SLOT_EATING_OUT_KEY = {
    "breakfast": "breakfast",
    "snack1": "snack",
    "lunch": "lunch",
    "snack2": "snack",
    "dinner": "dinner",
}

DRINK_LABELS = {key: display_name(key) for key in DRINK_OPTIONS}


def _day_number_for(d: date) -> int:
    return (d - PLAN_START_DATE).days + 1


@router.get("/meals", dependencies=[Depends(require_login)])
def meals_page(request: Request, view_date: str = None, session: Session = Depends(get_session)):
    current = date.fromisoformat(view_date) if view_date else date.today()
    day_number = _day_number_for(current)
    plan = get_day(day_number)

    logs = session.exec(select(MealLog).where(MealLog.log_date == current)).all()
    logs_by_slot = {log.meal_slot: log for log in logs}

    for meal in plan["meals"]:
        log = logs_by_slot.get(meal["slot"])
        meal["label"] = SLOT_LABELS.get(meal["slot"], meal["slot"])
        meal["icon"] = SLOT_ICONS.get(meal["slot"], "plate")
        meal["done"] = bool(log and log.completed)
        selected_option = log.option_key if (log and log.completed) else None
        for option in meal["options"]:
            option["selected"] = option["key"] == selected_option
        meal["drinks"] = [
            {"key": key, "label": DRINK_LABELS[key], "selected": bool(log and log.drink_key == key)}
            for key in DRINK_OPTIONS
        ]
        meal["eating_out_tips"] = EATING_OUT_TIPS.get(SLOT_EATING_OUT_KEY[meal["slot"]], [])

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
            "eating_out_general": EATING_OUT_TIPS["general"],
        },
    )


@router.post("/meals/toggle", dependencies=[Depends(require_login)])
def toggle_meal(
    log_date: str = Form(...),
    meal_slot: str = Form(...),
    option_key: str = Form(...),
    session: Session = Depends(get_session),
):
    d = date.fromisoformat(log_date)
    existing = session.exec(
        select(MealLog).where(MealLog.log_date == d, MealLog.meal_slot == meal_slot)
    ).first()
    if existing:
        if existing.completed and existing.option_key == option_key:
            existing.completed = False
        else:
            existing.completed = True
            existing.option_key = option_key
        session.add(existing)
    else:
        session.add(MealLog(log_date=d, meal_slot=meal_slot, completed=True, option_key=option_key))
    session.commit()
    return RedirectResponse(url=f"/meals?view_date={log_date}", status_code=303)


@router.post("/meals/drink", dependencies=[Depends(require_login)])
def set_drink(
    log_date: str = Form(...),
    meal_slot: str = Form(...),
    drink_key: str = Form(...),
    session: Session = Depends(get_session),
):
    d = date.fromisoformat(log_date)
    existing = session.exec(
        select(MealLog).where(MealLog.log_date == d, MealLog.meal_slot == meal_slot)
    ).first()
    if existing:
        existing.drink_key = None if existing.drink_key == drink_key else drink_key
        session.add(existing)
    else:
        session.add(MealLog(log_date=d, meal_slot=meal_slot, completed=False, drink_key=drink_key))
    session.commit()
    return RedirectResponse(url=f"/meals?view_date={log_date}", status_code=303)
