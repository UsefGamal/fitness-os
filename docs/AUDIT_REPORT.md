# Tafra V1 audit (26 Nov 2026)

A read-only audit of `main` at `db645f5` (app version 1.1.44). Nothing in the app was changed. Fixes wait for the owner's go-ahead.

**How it was done.** Five specialist reviewers (data integrity, training, nutrition, privacy and Android, UX and tests) read the code. Where they could, they ran throwaway scripts against the pure helpers in `mobile/src/lib`. Each then read the others' findings and confirmed, challenged or re-rated them. A lead review re-checked the key file and line references. An outside review's list of worries was used as leads to check, not as findings.

**Labels.** *Confirmed* means the code path was read and a concrete failing input is known. *Risk* means plausible but not shown. *Needs phone* means only a real device can settle it. Priority: **P0** data loss, security or safety now; **P1** wrong core numbers, broken core journey, release integrity; **P2** real but narrow; **P3** polish.

---

## 1. Executive assessment

Tafra is in good shape for a pilot. There are no P0 findings.

- **Checks are green.** 856 unit tests, 98.9% line coverage, 373 pytest cases and lint all pass locally. CI and the APK build passed on this commit.
- **Data handling is careful.** Writes are atomic, newer data formats are refused, and old backups are upgraded. Encryption is AES-GCM with PBKDF2 at 600k rounds. Unreadable data opens a recovery screen, never Setup.
- **No network traffic.** The page only allows connections to itself, and outside links open only on a tap.
- **The core maths is right.** BMR, TDEE, the 25% cap, floors, protein per kg and double progression all match the rules.

The gaps are where **rules meet each other**. Each safety gate is tested on its own, but not combined with maintenance, Ramadan or the weekly calorie cuts. Four nutrition P1s live there. The others:

- one release-integrity issue (the last tag),
- one way two overlapping file writes delete the backup copy,
- three training-progression bugs,
- a few doc mismatches, including the recovery hint.

**Before the pilot,** fix the 9 P1s. That's about 4 small PRs. Then align the docs, and run the real-phone checks, none of which are recorded yet.

---

## 2. Feature matrix

Status key: **V** = verified by tests · **T** = works, thin tests · **Ph** = needs a phone · **P** = partial · **D** = deferred.

| # | Feature | Status | Where / note |
|---|---|---|---|
| 1 | Setup | V | `Setup.jsx`; journey `setup`. No backup tip in Setup |
| 2 | Safety screening | V* | `safety.js`; *not tested combined with other modes (NUT-1..4) |
| 3 | Goal | V* | `macros.js` `saveProfile`; *see UX-3 |
| 4 | Routine pick | V | `routines.js`, `test_routines.py` |
| 5 | Weekly schedule | V | `schedule.js` |
| 6 | My routine | V | `myRoutine.js`, `planEdit.js` (TRN-7) |
| 7 | Exercise library | T | `/library/:id`, `/catalogue/:id` not in screen checks |
| 8 | Swaps | V* | *swap ladder ignores injury limits (TRN-8) |
| 9 | Guided workout | V* | `Workout.jsx`; *UX-1 |
| 10 | Set logging | V | `data.js`; double tap logs 2 sets (risk) |
| 11 | Progression | V* | `progression.js`; *TRN-1, 2, 4, 5 |
| 12 | Rest timer + shade | Ph | `RestTimerService` has no tests |
| 13 | Paired sets | V | `superset.js` |
| 14 | History | T | `/history/:id` not in screen checks |
| 15 | Records | T | `records.js`; toast repeats (TRN-6) |
| 16 | Muscle volume | V | `muscleVolume.js`, helpers count ×0.5 |
| 17 | Recovery | V | deload and by-muscle; hint is DEC-1 |
| 18 | Calorie and macro targets | V* | *NUT-1, NUT-4 |
| 19 | Meal plan + ticks | V* | *NUT-2, 3, 6; no tick journey |
| 20 | Recipes | T | `/meals/library*` not in CI screen checks |
| 21 | Meal swaps | T | unit only |
| 22 | My foods / ate else | V* | *NUT-5 |
| 23 | Water | T | unit only |
| 24 | Shopping list | V | amounts like "4.5 pc" (risk) |
| 25 | Ramadan | V* | *NUT-4 |
| 26 | Weight, goal card, maintenance | V* | *NUT-1 |
| 27 | Measurements | V | `bodyStats.js` |
| 28 | Progress photos | Ph | `PhotoLockPlugin` untested |
| 29 | Stats, badges, quests | V | |
| 30 | Health Connect | Ph | AND-1, AND-3; `/settings/health` not in screen checks |
| 31 | Reminders | Ph | DOC-2 |
| 32 | Widget | Ph | `TodayWidget` untested |
| 33 | Settings | V | 9 sections + search |
| 34 | Backup, restore, auto, encrypted | V* | *DATA-1, 2, 8 |
| 35 | Migrations | V | `migrate.js` (95% strict); needs phone rehearsal per PRODUCT.md |
| 36 | Delete everything | P | no test runs `deleteEverything`; DATA-5, DATA-7 |
| 37 | Bug report | T | user-sent, editable preview; DOC-3 |
| 38 | What's new | V* | *REL-1: a tag that differs from `package.json` is never tested |
| 39 | Android build and signing | Ph | update-over-install runs on an emulator |
| 40 | Google Play | D | console steps are the owner's |

