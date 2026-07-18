MILESTONES = [
    (100, "Getting Started", "🌱"),
    (250, "Consistency Builder", "🔥"),
    (500, "Habit Master", "⚡"),
    (1000, "Iron Will", "💎"),
    (2000, "Transformation Elite", "👑"),
]


def badge_progress(total_points: int):
    """Returns (current_badge_or_None, next_milestone_or_None).
    Each is (threshold, name, icon), or None if not yet reached / already maxed."""
    current_badge = None
    next_milestone = None
    for threshold, name, icon in MILESTONES:
        if total_points >= threshold:
            current_badge = (threshold, name, icon)
        else:
            next_milestone = (threshold, name, icon)
            break
    return current_badge, next_milestone


def level_for_points(total_points: int) -> int:
    """Simple level number: +1 every 50 points, no cap."""
    return 1 + total_points // 50
