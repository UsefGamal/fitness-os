# The gym program. Every install starts on the general full-body plan in
# content/starter_plan.json, on a fixed weekday schedule (Sunday-start week,
# 7 AM sessions), the way openGym plans a routine per weekday. Other plans,
# including the Upper / Lower / Push / Pull / Leg plan in
# content/trainer_plan.json, are ready-made routines (content/routines.py).
# Plan files hold exercises, warm-ups with their weight ramps, RIR targets
# ("Pre*"), paired sets, rest, tempo, notes and form-video links. JSON so the
# phone app can read the very same file. Exercise names must match
# content/gym_exercises.py.

import json
import re
from datetime import date, timedelta
from pathlib import Path


def load_plan(file_name: str) -> dict:
    """A plan file next to this one (trainer_plan.json shape)."""
    return json.loads(Path(__file__).with_name(file_name).read_text(encoding="utf-8"))


# One app for everyone (Nov 2026): no build-specific plan any more. The
# exported key stays "trainer_plan" so the app and saved data don't change.
DEFAULT_PLAN: dict = load_plan("starter_plan.json")

SESSION_TIME: str = DEFAULT_PLAN["session_time"]
TEMPO: str = DEFAULT_PLAN["tempo"]
TEMPO_NOTE: str = DEFAULT_PLAN["tempo_note"]
GLOSSARY: dict = DEFAULT_PLAN["glossary"]

# Labels and focus for plan files that have none (trainer_plan.json).
SESSION_LABELS = {"upper": "Upper", "lower": "Lower", "push": "Push", "pull": "Pull", "leg": "Leg"}
SESSION_FOCUS = {
    "upper": "Incline press, lat pulldown, lateral raises, arms",
    "lower": "Leg press, quads and hamstrings, glutes, calves, core",
    "push": "Shoulders, incline press, chest, triceps",
    "pull": "Lats, rows, upper back, biceps",
    "leg": "Quads and hamstrings, calves, glutes, core",
}
WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def rest_seconds(rest: str | None) -> int | None:
    """'2m' -> 120, '1.5-2m' -> 90 (the lower bound), '30s' -> 30,
    '1.5m per arm' -> 90. None when there is nothing to parse."""
    if not rest:
        return None
    match = re.match(r"\s*(\d+(?:\.\d+)?)(?:-\d+(?:\.\d+)?)?\s*([ms])", rest)
    if not match:
        return None
    value = float(match.group(1))
    return int(value * 60) if match.group(2) == "m" else int(value)


def _warmup_lines(session: dict) -> list[str]:
    lines = [session["pre_cardio"]]
    for block in session["blocks"]:
        if block["phase"] == "warm_up":
            for item in block["items"]:
                ramp = f" at {item['warm_up_pct']}%" if item.get("warm_up_pct") else ""
                lines.append(f"{item['name']} {item['sets']}x{item['reps']}{ramp}")
    return lines


def _build_day(key: str, plan: dict | None = None) -> dict:
    plan = plan or DEFAULT_PLAN
    session = plan["sessions"][key]
    exercises = []
    warmup_items = []
    for block in session["blocks"]:
        if block["phase"] == "work":
            for item in block["items"]:
                exercises.append({**item, "rest_sec": rest_seconds(item.get("rest"))})
        elif block["phase"] == "warm_up":
            warmup_items.extend(block["items"])
    cardio_key = next((d["cardio_after"] for d in plan["schedule"] if d["session"] == key), None)
    labels = plan.get("labels") or SESSION_LABELS
    focus = plan.get("focus") or SESSION_FOCUS
    return {
        "key": key,
        "day_letter": key[0].upper(),
        "label": labels[key],
        "focus": focus[key],
        "warmup": _warmup_lines(session),
        "warmup_items": warmup_items,
        "pre_cardio": session["pre_cardio"],
        "cooldown": (
            [f"{plan['cardio'][cardio_key]['minutes']} min cycling. {plan['cardio'][cardio_key]['note']}"]
            if cardio_key
            else []
        ),
        "cardio_after": plan["cardio"][cardio_key] if cardio_key else None,
        "exercises": exercises,
    }


def build_program(plan: dict) -> list[dict]:
    """A plan in the trainer_plan.json shape -> the app's session list."""
    return [_build_day(key, plan) for key in (plan.get("labels") or SESSION_LABELS)]


PROGRAM = build_program(DEFAULT_PLAN)
_PROGRAM_BY_KEY = {day["key"]: day for day in PROGRAM}
_SCHEDULE_BY_WEEKDAY = {entry["day"]: entry["session"] for entry in DEFAULT_PLAN["schedule"]}

PROGRESSION_NOTE = (
    "Work in the rep range at the Pre* target: stop with that many reps left "
    "in the tank. When every working set reaches the top of the range at the "
    "target, add weight next time (2.5kg upper body, 5kg lower body). Tempo "
    f"{TEMPO} on everything: {TEMPO_NOTE.lower()}"
)


def session_key_on(day: date) -> str:
    """'upper', 'lower', 'push', 'pull', 'leg' or 'rest' for that date."""
    return _SCHEDULE_BY_WEEKDAY[WEEKDAY_NAMES[day.weekday()]]


def program_day_for(day: date) -> dict:
    """The session planned for `day`. On a rest day: the next planned
    session, with is_rest_today and the date it falls on, so "what's next"
    always has an answer."""
    key = session_key_on(day)
    if key != "rest":
        return {**_PROGRAM_BY_KEY[key], "is_rest_today": False, "on_date": day}
    for offset in range(1, 8):
        later = day + timedelta(days=offset)
        later_key = session_key_on(later)
        if later_key != "rest":
            return {**_PROGRAM_BY_KEY[later_key], "is_rest_today": True, "on_date": later}
    raise ValueError("The schedule has no training day")


def week_view(day: date) -> list[dict]:
    """The Sunday-start week containing `day`, one entry per weekday."""
    start = day - timedelta(days=(day.weekday() + 1) % 7)
    days = []
    for offset in range(7):
        d = start + timedelta(days=offset)
        key = session_key_on(d)
        days.append(
            {
                "date": d,
                "short": WEEKDAY_NAMES[d.weekday()][:3].title(),
                "key": key,
                "label": "Rest" if key == "rest" else _PROGRAM_BY_KEY[key]["label"],
                "is_today": d == day,
            }
        )
    return days


def next_program_day(completed_gym_sessions: int) -> dict:
    """Kept for callers that still count sessions; the weekday schedule in
    program_day_for() is the source of truth now."""
    return PROGRAM[completed_gym_sessions % len(PROGRAM)]