26 verified, 7 thin, 6 need a phone, 1 partial, 1 deferred. A star means verified but with a finding.

---

## 3. Top 20 findings

All are confirmed unless marked. There's one line on each here, and detail in sections 5 to 8.

| # | ID | P | Finding |
|---|---|---|---|
| 1 | REL-1 | P1 | Tag `v1.0.9` was put on a 1.1.44 commit |
| 2 | DATA-1 | P1 | Two overlapping file-mirror writes can delete the data file |
| 3 | NUT-1 | P1 | Step-up back to maintenance ignores "no deficit" gates |
| 4 | NUT-2 | P1 | Full plan view shows kcal when calories are hidden |
| 5 | NUT-3 | P1 | Plan meals ignore the protein cap |
| 6 | NUT-4 + UX-3 | P1 | Weekly kcal cuts bypass the Ramadan cap and survive a goal change |
| 7 | UX-1 | P1 | A workout left open on an earlier day becomes today's |
| 8 | TRN-4 | P1 | Second session after a long break jumps above the old best |
| 9 | TRN-1 | P1 | 2-day plans: Sunday's lifts never progress |
| 10 | DATA-2 | P2 | A failed snapshot doesn't stop an import or upgrade |
| 11 | TRN-8 | P2 | Easier/harder swap ladder offers moves the injury limits ban |
| 12 | DATA-8 | P2 | Backups to sync-app folders are saved unencrypted |
| 13 | AND-1 | P2 | Revoked Health Connect permission goes unnoticed |
| 14 | NUT-5 | P2 | "Ate something else" meals count 0 protein in the week row |
| 15 | TRN-2 | P2 | "Drop 10%" does nothing on light weights |
| 16 | AND-3 | P2 (risk) | Health Connect ids reused after reinstall overwrite old sessions |
| 17 | DATA-7 | P2 (risk) | Delete everything can race a running write, so data comes back |
| 18 | NUT-6 | P2 | Plans for about 1400-1600 kcal often aren't scaled |
| 19 | TRN-3 | P2 | "per side" / "per leg" reps aren't understood |
| 20 | TRN-5 | P2 | Barbell isolation targets use 1 kg jumps you can't load |

---

## 4. Critical and high-priority risks

