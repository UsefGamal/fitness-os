"""Session-aware wrapper around content/tdee.py — computes the real,
per-user macro target (replacing the old fixed MACRO_TARGETS constant)
from the profile's actual stats, current weight, and the pace already
needed to hit their goal by goal_date.

Falls back to content.meal_plan's static band whenever there isn't
enough profile data yet (no weight logged/set, or an out-of-range age),
so the app keeps working sensibly before Settings has real numbers in it.
"""

from datetime import date

from sqlmodel import Session

from baseline import get_baseline
from content.meal_plan import MACRO_TARGETS as _STATIC_FALLBACK
from content.tdee import bmr_mifflin_st_jeor, macro_split, target_kcal, tdee_kcal

MIN_AGE_YEARS = 10
MAX_AGE_YEARS = 100


def _static_fallback() -> dict:
    # Normalize to the same shape as macro_split()'s output (adds "kcal",
    # absent from the original 4-key constant) so callers never need to
    # special-case which path produced the dict.
    m = _STATIC_FALLBACK
    kcal = round(m["protein"] * 4 + m["carbs"] * 4 + m["fat"] * 9)
    return {**m, "kcal": kcal}


def get_macro_targets(session: Session, today: date | None = None) -> dict:
    baseline = get_baseline(session, today)
    profile = baseline["profile"]
    weight = baseline["current_weight"] or baseline["start_weight"]
    if weight is None:
        return _static_fallback()

    today = today or date.today()
    age_years = (today - profile.date_of_birth).days / 365.25
    if not (MIN_AGE_YEARS <= age_years <= MAX_AGE_YEARS):
        return _static_fallback()

    bmr = bmr_mifflin_st_jeor(weight, profile.height_cm, age_years, profile.gender)
    tdee = tdee_kcal(bmr, profile.activity_level)
    kcal = target_kcal(tdee, baseline["target_rate"])
    return macro_split(kcal, weight)
