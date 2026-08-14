---
name: frontend-design
description: Use when adding or editing a Jinja2 template, static/style.css, or static/app.js in Fitness OS — any UI-facing change. Covers the existing dark-theme token system, CSP constraints (no inline JS), the icon sprite, and the accessibility-twin pattern for charts, so new UI matches the app instead of drifting from it.
---

# Frontend design conventions

This app is server-rendered Jinja2 + plain CSS — no JS framework, no build step, no component library. "Design system" here means: reuse the existing CSS custom properties, the existing icon sprite, and the existing template structure, rather than inventing new patterns per page.

## Before writing any UI

1. **Skim an existing template that does something similar** (`templates/body.html` for a log-with-history page, `templates/gym_detail.html` for a form-heavy detail page) rather than starting from a blank block — every page already follows the same card/table/chart shell.

## Colors and tokens

- **Never hardcode a color.** Everything comes from the custom properties in `static/style.css`'s `:root` block (`--bg`, `--surface`, `--surface2`, `--border`, `--text`, `--muted`, `--accent`, `--gold`, `--purple`, `--danger`).
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