There are no P0 findings. The P1s that touch **safety** are NUT-1, NUT-2, NUT-3, NUT-4 and TRN-4. The P1s that touch **data** are DATA-1 and UX-1. The release-integrity P1 is REL-1.

**REL-1 · P1 · release.** Tag `v1.0.9` points at `db645f5`, where `mobile/package.json` is 1.1.44. The APK name and version come from the tag (`scripts/version-from-tag.sh`, `mobile/vite.config.js:16`). So that release runs 1.1.44 code but reports 1.0.9. Its What's new shows only the old 1.0.9 notes, and none of the 1.1.x changes, including the rename to Tafra.

- **Next tag:** `v1.1.44` (or later) is safe. The versionCode goes from 1000009 to 1001044, with the same key. Phones that saw 1.0.9 will then get all 45 entries from 1.1.0 at once.
- **Fix:** the release job fails when the tag and `package.json` differ, and the What's new sheet caps its length.

**DATA-1 · P1 · data.** `writeMirror` starts a new `flush` with no check for one already running (`mobile/src/store/mirror.js:47-68`). Two `atomicWrite` calls then share one `.tmp` file (`lib/durable.js:43`). When the second rename fails, the Android fallback deletes the real file before retrying (`store/fs.js:36-42`). The file copy is then gone until the next save.

- localStorage is written first, so loss needs a second fault, such as localStorage being lost on a kill (DATA-9, needs a phone).
- The data reviewer rated it P2. The lead keeps it at P1, because the code itself deletes the good copy and the fix is small.
- **Fix:** chain flushes through one promise. Never delete the target unless the `.tmp` file exists.
- **Test:** a slow fake file system in a new `store/mirror.test.js`.

**UX-1 · P1 · data + UX.** At start, any workout with `started_at` and no `finished_at` becomes the active one, whatever its date (`store/useData.js:189`).

- Home still says Start, and `Workout.jsx` reopens the old session. New sets get the old date.
- Records, weekly volume and streaks then land on the wrong day, and today shows as missed.
- The old `is_deload` and `easy` flags carry over.
- Health Connect gets a session running from the old start until now.
- **Fix:** when the open workout is from an earlier day, ask once: finish it at its last set, or discard it.

---

## 5. Training and nutrition

### Training

Double progression is correct: 40×8/10/12 suggests 40 kg aiming for 9 reps, and 3×12 suggests 42.5×8. Also correct:

- A first-time exercise gets no invented weight.
- Warm-ups and holds stay out of records.
- A workout killed mid-way is restored.
- Swaps keep their own history.
- Every routine exercise exists in the library.

- **TRN-1 · P1.** A gap of 4 or more days counts as a "short comeback" (`lib/comeback.js:13`). That marks the session `easy` (`Workout.jsx:415`), and easy sessions are left out of progression (`recovery.js` `withoutRecovery`). On `starter-2` and `full-body-2` (Sunday and Wednesday), Wednesday to Sunday is 4 days. So the Sunday session never adds weight and shows "Welcome back" every week. A 3-day user who misses one session hits the same thing. **Fix:** don't mark `short` as easy.
- **TRN-4 · P1.** After about 7 weeks off, the easy first session back is excluded from progression. The second session then reads the pre-break 3×12 and suggests 42.5 kg against a 40 kg best. **Fix:** after a 14+ day gap, cap the target at the pre-gap top until it is hit again.
- **TRN-8 · P2.** Today's swaps are applied after `safeDay` (`Workout.jsx:210-212`). With the shoulder limit on, the swap sheet can offer "Harder: Decline Push-up", which is itself flagged for shoulders. Ten steps in the easier/harder ladders are flagged for some limit. **Fix:** filter ladder and alternative picks through the active limits.
- **TRN-2 · P2.** The deload rounds `top × 0.9` to the step (`lib/progression.js:93`). So 4-10 kg dumbbells and 5 kg isolation moves stay at the same weight while the text says "drop 10%". The comeback 90% path has the same flaw.
- **TRN-3 · P2.** The rep and hold patterns (`progression.js:7,16`) reject "per leg" and "per side". home-3's Side Plank is logged as reps, and its per-leg moves never progress.
- **TRN-5 · P2.** `stepFor` gives every isolation move 1 kg steps (`progression.js:44`), so a barbell or EZ-bar curl goes from 30 to 31 kg, which can't be loaded.
- **TRN-6 · P3.** The "New best" toast fires on every set that beats earlier workouts, including a repeat set in the same workout (`lib/data.js:313`). Stored records stay correct.
- **TRN-7 · P3.** A Plan rest typed as "3" is stored as 90 s (`lib/planEdit.js:32`).
- **Risks.**
  - The intermediate upper-lower-4 and full-body-3 plans give chest about 6 sets a week, below the app's own 10-20 guide.
  - Trainer-plan leg days run about 90 minutes.
  - Dumbbell and machine steps land on odd sizes (12→13 kg).

