"""Hand-checked muscles and angle for every exercise in the plans (E4-S16).

free-exercise-db tags 17 muscles, one "shoulders" and no angles, and some
of our exercises borrow a neighbour's photo (Upper Back Pulldown shows a
wide-grip lat pulldown). The app works the rest out from exercise names
(mobile/src/lib/muscles.js); for the exercises people actually train, this
table is what it shows, checked by hand.

Each entry: main muscles, helper muscles, and the angle (or None). Keys
must match mobile/src/lib/muscles.js (MUSCLES and ANGLES); the JS test
muscles.test.js checks that, and tests/test_exercise_targets.py checks
that every plan exercise is here.
"""

EXERCISE_TARGETS = {
    # ── Yusuf's plan (content/trainer_plan.json) ─────────────────────────
    "15° Incline DB Press": (["chest"], ["front delts", "triceps"], "upper_chest"),
    "30° Incline DB Press": (["chest"], ["front delts", "triceps"], "upper_chest"),
    "DB Chest Press": (["chest"], ["front delts", "triceps"], "mid_chest"),
    "Fly Machine": (["chest"], ["front delts"], "mid_chest"),
    "NG Lat Pulldown": (["lats"], ["biceps", "middle back"], "lats_width"),
    "1-Arm Lat Pulldown": (["lats"], ["biceps", "middle back"], "lats_width"),
    "1-Arm Row Machine": (["middle back", "lats"], ["rear delts", "biceps"], "back_thickness"),
    # Elbows out, pulling to the upper chest: upper back and rear delts, not lat width.
    "Upper Back Pulldown": (["middle back", "rear delts"], ["traps", "biceps"], "back_thickness"),
    "Y Cable Lateral Raise": (["side delts"], ["traps"], None),
    "Kneeling Cable Lateral Raise": (["side delts"], ["traps"], None),
    "Incline Cable Curl": (["biceps"], ["forearms"], "biceps_long"),
    "HG Incline Curl": (["biceps"], ["forearms"], "brachialis"),
    "Preacher Curl Machine": (["biceps"], ["forearms"], "biceps_short"),
    "1-Arm Overhead Cable Extension": (["triceps"], [], "triceps_long"),
    "Cable Cross Triceps Extension": (["triceps"], [], "triceps_lateral"),
    "Leg Press": (["quadriceps", "glutes"], ["hamstrings", "adductors"], None),
    "Leg Extension": (["quadriceps"], [], None),
    "Seated Leg Curl": (["hamstrings"], ["calves"], None),
    "Glute Bridge": (["glutes"], ["hamstrings"], None),
    # 45° back extension done with a rounded upper back: hips, not lower back.
    "45° Hip Extension": (["glutes", "hamstrings"], ["lower back"], None),
    "Hip Abduction": (["abductors"], ["glutes"], None),
    "1-Leg Standing Calf Raise": (["calves"], [], None),
    "Seated Calf Raise": (["calves"], [], None),
    "Tibia Wall": (["shins"], [], None),
    "Dead Bug": (["abdominals"], [], None),
    "TVA": (["abdominals"], [], None),
    "Pallof Press": (["abdominals"], ["glutes"], None),
    "Bear Plank": (["abdominals"], ["front delts"], None),
    # Warm-ups, backups and swaps in the same plan.
    "Y-Bench": (["traps"], ["rear delts", "middle back"], None),
    "Scapula Push Plus": (["middle back"], ["front delts", "chest"], None),
    "SA Pullover": (["lats"], ["chest", "triceps"], "lats_width"),
    "Rotator Cuff": (["rear delts"], [], None),
    "Wall Slide": (["traps"], ["side delts"], None),
    "Floor Slides": (["traps"], ["side delts"], None),
    "Forward Wall": (["traps"], ["front delts"], None),
    "World's Greatest Stretch": (["glutes"], ["hamstrings", "adductors"], None),
    "Lower Body Warm-up": (["glutes"], ["quadriceps", "hamstrings"], None),
    "Air Squat": (["quadriceps", "glutes"], ["hamstrings"], None),
    "1-Arm Triceps Pushdown": (["triceps"], [], "triceps_lateral"),
    "Hammer DB Curl": (["biceps"], ["forearms"], "brachialis"),
    "Lateral Raise in Scapula Plane": (["side delts"], ["front delts"], None),
    # ── Friends' starter plan (content/starter_plan.json) ────────────────
    "Back Squat": (["quadriceps", "glutes"], ["hamstrings", "lower back"], None),
    "Bench Press": (["chest"], ["front delts", "triceps"], "mid_chest"),
    "Incline Dumbbell Press": (["chest"], ["front delts", "triceps"], "upper_chest"),
    "Push-up": (["chest"], ["front delts", "triceps", "abdominals"], "mid_chest"),
    "Overhead Press": (["front delts"], ["side delts", "triceps"], None),
    "Lateral Raise": (["side delts"], ["traps"], None),
    "Face Pull": (["rear delts"], ["middle back", "traps"], None),
    "Lat Pulldown": (["lats"], ["biceps", "middle back"], "lats_width"),
    "Seated Cable Row": (["middle back", "lats"], ["rear delts", "biceps"], "back_thickness"),
    "Bent-over Row": (["middle back", "lats"], ["rear delts", "biceps", "lower back"], "back_thickness"),
    "Dumbbell Curl": (["biceps"], ["forearms"], None),
    "Triceps Pushdown": (["triceps"], [], "triceps_lateral"),
    "Romanian Deadlift": (["hamstrings", "glutes"], ["lower back"], None),
    "Standing Calf Raise": (["calves"], [], None),
    "Plank": (["abdominals"], ["front delts"], None),
}
