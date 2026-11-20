"""Safer swaps for the safety check (SAFE-2, 19 Nov 2026).

When the safety check says someone is pregnant, or has an injury in one of
the AREAS, the plan's exercises that load that spot are swapped before the
day is shown (mobile/src/lib/safety.js safeDay). Each entry is an exercise
and its replacements in order of preference: the first one that isn't
already in that day is used. An empty list leaves the exercise out.

Pregnancy: nothing flat on the back or belly, no crunches, nothing head
down, steadier balance. Every set also stops 3 reps short of failure
(the beginner_only gate). Injuries: moves that put load or range on the
sore joint go for ones that don't.

Every name must be in content/exercise_targets.py, so muscles and photos
still work (tests/test_safety_swaps.py).
"""

AREAS = ["shoulder", "elbow_wrist", "lower_back", "hip", "knee", "ankle"]

SWAPS = {
    "pregnancy": {
        "Bench Press": ["Incline Dumbbell Press", "30° Incline DB Press"],
        "Dead Bug": ["Pallof Press", "Bear Plank"],
        "TVA": ["Pallof Press", "Bear Plank"],
        "Floor Slides": ["Wall Slide"],
        "Glute Bridge": ["Hip Abduction", "Bodyweight Squat"],
        "Glute Bridge March": ["Hip Abduction", "Bodyweight Squat"],
        "Cable Crunch": ["Pallof Press"],
        "Plank": ["Pallof Press", "Side Plank"],
        "Decline Push-up": ["Push-up"],
        "Pike Push-up": ["Push-up", "Lateral Raise"],
        "Superman Row": ["Face Pull", "Wall Slide"],
        "Reverse Snow Angel": ["Wall Slide", "Face Pull"],
        "Y-Bench": ["Face Pull", "Wall Slide"],
        "45° Hip Extension": ["Romanian Deadlift", "Hip Abduction"],
        "SA Pullover": ["Lat Pulldown", "Seated Cable Row"],
        "Walking Lunge": ["Bodyweight Squat", "Leg Press"],
    },
    "shoulder": {
        "Overhead Press": ["Lateral Raise in Scapula Plane"],
        "Pike Push-up": ["Push-up"],
        "Bench Press": ["DB Chest Press", "Push-up"],
        "Decline Push-up": ["Push-up"],
        "Fly Machine": ["DB Chest Press"],
        "Pull-up": ["Lat Pulldown", "NG Lat Pulldown"],
        "SA Pullover": ["NG Lat Pulldown"],
        "Lateral Raise": ["Lateral Raise in Scapula Plane"],
    },
    "elbow_wrist": {
        "Bench Press": ["DB Chest Press", "Fly Machine"],
        "Preacher Curl Machine": ["Hammer Curl"],
        "Dumbbell Curl": ["Hammer Curl"],
        "1-Arm Overhead Cable Extension": ["Triceps Pushdown"],
        "Cable Cross Triceps Extension": ["Triceps Pushdown"],
        "Pull-up": ["Lat Pulldown"],
        "Bent-over Row": ["Seated Cable Row", "1-Arm Row Machine"],
    },
    "lower_back": {
        "Deadlift": ["Leg Curl", "Seated Leg Curl", "Glute Bridge"],
        "Romanian Deadlift": ["Leg Curl", "Seated Leg Curl", "Glute Bridge"],
        "Single-leg Romanian Deadlift": ["Glute Bridge", "Leg Curl"],
        "Back Squat": ["Leg Press", "Bulgarian Split Squat"],
        "Bent-over Row": ["Seated Cable Row", "1-Arm Row Machine"],
        "Overhead Press": ["Lateral Raise"],
        "Superman Row": ["Wall Slide"],
        "45° Hip Extension": ["Glute Bridge", "Hip Abduction"],
    },
    "hip": {
        "Bulgarian Split Squat": ["Leg Extension", "Leg Press"],
        "Walking Lunge": ["Leg Extension", "Glute Bridge"],
        "Single-leg Romanian Deadlift": ["Leg Curl", "Glute Bridge"],
        "Deadlift": ["Leg Curl", "Seated Leg Curl"],
        "Back Squat": ["Leg Press", "Leg Extension"],
        "Hip Abduction": [],
    },
    "knee": {
        "Back Squat": ["Romanian Deadlift", "Glute Bridge"],
        "Bodyweight Squat": ["Glute Bridge"],
        "Air Squat": ["Glute Bridge"],
        "Bulgarian Split Squat": ["Glute Bridge", "Hip Abduction"],
        "Walking Lunge": ["Glute Bridge", "Hip Abduction"],
        "Leg Press": ["Romanian Deadlift", "Glute Bridge"],
        "Leg Extension": ["Leg Curl", "Seated Leg Curl"],
    },
    "ankle": {
        "Walking Lunge": ["Leg Extension", "Glute Bridge"],
        "Bulgarian Split Squat": ["Leg Extension", "Glute Bridge"],
        "Calf Raise": [],
        "Standing Calf Raise": [],
        "1-Leg Standing Calf Raise": [],
        "Seated Calf Raise": [],
        "Tibia Wall": [],
    },
}
