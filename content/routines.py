# Ready-made routines (E4-S18): plans anyone can switch to from the Plan
# page, in both builds. Each one is written for Fitness OS (Nov 2026) in
# the same shape as content/starter_plan.json, then built into the app's
# session format by gym_program.build_program(). Gym moves must be in
# content/gym_exercises.py; the home routine uses bodyweight moves only.
#
# Coaching rules (coach review, COA-08..10): beginners at RIR 2-3 and
# sessions of about 45 minutes; intermediates at RIR 1-3. Nothing to
# failure.

import json
from pathlib import Path

from content.gym_program import build_program

DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]


def ex(name, sets, reps, rest, group, rir="2-3", note=None, warm_up=False):
    item = {"name": name, "sets": sets, "reps": reps, "rest": rest, "rir": rir, "type": "normal", "group": group}
    if warm_up:
        item.update({"warm_up_sets": "2", "warm_up_reps": "8", "warm_up_rest": "1m", "warm_up_pct": "50-80"})
    if note:
        item["note"] = note
    return item


def body(name, sets, reps, group, rest="45s", note=None):
    """A bodyweight move: reps only, no weight."""
    item = {"name": name, "sets": sets, "reps": reps, "rest": rest, "type": "normal", "group": group, "bodyweight": True}
    if note:
        item["note"] = note
    return item


GYM_WARM_UP = [
    {"name": "Glute Bridge", "sets": 1, "reps": "12", "rest": "20s"},
    {"name": "Dead Bug", "sets": 1, "reps": "8 per side", "rest": "20s"},
    {"name": "Push-up", "sets": 1, "reps": "8", "rest": "30s", "note": "From the knees is fine."},
]
HOME_WARM_UP = [
    {"name": "Jog in place", "sets": 1, "reps": "1 min", "rest": "15s"},
    {"name": "Arm circles", "sets": 1, "reps": "10 each way", "rest": "15s"},
    {"name": "Bodyweight Squat", "sets": 1, "reps": "10", "rest": "20s"},
]


def session(items, warm_up=GYM_WARM_UP, pre="5 min easy walk or bike"):
    return {"pre_cardio": pre, "blocks": [{"phase": "warm_up", "items": warm_up}, {"phase": "rest", "rest": "1m"}, {"phase": "work", "items": items}]}


def week(plan):
    """{'sunday': 'push', ...} -> the 7-day schedule, rest on the others."""
    return [{"day": d, "plan_day": i + 1, "session": plan.get(d, "rest"), "cardio_after": None} for i, d in enumerate(DAYS)]


def routine(rid, name, about, level, place, labels, focus, plan, sessions, rir_note):
    return {
        "id": rid,
        "name": name,
        "about": about,
        "level": level,
        "place": place,
        "days": sum(1 for s in plan.values() if s != "rest"),
        "source": "A general plan written for Fitness OS (2026-11).",
        "week_starts": "sunday",
        "session_time": "07:00",
        "tempo": "2010",
        "tempo_note": "Every exercise: 2 s down, no pause, 1 s up, no pause at the top.",
        "glossary": {
            "RIR": "Reps in reserve: how many more good reps you could have done. " + rir_note,
            "tempo": "Seconds for each part of a rep: down, pause, up, pause.",
        },
        "general_notes": ["Warm up with light weights first.", "Add weight when every set reaches the top of the rep range."],
        "labels": labels,
        "focus": focus,
        "schedule": week(plan),
        "cardio": {},
        "sessions": sessions,
    }


