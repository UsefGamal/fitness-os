---
name: ui-ux-review
description: Use when designing a new screen or flow in Tafra, or reviewing an existing one for usability. Covers where things live, empty states, confirms, and the one-handed phone path; colours and sizes are in CLAUDE.md's code rules.
---

# UI/UX review

Tafra is an Android app used one-handed, mid-workout or mid-meal, on a 360-412 px phone, in light or dark theme and left-to-right or right-to-left. Judge every UI decision against that, not against desktop web conventions.

## Where things live

- **The tab bar has five places:** Home, Plan, Start, Meals and Stats (`mobile/src/components/TabBar.jsx`). With the Meals module off, Library takes its slot. A new feature does **not** get a sixth tab. Ask: is it a daily action (on Home, or inside an existing tab) or a periodic one (a page reached from a tab, or Settings)?
- **Settings is a hub** of sections (`mobile/src/lib/settingsPages.js`): Training, Times, Data, Preferences, About, plus Modules, Safety, Health Connect, Help and Privacy, with search. A new setting goes in the section it belongs to and gets search words; it doesn't get a new top-level page.
- **Start holds every kind of session:** the guided workout, intervals, follow-along, and home, cardio, padel, stretching and recovery sessions. A new session type is another entry there.
- **Count the taps** from opening the app to the thing needed right now. Home's today card exists so the daily check needs no tab hopping; a frequent action deserves the same.

## Friction, empty states, confirms

- **Logging edits in place:** re-logging today's weight or meal updates it; don't add a separate "edit mode".
- **Empty states say what to do:** use `EmptyState` with the action that makes data appear ("Log two workouts to see your volume here"), never a blank chart or a bare "No data".
- **Destructive actions confirm** with `ConfirmSheet`, naming what goes ("Delete Tuesday's workout and its 18 sets?"), never a generic "Are you sure?". Prefer undo when it's cheap.
- **Sheets for short choices** (`Sheet`), pages for anything with its own history or long content.
- **Every visible string** goes through `t()` in `mobile/src/i18n/en.js`.

## Before shipping a UI change

1. **Where does it live?** (a tab, a page under one, or a Settings section)
2. **What does it look like with no data, and with three years of it?**
3. **What's the one-handed path?** Main action in thumb reach, 44 px taps, 16 px inputs, a confirm on anything destructive.
4. **Run the harness:** `npm run e2e` checks every route at 360/390/412 px in both directions for axe errors, small taps and sideways scroll. Add a state to `e2e/harness.mjs` `STATES` for a new screen.

If a new screen has no place without a sixth tab, it belongs under an existing tab or in Settings: raise it rather than adding a tab.