### Nutrition

BMR (Mifflin-St Jeor) and the activity factors are the same in JS and in content. These limits are also correct:

- the 25%, 1000 kcal and 1%-of-body-weight caps,
- the 1500 and 1200 kcal floors,
- protein per kg of goal weight,
- Ramadan's 15%,
- skipped screening counting as gated,
- under-18 getting maintenance.

All 108 meals agree with 4P+4C+9F within 10%, with no duplicates. Custom foods keep their numbers when the target changes. The adaptive TDEE from Health Connect is clamped to BMR×1.2-1.9, and the same caps apply to it.

| Persona | Target kcal / protein | Plan day vs target |
|---|---|---|
| Beginner, fat loss (F, 85 kg) | 1616 / 138 g (25% cap) | -2.6% |
| Intermediate, maintain (M, 78 kg) | 2655 / 140 g | -5.8% |
| Experienced, gain (M, 75 kg) | 3281 / 130 g | not scaled, -42% |
| Skipped screening (M, 100 kg) | 2952 / 120 g cap | not scaled, 173 g protein |
| Ramadan, lose (M, 95 kg) | 2422 / 162 g (15% cap) | +4.7% |

- **NUT-1 · P1.** The step-up back to maintenance after a reached goal is applied whenever `mode === 'maintain'` (`lib/macros.js:205-206`). That includes when a gate such as pregnancy, eating, or a skipped screening sets maintenance. Computed: 1653 kcal against a TDEE of 1892 for up to 6 weeks. **Fix:** skip the step-up when `no_deficit` is on.
- **NUT-2 · P1.** The full plan view (`views/Meals.jsx:232`, plus the summary, drift and option lines) shows kcal even when calories are hidden. The simple view hides them (`:63`). Everyone who skips screening sees calories one tap in.
- **NUT-3 · P1.** With the protein cap on, the scaler only drops the protein floor (`lib/portions.js:149`). It never aims below the cap, and `macroCheck` never flags protein that is too high. A kidney-gated 60 kg user, capped at 72 g, is served 132-173 g. The target screen itself is right.
- **NUT-4 + UX-3 · P1.** Confirmed weekly cuts are added after every cap, with only the floor checked (`macros.js:209-214`). Computed: a 29% deficit in Ramadan against the 15% limit, and 400 kcal while fasting for a diabetes-gated user. Changing the goal edits it in place (`macros.js:76-79`), so old cuts and the old `set_on` survive. A lose → gain → lose switch brings the cuts back and skips the 3-week wait. **Fix (one PR):** keep the adjusted kcal within that day's `maxDeficit`, and start a fresh goal when the direction or target changes.
- **NUT-5 · P2.** "I ate something else" stores `custom` with `eaten: null` (`lib/myFoods.js:58`). The week's protein row (`lib/mealWeek.js:25`) and the measured burn (`lib/measuredBurn.js:45`) read only `eaten`, so a 40 g custom lunch counts as 0.
- **NUT-6 · P2.** At scale factors 0.70-0.80, 19 day-factor pairs miss the 5% window and show the 1994 kcal plan as written. Users at about 1400-1600 kcal, mostly smaller women on a cut, are the ones hit.
- **Risks.**
  - Above 2792 kcal (1.4 × plan), the plan isn't scaled at all. That affects 14 of the 30 test personas (see DEC-3).
  - Outside Ramadan, cuts can pass the 25% cap: 39% after 3 steps (see DEC-2).
  - The 1,000-profile test checks the deficit with share 1, not 0.25 (`macrosPersonas.test.js:87`).
  - Shopping amounts aren't rounded for buying ("4.5 pc", "1.755 kg").

