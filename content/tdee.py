# FROZEN, NOT AUTHORITATIVE: kept from the retired web app as a reference for
# porting. The phone app's mobile/src/lib/macros.js is the source of truth.
"""Mifflin-St Jeor BMR/TDEE calculation and deficit-based macro targeting.

Replaces the old fixed MACRO_TARGETS constant (a hand-picked "~1900-2050
kcal / 185g protein" band) with numbers actually derived from the user's
stats — and rather than an arbitrary fixed deficit (the usual "500 kcal/
day" advice), the deficit is the pace already implied by the profile's
own goal weight and goal date (see baseline.py's target_rate_kg_per_week)
so the calorie target and the "predicted goal date" projection can never
silently disagree with each other.

Pure functions only — no DB access. See macro_targets.py for the
session-aware version that pulls real profile/body-log data.
"""

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,  # little to no exercise
    "light": 1.375,  # light exercise 1-3 days/week
    "moderate": 1.55,  # moderate exercise 3-5 days/week
    "active": 1.725,  # hard exercise 6-7 days/week
    "very_active": 1.9,  # very hard exercise + physical job
}
ACTIVITY_LEVELS = list(ACTIVITY_MULTIPLIERS)

GENDERS = ["male", "female"]

KCAL_PER_KG_FAT = 7700  # standard approximation used to convert a weekly rate into a daily deficit
MAX_DAILY_DEFICIT = 1000  # capped even if the math implies faster — beyond this isn't sustainable
MIN_DAILY_KCAL = 1200  # never target below this regardless of what the deficit math says

PROTEIN_G_PER_KG = 2.0  # high end of the evidence-based range for a cut — favors muscle retention
FAT_G_PER_KG = 0.8  # floor for hormonal health, independent of how aggressive the deficit is


def bmr_mifflin_st_jeor(weight_kg: float, height_cm: float, age_years: float, gender: str) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age_years
    return base + 5 if gender == "male" else base - 161


def tdee_kcal(bmr: float, activity_level: str) -> float:
    return bmr * ACTIVITY_MULTIPLIERS.get(activity_level, ACTIVITY_MULTIPLIERS["moderate"])


def target_kcal(tdee: float, target_rate_kg_per_week) -> int:
    """target_rate_kg_per_week may be None (no clear goal pace yet, e.g.
    goal weight already matches start weight) — falls back to maintenance."""
    if target_rate_kg_per_week is None or target_rate_kg_per_week <= 0:
        return round(tdee)
    daily_deficit = min(target_rate_kg_per_week * KCAL_PER_KG_FAT / 7, MAX_DAILY_DEFICIT)
    return max(round(tdee - daily_deficit), MIN_DAILY_KCAL)


def macro_split(kcal: int, weight_kg: float) -> dict:
    protein_g = round(weight_kg * PROTEIN_G_PER_KG)
    fat_g = round(weight_kg * FAT_G_PER_KG)
    remaining_kcal = max(kcal - protein_g * 4 - fat_g * 9, 0)
    carbs_g = round(remaining_kcal / 4)
    fiber_g = round(kcal / 1000 * 14)  # ~14g fiber per 1000 kcal, standard general guideline
    return {"protein": protein_g, "carbs": carbs_g, "fat": fat_g, "fiber": fiber_g, "kcal": kcal}
