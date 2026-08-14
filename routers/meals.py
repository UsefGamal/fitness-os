from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_heatmap_html, build_meter_html, build_sparkline_svg
from clock import today as get_today
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
from content.meal_plan import DRINK_OPTIONS, MEAL_PLAN_14_DAY, MEAL_SLOTS, PLAN_START_DATE, display_name
from content.meal_plan import get_day as get_static_day
from database import get_session
from edamam_sync import get_active_day, get_active_shopping_products, is_pending_stale, run_sync_in_background
from edamam_sync import latest_sync as latest_edamam_sync
from edamam_sync import start_sync as start_edamam_sync
from fitchef_sync import advance_sync, latest_sync
from fitchef_sync import start_sync as start_fitchef_sync
from macro_targets import get_macro_targets
from models import HydrationLog, MealLog, MealPlanSync, Workout
from validation import require_choice, require_range

router = APIRouter()
templates = Jinja2Templates(directory="templates")

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

# option_c is the static plan's own option A, injected as a third choice
# alongside a synced plan's two options — see _add_static_fallback_option.
OPTION_KEYS = ["option_a", "option_b", "option_c"]


def _day_number_for(d: date) -> int:
    return (d - PLAN_START_DATE).days + 1


def _synced_plan_active(session: Session) -> bool:
    """True when /meals is currently showing a completed Edamam or
    FitChef sync rather than the static plan — mirrors the same
    "does a completed sync exist" check get_active_day()'s fallback
    chain makes internally, using only the public latest_sync() API."""
    edamam_status = latest_edamam_sync(session)
    if edamam_status and edamam_status.status == "complete" and edamam_status.plan_json:
        return True
    fitchef_status = latest_sync(session)
    return bool(fitchef_status and fitchef_status.status == "complete" and fitchef_status.plan_json)


def _add_static_fallback_option(day_number: int, plan: dict) -> None:
    """Appends the static plan's own option A as a third, clearly-labeled
    choice per meal slot — the always-available, no-dependency fallback
    alongside whichever two options the active synced plan produced.
    Caller must only invoke this when a synced plan is actually active
    (see _synced_plan_active) — calling it when the static plan is
    already the active plan would just duplicate option A against
    itself."""
    static_day = get_static_day(day_number)
    static_options_by_slot = {m["slot"]: m["options"][0] for m in static_day["meals"]}
    for meal in plan["meals"]:
        static_option = static_options_by_slot.get(meal["slot"])
        if not static_option:
            continue
        meal["options"].append(
            {
                "key": "option_c",
                "cuisine": "Static Plan",
                "ingredients": static_option["ingredients"],
                "kcal": static_option["kcal"],
                "protein": static_option["protein"],
                "carbs": static_option["carbs"],
                "fat": static_option["fat"],
                "fiber": static_option["fiber"],
            }
        )


