# Bodyweight-only 4-day Upper/Lower split mirroring content/gym_program.py's
# focus themes, for days you can't get to the gym. Same rotation counter as
# gym sessions (workout_type in ('gym','home')), so the day letter always
# maps to the same movement focus regardless of which you did last.

PROGRAM = [
    {
        "day_letter": "UA",
        "label": "Upper A (Home)",
        "focus": "Horizontal push + pull, bodyweight",
        "exercises": [
            {"name": "Push-up", "reps": "12-20"},
            {"name": "Superman Row", "reps": "12-15"},
            {"name": "Pike Push-up", "reps": "8-12"},
            {"name": "Reverse Snow Angel", "reps": "12-15"},
            {"name": "Plank Shoulder Taps", "reps": "30-40s"},
            {"name": "Diamond Push-up", "reps": "AMRAP"},
        ],
    },
    {
        "day_letter": "LA",
        "label": "Lower A (Home)",
        "focus": "Squat focus, bodyweight",
        "exercises": [
            {"name": "Bodyweight Squat", "reps": "15-20"},
            {"name": "Bulgarian Split Squat", "reps": "10-12/leg"},
            {"name": "Glute Bridge", "reps": "15-20"},
            {"name": "Calf Raise", "reps": "15-20"},
            {"name": "Wall Sit", "reps": "30-45s"},
            {"name": "Bicycle Crunch", "reps": "15-20"},
        ],
    },
    {
        "day_letter": "UB",
        "label": "Upper B (Home)",
        "focus": "Incline push + vertical pull, bodyweight",
        "exercises": [
            {"name": "Decline Push-up", "reps": "10-15"},
            {"name": "Superman Row", "reps": "15-20"},
            {"name": "Pike Push-up", "reps": "8-12"},
            {"name": "Reverse Snow Angel", "reps": "15-20"},
            {"name": "Plank", "reps": "45-60s"},
            {"name": "Diamond Push-up", "reps": "AMRAP"},
        ],
    },
    {
        "day_letter": "LB",
        "label": "Lower B (Home)",
        "focus": "Hinge focus, bodyweight",
        "exercises": [
            {"name": "Single-leg Romanian Deadlift", "reps": "10-12/leg"},
            {"name": "Glute Bridge March", "reps": "12-15/leg"},
            {"name": "Walking Lunge", "reps": "12/leg"},
            {"name": "Calf Raise", "reps": "15-20"},
            {"name": "Side Plank", "reps": "30-45s/side"},
            {"name": "Hollow Body Hold", "reps": "20-30s"},
        ],
    },
]


def next_program_day(completed_gym_and_home_sessions: int) -> dict:
    return PROGRAM[completed_gym_and_home_sessions % len(PROGRAM)]
