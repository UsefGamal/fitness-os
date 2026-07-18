from datetime import date

from content.gym_program import next_program_day
from content.meal_plan import get_day
from routers.meals import PLAN_START_DATE, SLOT_LABELS

ACCENT = "#16a34a"
INK = "#0f172a"
MUTED = "#64748b"
BORDER = "#e2e8f0"
SURFACE = "#f8fafc"


def build_daily_digest_html(today: date, completed_gym_sessions: int, app_base_url: str) -> tuple[str, str]:
    day_number = (today - PLAN_START_DATE).days + 1
    meal_plan = get_day(day_number)
    gym_day = next_program_day(completed_gym_sessions)

    meal_rows = "".join(
        f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid {BORDER};font-weight:600;color:{INK};white-space:nowrap">{SLOT_LABELS.get(m['slot'], m['slot'])}</td>
          <td style="padding:10px 12px;border-bottom:1px solid {BORDER};color:{MUTED};font-size:14px">{', '.join(m['ingredients'])}</td>
          <td style="padding:10px 12px;border-bottom:1px solid {BORDER};color:{ACCENT};font-weight:600;white-space:nowrap;text-align:right">{m['kcal']} kcal</td>
        </tr>"""
        for m in meal_plan["meals"]
    )

    gym_rows = "".join(
        f"""<li style="margin-bottom:6px"><strong style="color:{INK}">{ex['name']}</strong>
        <span style="color:{MUTED}"> — {ex['sets']} x {ex['reps']}</span></li>"""
        for ex in gym_day["exercises"]
    )

    subject = f"Fitness OS — {today.strftime('%a %b %d')} plan"
    html = f"""
    <div style="background:{SURFACE};padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid {BORDER};border-radius:14px;overflow:hidden">

        <div style="background:{INK};padding:22px 28px">
          <span style="color:{ACCENT};font-weight:800;font-size:20px;letter-spacing:0.5px">FITNESS OS</span>
          <div style="color:#94a3b8;font-size:13px;margin-top:2px">{today.strftime('%A, %B %d, %Y')}</div>
        </div>

        <div style="padding:24px 28px">
          <p style="color:{INK};font-size:16px;margin:0 0 18px">Good morning — here's today's plan.</p>

          <a href="{app_base_url}/body" style="display:inline-block;background:{ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;margin-bottom:24px">
            Log today's weigh-in →
          </a>

          <h2 style="color:{INK};font-size:16px;border-top:1px solid {BORDER};padding-top:18px;margin:0 0 4px">
            {meal_plan['label']}
          </h2>
          <p style="color:{MUTED};font-size:13px;margin:0 0 12px">
            {meal_plan['totals']['kcal']} kcal &middot; {meal_plan['totals']['protein']}g protein &middot; {meal_plan['totals']['carbs']}g carbs &middot; {meal_plan['totals']['fat']}g fat
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:8px">{meal_rows}</table>
          <p style="text-align:right;margin:8px 0 0">
            <a href="{app_base_url}/meals" style="color:{ACCENT};font-size:13px;font-weight:600;text-decoration:none">Open meal plan →</a>
          </p>

          <h2 style="color:{INK};font-size:16px;border-top:1px solid {BORDER};padding-top:18px;margin:24px 0 4px">
            If you're hitting the gym today: {gym_day['label']}
          </h2>
          <p style="color:{MUTED};font-size:13px;margin:0 0 10px">{gym_day['focus']}</p>
          <ul style="padding-left:18px;margin:0 0 10px;font-size:14px">{gym_rows}</ul>
          <p style="text-align:right;margin:8px 0 0">
            <a href="{app_base_url}/gym" style="color:{ACCENT};font-size:13px;font-weight:600;text-decoration:none">Log your session →</a>
          </p>
        </div>

        <div style="background:{SURFACE};padding:14px 28px;border-top:1px solid {BORDER}">
          <span style="color:{MUTED};font-size:11px">Fitness OS daily digest</span>
        </div>
      </div>
    </div>
    """
    return subject, html
