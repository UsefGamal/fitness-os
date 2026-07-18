# Beginner 3-day full-body split. Rotates A -> B -> C -> A regardless of
# calendar day, since gym frequency flexes around padel and work schedule.
# Exercise names must match content/gym_exercises.py entries.

PROGRAM = [
    {
        "day_letter": "A",
        "label": "Full Body A",
        "focus": "Squat + push focus",
        "exercises": [
            {"name": "Back Squat", "sets": 3, "reps": "8-10", "rest": "90s"},
            {"name": "Bench Press", "sets": 3, "reps": "8-10", "rest": "90s"},
            {"name": "Seated Cable Row", "sets": 3, "reps": "10-12", "rest": "75s"},
            {"name": "Overhead Press", "sets": 2, "reps": "8-10", "rest": "75s"},
            {"name": "Plank", "sets": 3, "reps": "30-45s hold", "rest": "45s"},
        ],
    },
    {
        "day_letter": "B",
        "label": "Full Body B",
        "focus": "Hinge + pull focus",
        "exercises": [
            {"name": "Romanian Deadlift", "sets": 3, "reps": "8-10", "rest": "90s"},
            {"name": "Lat Pulldown", "sets": 3, "reps": "10-12", "rest": "75s"},
            {"name": "Incline Dumbbell Press", "sets": 3, "reps": "10-12", "rest": "75s"},
            {"name": "Lateral Raise", "sets": 2, "reps": "12-15", "rest": "60s"},
            {"name": "Cable Crunch", "sets": 3, "reps": "12-15", "rest": "45s"},
        ],
    },
    {
        "day_letter": "C",
        "label": "Full Body C",
        "focus": "Leg press + arms focus",
        "exercises": [
            {"name": "Leg Press", "sets": 3, "reps": "10-12", "rest": "90s"},
            {"name": "Bent-over Row", "sets": 3, "reps": "8-10", "rest": "90s"},
            {"name": "Push-up", "sets": 3, "reps": "AMRAP", "rest": "60s"},
            {"name": "Dumbbell Curl", "sets": 2, "reps": "10-12", "rest": "45s"},
            {"name": "Triceps Pushdown", "sets": 2, "reps": "10-12", "rest": "45s"},
        ],
    },
]

PROGRESSION_NOTE = (
    "If you hit the top of the rep range on every set with good form, add "
    "2.5kg for upper-body lifts or 5kg for lower-body lifts next session. "
    "Otherwise repeat the same weight."
)


def next_program_day(completed_gym_sessions: int) -> dict:
    return PROGRAM[completed_gym_sessions % 3]
