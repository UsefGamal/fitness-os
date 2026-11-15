# A fitness test to repeat every few weeks (Nov 2026): three bodyweight
# checks that show progress without a scale, so a friend who isn't trying
# to lose weight still sees how far they've come. Results are kept on the
# phone in data.fitness_tests (mobile/src/lib/fitnessTest.js).
#
# Each item names the moves it can be done with, easiest last, and the
# ladder in content/progressions.py they come from. A result only compares
# with earlier results on the same move.
#
# Safety (PRODUCT.md "Stay safe"): the test stops when form breaks, never
# at all-out failure. With the beginner_only gate on, the app asks people to
# stop with about 3 reps (or 10 seconds) left instead.

EVERY_DAYS = 28

ITEMS = [
    {
        "key": "pushups",
        "label": "Push-ups",
        "unit": "reps",
        "ladder": "push",
        "moves": ["Push-up", "Knee Push-up", "Incline Push-up"],
        "how": "As many as you can in one go. Stop when your hips sag or your chest stops getting close to the floor.",
        "max": 200,
    },
    {
        "key": "squats",
        "label": "Squats in 60 seconds",
        "unit": "reps",
        "ladder": "squat",
        "moves": ["Bodyweight Squat", "Box Squat"],
        "how": "Squat until your thighs are level with the floor, for one minute. Count only full reps.",
        "timer": {"kind": "countdown", "seconds": 60},
        "max": 150,
    },
    {
        "key": "plank",
        "label": "Plank hold",
        "unit": "seconds",
        "ladder": "core",
        "moves": ["Plank", "Knee Plank"],
        "how": "Forearm plank with your body in one line. Stop the clock when your hips drop or rise.",
        "timer": {"kind": "stopwatch"},
        "max": 900,
    },
]

GUIDE = [
    "Warm up for 5 minutes first: march on the spot, arm circles, a few easy squats.",
    "Rest about 3 minutes between the three tests.",
    "Test at the same time of day and in the same order each time, so the numbers compare.",
    "Stop if anything hurts. Sharp pain is not a result.",
]

ITEMS_BY_KEY = {item["key"]: item for item in ITEMS}
