"""The trainer's Upper / Lower / Push / Pull / Leg plan: weekday schedule,
rest parsing, and the plan file's shape (content/gym_program.py)."""

from datetime import date

import pytest

from content.gym_exercises import SEED_EXERCISES
from content.gym_program import PROGRAM, program_day_for, rest_seconds, session_key_on, week_view

# 2026-11-01 is a Sunday.
WEEK = [
    (date(2026, 11, 1), "upper"),
    (date(2026, 11, 2), "lower"),
    (date(2026, 11, 3), "rest"),
    (date(2026, 11, 4), "push"),
    (date(2026, 11, 5), "pull"),
    (date(2026, 11, 6), "leg"),
    (date(2026, 11, 7), "rest"),
]


@pytest.mark.parametrize("day,key", WEEK)
def test_sunday_start_schedule(day, key):
    assert session_key_on(day) == key


def test_training_day_is_that_days_session():
    today = program_day_for(date(2026, 11, 4))
    assert today["label"] == "Push"
    assert today["is_rest_today"] is False
    assert today["on_date"] == date(2026, 11, 4)


def test_rest_day_points_at_the_next_session():
    tuesday = program_day_for(date(2026, 11, 3))
    assert tuesday["is_rest_today"] is True
    assert tuesday["label"] == "Push"
    assert tuesday["on_date"] == date(2026, 11, 4)
    saturday = program_day_for(date(2026, 11, 7))
    assert saturday["label"] == "Upper"
    assert saturday["on_date"] == date(2026, 11, 8)


def test_week_view_starts_on_sunday_and_marks_today():
    week = week_view(date(2026, 11, 4))
    assert [d["short"] for d in week] == ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    assert [d["label"] for d in week] == ["Upper", "Lower", "Rest", "Push", "Pull", "Leg", "Rest"]
    assert [d["is_today"] for d in week].index(True) == 3


@pytest.mark.parametrize(
    "text,seconds",
    [("2m", 120), ("1.5-2m", 90), ("30s", 30), ("1.5m per arm", 90), ("45s per arm", 45), ("2-3m", 120), ("", None), (None, None)],
)
def test_rest_seconds(text, seconds):
    assert rest_seconds(text) == seconds


def test_cardio_finisher_only_after_lower_push_pull_leg():
    cardio = {day["key"]: day["cardio_after"] for day in PROGRAM}
    assert cardio["upper"] is None
    assert all(cardio[k]["minutes"] == 10 for k in ("lower", "push", "pull", "leg"))


def test_every_working_exercise_is_loggable():
    """Each working-set exercise must exist in the seeded Exercise table, or
    the gym page can't offer a Log button or a weight suggestion for it."""
    seeded = {name for _, name, _ in SEED_EXERCISES}
    missing = [ex["name"] for day in PROGRAM for ex in day["exercises"] if ex["name"] not in seeded]
    assert missing == []


def test_paired_sets_come_in_pairs():
    for day in PROGRAM:
        pairs: dict[str, int] = {}
        for ex in day["exercises"]:
            if ex.get("type") == "paired":
                pairs[ex["pair"]] = pairs.get(ex["pair"], 0) + 1
        assert all(count == 2 for count in pairs.values()), (day["key"], pairs)