---

## 6. Data integrity

**These already work:**

- Atomic tmp-then-rename writes, with a read fallback to `.tmp`.
- No writes before the data has loaded.
- Newer formats refused at start and on import.
- v1 and v2 backups upgraded.
- Import validated and previewed before anything is replaced.
- A failed upgrade blocked, with raw copies kept.
- Encrypted backups decrypted once more as a check before they're kept.
- Android's own backup is off on Android 8, needs encryption on 9 and later, and excludes photos.

**Findings:**

- **DATA-1 · P1.** Overlapping mirror writes (section 4).
- **DATA-2 · P2.** `snapshot()` returns null on failure (`store/snapshots.js:30-39`), and callers ignore it (`store/useData.js:170,172,207`). On a full disk, an import or upgrade goes ahead with no undo, yet Settings says "What was here before is kept in Snapshots" (`views/Settings.jsx:198`). **Fix:** stop the import when the snapshot fails.
- **DATA-3 · P3.** A recovery restore reloads before its 300 ms mirror write lands (`RecoveryScreen.jsx`).
- **DATA-4 · P3.** Data health reads only `last_backup_at`, so it shows "never backed up" with healthy automatic backup (`lib/dataHealth.js:90`).
- **DATA-5 · P3.** Delete everything leaves native preferences behind: the last rest's exercise and kg, crash lines, and the widget. PRIVACY.md says everything goes.
- **DATA-8 · P2.** Only folders outside the phone's own storage count as "synced" (`BackupFolderPlugin.java:137`), and only synced folders are encrypted (`lib/autoBackup.js:149`). A folder that Syncthing, FolderSync or OneDrive uploads gets plain health data. PRIVACY.md:28 promises encryption there (see DEC-4).
- **Risks.**
  - DATA-6: the clock goes back and one store then fails, so a stale copy wins.
  - DATA-7: Delete everything can race a running write.
  - DATA-9: going to the background doesn't flush a waiting mirror write (needs a phone).
  - DATA-10: rest-shade logs are removed before they're saved.
  - DATA-11: a double tap logs two sets.
  - DATA-12: the 10 MB import cap is hit after roughly 38k sets.
  - DATA-14: photo files are orphaned after a restore.

**Uninstall** removes app data, the mirror, snapshots, photos and the key. Documents exports, automatic backup files, Android cloud backup (without photos) and Health Connect rows survive. Setup says nothing about backups. The first-week card asks for one in days 0-14, and the Home reminder comes 14 days after the first log, or 7 days without a screen lock.

---

## 7. Privacy and security

**Clean:**

- No outbound calls (`index.html:7` CSP `connect-src 'self'`).
- Outside links come only from taps, through allowlists (`lib/links.js`).
- Exported components are guarded.
- The photo lock asks for the phone's lock and blocks screenshots.
- CI uses read-only tokens, gives PRs no secrets, pins actions, and checks the signing certificate on both the APK and the bundle.
- Permissions match PRIVACY.md and the Play declarations, apart from DOC-5.