UPPER_LOWER = routine(
    "upper-lower-4", "Upper / lower, 4 days",
    "Upper body and lower body twice a week each. For people who have trained for a few months.",
    "intermediate", "gym",
    {"upper_a": "Upper A", "lower_a": "Lower A", "upper_b": "Upper B", "lower_b": "Lower B"},
    {"upper_a": "Bench press, rows, shoulders, arms", "lower_a": "Squat, hamstrings, calves, core",
     "upper_b": "Incline press, pull-ups, side delts, arms", "lower_b": "Deadlift, leg press, calves, core"},
    {"sunday": "upper_a", "monday": "lower_a", "wednesday": "upper_b", "thursday": "lower_b"},
    {
        "upper_a": session([
            ex("Bench Press", 3, "6-8", "2-3m", "Chest", "1-3", warm_up=True),
            ex("Seated Cable Row", 3, "8-10", "2m", "Back", "1-3"),
            ex("Overhead Press", 2, "8-10", "2m", "Shoulders", "1-3"),
            ex("Lat Pulldown", 2, "10-12", "1.5m", "Back", "1-3"),
            ex("Dumbbell Curl", 2, "10-12", "1m", "Arms", "1-2"),
            ex("Triceps Pushdown", 2, "10-12", "1m", "Arms", "1-2"),
        ]),
        "lower_a": session([
            ex("Back Squat", 3, "6-8", "2-3m", "Legs", "1-3", warm_up=True),
            ex("Romanian Deadlift", 3, "8-10", "2m", "Legs", "1-3"),
            ex("Leg Curl", 2, "10-12", "1.5m", "Legs", "1-2"),
            ex("Standing Calf Raise", 3, "12-15", "1m", "Legs", "1-2"),
            ex("Plank", 2, "30-45s", "45s", "Core"),
        ]),
        "upper_b": session([
            ex("Incline Dumbbell Press", 3, "8-10", "2m", "Chest", "1-3", warm_up=True),
            ex("Pull-up", 3, "6-10", "2m", "Back", "1-3", note="Use the assisted machine or a band if you need to."),
            ex("Bent-over Row", 3, "8-10", "2m", "Back", "1-3"),
            ex("Lateral Raise", 3, "12-15", "1m", "Shoulders", "1-2"),
            ex("Hammer Curl", 2, "10-12", "1m", "Arms", "1-2"),
            ex("1-Arm Overhead Cable Extension", 2, "10-12", "1m", "Arms", "1-2"),
        ]),
        "lower_b": session([
            ex("Deadlift", 3, "5", "3m", "Legs", "2-3", warm_up=True),
            ex("Leg Press", 3, "10-12", "2m", "Legs", "1-3"),
            ex("Leg Extension", 2, "12-15", "1m", "Legs", "1-2"),
            ex("Seated Calf Raise", 3, "12-15", "1m", "Legs", "1-2"),
            ex("Cable Crunch", 2, "12-15", "1m", "Core", "1-2"),
        ]),
    },
    "RIR 1-3 means stop with 1-3 left.",
)

PPL = routine(
    "ppl-3", "Push / pull / legs, 3 days",
    "Pushing muscles, pulling muscles and legs on their own days. Run it twice a week with My week when you want 6 days.",
    "beginner", "gym",
    {"push": "Push", "pull": "Pull", "legs": "Legs"},
    {"push": "Chest, shoulders, triceps", "pull": "Back, rear delts, biceps", "legs": "Quads, hamstrings, glutes, calves"},
    {"sunday": "push", "tuesday": "pull", "thursday": "legs"},
    {
        "push": session([
            ex("Bench Press", 3, "6-8", "2-3m", "Chest", warm_up=True),
            ex("Overhead Press", 3, "8-10", "2m", "Shoulders"),
            ex("Incline Dumbbell Press", 2, "8-12", "1.5m", "Chest"),
            ex("Lateral Raise", 3, "12-15", "1m", "Shoulders"),
            ex("Triceps Pushdown", 3, "10-12", "1m", "Arms"),
        ]),
        "pull": session([
            ex("Lat Pulldown", 3, "8-10", "2m", "Back", warm_up=True),
            ex("Seated Cable Row", 3, "8-12", "2m", "Back"),
            ex("Face Pull", 3, "12-15", "1m", "Shoulders"),
            ex("Dumbbell Curl", 3, "10-12", "1m", "Arms"),
            ex("Hammer Curl", 2, "10-12", "1m", "Arms"),
        ]),
        "legs": session([
            ex("Back Squat", 3, "6-8", "2-3m", "Legs", warm_up=True),
            ex("Romanian Deadlift", 3, "8-10", "2m", "Legs"),
            ex("Leg Press", 2, "10-12", "2m", "Legs"),
            ex("Leg Curl", 2, "10-12", "1.5m", "Legs"),
            ex("Standing Calf Raise", 3, "12-15", "1m", "Legs"),
        ]),
    },
    "RIR 2-3 means stop with 2-3 left.",
)

