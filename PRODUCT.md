# Fitness OS: what v1 is, and what it isn't

This is the scope for version 1, the build Yusuf shares with friends on 24 Jan 2027. When a new idea comes up, check it against this page first. A "Won't now" item needs a written reason to move.

## Who it is for

- **Yusuf**, on his own phone, with his own Upper / Lower / Push / Pull / Leg plan and his 14-day high-protein meal plan.
- **A few friends** with different jobs, goals and schedules, each on their own phone.
- One person per install. Each friend's data lives only on their phone. There are no accounts and no server.

## What v1 does

- **Plan and train.** A weekly plan picked from a small set of vetted templates (Yusuf's own plan stays in his build only), a guided workout screen with prefilled weights, a rest timer that also runs in the notification shade, History, Library and Stats.
- **Eat to the goal.** Calorie and macro targets from the person's profile and goal, the meal plan with ticks, and a weekly shopping list. Nutrition is this app's edge, so it is never traded away for gym-tracker features.
- **Stay safe.** A short screening on setup that switches off a calorie deficit, hides weight or caps protein when it should. Skipping the screening counts as "gated", not as "all clear".
- **See progress.** A goal card with the weight trend and a pace inside a safe band, a weekly streak with a free skip, and badges that never reward weight loss alone.
- **Keep the data.** Versioned data with automatic upgrades, snapshots before every upgrade or import, backups the person can save anywhere, and a reminder to back up.
- **Seasons.** Ramadan mode (suhoor and iftar slots, a capped deficit) and a maintenance phase after the goal.
- **Languages.** English first. Arabic for setup, safety and the app's chrome in v1, and everywhere by 28 Mar 2027.

## How we ship it

- Signed APKs come only from tags, with one keystore and one app ID. Debug builds install beside the real app (`.debug`), never over it.
- Every tag that changes the data format is rehearsed on a real phone first: install the previous release, update over it, and compare the exports.
- A pilot with 2-3 friends (including one Xiaomi/Redmi and one Infinix/Tecno phone) and a fix week come before the wide share.
- The dated plan is in the roadmap doc's "Roadmap and backlog" tab.

## Won't now

These stay out of v1. Each one either needs a server, puts health data at risk, or costs more than it gives for a few friends.

- A plan generator. Plans come from a few vetted templates.
- Food search, barcode scanning or a food database.
- Accounts, sync between phones, or any server.
- The Play Store. The APK is shared directly.
- Several profiles on one phone.
- Leaderboards, or "streak at risk" push messages.
- Fiber hints.
- Crash-reporting SDKs, analytics or any telemetry. Bug reports are a text the person chooses to send.
- Device farms. Testing uses the pilot friends' real phones.

## Could, after v1

Graduation from the app, a co-op challenge, one points currency, accessory refreshes, a HIIT limit, a readiness hint, refeed copy, portion scaling, vegetarian plans, a session-count rotation, a biometric lock, an APK size guard, encrypted backups, and Health Connect IDs.
