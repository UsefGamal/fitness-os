from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from sqlmodel import Session

from auth import require_login
from baseline import get_baseline
from database import get_session

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/simulate", dependencies=[Depends(require_login)])
def simulate_page(
    request: Request,
    missed_sessions_per_week: float = 0,
    meal_adherence_pct: float = 100,
    rate_override: Optional[float] = None,
    pause_weeks: float = 0,
    session: Session = Depends(get_session),
):
    baseline = get_baseline(session)
    today = baseline["today"]
    goal_mid = baseline["goal_mid"]
    current_weight = baseline["current_weight"]
    base_rate = baseline["actual_rate"] or baseline["target_rate"] or 0

    if rate_override is not None:
        effective_rate = rate_override
    else:
        reduction_factor = max(0, 1 - missed_sessions_per_week * 0.08)
        effective_rate = base_rate * (meal_adherence_pct / 100) * reduction_factor

    scenario_date = None
    if current_weight is not None and effective_rate and effective_rate > 0:
        remaining = current_weight - goal_mid
        if remaining <= 0:
            scenario_date = today
        else:
            weeks_needed = remaining / effective_rate
            scenario_date = today + timedelta(days=round(pause_weeks * 7 + weeks_needed * 7))

    delta_days = None
    if scenario_date and baseline["baseline_date"]:
        delta_days = (scenario_date - baseline["baseline_date"]).days

    return templates.TemplateResponse(
        "simulate.html",
        {
            "request": request,
            "logged_in": True,
            "has_data": current_weight is not None and base_rate,
            "baseline_date": baseline["baseline_date"],
            "base_rate": round(base_rate, 3) if base_rate else None,
            "effective_rate": round(effective_rate, 3) if effective_rate else 0,
            "scenario_date": scenario_date,
            "delta_days": delta_days,
            "missed_sessions_per_week": missed_sessions_per_week,
            "meal_adherence_pct": meal_adherence_pct,
            "rate_override": rate_override,
            "pause_weeks": pause_weeks,
        },
    )
