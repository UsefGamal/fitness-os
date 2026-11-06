"""Content contracts (E4-S13): rules every plan in content/ keeps, whoever
edits it."""

from content import gym_exercises, home_program

GYM_EQUIPMENT = {"Barbell", "Dumbbell", "Machine", "Cable"}
GYM_ONLY = {name for _group, name, kit in gym_exercises.SEED_EXERCISES if kit in GYM_EQUIPMENT}
GYM_WORDS = ("barbell", "dumbbell", "machine", "cable", " db ", "smith")


def test_no_gym_moves_in_the_home_plan():
    for day in home_program.PROGRAM:
        for ex in day["exercises"]:
            name = ex["name"]
            assert name not in GYM_ONLY, f"{day['label']}: {name} needs gym kit"
            assert not any(w in f" {name.lower()} " for w in GYM_WORDS), f"{day['label']}: {name}"


def test_home_alternates_are_home_moves_too():
    for alts in home_program.ALTERNATE_EXERCISES.values():
        for name in alts:
            base = name.split(" (")[0]
            assert base not in GYM_ONLY, name
            assert not any(w in f" {base.lower()} " for w in GYM_WORDS), name
