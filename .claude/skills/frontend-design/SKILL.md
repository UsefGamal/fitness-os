---
name: frontend-design
description: Use when adding or editing a Jinja2 template, static/style.css, or static/app.js in Fitness OS — any UI-facing change. Covers the existing dark-theme token system, CSP constraints (no inline JS), the icon sprite, and the accessibility-twin pattern for charts, so new UI matches the app instead of drifting from it.
---

# Frontend design conventions

This app is server-rendered Jinja2 + plain CSS — no JS framework, no build step, no component library. "Design system" here means: reuse the existing CSS custom properties, the existing icon sprite, and the existing template structure, rather than inventing new patterns per page.

## Before writing any UI

1. **Skim an existing template that does something similar** (`templates/body.html` for a log-with-history page, `templates/gym_detail.html` for a form-heavy detail page) rather than starting from a blank block — every page already follows the same card/table/chart shell.

## Look and feel: match openGym

The app's theme and usability follow [openGym](https://github.com/DuarteSantos8/openGym) (Yusuf's standing rule: when the two differ, openGym's usability wins). In practice:

- **Black page, neutral grey cards** (`--bg` #000, `--surface` #1c1c1e, `--surface2` #2c2c2e for things nested in a card), green accent `--accent` #30d158 with black text on it (`--on-accent`). No gradients, glows or drop shadows.
- **One system font**, tabular figures for numbers. Weight carries meaning: 700 page title (34px, 30px under 420px), 600 names, 400 content. Section labels (`h2`) are 13px grey sentence case, not uppercase.
- **Fills, not outlines.** Nested items (pills, chips, inputs, options) are `--surface2` fills; separators are `var(--hair)` hairlines. A selected or "today" item gets `--accent-line` as its border.
- **Touch first.** Controls are at least 44px tall, inputs at least 16px text (17px by default) so phones never zoom, the main action of a form is a full-width filled button, presses scale to `--press-scale` / `--press-scale-sm` / `--press-scale-card`. Respect `--sat` / `--sab` safe areas.
- **Bars float.** Topbar and tab bar are `--bg-el` at 94% with a 10px blur and a hairline edge; the active tab is just the accent colour, no pill.
- Borrow patterns from openGym's `frontend/src/index.css` by reimplementing them; don't paste its AGPL code.

## Colors and tokens

- **Never hardcode a color.** Everything comes from the custom properties in `static/style.css`'s `:root` block (`--bg`, `--bg-el`, `--surface`, `--surface2`, `--surface3`, `--border`, `--text`, `--muted`, `--accent`, `--accent-soft`, `--accent-line`, `--on-accent`, `--gold`, `--orange`, `--purple`, `--danger`). For a tint, use `color-mix(in srgb, var(--accent) 16%, transparent)` rather than a raw `rgba()`.
- **Chart fills use the separate `--chart-*` tokens, never `--accent`/`--gold`/`--purple` directly.** Those bright UI accents are tuned to pop as buttons/badges and fail a categorical-lightness-band check as data marks; the `--chart-*` tokens are darker steps of the same hues, already validated (see the comment block above them in `style.css`). Adding a new chart series color needs the same validation the existing ones went through — don't just pick a new hex.
- **Never use green-vs-red as a diverging pair** (classic red-green colorblind failure). "Ahead/behind target" is a status chip — icon + label + color together (`--chart-status-good`/`--chart-status-warning`/`--chart-critical`) — never color alone.
- There is only one theme (dark) — no light-mode variant to maintain.

## Icons

- One self-hosted SVG sprite, included once in `base.html` via `{% include "_icons.html" %}`. Use an existing icon with `<svg class="icon"><use href="#icon-name"/></svg>`; only add a new `<symbol>` to `_icons.html` if nothing existing fits.
- Icons are mono-color by design — `fill: none; stroke: currentColor` (see `.icon` in `style.css`). Never hardcode an icon's stroke/fill color; it inherits from its container's text color.

## CSP — no inline JS, ever

The app sends `script-src 'self'` (see `main.py`'s `_CSP`). This means:
- **No `onclick=`, `onsubmit=`, or any inline event-handler attribute in a template.** All interactivity goes through `static/app.js`'s single `submit` listener, dispatched by CSS class — `.confirm-delete` (with a `data-confirm="..."` message) for destructive actions, `.js-toggle` for the optimistic-toggle animation. Add a new class to that dispatch table in `app.js` rather than reaching for an inline handler.
- **No inline `<script>` blocks in templates.** Any new client-side behavior goes in `static/app.js` (or a new static file linked normally), not inline.

## Accessibility twin for data

Per `charting.py`'s own module docstring: every chart is paired with a table view of the same data (the existing `.log-table` pattern) — the chart is for the at-a-glance trend, the table is the precise, accessible record. A new chart without its table twin is an incomplete pattern here, not a smaller version of it.

## Structure

- `templates/base.html` owns the shell: topbar, bottom tab bar (`.tabbar`, 4 items — Home/Meals/Training/Quests; don't add a 5th, route new pages under `/more` instead like the existing secondary pages do), and the CSP-safe `<script>` include. Don't duplicate this shell in a new template — extend `base.html` with `{% block content %}`.
- `_icons.html` and `_body_map.html` are shared partials, included where needed — check them before building a new inline SVG or muscle-group diagram from scratch.
- Destructive actions (delete buttons) are a `<form class="confirm-delete" data-confirm="...">` POST, never a bare link — consistent with how every existing delete button in the app works.
