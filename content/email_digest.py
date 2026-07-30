from datetime import date

from sqlmodel import Session

from content.eating_out_guide import EATING_OUT_TIPS
from content.gym_program import next_program_day
from fitchef_sync import get_active_day
from routers.meals import PLAN_START_DATE, SLOT_LABELS

# Same palette as static/style.css's dark theme — kept in sync by hand since
# email clients need inline styles, not shared CSS custom properties.
BG = "#090c14"
SURFACE = "#131826"
SURFACE_DARK = "#0b0f1a"
BORDER = "#242c42"
TEXT = "#eef1f8"
MUTED = "#8b95ac"
ACCENT = "#22c55e"
ACCENT_DARK = "#16a34a"
GOLD = "#fbbf24"
FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"


def _wrap_document(body: str) -> str:
    """A minimal responsive HTML document (viewport meta + fluid max-width
    container) rather than a bare fragment — keeps rendering consistent
    and correctly scaled across mail clients."""
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
</head>
<body style="margin:0;padding:0;background:{BG}">
{body}
</body>
</html>"""


def build_daily_digest_html(session: Session, today: date, completed_gym_sessions: int, app_base_url: str) -> tuple[str, str]:
    day_number = (today - PLAN_START_DATE).days + 1
    meal_plan = get_active_day(session, day_number)
    gym_day = next_program_day(completed_gym_sessions)
    general_tips = EATING_OUT_TIPS["general"]
    eating_out_tip = general_tips[day_number % len(general_tips)]

    refeed_badge = (
        f'<span style="display:inline-block;color:{GOLD};background:rgba(251,191,36,0.12);'
        f'border:1px solid rgba(251,191,36,0.35);border-radius:999px;padding:2px 10px;'
        f'font-size:11px;font-weight:700;letter-spacing:0.3px;margin-left:8px;vertical-align:middle">REFEED DAY</span>'
        if meal_plan.get("is_refeed")
        else ""
    )

    # Each meal is a full-width stacked block, not a table cell — a narrow
    # fixed-width table column was wrapping long ingredient lists to one
    # word per line on mobile mail clients. The only table here is a
    # 2-column header row (short label + short kcal figure), which is
    # safe at any width.
    meal_rows = "".join(
        f"""
        <div style="padding:14px 0;border-bottom:1px solid {BORDER}">
          <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
            <td style="padding:0;font-weight:600;color:{TEXT};font-size:14px;vertical-align:baseline">
              {SLOT_LABELS.get(m['slot'], m['slot'])}
              <span style="font-weight:400;color:{MUTED};font-size:11px">&nbsp;&middot; {m['time_window']}</span>
            </td>
            <td style="padding:0;color:{ACCENT};font-weight:700;font-size:14px;text-align:right;white-space:nowrap;vertical-align:baseline">{m['options'][0]['kcal']} kcal</td>
          </tr></table>
          <p style="color:{MUTED};font-size:13px;line-height:1.6;margin:8px 0 0;word-wrap:break-word">
            <strong style="color:{TEXT}">A ({m['options'][0]['cuisine']}):</strong> {', '.join(m['options'][0]['ingredients'])}<br>
            <strong style="color:{TEXT}">B ({m['options'][1]['cuisine']}):</strong> {', '.join(m['options'][1]['ingredients'])}
          </p>
        </div>"""
        for m in meal_plan["meals"]
    )

    gym_rows = "".join(
        f"""<li style="margin-bottom:6px"><strong style="color:{TEXT}">{ex['name']}</strong>
        <span style="color:{MUTED}"> — {ex['sets']} x {ex['reps']}</span></li>"""
        for ex in gym_day["exercises"]
    )

    subject = f"Fitness OS — {today.strftime('%a %b %d')} plan"
    body = f"""
    <div style="background:{BG};padding:24px 12px;font-family:{FONT}">
      <div style="max-width:600px;margin:0 auto;background:{SURFACE};border:1px solid {BORDER};border-radius:14px;overflow:hidden">

        <div style="background:{SURFACE_DARK};padding:22px 28px;border-bottom:1px solid {BORDER}">
          <span style="color:{ACCENT};font-weight:800;font-size:20px;letter-spacing:0.5px">⚡ FITNESS OS</span>
          <div style="color:{MUTED};font-size:13px;margin-top:2px">{today.strftime('%A, %B %d, %Y')}</div>
        </div>

        <div style="padding:24px 28px">
          <p style="color:{TEXT};font-size:16px;margin:0 0 18px">Good morning — here's today's plan.</p>

          <a href="{app_base_url}/body" style="display:inline-block;background:linear-gradient(135deg,{ACCENT_DARK},{ACCENT});color:#06210f;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:8px;margin-bottom:24px">
            Log today's weigh-in →
          </a>

          <h2 style="color:{TEXT};font-size:16px;border-top:1px solid {BORDER};padding-top:18px;margin:0 0 4px">
            {meal_plan['label']}{refeed_badge}
          </h2>
          <p style="color:{MUTED};font-size:13px;margin:0 0 4px">
            {meal_plan['totals']['kcal']} kcal &middot; {meal_plan['totals']['protein']}g protein &middot; {meal_plan['totals']['carbs']}g carbs &middot; {meal_plan['totals']['fat']}g fat &middot; {meal_plan['totals']['fiber']}g fiber
          </p>
          <div style="margin-bottom:4px">{meal_rows}</div>
          <p style="color:{MUTED};font-size:12px;margin:8px 0 0;font-style:italic">Eating out? {eating_out_tip}</p>
          <p style="text-align:right;margin:8px 0 0">
            <a href="{app_base_url}/meals" style="color:{ACCENT};font-size:13px;font-weight:600;text-decoration:none">Open meal plan →</a>
          </p>

          <h2 style="color:{TEXT};font-size:16px;border-top:1px solid {BORDER};padding-top:18px;margin:24px 0 4px">
            If you're hitting the gym today: {gym_day['label']}
          </h2>
          <p style="color:{MUTED};font-size:13px;margin:0 0 10px">{gym_day['focus']}</p>
          <ul style="padding-left:18px;margin:0 0 10px;font-size:14px;color:{TEXT}">{gym_rows}</ul>
          <p style="text-align:right;margin:8px 0 0">
            <a href="{app_base_url}/gym" style="color:{ACCENT};font-size:13px;font-weight:600;text-decoration:none">Log your session →</a>
          </p>
        </div>

        <div style="background:{SURFACE_DARK};padding:14px 28px;border-top:1px solid {BORDER}">
          <span style="color:{MUTED};font-size:11px">Fitness OS daily digest</span>
        </div>
      </div>
    </div>
    """
    return subject, _wrap_document(body)
