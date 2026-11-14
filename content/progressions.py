# Easier and harder versions of the bodyweight moves (Nov 2026). Each ladder
# runs from the easiest step to the hardest, so a friend who can't do a move
# yet steps down instead of skipping it, and one who finds it easy steps up.
# The exercise page shows the ladder around any move that is on one, and
# the fitness test (content/fitness_test.py) records which step was used.
#
# Written for Fitness OS. The idea of a progression ladder is common
# coaching practice; the steps, cues and rules here are our own.
#
# Coaching rule (COA-08..10): move up when the top of the range is clean
# for every set, never by grinding to failure.

LADDERS = [
    {
        "key": "push",
        "label": "Push-up",
        "group": "Chest",
        "unit": "reps",
        "move_up": "Move up when you can do 3 sets of 12 with a straight body.",
        "steps": [
            {"name": "Wall Push-up", "cue": "Hands on a wall at chest height, step your feet back, chest to the wall."},
            {"name": "Incline Push-up", "cue": "Hands on a table or bench edge. The higher the surface, the easier."},
            {"name": "Knee Push-up", "cue": "Knees down, body straight from knees to head, chest to the floor."},
            {"name": "Push-up", "cue": "Hands under shoulders, body in one line, chest to a fist's height off the floor."},
            {"name": "Decline Push-up", "cue": "Feet on a step or bench, hands on the floor. More weight on the arms."},
            {"name": "Diamond Push-up", "cue": "Hands together under the chest, elbows brushing the ribs. Hits the triceps."},
            {"name": "Archer Push-up", "cue": "Hands wide, lower towards one hand while the other arm stays straight."},
        ],
    },
    {
        "key": "overhead",
        "label": "Overhead push",
        "group": "Shoulders",
        "unit": "reps",
        "move_up": "Move up when you can do 3 sets of 10 with your hips staying high.",
        "steps": [
            {"name": "Incline Pike Push-up", "cue": "Hands on a bench, hips high, lower the top of your head towards it."},
            {"name": "Pike Push-up", "cue": "Hands and feet on the floor, hips high in an upside-down V, head between the hands."},
            {"name": "Feet-elevated Pike Push-up", "cue": "Feet on a chair so the hips stack over the shoulders."},
            {"name": "Wall Handstand Hold", "cue": "Walk your feet up a wall, arms locked, 20-30 seconds a set. Only on a clear floor."},
        ],
    },
    {
        "key": "pull",
        "label": "Pull",
        "group": "Back",
        "unit": "reps",
        "move_up": "Move up when you can do 3 sets of 10 without swinging.",
        "steps": [
            {"name": "Superman Row", "cue": "Face down, arms forward, lift the chest and pull the elbows back to your sides."},
            {"name": "Table Row", "cue": "Lie under a sturdy table, grip the edge, knees bent, pull your chest up to it."},
            {"name": "Inverted Row", "cue": "Under a low bar or table, legs straight, body stiff, pull the chest to the bar."},
            {"name": "Feet-elevated Inverted Row", "cue": "The same row with your feet on a chair. Body stays in one line."},
            {"name": "Pull-up Negative", "cue": "Jump or step to the top of a pull-up and lower yourself over 5 seconds."},
            {"name": "Pull-up", "cue": "Hang with straight arms, pull until your chin clears the bar, lower all the way."},
        ],
    },
    {
        "key": "squat",
        "label": "Squat",
        "group": "Legs",
        "unit": "reps",
        "move_up": "Move up when you can do 3 sets of 15 (each leg on one-leg moves) with control.",
        "steps": [
            {"name": "Box Squat", "cue": "Sit back to a chair, touch it lightly, stand up without rocking."},
            {"name": "Bodyweight Squat", "cue": "Feet shoulder-width, sit down until your thighs are level with the floor."},
            {"name": "Split Squat", "cue": "One foot forward, one back, drop the back knee straight down."},
            {"name": "Bulgarian Split Squat", "cue": "Back foot on a chair or bench, front shin roughly upright."},
            {"name": "Box Pistol Squat", "cue": "On one leg, sit to a chair with the other leg out in front, stand back up."},
        ],
    },
    {
        "key": "hinge",
        "label": "Hip hinge",
        "group": "Legs",
        "unit": "reps",
        "move_up": "Move up when you can do 3 sets of 15 (each leg on one-leg moves) with a pause at the top.",
        "steps": [
            {"name": "Glute Bridge", "cue": "On your back, knees bent, push through the heels until hips and knees line up."},
            {"name": "Glute Bridge March", "cue": "Hold the bridge and lift one foot at a time without the hips dropping."},
            {"name": "Single-leg Glute Bridge", "cue": "One foot on the floor, the other knee pulled in, bridge up on one leg."},
            {"name": "Single-leg Romanian Deadlift", "cue": "Stand on one leg, hinge forward with a flat back, the free leg reaching behind."},
        ],
    },
    {
        "key": "core",
        "label": "Plank",
        "group": "Core",
        "unit": "seconds",
        "move_up": "Move up when you can hold 3 sets of 45 seconds without your hips sagging.",
        "steps": [
            {"name": "Knee Plank", "cue": "On forearms and knees, body straight from knees to head."},
            {"name": "Plank", "cue": "On forearms and toes, squeeze your glutes, ribs down, body in one line."},
            {"name": "Plank Shoulder Taps", "cue": "High plank on your hands, tap each shoulder without the hips rocking."},
            {"name": "Long-lever Plank", "cue": "Forearm plank with the elbows a hand's length in front of the shoulders."},
        ],
    },
]

LADDERS_BY_KEY = {ladder["key"]: ladder for ladder in LADDERS}
