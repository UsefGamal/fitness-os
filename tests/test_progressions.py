"""Easier/harder ladders and the fitness test: rules the content keeps."""

import pytest

from content import fitness_test, progressions
from scripts import export_content
from tests.test_content_contract import GYM_ONLY, GYM_WORDS

STEP_NAMES = [s["name"] for ladder in progressions.LADDERS for s in ladder["steps"]]


def test_ladder_keys_are_unique():
    keys = [ladder["key"] for ladder in progressions.LADDERS]
    assert len(keys) == len(set(keys))


def test_a_move_is_on_one_ladder_only():
    # The exercise page finds "the" ladder for a name, so a name on two
    # ladders would be ambiguous.
    lowered = [n.lower() for n in STEP_NAMES]
    assert len(lowered) == len(set(lowered))


@pytest.mark.parametrize("ladder", progressions.LADDERS, ids=lambda x: x["key"])
def test_each_ladder(ladder):
    assert len(ladder["steps"]) >= 3, "an easier and a harder step around the middle one"
    assert ladder["unit"] in ("reps", "seconds")
    assert ladder["move_up"].startswith("Move up when")
    for step in ladder["steps"]:
        assert step["name"] and step["cue"].endswith(".")
        assert len(step["cue"]) <= 100, step["name"]


def test_ladders_need_no_gym():
    for name in STEP_NAMES:
        assert name not in GYM_ONLY, name
        assert not any(w in f" {name.lower()} " for w in GYM_WORDS), name


def test_ladders_reach_the_home_moves():
    # The moves friends meet first in the home plan have somewhere to go.
    for name in ["Push-up", "Pike Push-up", "Superman Row", "Bodyweight Squat", "Glute Bridge", "Plank"]:
        assert name in STEP_NAMES, name


@pytest.mark.parametrize("item", fitness_test.ITEMS, ids=lambda x: x["key"])
def test_fitness_test_items(item):
    ladder = progressions.LADDERS_BY_KEY[item["ladder"]]
    on_ladder = {s["name"] for s in ladder["steps"]}
    assert item["moves"] and set(item["moves"]) <= on_ladder, "test moves come from their ladder"
    assert item["unit"] == ladder["unit"]
    assert item["max"] > 0
    timer = item.get("timer")
    if timer:
        assert timer["kind"] in ("countdown", "stopwatch")
        assert timer["kind"] != "countdown" or timer["seconds"] > 0


def test_fitness_test_keys_and_cadence():
    keys = [i["key"] for i in fitness_test.ITEMS]
    assert len(keys) == len(set(keys))
    assert 14 <= fitness_test.EVERY_DAYS <= 56


def test_exported():
    training = export_content.build_content()["training"]
    assert [x["key"] for x in training["progressions"]] == [x["key"] for x in progressions.LADDERS]
    assert training["fitness_test"]["every_days"] == fitness_test.EVERY_DAYS
    assert [i["key"] for i in training["fitness_test"]["items"]] == [i["key"] for i in fitness_test.ITEMS]
