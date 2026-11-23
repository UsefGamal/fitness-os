---
name: training-programming
description: Use when writing or reviewing anything training-related in Tafra: ready-made routines (content/routines.py, content/*_plan.json, content/gym_exercises.py), the weekday schedule, weight suggestions (mobile/src/lib/progression.js), rest, safety limits on training, or other session types. Keeps new content and logic consistent with the rules already set.
---

# Training rules

## Routines

- **Ready-made routines only** (no plan generator, PRODUCT.md). They live in `content/routines.py`, `content/starter_plan.json` (beginner full body) and `content/trainer_plan.json` (Upper / Lower / Push / Pull / Leg), built into sessions by `content/gym_program.build_program()`. People pick one on Plan > Routines, edit days, or build their own (`myRoutine.js`, `planEdit.js`); the original stays as the starting point and "Reset" puts a day back.
- **Coaching rules:** beginners at RIR 2-3 in sessions of about 45 minutes; intermediates at RIR 1-3; nothing to failure. Every day has a warm-up, focus and exercises with sets, reps, rest and RIR.
- **Exercise names must match `content/gym_exercises.py`** exactly; the home routine uses bodyweight moves only (`tests/test_content_contract.py`, `tests/test_routines.py`).
- Each exercise has a level (beginner, intermediate, expert). Moves above the person's level are labelled "Advanced", never hidden (`levels.js`); swap lists put same-level, same-muscle options first.

## Schedule

- **By weekday**, not by session count: each routine maps days of the week to sessions, the week starts on the person's chosen day (Sunday default), and sessions sit at the person's training time with an optional evening slot. A session can be moved to another day for one week (`schedule.js` `moveSession`). `schedule.test.js` mirrors `tests/test_gym_program.py`: change both together.

## Weight suggestions: `mobile/src/lib/progression.js`

Double progression, shown as a `reason` under the weight on the workout screen:
- All work sets at the top of the rep range: **add weight** and start again at the bottom. The jump comes from the equipment (`stepFor`/`jumpFor`): 2.5 kg for barbells and machines, the next pair up for dumbbells and kettlebells, and for light loads never more than 10% of the load (at least 1 kg).
- Not yet at the top: **same weight**, aim for one more rep.
- Missed the bottom of the range two sessions running: **drop 10%** and build back up.
- Bodyweight moves progress by reps, then point to a harder version (`progressions.js` ladders); timed holds add 5 s.
- No history: "pick a comfortable starting weight", never an invented number.

## Safety

The setup screening can limit training (`safety.js`): beginner-only, gentler RIR (3+) and swaps away from injured areas (shoulder, elbow/wrist, lower back, hip, knee, ankle via `content/safety_swaps.py`). New training logic must go through `safeDay()` so those limits hold.

## Other sessions

Home, recovery, cardio and padel (with a win/loss/draw result) are logged in one go as their own session types (`SESSION_TYPES` in `data.js`) with session-level effort; intervals and follow-along runs are logged from their own screens. Only gym sets carry per-set weight, reps and RIR. Intervals (`intervals.js`, `content/interval_program.py`) count towards load, not the lifting progression.
