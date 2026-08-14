from datetime import date, timedelta


def week_start(d: date) -> date:
    """Monday of the ISO week containing d."""
    return d - timedelta(days=d.weekday())


def linear_rate_kg_per_week(body_logs: list) -> float | None:
    """Least-squares weight trend from BodyLog rows (any order), in kg/week
    (positive = losing weight). None if fewer than 2 logs or span < 7 days."""
    if len(body_logs) < 2:
        return None

    logs = sorted(body_logs, key=lambda log: log.log_date)
    first_date = logs[0].log_date
    if (logs[-1].log_date - first_date).days < 7:
        return None

    xs = [(log.log_date - first_date).days for log in logs]
    ys = [log.weight_kg for log in logs]
    n = len(xs)
    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys, strict=True))
    sum_x2 = sum(x * x for x in xs)

    denom = n * sum_x2 - sum_x * sum_x
    if denom == 0:
        return None

    slope_per_day = (n * sum_xy - sum_x * sum_y) / denom  # kg/day, negative if losing
    return round(-slope_per_day * 7, 3)


def target_rate_kg_per_week(start_weight: float, goal_mid: float, start_date: date, goal_date: date) -> float | None:
    days = (goal_date - start_date).days
    if days <= 0:
        return None
    return round((start_weight - goal_mid) / days * 7, 3)


def predicted_goal_date(current_weight: float, goal_mid: float, actual_rate_per_week: float | None, today: date) -> date | None:
    if actual_rate_per_week is None or actual_rate_per_week <= 0:
        return None
    remaining = current_weight - goal_mid
    if remaining <= 0:
        return today
    weeks_needed = remaining / actual_rate_per_week
    return today + timedelta(days=round(weeks_needed * 7))


def slack_impact_date(baseline_predicted: date | None, missed_weeks: float) -> date | None:
    """Rough estimate: a full pause shifts the goal date by the pause length,
    assuming the same rate resumes afterward."""
    if baseline_predicted is None:
        return None
    return baseline_predicted + timedelta(days=round(missed_weeks * 7))


def training_adherence_pct(sessions_last_14_days: int, target_sessions_per_week: int = 4) -> float:
    target = target_sessions_per_week * 2
    if target <= 0:
        return 0.0
    return round(min(100, (sessions_last_14_days / target) * 100), 1)


def meal_adherence_pct(completed_count: int, possible_count: int) -> float:
    if possible_count <= 0:
        return 0.0
    return round(min(100, (completed_count / possible_count) * 100), 1)


def compute_streak(logged_dates: set, today: date) -> int:
    """Consecutive days with at least one workout logged, walking backward
    from today. If today has nothing logged yet, doesn't break the streak
    until the day is actually over — counts from yesterday instead."""
    streak = 0
    cursor = today if today in logged_dates else today - timedelta(days=1)
    while cursor in logged_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def confidence_score(actual_rate: float | None, target_rate: float | None, adherence_pct: float):
    """Returns (score_0_100_or_None, label). Blends pace-vs-target (60%) and
    adherence (40%). None score means not enough data yet to judge pace."""
    if actual_rate is None or target_rate is None or target_rate <= 0:
        return None, "Not enough data yet"

    pace_score = min(100, max(0, (actual_rate / target_rate) * 100))
    score = round(pace_score * 0.6 + adherence_pct * 0.4)

    if score >= 80:
        label = "On Track"
    elif score >= 50:
        label = "Slightly Behind"
    else:
        label = "At Risk"
    return score, label