- **DOC-1 · P2.** The recovery hint ships (see DEC-1). `lib/activity.js:71` compares today's sleep and resting heart rate with the median of the last 14 days. The Today card shows Ready, Go steady or Take it easy, and the Stats body map keeps muscles "recovering" one extra day. It never changes weights or the plan. PRIVACY.md and the in-app text describe it, but `PRODUCT.md:43` lists "a readiness hint" as after-v1. The Play declarations leave out the under-6 h rule and the Stats effect.
- **DOC-2 · P2.** Reminders are marked private (`store/notify.js:30`). That hides their text only when the phone is set to hide sensitive content. `DEVICE_MATRIX.md` check 2 and the `notify.js` comment say the lock screen never shows text. PRIVACY.md is right.
- **AND-1 · P2.** Settings never reads `status().granted` (`views/Settings.jsx:98`), so a revoked permission looks on. Losing "read weight" makes background sync stop before it writes workouts (`store/phoneSync.js:46,55`), and the error is swallowed.
- **AND-2 · P3.** The recovery line (sleep, resting heart rate) shows on Today even with the "Watch numbers" module off (`views/Today.jsx:83`).
- **AND-3 · P2 (risk).** The Health Connect id is `fitness-os-workout-<n>` (`HealthPlugin.kt:241`), and n restarts at 1 after Delete everything or a reinstall. New workouts then overwrite old sessions. This is PRODUCT.md's "Health Connect IDs" item.
- **DOC-3, DOC-4, DOC-5 · P3.** PRIVACY.md leaves out three things:
  - the phone model and screen in bug reports,
  - the exercise and kg the rest timer shows on the lock screen,
  - the `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` and `VIBRATE` permissions.
- **BRAND-1 · P3.** Every export and share file is named `fitness-os-*`: backups, CSV, the week picture sent to friends, and `.ics`. So is the release APK. Internal ids stay as decided. Renaming the automatic backup files means both file patterns must accept the old and new prefixes.
- **SEC-2 · P3.** `@capacitor-community/keep-awake` isn't an official plugin. CLAUDE.md asks for a written reason.

---

## 8. UX findings

The happy path is short: open, Start, log, finish sheet with the next session, then meals and a tick. Main screens have empty states.

- **UX-1 · P1.** A stale open workout becomes today's (section 4).
- **UX-2 · P2.** On a rest day, the Home workout card ignores a workout done or running today. It shows no done state and no Resume button (`components/WorkoutCard.jsx:28-46`).
- **UX-3 · P1.** Goal changes edit the goal in place (folded into NUT-4).
- **UX-4 · P2.** A missed session is simply lost. Nothing offers "Missed Push yesterday? Do it today", and that would also shorten the TRN-1 gap. This is a suggestion, not built (see DEC-5).
- **UX-5 · P3.** 171 visible strings still bypass `t()` (`i18n-baseline.json`). The not-found pages (`History.jsx`, `ExerciseDetail.jsx`, `CatalogueDetail.jsx`) are dead ends with no way back.
- **UX-6 · P3.** "Still time today?" only appears when Home happens to re-render.

---

## 9. Test and CI baseline

