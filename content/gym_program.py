# The gym program. Yusuf's build uses his Upper / Lower / Push / Pull / Leg plan,
# on a fixed weekday schedule (Sunday-start week, 7 AM sessions), the way
# openGym plans a routine per weekday. The plan itself lives in
# content/trainer_plan.json, transcribed from the trainer's PDF: exercises,
# warm-ups with their weight ramps, RIR targets ("Pre*"), paired sets, rest,
# tempo, notes and form-video links. JSON so the phone app (phase 3) can read
# the very same file. Exercise names must match content/gym_exercises.py.

import json
import os
import re
from datetime import date, timedelta
from pathlib import Path

# Which plan a build carries (E4-S2). Yusuf's plan came from his trainer's
# PDF and stays in his build only; the friends build (FITNESS_OS_FLAVOR=
# friends) gets the general content/starter_plan.json instead.
FLAVOR = os.environ.get("FITNESS_OS_FLAVOR", "yusuf")
PLAN_FILES = {"yusuf": "trainer_plan.json", "friends": "starter_plan.json"}
if FLAVOR not in PLAN_FILES:
    raise ValueError(f"Unknown FITNESS_OS_FLAVOR {FLAVOR!r}; use one of {sorted(PLAN_FILES)}")
_PLAN_PATH = Path(__file__).with_name(PLAN_FILES[FLAVOR])
TRAINER_PLAN: dict = json.loads(_PLAN_PATH.read_text(encoding="utf-8"))
TRAINER_PLAN.setdefault("id", "ul-ppl")

SESSION_TIME: str = TRAINER_PLAN["session_time"]
TEMPO: str = TRAINER_PLAN["tempo"]
TEMPO_NOTE: str = TRAINER_PLAN["tempo_note"]
GLOSSARY: dict = TRAINER_PLAN["glossary"]

SESSION_LABELS = TRAINER_PLAN.get("labels") or {"upper": "Upper", "lower": "Lower", "push": "Push", "pull": "Pull", "leg": "Leg"}
SESSION_FOCUS = TRAINER_PLAN.get("focus") or {
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


def _build_day(key: str) -> dict:
    session = TRAINER_PLAN["sessions"][key]
    exercises = []
    warmup_items = []
    for block in session["blocks"]:
        if block["phase"] == "work":
            for item in block["items"]:
                exercises.append({**item, "rest_sec": rest_seconds(item.get("rest"))})
        elif block["phase"] == "warm_up":
            warmup_items.extend(block["items"])
    cardio_key = next((d["cardio_after"] for d in TRAINER_PLAN["schedule"] if d["session"] == key), None)
    return {
        "key": key,
        "day_letter": key[0].upper(),
        "label": SESSION_LABELS[key],
        "focus": SESSION_FOCUS[key],
        "warmup": _warmup_lines(session),
        "warmup_items": warmup_items,
        "pre_cardio": session["pre_cardio"],
        "cooldown": (
            [f"{TRAINER_PLAN['cardio'][cardio_key]['minutes']} min cycling. {TRAINER_PLAN['cardio'][cardio_key]['note']}"]
            if cardio_key
            else []
        ),
        "cardio_after": TRAINER_PLAN["cardio"][cardio_key] if cardio_key else None,
        "exercises": exercises,
    }


PROGRAM = [_build_day(key) for key in SESSION_LABELS]
_PROGRAM_BY_KEY = {day["key"]: day for day in PROGRAM}
_SCHEDULE_BY_WEEKDAY = {entry["day"]: entry["session"] for entry in TRAINER_PLAN["schedule"]}

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
                "label": "Rest" if key == "rest" else SESSION_LABELS[key],
                "is_today": d == day,
            }
        )
    return days


def next_program_day(completed_gym_sessions: int) -> dict:
    """Kept for callers that still count sessions; the weekday schedule in
    program_day_for() is the source of truth now."""
    return PROGRAM[completed_gym_sessions % len(PROGRAM)]
