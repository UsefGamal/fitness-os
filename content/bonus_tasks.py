# Quest board: three cadences so it isn't just a daily checklist that
# resets to zero every midnight.
#   "daily"  — the only cadence the user marks by hand (see routers/bonus.py's
#              toggle_bonus). Resets every day, checked against today's rows.
#   "weekly" — resets once per ISO week. System-evaluated by quest_engine.py
#              from real logged activity (including the daily habits above),
#              never toggled directly.
#   "once"   — completed a single time, ever, and then stays done.
#              System-evaluated by quest_engine.py, never toggled directly.
BONUS_TASKS = [
    {"key": "extra_walk", "label": "Extra 20-30 min walk", "points": 10, "icon": "footprints", "frequency": "daily"},
    {"key": "extra_cardio", "label": "Extra padel/cardio session", "points": 15, "icon": "heart-pulse", "frequency": "daily"},
    {"key": "meal_prep", "label": "Meal-prep tomorrow's meals ahead", "points": 10, "icon": "lunchbox", "frequency": "daily"},
    {"key": "mobility", "label": "10 min stretching/mobility", "points": 5, "icon": "activity", "frequency": "daily"},
    {"key": "hydration", "label": "Hit your water goal", "points": 5, "icon": "droplet", "frequency": "daily"},
    {"key": "sleep", "label": "7-8 hours sleep last night", "points": 5, "icon": "moon-stars", "frequency": "daily"},
    {"key": "no_processed", "label": "Zero fast food/processed snacks today", "points": 10, "icon": "salad", "frequency": "daily"},
    {"key": "meal_prep_week", "label": "Meal-prep the whole week ahead", "points": 20, "icon": "lunchbox", "frequency": "weekly"},
    {"key": "three_sessions_week", "label": "3+ training sessions this week", "points": 25, "icon": "dumbbell", "frequency": "weekly"},
    {"key": "no_missed_week", "label": "No missed check-in days this week", "points": 15, "icon": "calendar", "frequency": "weekly"},
    {"key": "first_5kg", "label": "Lose your first 5kg", "points": 50, "icon": "star", "frequency": "once"},
    {"key": "first_deload", "label": "Complete your first deload week", "points": 30, "icon": "snowflake", "frequency": "once"},
]

BONUS_TASKS_BY_KEY = {t["key"]: t for t in BONUS_TASKS}
