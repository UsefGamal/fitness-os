---
name: ui-ux-review
description: Use when designing a new page/flow or reviewing an existing one for usability in Fitness OS — distinct from frontend-design (which covers CSS tokens/CSP/icon mechanics). This is about information architecture, mobile-first usability, and the friction-reduction philosophy the app already has, not visual styling.
---

# UI/UX review

This is a single-user PWA (`static/manifest.json`, `display: standalone`) meant to be used one-handed, mid-workout or mid-meal, on a phone — not browsed at leisure. Every UI decision should be judged against that context, not against general web-app conventions.

## Information architecture

- **The bottom tab bar has exactly 4 items** (Home, Meals, Training, Quests — see `templates/base.html`'s `.tabbar`) and that's deliberate, not an oversight. A new top-level feature does **not** get a 5th tab — it goes under `/more` (see `templates/more.html`) alongside Settings/Help/sync, the same way Body tracking already does. Ask: is this a *daily* action (tab bar) or a *periodic* one (More)? The README is explicit about this exact distinction for Body tracking ("weekly/biweekly check-in, not a daily one").
- **`/training` is a hub page**, not a workout type — gym/home/recovery/cardio/padel all nest under it. A new training-adjacent feature likely belongs as a 6th card there, not a new top-level route.
- Trace a new page's reachability before building it: from the tab bar, how many taps to the thing the user actually needs *right now*? The dashboard's "Today's Checklist" exists specifically so a daily check-in doesn't require hopping across tabs — a new frequently-used action should get the same treatment, not force a detour through a list page first.

## Friction and empty states

- **Every log action is upsert-by-date** (see `new-logged-entity`) specifically so re-logging the same day *edits in place* — a UI that makes the user hunt for "edit today's entry" instead of just re-submitting the form is fighting this. Don't add a separate "edit mode" toggle where the existing upsert already handles it.
- **Charts have a standard empty state**: `<p class="chart-empty">` with a message telling the user exactly what to do to make the chart appear (`"Log a couple of gym sessions with sets to see your volume trend here."` — see `templates/gym_progress.html`). Never render a blank chart container or a bare "No data" — say what action produces data.
- **Destructive actions confirm via `.confirm-delete` + `data-confirm="..."`** (see `frontend-design`) — write the confirm message to name what's being deleted, not a generic "Are you sure?".
- Every chart/meter needs its accessibility-twin table per `frontend-design` — but check whether one *already exists elsewhere in the same flow* (e.g. cardio/padel's duration sparkline is twinned by the session-history table right below it) before adding a redundant one. Don't twin the same data twice on one page.

## Before shipping a UI change

Ask these three, in order — they're phrased as *decisions*, not a checklist to satisfy:
1. **Where does this live?** (tab bar / hub page / More — see above)
2. **What does it look like with zero data?** (a chart-empty message, not a blank card)
3. **What's the one-handed, mid-activity path through it?** (minimum taps, upsert not re-navigate, a confirm on anything destructive)

If you can't answer where a new page lives in the nav without adding a 5th tab bar item, that's a sign it belongs under `/more` or nested under an existing hub instead — raise it rather than defaulting to a new tab.