These ran locally on `db645f5` on 26 Nov:

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run check` | exit 0 · 835 lib + 21 store tests pass, 0 skipped |
| `npm run coverage` | exit 0 · 98.92% lines (baseline 98.31%) |
| `pytest` | exit 0 · 373 passed |
| `ruff check .` | exit 0 |

The e2e suites weren't run locally. CI run #576 (screens, device, journeys) and Android APK run #578 passed on this commit on 23 Nov. There are no `.skip`, `.only` or `xfail` anywhere.

**Gaps:**

- **QA-1.** None of the P1/P2 findings above is caught by a current test. One gate × goal × Ramadan × cuts grid in `lib/safety.test.js` would have caught NUT-1 to NUT-4.
- **QA-2 · P2.** No test runs `deleteEverything`. The restore journey only clears localStorage.
- **QA-3 · P2.** The coverage ratchet skips about 37 lib files that aren't in the baseline, including `targetCheck.js`, `pace.js`, `maintenance.js` and `comeback.js`.
- **QA-4 · P2.** The save code has low coverage: `store/fs.js` 48%, `mirror.js` 77%, `snapshots.js` 78%. The fake file system is synchronous, so races can't be tested.
- **QA-5 · P2.** The native code has only the example test.
- **QA-6 · P3.** Nine routes never get the screen checks: `/meals/library`, `/history/:id`, `/settings/health` and others.
- **Real phones.** `docs/DEVICE_MATRIX.md` records no results, so all 6 checks on 5 phones are open. It also has no Health Connect row and no rest-timer lock-screen row.

---

## 10. Recommended milestones

The outside review's eight milestones are more process than this app needs. Four fix batches, then the phone checks and the release:

1. **A · Safety and data (P1).** About 4 PRs, all with tests:
   - REL-1 tag guard and What's new cap,
   - DATA-1 + DATA-2,
   - NUT-1 + NUT-2 + NUT-3,
   - NUT-4 + UX-3 + the safety grid test.
2. **B · Training correctness.** About 2 PRs:
   - UX-1 + UX-2,
   - TRN-1, TRN-4, TRN-2, TRN-5, TRN-3, TRN-8.
3. **C · Docs and privacy alignment.** 1 PR: DOC-1 to DOC-5, DATA-8 wording or change, AND-1, AND-2, DATA-4, DATA-5. BRAND-1 file names are optional.
4. **D · Test gaps.** 1 PR: QA-2, QA-3, QA-4, QA-6 and the restore journey with a full fixture.
5. **Phone checks.** The owner and pilot friends run `DEVICE_MATRIX.md`, plus Health Connect revoke and the rest timer on the lock screen.
6. **Release.** Tag `v1.1.x` on main after A to C, then Play internal testing.

A, B and C touch different files and can run in parallel. A's NUT and DATA PRs both touch `useData.js` and `macros.js` only lightly, but merge them one at a time and rebump. D follows A, because the tests ride with the fixes.

## 11. Estimated effort

These are sizes for agent work in this repo, not calendar dates. Phone checks depend on people.

| Batch | Size |
|---|---|
| A | about 1 day, 4 PRs |
| B | about 0.5-1 day, 2 PRs |
| C | about 0.5 day, 1 PR |
| D | about 0.5 day, 1 PR |
| Phone checks | 1-2 evenings per phone |

---

## 12. Decisions for the owner

- **DEC-1 · Recovery hint.** Keep it in v1 and align `PRODUCT.md:43`, the Play declarations and `mobile/README.md` (recommended), or switch it off in `Today.jsx:83` and `Stats.jsx:144-173`. It is advice only, PRIVACY.md and the Health Connect screen already describe it, and switching it off leaves two permissions with little use.
- **DEC-2 · Weekly cuts past 25%.** Should the confirmed weekly cuts be allowed to push a deficit past the 25% cap (39% after 3 steps), or be clamped to it (recommended)? Ramadan and gated users are clamped either way (NUT-4).
- **DEC-3 · Big eaters.** Above 2792 kcal the plan isn't scaled (14 of 30 personas). Accept this for the pilot with the current "built for about 1994 kcal" note (recommended), or widen the scaling or add a second snack.
- **DEC-4 · Backups to local folders.** Offer the passphrase for every folder, on by default (recommended), or reword PRIVACY.md to say sync apps aren't detected.
- **DEC-5 · Missed-session catch-up (UX-4).** This is a small new feature. Do it before the pilot, or after (recommended).
- **DEC-6 · DATA-1 priority.** P1 (lead) or P2 (data reviewer). Both agree it should be fixed in batch A.
- **Owner's steps:**
  - Tag the next release from main at its `package.json` version, not `v1.0.10`.
  - Run the phone checks.
  - Give the go-ahead for batch A.
