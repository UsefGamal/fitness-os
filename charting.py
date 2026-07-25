"""Shared server-rendered inline SVG/HTML chart builders.

No JS charting library — every chart is plain SVG/HTML generated here,
following the dataviz skill's mark specs (2px lines, 4px-rounded bar
data-ends, hairline recessive gridlines, selective direct labels only
at endpoints/extremes — never a number on every point) and validated
color tokens (see static/style.css's --chart-* custom properties).

Every chart function returns a ready-to-embed HTML/SVG string. Callers
are responsible for pairing it with a table-view toggle (the
accessibility twin) using the existing .log-table pattern — these
builders don't own that, since the underlying data (dates, values)
already has a natural table representation at the call site.
"""

from html import escape


def _fmt(value: float) -> str:
    if value == int(value):
        return str(int(value))
    return f"{value:g}"


def build_line_svg(
    values: list[float],
    width: int = 600,
    height: int = 160,
    reference_value: float | None = None,
    pad: int = 12,
) -> str:
    """Emphasis-form line chart: one colored 'actual' line, an optional
    muted dashed reference line (target/goal/baseline), direct labels at
    the first/last points only. Returns "" if there's not enough data."""
    if len(values) < 2:
        return ""

    # Extra headroom above the plotted line so the endpoint's direct-value
    # label (drawn above its point) never gets clipped by the viewBox when
    # that point sits near the top of the range.
    pad_top = pad + 16

    all_values = list(values) + ([reference_value] if reference_value is not None else [])
    min_v, max_v = min(all_values), max(all_values)
    span = (max_v - min_v) or 1
    n = len(values)

    def xy(i, v):
        x = pad + (i / (n - 1)) * (width - 2 * pad)
        y = pad_top + (1 - (v - min_v) / span) * (height - pad_top - pad)
        return x, y

    points = [xy(i, v) for i, v in enumerate(values)]
    polyline = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)

    parts = [f'<svg viewBox="0 0 {width} {height}" class="chart-svg" preserveAspectRatio="none">']

    # Recessive hairline baseline.
    base_y = height - pad
    parts.append(f'<line x1="{pad}" y1="{base_y:.1f}" x2="{width - pad}" y2="{base_y:.1f}" class="chart-grid-line"/>')

    if reference_value is not None:
        _, ry = xy(0, reference_value)
        parts.append(f'<line x1="{pad}" y1="{ry:.1f}" x2="{width - pad}" y2="{ry:.1f}" class="chart-reference-line"/>')

    parts.append(f'<polyline points="{polyline}" class="chart-line"/>')

    # Direct labels: first point, last point, and the extreme (min/max) if distinct.
    fx, fy = points[0]
    lx, ly = points[-1]
    parts.append(f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="4" class="chart-marker"/>')
    parts.append(f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="4" class="chart-marker"/>')
    label_anchor = "end" if lx > width - 60 else "start"
    label_dx = -8 if label_anchor == "end" else 8
    parts.append(
        f'<text x="{lx + label_dx:.1f}" y="{ly - 8:.1f}" text-anchor="{label_anchor}" class="chart-label-primary">{_fmt(values[-1])}</text>'
    )

    parts.append("</svg>")
    return "".join(parts)


def build_sparkline_svg(values: list[float], width: int = 96, height: int = 32, pad: int = 3) -> str:
    """Compact single-hue trend line for small multiples — no axis, no grid."""
    if len(values) < 2:
        return ""
    min_v, max_v = min(values), max(values)
    span = (max_v - min_v) or 1
    n = len(values)

    def xy(i, v):
        x = pad + (i / (n - 1)) * (width - 2 * pad)
        y = pad + (1 - (v - min_v) / span) * (height - 2 * pad)
        return x, y

    points = [xy(i, v) for i, v in enumerate(values)]
    polyline = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    lx, ly = points[-1]
    return (
        f'<svg viewBox="0 0 {width} {height}" class="sparkline-svg" width="{width}" height="{height}">'
        f'<polyline points="{polyline}" class="chart-line"/>'
        f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="3" class="chart-marker"/>'
        f"</svg>"
    )


def build_bar_svg(
    values: list[float],
    labels: list[str] | None = None,
    width: int = 600,
    height: int = 140,
    pad: int = 12,
    max_bar_width: int = 24,
) -> str:
    """Vertical bar chart — thin bars, 4px rounded data-end, hairline baseline."""
    if not values:
        return ""
    max_v = max(values) or 1
    n = len(values)
    plot_w = width - 2 * pad
    slot_w = plot_w / n
    bar_w = min(max_bar_width, slot_w * 0.6)
    base_y = height - pad

    parts = [f'<svg viewBox="0 0 {width} {height}" class="chart-svg" preserveAspectRatio="none">']
    parts.append(f'<line x1="{pad}" y1="{base_y:.1f}" x2="{width - pad}" y2="{base_y:.1f}" class="chart-grid-line"/>')

    for i, v in enumerate(values):
        cx = pad + slot_w * (i + 0.5)
        bar_h = (v / max_v) * (height - 2 * pad) if max_v else 0
        y = base_y - bar_h
        rx = 4
        parts.append(
            f'<rect x="{cx - bar_w / 2:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{max(bar_h, 1):.1f}" '
            f'rx="{rx}" class="chart-bar-fill"/>'
        )

    # Label only the last bar's value (endpoint) to stay selective.
    if values:
        cx = pad + slot_w * (n - 0.5)
        last_h = (values[-1] / max_v) * (height - 2 * pad) if max_v else 0
        parts.append(
            f'<text x="{cx:.1f}" y="{base_y - last_h - 6:.1f}" text-anchor="middle" class="chart-label-primary">{_fmt(values[-1])}</text>'
        )

    parts.append("</svg>")
    return "".join(parts)


def build_meter_html(value: float, target: float, label: str, unit: str = "") -> str:
    """Same-ramp progress meter: fill = value/target, unfilled track is the
    surface-2 step. Reuses the existing .progress-bar/.progress-fill
    pattern already shipped across the app."""
    pct = 0 if target <= 0 else max(0, min(100, round(value / target * 100)))
    return (
        f'<div class="meter-row">'
        f'<div class="meter-head"><span>{escape(label)}</span>'
        f'<span class="muted">{_fmt(value)}{unit} / {_fmt(target)}{unit}</span></div>'
        f'<div class="progress-bar"><div class="progress-fill" style="width:{pct}%"></div></div>'
        f"</div>"
    )


def build_heatmap_html(day_cells: list[dict]) -> str:
    """Streak/adherence calendar heatmap — sequential ramp, one cell per
    day. Each item: {"date": iso_str, "level": 0-4, "title": tooltip_str}."""
    cells = []
    ramp = ["var(--surface2)", "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]
    for cell in day_cells:
        level = max(0, min(4, cell.get("level", 0)))
        color = ramp[level]
        title = escape(cell.get("title", cell.get("date", "")))
        cells.append(f'<div class="heatmap-cell" style="background:{color}" title="{title}"></div>')
    return f'<div class="heatmap-grid">{"".join(cells)}</div>'


def status_chip_html(status: str, label: str, icon_slug: str) -> str:
    """status: 'good' | 'warning' | 'critical'. Always icon + label, never color alone."""
    status = status if status in ("good", "warning", "critical") else "warning"
    return (
        f'<span class="status-chip {status}">'
        f'<svg class="icon"><use href="#icon-{icon_slug}"/></svg>{escape(label)}'
        f"</span>"
    )
