---
name: training-programming
description: Use when writing or reviewing anything training-program-related in Fitness OS — the gym/home/cardio/recovery program content (content/gym_program.py, content/home_program.py, content/cardio_program.py, content/recovery_program.py), the autoregulation/weight-suggestion logic in routers/gym.py, or deload timing (training_counter.py). Encodes the programming methodology already established, so new program content or logic doesn't quietly contradict it.
---

# Training programming rules

Like `nutrition-domain`, this is one real program for one real person on a real timeline, not general fitness best practices.

## Program structure

- **4-day Upper/Lower split**, intermediate level, rotating `UA → LA → UB → LB → repeat` — by *count of sessions logged*, not by calendar day (`training_counter.count_training_sessions()`), since real frequency flexes around padel/work. Never hardcode "day N of the week" logic for gym/home rotation; always derive it from the session count.
- **Gym and Home share one rotation counter** (`workout_type in ("gym", "home")`) so switching between them mid-week doesn't reset the split — a bodyweight day and a gym day both advance the same Upper/Lower position. **Recovery, Cardio, and Padel never advance it.** Get this wrong and the rotation desyncs from what the user actually did.
- **Exercise names in program content must match `content/gym_exercises.py` entries exactly** — the match is by string name, not an ID/FK, so a typo silently breaks the weight-suggestion lookup (`last_performance` in `routers/gym.py`) instead of erroring.
- Each program day has `warmup`, `cooldown`, `focus`, and an `exercises` list (`name`/`sets`/`reps`/`rest`) — a new program day needs all of these, matching the existing shape (see `content/gym_program.py`'s Upper A entry as the reference).

## Autoregulation (weight suggestions)

`routers/gym.py`'s `_suggest_next_weight()` implements `PROGRESSION_NOTE`'s stated rule exactly — don't let these drift apart if you change one:
- Hit the top of the rep range on every set → **+2.5kg for upper-body lifts, +5kg for lower-body** (`muscle_group == "Legs"` → 5kg increment, else 2.5kg).
- Hit the top of the range but **last RPE ≥ 9** → hold at the same weight instead of adding load ("maxed out — hold before adding more"). This overrides the plain top-of-range rule; RPE is the tiebreaker.
- Otherwise (didn't hit the top of the range) → repeat the same weight.
- No prior data for that exercise → "pick a comfortable starting weight," never a fabricated number.

If you touch this logic, update `PROGRESSION_NOTE`'s user-facing text in the same change — it's the plain-language version of exactly this rule, shown on `/gym`.

## Deload

- **Deload cadence is `DELOAD_REMINDER_WEEKS = 6`** in `training_counter.py`, counted from the last `Workout` with `is_deload=True` on gym/home (or from `PLAN_START_DATE` if none logged yet) — not a fixed calendar schedule.
- A deload session: same exercises, "about a third fewer" sets per `PROGRESSION_NOTE` — don't invent a different deload shape (different exercises, different rep scheme) without updating that user-facing text to match.
- The rationale is explicit in the program content: "on an aggressive cut, fatigue builds up faster than usual" — this app is deliberately more deload-proactive than a maintenance-phase program would be. Don't loosen the 6-week cadence on the assumption a generic program would use 8-12.

## Cardio / Recovery / Padel

- **Cardio is explicitly excluded from the gym/home lift rotation** — it's `workout_type == "cardio"`, doesn't touch `count_training_sessions()`. Keep it that way; folding cardio into the rotation would break the Upper/Lower alternation.
- **Recovery** is a simple checklist (walk/stretch/mobility), not a loaded session — don't add weight/RPE-per-set fields to it; session-level RPE (`Workout.session_rpe`) is enough, matching how it's used elsewhere (home/cardio/padel all use session-level RPE; only gym has per-set RPE, because gym is the only one with discrete loaded sets).
- **Padel** tracks `result` (win/loss/draw) — no other workout type has this field; don't add it elsewhere without a reason, since it exists specifically to drive the W-L-D record.

## Pain tracking

`Workout.pain_note` is free text, aggregated dashboard-wide into the pain-pattern flag (3+ of the last 5 sessions, *any* training type, flagged discomfort — see `main.py`'s `pain_pattern_flag`). This is intentionally cross-type, not per-workout-type — a new training feature that logs pain/discomfort should feed this same field rather than creating a parallel one, or the pattern-detection breaks.
