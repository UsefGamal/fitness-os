"""Moves for the Intervals timer, and how cardio and sport sessions load
the muscles.

Each interval preset plays its moves in turn, one per work round, so the
timer can show the move's photo and the notification can name it. The
moves are bodyweight (or one simple tool) and all have a public-domain
photo (content/exercise_photos.py) and hand-checked muscles
(content/exercise_targets.py). People can change the list in the app.

SESSION_MUSCLES says which muscles a cardio machine or a padel match
works, for the muscle map, weekly sets and recovery. Steady cardio and
sport are lighter than lifting, so the app counts them as a few light
sets (mobile/src/lib/sessionLoad.js), never as hard sets.
"""

# Moves the Intervals timer offers, in the order the "Add a move" list shows.
INTERVAL_MOVES = [
    "Jump Squat",
    "Mountain Climbers",
    "Push-up",
    "Star Jump",
    "Split Jump",
    "Butt Kicks",
    "Tuck Jump",
    "Bodyweight Squat",
    "Walking Lunge",
    "Glute Bridge",
    "Plank",
    "Side Plank",
    "Jump Rope",
    "Battle Ropes",
    "Kettlebell Swing",
]

# The moves each preset starts with (keys match INTERVAL_PRESETS in
# mobile/src/lib/training.js). Round 1 plays the first move, round 2 the
# second, and so on, starting over after the last.
PRESET_MOVES = {
    "hiit": ["Jump Squat", "Mountain Climbers", "Push-up", "Star Jump", "Split Jump"],
    "tabata": ["Jump Squat", "Mountain Climbers", "Push-up", "Star Jump"],
    "emom": ["Bodyweight Squat", "Push-up"],
    "hiit45": ["Jump Squat", "Push-up", "Mountain Climbers", "Walking Lunge", "Plank", "Star Jump"],
}

# Muscles a non-lifting session works: (match words, main, helpers). The
# first row whose words appear in the session's name wins; "padel" is
# matched by the session type too. Muscle keys match mobile/src/lib/muscles.js.
SESSION_MUSCLES = [
    (["padel", "tennis", "squash"], ["quadriceps", "glutes", "calves"], ["front delts", "forearms", "obliques", "hamstrings"]),
    (["bike", "cycling", "cycle", "spin"], ["quadriceps", "glutes"], ["calves", "hamstrings"]),
    (["row"], ["lats", "middle back", "quadriceps"], ["biceps", "glutes", "hamstrings", "lower back"]),
    (["elliptical", "cross trainer"], ["quadriceps", "glutes"], ["hamstrings", "calves", "front delts"]),
    (["stair", "step"], ["quadriceps", "glutes"], ["calves", "hamstrings"]),
    (["swim"], ["lats", "front delts"], ["triceps", "middle back", "abdominals"]),
    (["incline", "hill"], ["glutes", "calves"], ["hamstrings", "quadriceps"]),
    (["walk", "treadmill", "run", "jog", "football", "basketball"], ["calves", "quadriceps"], ["glutes", "hamstrings"]),
]
