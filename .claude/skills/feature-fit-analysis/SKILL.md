---
name: feature-fit-analysis
description: Use before building a new feature, logged entity, screen or integration in Tafra, or when someone proposes one. Weighs it against PRODUCT.md's v1 scope, the offline/no-server rules and the cost of keeping it working, before any code is written.
---

# Feature-fit analysis

Tafra is an offline Android app for people training on their own: a ready-made routine, guided workouts, calorie and macro targets, a meal plan and a shopping list. Version 1 goes to a small pilot and then Google Play. [`PRODUCT.md`](../../../PRODUCT.md) is the scope; judge new work against it, not against what a general fitness app "should" have.

## Before proposing or building something new, answer these

1. **Is it already decided?** Check PRODUCT.md's "Won't now" and "Could, after v1" lists first. A plan generator, food search or barcodes, accounts or sync, several profiles, leaderboards, "streak at risk" pushes and any telemetry are out. If a request maps onto one of these, say so plainly and ask whether the goal is something narrower, rather than building around a written decision.

2. **Does it break the hard rules?** No server, no account, no network calls with user data, one app version for everyone, kg only, works on a 360 px screen and right-to-left, every watch or Health Connect feature optional. A feature that needs any of these broken is a scope change, not a feature.

3. **Does it feed something the app already shows?** Targets, the weight trend and pace, streaks, records, muscle volume, the meal ticks and the shopping list. A feature that feeds one of these, or makes logging something that already feeds one quicker, has a clear payoff. One that adds a new number needs its own reason.

4. **Derive before asking.** Prefer working insight out from what's already logged (workouts, sets, weigh-ins, meal ticks, watch data when present) over a new thing to log by hand. A new logged field needs a reason it can't be derived.

5. **Count the cost.** New stored data means a data-format version bump, an upgrade step in `mobile/src/lib/migrate.js`, backup/import handling and tests, because the phone holds the person's only copy. New screens need the e2e harness states, i18n strings and safety handling. Ask whether an existing screen or field can absorb it.

6. **Is it safe for everyone?** The setup screening can switch off a deficit, cap protein or hide weight (`mobile/src/lib/safety.js`). A feature about food, weight or intensity must respect those gates and never reward weight loss alone.

## Output

State what the feature is, which part of v1 it serves (or why it's worth it anyway), what it costs (new data or not, new screen or not), and any written decision it touches. Then let the person decide: this skill surfaces the trade-off, it doesn't veto ideas.
