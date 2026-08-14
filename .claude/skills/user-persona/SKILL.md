---
name: user-persona
description: Use whenever making a UX, design, or feature-priority judgment call in Fitness OS (alongside ui-ux-review and feature-fit-analysis) — this app has exactly one real user, not a target market, so "who is this for and what's their actual context of use" has a concrete, specific answer instead of a guessed-at demographic.
---

# The user

Fitness OS has one user: a data engineer with a desk job, training for a 6-month body-recomposition program (103kg → 75-80kg, Aug 2026 – Jan 2027), based in Cairo (Africa/Cairo timezone — see `clock.py`). Plays padel ~2x/week (1.5h) alongside the structured 4-day Upper/Lower gym program. Prefers Egyptian/Syrian-leaning food, no fish/seafood.

This isn't a demographic sketch for a market that doesn't exist — every field here is either read directly from `models.Profile`'s defaults or stated in the README. Update this file if any of it goes stale (e.g. the program window ends, the goal changes) rather than leaving it to drift from the real `Profile` row.

## Context of use — when and how the app actually gets opened

- **On a phone, one-handed, mid-activity** — logging a set between reps at the gym, checking the meal plan before eating, marking hydration after a glass of water. Not sitting down to "review the app." This is *the* reason it's a PWA (`static/manifest.json`, `display: standalone`) with a bottom tab bar, not a reason that's been forgotten since.
- **Sessions are short and frequent**, not long and occasional. A single visit is usually "do the one thing I opened this for" (log today's weight, mark a meal eaten, log a set) — not a browsing session.
- **Daily touchpoints**: dashboard check (streak, today's checklist), meal-slot logging (up to 5x/day), gym/home/cardio/padel logging (per session), hydration quick-add (multiple times/day). **Weekly/biweekly touchpoints**: body measurements (`/body`, deliberately reached via More, not the tab bar — see README). **Passive touchpoints**: the daily digest and weekly recap emails, meant to surface the day/week's plan and outcome without opening the app at all.
- **The instance may be cold** (Render free tier spins down after inactivity) — the very first tap of a session can hit a multi-second wake-up delay. This is infrastructure, not UX, but it shapes the same thing UX does: the cost of opening the app. A design that adds friction on top of an already-possible cold start compounds a real, existing cost.

## What "low effort" means for this specific user

Not "fewer features" — the gamification layer, charts, and projections all exist because they help sustain a 6-month program, and removing them isn't a friction win. Low effort here means:
- **Fewest taps/fields for the thing this exact context needs** — see `ui-ux-review`'s upsert-by-date and empty-state conventions.
- **No re-deciding something already decided** — the program, the meal plan, the macro targets are all pre-computed; a feature that asks the user to re-enter or re-confirm something the app already knows is adding cost, not value.
- **Legible at a glance, mid-activity** — a screen that needs to be *read carefully* to understand doesn't fit a one-handed, between-sets context. Direct labels over legends, status chips over raw numbers needing interpretation (both already established conventions — see `frontend-design`).

## Using this alongside the other UX/planning skills

- `feature-fit-analysis` asks "does this serve the program's actual goals" — this file is what makes "actual goals" concrete (whose goals, what timeline, what constraints).
- `ui-ux-review` asks "where does this live, what's the empty state, what's the one-handed path" — this file is the *why* behind judging those three questions the way it does.
- `training-programming` / `nutrition-domain` are the domain rules; this file is the person those rules are in service of.
