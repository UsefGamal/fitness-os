"""Interval moves and the muscles cardio and sport sessions work."""

from content.exercise_photos import EXERCISE_PHOTOS
from content.exercise_targets import EXERCISE_TARGETS
from content.interval_program import INTERVAL_MOVES, PRESET_MOVES, SESSION_MUSCLES

PRESETS = {"hiit", "tabata", "emom", "hiit45"}  # mobile/src/lib/training.js INTERVAL_PRESETS


def test_every_move_has_a_photo_and_muscles():
    for name in INTERVAL_MOVES:
        assert name in EXERCISE_PHOTOS, f"{name}: add a photo to content/exercise_photos.py"
        assert name in EXERCISE_TARGETS, f"{name}: add muscles to content/exercise_targets.py"


def test_presets_use_listed_moves():
    assert set(PRESET_MOVES) == PRESETS
    for key, moves in PRESET_MOVES.items():
        assert moves, key
        assert set(moves) <= set(INTERVAL_MOVES), key


def test_session_muscles_are_well_formed():
    known = {m for main, helpers, _ in EXERCISE_TARGETS.values() for m in main + helpers}
    for words, main, helpers in SESSION_MUSCLES:
        assert words and main, words
        assert all(w == w.lower() for w in words), words
        assert not set(main) & set(helpers), words
        assert set(main + helpers) <= known, words
