# Fitness OS phone app

The standalone Android app. Everything runs inside the APK and your data is
saved on the phone, so there's no server, no account and no internet needed.
It replaces the phase 1 app that only opened the Render site.

## Screens

The tab bar follows openGym: **Home**, **Plan**, **Start**, **Meals** and **Stats**. Settings is behind the gear on Home.

- **Home:** today's session at 07:00 (or the next one on a rest day), the Sunday-start week, other sessions (home, recovery, cardio, padel), quests, meals eaten, water and your latest weight.
- **Plan:** your trainer's Upper / Lower / Push / Pull / Leg week. Tap a day to see its warm-up and working sets with RIR, rest, notes, form videos and backups.
- **Start:** a guided workout. Weight and reps come prefilled from last time and can be changed with big +/- buttons. One tap logs a set and starts the rest timer, which also buzzes as a notification with the screen off. Paired sets (A1/A2) alternate automatically, and a new best set shows a PR banner.
- **Meals:** the 14-day meal plan for any date. Pick option A or B, tick each meal off and see calories and macros against your targets. **Shopping** lists the next seven days' food by aisle, with ticks that reset each Sunday.
- **Stats:** weigh-ins with a trend chart against your goal band, your records per exercise, and links to History and Library.
- **Library:** your exercises, and **All with photos**: 876 exercises from free-exercise-db (public domain) with start/end photos, instructions, muscles and equipment, searchable and filterable. Plan exercises show the closest match's photos on their page and in the workout. Your exercises: with search, a filter by muscle group and a tappable body map. Each exercise shows your best set, estimated 1RM, where it sits in your plan and every time you've done it. You can add your own exercises too.
- **History:** every workout by month. Open one to change its date, edit a set's weight or reps, or delete sets or the whole workout.
- **Editable Plan:** tap Edit on a day to swap an exercise (same muscle group first), change sets, reps or rest, reorder, remove or add exercises. Your trainer's plan stays as the starter plan; "Reset" puts a day back.
- **Sessions:** log a home workout (its warm-up, exercises and cool-down as a checklist), recovery, cardio or padel (with the result).
- **Quests:** tick daily habits; weekly quests and milestones are earned from what you log, adding up to levels and badges.
- **Profile:** height, age, sex, activity and goal set the daily calorie and macro targets, worked out like the old site.
- **Settings:** import your data, export a backup, turn reminders on (30 min before each 07:00 session and at every meal time), and switch **Modules** (Meals, Water, Weight) off to hide them. With Meals off, Library takes its place in the tab bar.

## Moving your data in

1. On the old site, open Settings > "Download my data" and save the file.
2. In the app, open Settings > "Import your data" and pick that file.

Backups made with "Export a backup" are in the same format and import the
same way. Data lives in the app's storage plus a file mirror in its private
folder. **Uninstalling the app deletes it**, so export a backup now and then.

## Getting the APK

The **Android APK** workflow builds it on every PR and push to `main` that
touches `mobile/`, `content/` or the build files. Download the
`fitness-os-apk-<n>` artifact from the run in the Actions tab and open
`fitness-os-debug.apk` on the phone.

A debug APK from CI is signed with that run's throwaway key, so to install a
newer one you uninstall the old one first. Export a backup before you do, then
import it again. To install updates in place instead, set up release signing
once:

1. Make a keystore and back it up with its password. If it's lost, updates
   can't install over the old app.
   `keytool -genkeypair -v -keystore fitness-os.jks -alias fitnessos -keyalg RSA -keysize 2048 -validity 10000`
2. In the repo's Settings > Secrets and variables > Actions, add
   `FITNESS_OS_KEYSTORE_BASE64` (from `base64 -w0 fitness-os.jks`) and
   `FITNESS_OS_KEYSTORE_PASSWORD`. Add `FITNESS_OS_KEY_ALIAS` and
   `FITNESS_OS_KEY_PASSWORD` too if they differ from the defaults.

Never commit the keystore (`*.jks` and `*.keystore` are gitignored).

## Developing

```bash
cd mobile
npm ci
npm run dev        # exports content/ to src/content.json, then starts Vite
npm test           # node --test on src/lib/*.test.js
npm run photos     # downloads and converts the exercise photos (once, ~2 min, ~50 MB)
npm run build      # dist/
../scripts/build-apk.sh   # needs JDK 21 + Android SDK
```

- Plan content comes from `content/` through `scripts/export_content.py`. Never edit `src/content.json` by hand; it's generated and gitignored.
- Decision logic lives in `src/lib/` as pure functions, each with a `*.test.js` beside it. `schedule.test.js` mirrors `tests/test_gym_program.py`, so change both together.
- Exercise photos land in `public/exercise-db/` (gitignored). `npm run build:mobile` fetches them; install Pillow (`pip install pillow`) to get WebP at half the size.
- `src/store/useData.js` is the one Zustand store. `src/store/mirror.js` keeps the file copy and `src/store/notify.js` handles local notifications.
- After changing `capacitor.config.json` or a Capacitor plugin, run `npx cap sync android` and commit the result.
