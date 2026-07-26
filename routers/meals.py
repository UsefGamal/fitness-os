from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_heatmap_html, build_meter_html, build_sparkline_svg
from content.eating_out_guide import EATING_OUT_TIPS
from content.food_items import (
    CATEGORY_COLORS,
    CATEGORY_ICONS,
    CATEGORY_ORDER,
    FOOD_CATEGORIES,
    format_shopping_qty,
    parse_shopping_unit,
)
from content.maintenance_plan import MAINTENANCE_INTRO, MAINTENANCE_STEPS
from content.meal_plan import DRINK_OPTIONS, MACRO_TARGETS, MEAL_PLAN_14_DAY, MEAL_SLOTS, display_name, get_day
from database import get_session
from models import HydrationLog, MealLog, Workout
from validation import require_choice, require_range

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

MACRO_TREND_DAYS = 14
ADHERENCE_HEATMAP_DAYS = 28

DRINK_LABELS = {key: display_name(key) for key in DRINK_OPTIONS}


def _day_number_for(d: date) -> int:
    return (d - PLAN_START_DATE).days + 1


def _daily_macro_totals(session: Session, start: date, end: date) -> dict:
    """Reconstructs each day's eaten macro totals from MealLog + the meal
    plan content (MealLog itself only stores which option was picked, not
    the macro grams)."""
    logs = session.exec(
        select(MealLog).where(MealLog.log_date >= start, MealLog.log_date <= end, MealLog.completed == True)  # noqa: E712
    ).all()
    logs_by_date = defaultdict(list)
    for log in logs:
        logs_by_date[log.log_date].append(log)

    totals_by_date = {}
    d = start
    while d <= end:
        totals = {"protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
        day_logs = logs_by_date.get(d, [])
        if day_logs:
            plan_by_slot = {m["slot"]: m for m in get_day(_day_number_for(d))["meals"]}
            for log in day_logs:
                meal = plan_by_slot.get(log.meal_slot)
                option = next((o for o in meal["options"] if o["key"] == log.option_key), None) if meal else None
                if option:
                    for macro in totals:
                        totals[macro] += option[macro]
        totals_by_date[d] = totals
        d += timedelta(days=1)
    return totals_by_date


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

    today = date.today()
    window_start = today - timedelta(days=ADHERENCE_HEATMAP_DAYS - 1)
    daily_totals = _daily_macro_totals(session, window_start, today)
    ordered_days = sorted(daily_totals)
    trend_days = ordered_days[-MACRO_TREND_DAYS:]

    macro_trend_svgs = {
        macro: build_sparkline_svg([daily_totals[d][macro] for d in trend_days])
        for macro in ("protein", "carbs", "fat", "fiber")
    }

    heatmap_cells = []
    for d in ordered_days:
        totals = daily_totals[d]
        if not any(totals.values()):
            level, title = 0, f"{d.isoformat()} — no meals logged"
        else:
            pct_avg = sum(min(100, totals[m] / MACRO_TARGETS[m] * 100) for m in totals) / 4
            level, title = min(4, int(pct_avg // 25)), f"{d.isoformat()} — {round(pct_avg)}% of macro targets"
        heatmap_cells.append({"date": d.isoformat(), "level": level, "title": title})
    adherence_heatmap = build_heatmap_html(heatmap_cells)

    return templates.TemplateResponse(
        request,
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
            "macro_trend_svgs": macro_trend_svgs,
            "macro_trend_days": MACRO_TREND_DAYS,
            "adherence_heatmap": adherence_heatmap,
        },
    )


@router.post("/meals/toggle", dependencies=[Depends(require_login)])
def toggle_meal(
    log_date: date = Form(...),
    meal_slot: str = Form(...),
    option_key: str = Form(...),
    session: Session = Depends(get_session),
):
    require_choice(meal_slot, MEAL_SLOTS, "Meal slot")
    require_choice(option_key, ["option_a", "option_b"], "Option")
    d = log_date
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
    log_date: date = Form(...),
    meal_slot: str = Form(...),
    drink_key: str = Form(...),
    session: Session = Depends(get_session),
):
    require_choice(meal_slot, MEAL_SLOTS, "Meal slot")
    require_choice(drink_key, DRINK_OPTIONS, "Drink")
    d = log_date
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
    log_date: date = Form(...),
    ml: int = Form(...),
    session: Session = Depends(get_session),
):
    require_range(ml, -5000, 5000, "Hydration amount")
    d = log_date
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
        request,
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
    totals: dict[tuple, float] = defaultdict(float)
    base_category: dict[str, str] = {}
    for offset in range(7):
        d = today + timedelta(days=offset)
        day = MEAL_PLAN_14_DAY[(_day_number_for(d) - 1) % 14]
        for slot in MEAL_SLOTS:
            for option_key in ("option_a", "option_b"):
                for item in day["meals"][slot][option_key]["items"]:
                    base, qty, unit = parse_shopping_unit(item)
                    totals[(base, unit)] += qty
                    base_category.setdefault(base, FOOD_CATEGORIES.get(item, "Nuts, Sauces & Extras"))

    by_category: dict[str, list[dict]] = {cat: [] for cat in CATEGORY_ORDER}
    for (base, unit), total in totals.items():
        category = base_category.get(base, "Nuts, Sauces & Extras")
        by_category[category].append({"name": display_name(base), "qty": format_shopping_qty(total, unit)})

    categories = [
        {
            "name": cat,
            "foods": sorted(items, key=lambda x: x["name"]),
            "color": CATEGORY_COLORS.get(cat, "var(--muted)"),
            "icon": CATEGORY_ICONS.get(cat, "list"),
        }
        for cat, items in by_category.items()
        if items
    ]

    return templates.TemplateResponse(
        request,
        "shopping_list.html",
        {
            "request": request,
            "logged_in": True,
            "categories": categories,
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=6)).isoformat(),
        },
    )