def _daily_macro_totals(session: Session, start: date, end: date, synced_plan_active: bool) -> dict:
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
            day_number = _day_number_for(d)
            active_plan = get_active_day(session, day_number)
            if synced_plan_active:
                _add_static_fallback_option(day_number, active_plan)
            plan_by_slot = {m["slot"]: m for m in active_plan["meals"]}
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
def meals_page(request: Request, view_date: str | None = None, session: Session = Depends(get_session)):
    sync = latest_sync(session)
    if sync and sync.status not in ("complete", "error"):
        advance_sync(session, sync)

    current = date.fromisoformat(view_date) if view_date else get_today()
    day_number = _day_number_for(current)
    plan = get_active_day(session, day_number)
    synced_plan_active = _synced_plan_active(session)
    if synced_plan_active:
        _add_static_fallback_option(day_number, plan)
    macro_targets = get_macro_targets(session)

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
        build_meter_html(eaten_totals["protein"], macro_targets["protein"], "Protein", "g"),
        build_meter_html(eaten_totals["carbs"], macro_targets["carbs"], "Carbs", "g"),
        build_meter_html(eaten_totals["fat"], macro_targets["fat"], "Fat", "g"),
        build_meter_html(eaten_totals["fiber"], macro_targets["fiber"], "Fiber", "g"),
    ]
    hydration_meter = build_meter_html(hydration_ml, HYDRATION_TARGET_ML, "Water", "ml")

    today = get_today()
    window_start = today - timedelta(days=ADHERENCE_HEATMAP_DAYS - 1)
    daily_totals = _daily_macro_totals(session, window_start, today, synced_plan_active)
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
            pct_avg = sum(min(100, totals[m] / macro_targets[m] * 100) for m in totals) / 4
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
            "is_today": current == get_today(),
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
    require_choice(option_key, OPTION_KEYS, "Option")
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
def shopping_list_page(request: Request, session: Session = Depends(get_session)):
    today = get_today()

    products = get_active_shopping_products(session)
    if products is not None:
        # A synced plan is active. Edamam's products carry a real
        # "category" (its own foodCategory, e.g. "Poultry") and a
        # pre-formatted "quantity" string (already summed to kg/g — see
        # edamam_sync._build_shopping_list); FitChef's older shape has
        # neither, so both fall back sensibly here: ungrouped items land
        # in one "Shopping List" bucket, and a bare numeric quantity gets
        # a "×" prefix like the static plan's counts do. If the response
        # didn't include any products at all (seen on FitChef's sandbox
        # sample data), categories stays empty and the template shows a
        # plain "no shopping list yet" message — falling back to the
        # *static* plan's shopping list here would be actively
        # misleading, since it wouldn't match the synced meals actually
        # being shown on /meals.
        by_category: dict[str, list[dict]] = defaultdict(list)
        for p in products:
            qty = p.get("quantity", 1)
            qty_display = qty if isinstance(qty, str) else f"×{qty}"
            by_category[p.get("category") or "Shopping List"].append({"name": p.get("name", "?"), "qty": qty_display})

        categories = [
            {
                "name": cat,
                "foods": sorted(items, key=lambda x: x["name"]),
                "color": "var(--accent)",
                "icon": "list",
            }
            for cat, items in sorted(by_category.items())
        ]
        return templates.TemplateResponse(
            request,
            "shopping_list.html",
            {
                "request": request,
                "logged_in": True,
                "categories": categories,
                "start_date": today.isoformat(),
                "end_date": (today + timedelta(days=13)).isoformat(),
            },
        )

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

    static_by_category: dict[str, list[dict]] = {cat: [] for cat in CATEGORY_ORDER}
    for (base, unit), total in totals.items():
        category = base_category.get(base, "Nuts, Sauces & Extras")
        static_by_category[category].append({"name": display_name(base), "qty": format_shopping_qty(total, unit)})

    categories = [
        {
            "name": cat,
            "foods": sorted(items, key=lambda x: x["name"]),
            "color": CATEGORY_COLORS.get(cat, "var(--muted)"),
            "icon": CATEGORY_ICONS.get(cat, "list"),
        }
        for cat, items in static_by_category.items()
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


@router.post("/meals/fitchef-sync", dependencies=[Depends(require_login)])
def trigger_fitchef_sync(session: Session = Depends(get_session)):
    """Kicks off a new 14-day FitChef generation. Only ever queues one at a
    time — a sync already in flight isn't restarted, since that would
    orphan its identifiers and quietly waste part of the monthly quota."""
    existing = latest_sync(session)
    if not existing or existing.status in ("complete", "error"):
        try:
            start_fitchef_sync(session)
        except Exception as exc:
            # Never let a bad/missing credential or a transient FitChef
            # outage 500 the page — show it on /more like any other sync
            # failure instead.
            session.add(MealPlanSync(status="error", error_detail=str(exc)[:300]))
            session.commit()
    return RedirectResponse(url="/more?synced=1", status_code=303)


@router.post("/meals/edamam-sync", dependencies=[Depends(require_login)])
def trigger_edamam_sync(background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    """Edamam's real rate limit needs retries with backoff to reliably
    complete a sync (see edamam_client.py), which can take over a minute —
    too long to block this request/response cycle. start_sync() creates a
    'pending' row and returns immediately; the real work runs in the
    background and /more picks up the result on a later page load, same
    UX pattern as FitChef's async job polling."""
    existing = latest_edamam_sync(session)
    if not existing or existing.status in ("complete", "error") or is_pending_stale(existing):
        sync = start_edamam_sync(session)
        background_tasks.add_task(run_sync_in_background, sync.id)
    return RedirectResponse(url="/more?synced=1", status_code=303)
