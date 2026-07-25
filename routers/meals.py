from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_meter_html
from content.eating_out_guide import EATING_OUT_TIPS
from content.maintenance_plan import MAINTENANCE_INTRO, MAINTENANCE_STEPS
from content.meal_plan import DRINK_OPTIONS, MACRO_TARGETS, MEAL_PLAN_14_DAY, MEAL_SLOTS, display_name, get_day
from database import get_session
from models import HydrationLog, MealLog, Workout

router = APIRouter()
templates = Jinja2Templates(directory="templates")

PLAN_START_DATE = date(2026, 8, 1)  # day 1 of the rotation — real program start date
HYDRATION_TARGET_ML = 3000
HYDRATION_QUICK_ADD = [250, 500, 1000]
TRAINING_WORKOUT_TYPES = ("gym", "home", "cardio")

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

# Meal slots that get the "training today" protein+carb callout.
TRAINING_DAY_SLOTS = ("lunch", "dinner")

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

    trained_today = bool(
        session.exec(
            select(Workout).where(Workout.log_date == current, Workout.workout_type.in_(TRAINING_WORKOUT_TYPES))
        ).first()
    )

    eaten_totals = {"protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    for meal in plan["meals"]:
        log = logs_by_slot.get(meal["slot"])
        meal["label"] = SLOT_LABELS.get(meal["slot"], meal["slot"])
        meal["icon"] = SLOT_ICONS.get(meal["slot"], "plate")
        meal["done"] = bool(log and log.completed)
        selected_option = log.option_key if (log and log.completed) else None
        for option in meal["options"]:
            option["selected"] = option["key"] == selected_option
            if option["selected"]:
                for macro in eaten_totals:
                    eaten_totals[macro] += option[macro]
        meal["drinks"] = [
            {"key": key, "label": DRINK_LABELS[key], "selected": bool(log and log.drink_key == key)}
            for key in DRINK_OPTIONS
        ]
        meal["eating_out_tips"] = EATING_OUT_TIPS.get(SLOT_EATING_OUT_KEY[meal["slot"]], [])
        meal["training_note"] = trained_today and meal["slot"] in TRAINING_DAY_SLOTS

    hydration_log = session.exec(select(HydrationLog).where(HydrationLog.log_date == current)).first()
    hydration_ml = hydration_log.ml if hydration_log else 0

    macro_meters = [
        build_meter_html(eaten_totals["protein"], MACRO_TARGETS["protein"], "Protein", "g"),
        build_meter_html(eaten_totals["carbs"], MACRO_TARGETS["carbs"], "Carbs", "g"),
        build_meter_html(eaten_totals["fat"], MACRO_TARGETS["fat"], "Fat", "g"),
        build_meter_html(eaten_totals["fiber"], MACRO_TARGETS["fiber"], "Fiber", "g"),
    ]
    hydration_meter = build_meter_html(hydration_ml, HYDRATION_TARGET_ML, "Water", "ml")

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
            "hydration_ml": hydration_ml,
            "hydration_target_ml": HYDRATION_TARGET_ML,
            "hydration_meter": hydration_meter,
            "hydration_quick_add": HYDRATION_QUICK_ADD,
            "macro_meters": macro_meters,
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


@router.post("/meals/hydration", dependencies=[Depends(require_login)])
def add_hydration(
    log_date: str = Form(...),
    ml: int = Form(...),
    session: Session = Depends(get_session),
):
    d = date.fromisoformat(log_date)
    existing = session.exec(select(HydrationLog).where(HydrationLog.log_date == d)).first()
    if existing:
        existing.ml = max(0, existing.ml + ml)
        session.add(existing)
    else:
        session.add(HydrationLog(log_date=d, ml=max(0, ml)))
    session.commit()
    return RedirectResponse(url=f"/meals?view_date={log_date}", status_code=303)


@router.get("/meals/maintenance", dependencies=[Depends(require_login)])
def maintenance_page(request: Request):
    return templates.TemplateResponse(
        "maintenance.html",
        {
            "request": request,
            "logged_in": True,
            "intro": MAINTENANCE_INTRO,
            "steps": MAINTENANCE_STEPS,
        },
    )


@router.get("/meals/shopping-list", dependencies=[Depends(require_login)])
def shopping_list_page(request: Request):
    today = date.today()
    counts = Counter()
    for offset in range(7):
        d = today + timedelta(days=offset)
        day = MEAL_PLAN_14_DAY[(_day_number_for(d) - 1) % 14]
        for slot in MEAL_SLOTS:
            for option_key in ("option_a", "option_b"):
                for item in day["meals"][slot][option_key]["items"]:
                    counts[item] += 1

    items = sorted(
        ({"name": display_name(key), "count": count} for key, count in counts.items()),
        key=lambda x: x["name"],
    )

    return templates.TemplateResponse(
        "shopping_list.html",
        {
            "request": request,
            "logged_in": True,
            "items": items,
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=6)).isoformat(),
        },
    )