BODY_PART = routine(
    "body-part-5", "One muscle a day, 5 days",
    "A body-part split: chest, back, legs, shoulders and arms each get their own day.",
    "intermediate", "gym",
    {"chest": "Chest", "back": "Back", "legs": "Legs", "shoulders": "Shoulders", "arms": "Arms"},
    {"chest": "Flat and incline presses, flyes", "back": "Pulldowns, rows, lower back",
     "legs": "Squat, hinge, quads, hamstrings, calves", "shoulders": "Overhead press, side and rear delts, core",
     "arms": "Biceps, triceps, forearms"},
    {"sunday": "chest", "monday": "back", "tuesday": "legs", "thursday": "shoulders", "friday": "arms"},
    {
        "chest": session([
            ex("Bench Press", 4, "6-8", "2-3m", "Chest", "1-3", warm_up=True),
            ex("Incline Dumbbell Press", 3, "8-10", "2m", "Chest", "1-3"),
            ex("Fly Machine", 3, "10-12", "1.5m", "Chest", "1-2"),
            ex("Push-up", 2, "10-15", "1m", "Chest", "1-2"),
        ]),
        "back": session([
            ex("Lat Pulldown", 4, "8-10", "2m", "Back", "1-3", warm_up=True),
            ex("Seated Cable Row", 3, "8-12", "2m", "Back", "1-3"),
            ex("Bent-over Row", 3, "8-10", "2m", "Back", "1-3"),
            ex("45° Hip Extension", 2, "10-12", "1.5m", "Back", "2-3"),
        ]),
        "legs": session([
            ex("Back Squat", 4, "6-8", "2-3m", "Legs", "1-3", warm_up=True),
            ex("Romanian Deadlift", 3, "8-10", "2m", "Legs", "1-3"),
            ex("Leg Extension", 3, "12-15", "1m", "Legs", "1-2"),
            ex("Leg Curl", 3, "10-12", "1m", "Legs", "1-2"),
            ex("Standing Calf Raise", 3, "12-15", "1m", "Legs", "1-2"),
        ]),
        "shoulders": session([
            ex("Overhead Press", 4, "6-8", "2-3m", "Shoulders", "1-3", warm_up=True),
            ex("Lateral Raise", 4, "12-15", "1m", "Shoulders", "1-2"),
            ex("Kneeling Cable Lateral Raise", 2, "12-15", "1m", "Shoulders", "1-2"),
            ex("Face Pull", 3, "12-15", "1m", "Shoulders", "1-2"),
            ex("Cable Crunch", 3, "12-15", "1m", "Core", "1-2"),
        ]),
        "arms": session([
            ex("Dumbbell Curl", 3, "10-12", "1m", "Arms", "1-2", warm_up=True),
            ex("Triceps Pushdown", 3, "10-12", "1m", "Arms", "1-2"),
            ex("Hammer Curl", 3, "10-12", "1m", "Arms", "1-2"),
            ex("1-Arm Overhead Cable Extension", 3, "10-12", "1m", "Arms", "1-2"),
            ex("Preacher Curl Machine", 2, "12-15", "1m", "Arms", "1-2"),
        ]),
    },
    "RIR 1-3 means stop with 1-3 left.",
)

HOME = routine(
    "home-3", "Home, no equipment, 3 days",
    "Full body with your own body weight. No gym and no weights needed.",
    "beginner", "home",
    {"home_a": "Home A", "home_b": "Home B", "home_c": "Home C"},
    {"home_a": "Push-ups, squats, back, core", "home_b": "Lunges, hinge, shoulders, core", "home_c": "Split squats, push-ups, glutes, core"},
    {"sunday": "home_a", "tuesday": "home_b", "thursday": "home_c"},
    {
        "home_a": session([
            body("Push-up", 3, "8-15", "Chest", note="From the knees is fine."),
            body("Bodyweight Squat", 3, "15-20", "Legs"),
            body("Superman Row", 3, "12-15", "Back"),
            body("Glute Bridge", 3, "12-15", "Legs"),
            body("Plank", 2, "30-45s", "Core"),
        ], HOME_WARM_UP, "5 min brisk walk or jog in place"),
        "home_b": session([
            body("Walking Lunge", 3, "10 per leg", "Legs"),
            body("Pike Push-up", 3, "6-10", "Shoulders"),
            body("Single-leg Romanian Deadlift", 3, "8-10 per leg", "Legs"),
            body("Reverse Snow Angel", 3, "12-15", "Back"),
            body("Side Plank", 2, "20-30s per side", "Core"),
        ], HOME_WARM_UP, "5 min brisk walk or jog in place"),
        "home_c": session([
            body("Bulgarian Split Squat", 3, "8-12 per leg", "Legs", note="Back foot on a chair or sofa."),
            body("Decline Push-up", 3, "6-12", "Chest", note="Feet on a chair."),
            body("Glute Bridge March", 3, "10 per side", "Legs"),
            body("Calf Raise", 3, "15-20", "Legs"),
            body("Dead Bug", 2, "8 per side", "Core"),
        ], HOME_WARM_UP, "5 min brisk walk or jog in place"),
    },
    "RIR 2-3 means stop with 2-3 left.",
)

_STARTER = json.loads(Path(__file__).with_name("starter_plan.json").read_text(encoding="utf-8"))
FULL_BODY = {
    **_STARTER,
    "about": "Your whole body three times a week. The best start if you are new to the gym.",
    "level": "beginner",
    "place": "gym",
    "days": sum(1 for d in _STARTER["schedule"] if d["session"] != "rest"),
}

TEMPLATES = [FULL_BODY, UPPER_LOWER, PPL, BODY_PART, HOME]


def _built(plan: dict) -> dict:
    return {
        "id": plan["id"],
        "name": plan["name"],
        "about": plan["about"],
        "level": plan["level"],
        "place": plan["place"],
        "days": plan["days"],
        "schedule": plan["schedule"],
        "program": build_program(plan),
    }


ROUTINES = [_built(p) for p in TEMPLATES]
