# Dedicated cardio, separate from padel and the lifting rotation. Doesn't
# advance the gym/home Upper-Lower counter (training_counter.py scopes to
# "gym"/"home" only).

CARDIO_SESSION = {
    "label": "Incline Treadmill Walk",
    "target": "20-25 min at 3.5-4.0 mph, 8-12% incline, RPE 6/10 — conversational pace, not a jog.",
    "frequency_note": "Aim for 2x/week, on non-lifting days or tacked onto the end of a lifting session.",
    "warmup": ["2 min flat walk (0% incline) to ease in"],
    "cooldown": ["2-3 min flat walk to bring your heart rate back down"],
}

ALTERNATIVES = [
    "Stationary bike, moderate resistance, same duration/RPE",
    "Rowing machine, steady pace, same duration/RPE",
    "Elliptical, moderate resistance, same duration/RPE",
    "Outdoor brisk walk on a hilly route, same duration/RPE",
]
