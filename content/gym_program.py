# Intermediate 4-day Upper/Lower split. Rotates UpperA -> LowerA -> UpperB ->
# LowerB -> repeat, regardless of calendar day, since frequency flexes around
# padel/work. Exercise names must match content/gym_exercises.py entries.

PROGRAM = [
    {
        "day_letter": "UA",
        "label": "Upper A",
        "focus": "Horizontal push + pull",
        "warmup": ["5 min light cardio (bike or brisk walk)", "Band pull-aparts x15", "Arm circles x10 each direction", "Empty-bar or light-dumbbell bench press x10"],
        "cooldown": ["Chest doorway stretch, 30s/side", "Overhead lat stretch, 30s/side", "Cross-body shoulder stretch, 30s/side"],
        "exercises": [
            {"name": "Bench Press", "sets": 4, "reps": "6-8", "rest": "120s"},
            {"name": "Bent-over Row", "sets": 4, "reps": "8-10", "rest": "90s"},
            {"name": "Overhead Press", "sets": 3, "reps": "8-10", "rest": "90s"},
            {"name": "Lat Pulldown", "sets": 3, "reps": "10-12", "rest": "75s"},
            {"name": "Lateral Raise", "sets": 3, "reps": "12-15", "rest": "60s"},
            {"name": "Triceps Pushdown", "sets": 3, "reps": "10-12", "rest": "60s"},
            {"name": "Dumbbell Curl", "sets": 2, "reps": "10-12", "rest": "45s"},
        ],
    },
    {
        "day_letter": "LA",
        "label": "Lower A",
        "focus": "Squat focus",
        "warmup": ["5 min light cardio (bike or brisk walk)", "Bodyweight squats x15", "Walking lunges x10/leg", "Leg swings x10/leg"],
        "cooldown": ["Quad stretch, 30s/side", "Hamstring stretch, 30s/side", "Hip flexor stretch, 30s/side"],
        "exercises": [
            {"name": "Back Squat", "sets": 4, "reps": "6-8", "rest": "120s"},
            {"name": "Romanian Deadlift", "sets": 3, "reps": "8-10", "rest": "90s"},
            {"name": "Leg Press", "sets": 3, "reps": "10-12", "rest": "90s"},
            {"name": "Leg Curl", "sets": 3, "reps": "10-12", "rest": "60s"},
            {"name": "Standing Calf Raise", "sets": 4, "reps": "12-15", "rest": "45s"},
            {"name": "Pallof Press", "sets": 3, "reps": "10-12/side", "rest": "45s"},
        ],
    },
    {
        "day_letter": "UB",
        "label": "Upper B",
        "focus": "Incline push + vertical pull",
        "warmup": ["5 min light cardio (bike or brisk walk)", "Band pull-aparts x15", "Scapular pull-ups or dead hangs x5", "Light push-ups x10"],
        "cooldown": ["Overhead lat stretch, 30s/side", "Overhead triceps stretch, 30s/side", "Chest doorway stretch, 30s/side"],
        "exercises": [
            {"name": "Incline Dumbbell Press", "sets": 4, "reps": "8-10", "rest": "90s"},
            {"name": "Pull-up", "sets": 4, "reps": "6-10", "rest": "90s"},
            {"name": "Seated Cable Row", "sets": 3, "reps": "10-12", "rest": "75s"},
            {"name": "Face Pull", "sets": 3, "reps": "12-15", "rest": "60s"},
            {"name": "Hammer Curl", "sets": 3, "reps": "10-12", "rest": "45s"},
            {"name": "Push-up", "sets": 2, "reps": "AMRAP", "rest": "45s"},
        ],
    },
    {
        "day_letter": "LB",
        "label": "Lower B",
        "focus": "Hinge + deadlift focus",
        "warmup": ["5 min light cardio (bike or brisk walk)", "Glute bridges x15", "Bodyweight Romanian deadlift pattern x10", "Leg swings x10/leg"],
        "cooldown": ["Hamstring stretch, 30s/side", "Calf stretch, 30s/side", "Glute/piriformis stretch, 30s/side"],
        "exercises": [
            {"name": "Deadlift", "sets": 4, "reps": "5-6", "rest": "150s"},
            {"name": "Hip Thrust", "sets": 3, "reps": "8-10", "rest": "90s"},
            {"name": "Leg Press", "sets": 3, "reps": "10-12", "rest": "90s"},
            {"name": "Leg Curl", "sets": 3, "reps": "10-12", "rest": "60s"},
            {"name": "Standing Calf Raise", "sets": 4, "reps": "12-15", "rest": "45s"},
            {"name": "Plank", "sets": 3, "reps": "45-60s hold", "rest": "45s"},
        ],
    },
]

PROGRESSION_NOTE = (
    "If you hit the top of the rep range on every set with good form, add "
    "2.5kg for upper-body lifts or 5kg for lower-body lifts next session. "
    "Otherwise repeat the same weight. On an aggressive cut, fatigue builds "
    "up faster than usual — if lifts stall or feel unusually heavy for "
    "1-2 weeks straight, take a deload: same exercises, about a third fewer "
    "sets, same or slightly lighter weight, for one week."
)


def next_program_day(completed_gym_sessions: int) -> dict:
    return PROGRAM[completed_gym_sessions % len(PROGRAM)]
