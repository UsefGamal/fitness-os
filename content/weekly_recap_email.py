from datetime import date

# Same palette as content/email_digest.py / static/style.css's dark theme.
BG = "#090c14"
SURFACE = "#131826"
SURFACE_DARK = "#0b0f1a"
BORDER = "#242c42"
TEXT = "#eef1f8"
MUTED = "#8b95ac"
ACCENT = "#22c55e"
ACCENT_DARK = "#16a34a"
GOLD = "#fbbf24"
PURPLE = "#a78bfa"
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


def _stat_tile(label: str, value: str, color: str) -> str:
    return f"""
    <td style="padding:14px 10px;text-align:center;border:1px solid {BORDER};border-radius:10px;background:{SURFACE_DARK}">
      <div style="color:{color};font-size:20px;font-weight:700;font-family:'JetBrains Mono',monospace">{value}</div>
      <div style="color:{MUTED};font-size:10px;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px">{label}</div>
    </td>"""


def build_weekly_recap_html(
    week_start: date,
    week_end: date,
    weight_change: float | None,
    meal_adherence: float,
    training_sessions: int,
    points_earned: int,
    streak: int,
    insight: str | None,
    app_base_url: str,
) -> tuple[str, str]:
    weight_str = f"{weight_change:+.1f}kg" if weight_change is not None else "—"
    weight_color = ACCENT if (weight_change is not None and weight_change < 0) else TEXT

    stats_row = "".join(
        [
            _stat_tile("Weight Δ", weight_str, weight_color),
            _stat_tile("Meal Adherence", f"{meal_adherence:g}%", ACCENT),
            _stat_tile("Sessions", str(training_sessions), TEXT),
            _stat_tile("Points", f"+{points_earned}", GOLD),
        ]
    )

    subject = f"Fitness OS — week of {week_start.strftime('%b %d')} recap"
    body = f"""
    <div style="background:{BG};padding:24px 12px;font-family:{FONT}">
      <div style="max-width:600px;margin:0 auto;background:{SURFACE};border:1px solid {BORDER};border-radius:14px;overflow:hidden">

        <div style="background:{SURFACE_DARK};padding:22px 28px;border-bottom:1px solid {BORDER}">
          <span style="color:{ACCENT};font-weight:800;font-size:20px;letter-spacing:0.5px">⚡ FITNESS OS</span>
          <div style="color:{MUTED};font-size:13px;margin-top:2px">Week of {week_start.strftime('%B %d')} – {week_end.strftime('%B %d, %Y')}</div>
        </div>

        <div style="padding:24px 28px">
          <p style="color:{TEXT};font-size:16px;margin:0 0 18px">Here's how your week went.</p>

          <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:6px 0;margin-bottom:8px"><tr>{stats_row}</tr></table>

          <p style="color:{MUTED};font-size:13px;margin:14px 0 0">
            <span style="color:{PURPLE};font-weight:700;font-family:'JetBrains Mono',monospace">{streak}</span> day current streak
          </p>

          {f'<p style="color:{MUTED};font-size:13px;margin:14px 0 0;padding-top:14px;border-top:1px solid {BORDER}">{insight}</p>' if insight else ''}

          <a href="{app_base_url}/" style="display:inline-block;background:linear-gradient(135deg,{ACCENT_DARK},{ACCENT});color:#06210f;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:8px;margin-top:22px">
            Open dashboard →
          </a>
        </div>

        <div style="background:{SURFACE_DARK};padding:14px 28px;border-top:1px solid {BORDER}">
          <span style="color:{MUTED};font-size:11px">Fitness OS weekly recap</span>
        </div>
      </div>
    </div>
    """
    return subject, _wrap_document(body)
