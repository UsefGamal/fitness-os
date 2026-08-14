---
name: feature-fit-analysis
description: Use before building a new feature, logged entity, or integration in Fitness OS, or when the user proposes one — this is a single-user app scoped to a specific 6-month body-recomposition program, not a general product, so "would this be nice to have" isn't the right bar. Weighs a proposed feature against the program's actual goals and the app's own documented scope decisions before writing code.
---

# Feature-fit analysis

This app has one user and one stated purpose (`README.md`'s opening line): a 6-month body-recomposition program, `PLAN_START_DATE = 2026-09-01` through the profile's `goal_date` (2027-01-18), tracked via structured meal/gym adherence and a blended confidence score. That's the actual product spec — not "a fitness app," this specific program. Judge new work against it, not against what a general fitness app "should" have.

## Before proposing or building something new, answer these

1. **Does it move a number the app already tracks, or does it need a new one?** The app already computes: meal adherence %, training adherence %, confidence score (pace-vs-target blended with adherence), streak, predicted goal date. A feature that feeds one of these (or removes friction from logging something that already feeds one) has a clear, checkable payoff. A feature that doesn't touch any of them needs its own justification for *why it matters to this program*, not just "would be useful to know."

2. **Check `README.md`'s "Known gaps / deliberately out of scope" list first.** Apple Health/Google Fit sync and a progress-photo timeline are already explicitly declined — if a request maps onto one of these, that's a decision already made, not a gap waiting to be filled. Raise it explicitly ("this is the photo-timeline idea the README already scoped out — still want it, or is the goal something narrower?") rather than silently building around a documented decision.

3. **Weigh the maintenance surface against the marginal value.** A new logged entity is a real, permanent cost: a model + migration (`db-migration-checklist`), a router (`new-logged-entity`), a template (`frontend-design`/`ui-ux-review`), tests, docs. For a program with a fixed ~5-month remaining window, ask whether an existing field/entity could absorb this instead — e.g. a new kind of note might fit `Workout.pain_note`'s pattern rather than needing its own table; a new metric might belong in `content/projections.py` computed from data already logged, rather than requiring a new log type at all.

4. **Prefer deriving over asking.** The app's whole design leans toward computing insight from what's already logged (adherence-vs-outcome insight, confidence score, pain-pattern flag) rather than adding another thing for the user to manually track. A proposed feature that adds logging burden should have a specific reason it can't instead be derived from existing `BodyLog`/`Workout`/`MealLog` data.

5. **Consider the program's actual end date.** A feature whose payoff mostly accrues after 2027-01-18 (the goal date) is lower priority than one that helps the next few months — this isn't a forever-app, it's a program-length one. Say so explicitly if a proposal reads as more useful post-program than during it (e.g. long-term trend analysis across future years).

## Output of this analysis

State plainly: what the feature is, which existing metric/goal it serves (or why it's justified despite not serving one), what it costs to build (rough shape: new entity vs. an addition to existing data), and whether an existing gap-decision in the README already covers this ground. Then let the user decide — this skill is for surfacing the tradeoff clearly, not for vetoing ideas.
