# Bodyweight-only 4-day Upper/Lower split mirroring content/gym_program.py's
# focus themes, for days you can't get to the gym. Same rotation counter as
# gym sessions (workout_type in ('gym','home')), so the day letter always
# maps to the same movement focus regardless of which you did last.

PROGRAM = [
    {
        "day_letter": "UA",
        "label": "Upper A (Home)",
        "focus": "Horizontal push + pull, bodyweight",
        "warmup": ["5 min brisk walk or jog in place", "Arm circles x10 each direction", "Light push-ups x8"],
        "cooldown": ["Chest doorway stretch, 30s/side", "Overhead lat stretch, 30s/side"],
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
        "warmup": ["5 min brisk walk or jog in place", "Bodyweight squats x15", "Leg swings x10/leg"],
        "cooldown": ["Quad stretch, 30s/side", "Hamstring stretch, 30s/side"],
        "exercises": [
            {"name": "Bodyweight Squat", "reps": "15-20"},
            {"name": "Bulgarian Split Squat", "reps": "10-12/leg"},
            {"name": "Glute Bridge", "reps": "15-20"},
            {"name": "Calf Raise", "reps": "15-20"},
            {"name": "Wall Sit", "reps": "30-45s"},
            {"name": "Bird Dog", "reps": "10-12/side"},
        ],
    },
    {
        "day_letter": "UB",
        "label": "Upper B (Home)",
        "focus": "Incline push + vertical pull, bodyweight",
        "warmup": ["5 min brisk walk or jog in place", "Arm circles x10 each direction", "Scapular retractions x10"],
        "cooldown": ["Overhead lat stretch, 30s/side", "Overhead triceps stretch, 30s/side"],
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
        "warmup": ["5 min brisk walk or jog in place", "Glute bridges x15", "Leg swings x10/leg"],
        "cooldown": ["Hamstring stretch, 30s/side", "Calf stretch, 30s/side"],
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

# Bodyweight exercises aren't DB-backed like gym Exercise rows, so muscle
# group (for the body map) is a small static lookup too, matching the
# muscle groups the mirrored gym day targets.
HOME_MUSCLE_GROUPS = {
    "Push-up": "Chest",
    "Decline Push-up": "Chest",
    "Superman Row": "Back",
    "Reverse Snow Angel": "Back",
    "Pike Push-up": "Shoulders",
    "Plank Shoulder Taps": "Core",
    "Diamond Push-up": "Arms",
    "Plank": "Core",
    "Bodyweight Squat": "Legs",
    "Bulgarian Split Squat": "Legs",
    "Glute Bridge": "Legs",
    "Calf Raise": "Legs",
    "Wall Sit": "Legs",
    "Bird Dog": "Core",
    "Single-leg Romanian Deadlift": "Legs",
    "Glute Bridge March": "Legs",
    "Walking Lunge": "Legs",
    "Side Plank": "Core",
    "Hollow Body Hold": "Core",
}

# Bodyweight exercises aren't DB-backed like gym Exercise rows, so
# alternatives are a small static lookup instead of a muscle_group query.
ALTERNATE_EXERCISES = {
    "Push-up": ["Incline Push-up (easier)", "Decline Push-up (harder)", "Diamond Push-up (triceps focus)"],
    "Superman Row": ["Reverse Snow Angel", "Plank Shoulder Taps"],
    "Pike Push-up": ["Wall Handstand Hold", "Decline Push-up"],
    "Reverse Snow Angel": ["Superman Row", "Face-pull-style band pull (if a band is available)"],
    "Plank Shoulder Taps": ["Plank", "Side Plank"],
    "Diamond Push-up": ["Push-up", "Decline Push-up"],
    "Decline Push-up": ["Push-up", "Incline Push-up (easier)"],
    "Plank": ["Plank Shoulder Taps", "Hollow Body Hold"],
    "Bodyweight Squat": ["Bulgarian Split Squat", "Wall Sit"],
    "Bulgarian Split Squat": ["Walking Lunge", "Bodyweight Squat"],
    "Glute Bridge": ["Single-leg Romanian Deadlift", "Glute Bridge March"],
    "Calf Raise": ["Single-leg Calf Raise (harder)"],
    "Wall Sit": ["Bodyweight Squat", "Bulgarian Split Squat"],
    "Bird Dog": ["Hollow Body Hold", "Plank Shoulder Taps"],
    "Single-leg Romanian Deadlift": ["Glute Bridge March", "Glute Bridge"],
    "Glute Bridge March": ["Single-leg Romanian Deadlift", "Glute Bridge"],
    "Walking Lunge": ["Bulgarian Split Squat", "Bodyweight Squat"],
    "Side Plank": ["Plank", "Plank Shoulder Taps"],
    "Hollow Body Hold": ["Bicycle Crunch", "Plank"],
}


def next_program_day(completed_gym_and_home_sessions: int) -> dict:
    return PROGRAM[completed_gym_and_home_sessions % len(PROGRAM)]
