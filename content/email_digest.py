from datetime import date

from content.gym_program import next_program_day
from content.meal_plan import get_day
from routers.meals import PLAN_START_DATE, SLOT_LABELS


def build_daily_digest_html(today: date, completed_gym_sessions: int, app_base_url: str) -> tuple[str, str]:
    day_number = (today - PLAN_START_DATE).days + 1
    meal_plan = get_day(day_number)
    gym_day = next_program_day(completed_gym_sessions)

    meal_rows = "".join(
        f"<tr><td style='padding:6px 10px'>{SLOT_LABELS.get(m['slot'], m['slot'])}</td>"
        f"<td style='padding:6px 10px'>{', '.join(m['ingredients'])}</td>"
        f"<td style='padding:6px 10px'>{m['kcal']} kcal</td></tr>"
        for m in meal_plan["meals"]
    )

    gym_rows = "".join(
        f"<li>{ex['name']} — {ex['sets']}x{ex['reps']}</li>" for ex in gym_day["exercises"]
    )

    subject = f"Fitness OS — {today.isoformat()} plan"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>Good morning — here's today's plan</h2>
      <p><a href="{app_base_url}/body">Log your weight</a> first thing if you haven't yet.</p>

      <h3>{meal_plan['label']} ({meal_plan['totals']['kcal']} kcal, {meal_plan['totals']['protein']}g protein)</h3>
      <table style="border-collapse:collapse;width:100%">{meal_rows}</table>

      <h3>If you're hitting the gym today: {gym_day['label']}</h3>
      <p>{gym_day['focus']}</p>
      <ul>{gym_rows}</ul>
      <p><a href="{app_base_url}/gym">Log your session</a></p>

      <p style="color:#888;font-size:12px;margin-top:24px">Fitness OS daily digest</p>
    </div>
    """
    return subject, html
