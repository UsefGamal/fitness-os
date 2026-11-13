"""Ready-made routines (E4-S18): every template is a plan the app can run."""

import pytest

from content import gym_exercises, routines
from tests.test_content_contract import GYM_ONLY, GYM_WORDS

SEEDED = {name for _group, name, _kit in gym_exercises.SEED_EXERCISES}
BY_ID = {r["id"]: r for r in routines.ROUTINES}


def test_the_templates():
    assert list(BY_ID) == ["starter-3", "starter-2", "full-body-3", "full-body-2", "upper-lower-4", "ppl-3", "ul-ppl-5", "body-part-5", "home-3"]


@pytest.mark.parametrize("routine", routines.ROUTINES, ids=lambda r: r["id"])
def test_schedule_names_real_sessions(routine):
    keys = {d["key"] for d in routine["program"]}
    on = [e["session"] for e in routine["schedule"] if e["session"] != "rest"]
    assert len(routine["schedule"]) == 7
    assert set(on) == keys, "every session is on the week and every day names a session"
    assert routine["days"] == len(on)


@pytest.mark.parametrize("routine", routines.ROUTINES, ids=lambda r: r["id"])
def test_never_to_failure(routine):
    for day in routine["program"]:
        for ex in day["exercises"]:
            assert ex.get("rir") != "0", (day["key"], ex["name"])
            assert ex["rest_sec"], (day["key"], ex["name"])


@pytest.mark.parametrize("routine", [r for r in routines.ROUTINES if r["place"] == "gym"], ids=lambda r: r["id"])
def test_gym_moves_are_loggable(routine):
    missing = [ex["name"] for day in routine["program"] for ex in day["exercises"] if ex["name"] not in SEEDED]
    assert missing == []


def test_home_routine_needs_no_gym():
    for day in BY_ID["home-3"]["program"]:
        for ex in day["exercises"]:
            assert ex["name"] not in GYM_ONLY, ex["name"]
            assert not any(w in f" {ex['name'].lower()} " for w in GYM_WORDS), ex["name"]
            assert ex.get("bodyweight") is True


def test_body_part_split_has_one_muscle_a_day():
    labels = [d["label"] for d in BY_ID["body-part-5"]["program"]]
    assert labels == ["Chest", "Back", "Legs", "Shoulders", "Arms"]
