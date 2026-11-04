"""Photos for our exercises, from free-exercise-db (public domain).

The phone app bundles the dataset's photos (scripts/fetch_exercise_photos.py)
and shows them on each exercise's page. Our names come from the trainer's
plan and the Library, so this maps each one to the dataset entry that shows
the same movement, or the closest one. Exercises with no honest match
(warm-up drills, mobility work) are left out and stay text only.

Dataset: https://github.com/yuhonas/free-exercise-db (Unlicense), pinned
to EXERCISE_DB_COMMIT so a rebuild never changes the photos underneath us.
"""

EXERCISE_DB_REPO = "https://github.com/yuhonas/free-exercise-db"
EXERCISE_DB_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5"

# Our exercise name -> free-exercise-db id.
EXERCISE_PHOTOS = {
    "1-Arm Lat Pulldown": "One_Arm_Lat_Pulldown",
    "1-Arm Overhead Cable Extension": "Cable_Rope_Overhead_Triceps_Extension",
    "1-Arm Row Machine": "Leverage_Iso_Row",
    "1-Arm Triceps Pushdown": "Triceps_Pushdown",
    "1-Leg Standing Calf Raise": "Calf_Raise_On_A_Dumbbell",
    "15° Incline DB Press": "Incline_Dumbbell_Press",
    "30° Incline DB Press": "Incline_Dumbbell_Press",
    "45° Hip Extension": "Hyperextensions_Back_Extensions",
    "Air Squat": "Bodyweight_Squat",
    "Back Squat": "Barbell_Squat",
    "Bear Plank": "Plank",
    "Bench Press": "Barbell_Bench_Press_-_Medium_Grip",
    "Bent-over Row": "Bent_Over_Barbell_Row",
    "Bodyweight Squat": "Bodyweight_Squat",
    "Bulgarian Split Squat": "Split_Squats",
    "Cable Cross Triceps Extension": "Cable_One_Arm_Tricep_Extension",
    "Cable Crunch": "Cable_Crunch",
    "Calf Raise": "Standing_Calf_Raises",
    "DB Chest Press": "Dumbbell_Bench_Press",
    "Dead Bug": "Dead_Bug",
    "Deadlift": "Barbell_Deadlift",
    "Decline Push-up": "Decline_Push-Up",
    "Diamond Push-up": "Push-Ups_-_Close_Triceps_Position",
    "Dumbbell Curl": "Dumbbell_Bicep_Curl",
    "Face Pull": "Face_Pull",
    "Fly Machine": "Butterfly",
    "Glute Bridge": "Butt_Lift_Bridge",
    "Glute Bridge March": "Single_Leg_Glute_Bridge",
    "HG Incline Curl": "Incline_Hammer_Curls",
    "Hammer Curl": "Hammer_Curls",
    "Hammer DB Curl": "Hammer_Curls",
    "Hip Abduction": "Thigh_Abductor",
    "Hip Thrust": "Barbell_Hip_Thrust",
    "Incline Cable Curl": "Incline_Dumbbell_Curl",
    "Incline Dumbbell Press": "Incline_Dumbbell_Press",
    "Kneeling Cable Lateral Raise": "Cable_Seated_Lateral_Raise",
    "Lat Pulldown": "Wide-Grip_Lat_Pulldown",
    "Lateral Raise": "Side_Lateral_Raise",
    "Lateral Raise in Scapula Plane": "Side_Lateral_Raise",
    "Leg Curl": "Seated_Leg_Curl",
    "Leg Extension": "Leg_Extensions",
    "Leg Press": "Leg_Press",
    "Lying Leg Curl": "Lying_Leg_Curls",
    "NG Lat Pulldown": "V-Bar_Pulldown",
    "Overhead Press": "Standing_Military_Press",
    "Pallof Press": "Pallof_Press",
    "Plank": "Plank",
    "Preacher Curl Machine": "Machine_Preacher_Curls",
    "Pull-up": "Pullups",
    "Push-up": "Pushups",
    "Romanian Deadlift": "Romanian_Deadlift",
    "Rotator Cuff": "External_Rotation_with_Cable",
    "SA Pullover": "Straight-Arm_Dumbbell_Pullover",
    "Seated Cable Row": "Seated_Cable_Rows",
    "Seated Calf Raise": "Seated_Calf_Raise",
    "Seated Leg Curl": "Seated_Leg_Curl",
    "Side Plank": "Side_Bridge",
    "Single-leg Romanian Deadlift": "Kettlebell_One-Legged_Deadlift",
    "Standing Calf Raise": "Standing_Calf_Raises",
    "Superman Row": "Superman",
    "Triceps Pushdown": "Triceps_Pushdown",
    "TVA": "Stomach_Vacuum",
    "Upper Back Pulldown": "Wide-Grip_Lat_Pulldown",
    "Walking Lunge": "Bodyweight_Walking_Lunge",
    "World's Greatest Stretch": "Worlds_Greatest_Stretch",
    "Y Cable Lateral Raise": "Cable_Seated_Lateral_Raise",
}
