"""Safety swaps only name exercises the app knows (SAFE-2)."""

from content.exercise_targets import EXERCISE_TARGETS
from content.safety_swaps import AREAS, SWAPS


def test_limits_are_pregnancy_and_the_areas():
    assert set(SWAPS) == {"pregnancy", *AREAS}


def test_every_name_is_a_known_exercise():
    for limit, table in SWAPS.items():
        for name, options in table.items():
            assert name in EXERCISE_TARGETS, f"{limit}: {name}"
            for o in options:
                assert o in EXERCISE_TARGETS, f"{limit}: {name} -> {o}"
                assert o != name, f"{limit}: {name} swaps to itself"


def test_a_swap_is_not_itself_unsafe_for_the_same_limit():
    for limit, table in SWAPS.items():
        for name, options in table.items():
            for o in options:
                assert o not in table, f"{limit}: {name} -> {o}, which is swapped too"
