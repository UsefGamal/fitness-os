# Fitness OS phone app

The standalone Android app. Everything runs inside the APK and your data is
saved on the phone, so there's no server, no account and no internet needed.
It replaces the phase 1 app that only opened the Render site.

## Screens

The tab bar follows openGym: **Home**, **Plan**, **Start**, **Meals** and **Stats**. Settings is behind the gear on Home.

- **Home:** today's session at 07:00 (or the next one on a rest day), the Sunday-start week, meals eaten, water and your latest weight.
- **Plan:** your trainer's Upper / Lower / Push / Pull / Leg week. Tap a day to see its warm-up and working sets with RIR, rest, notes, form videos and backups.
- **Start:** a guided workout. Weight and reps come prefilled from last time and can be changed with big +/- buttons. One tap logs a set and starts the rest timer, which also buzzes as a notification with the screen off. Paired sets (A1/A2) alternate automatically, and a new best set shows a PR banner.
- **Meals:** the 14-day meal plan for any date. Pick option A or B, tick each meal off and see calories and protein against your targets.
- **Stats:** weigh-ins with a trend chart against your goal band, workout history (open one to edit or delete sets) and your records per exercise.
- **Settings:** import your data, export a backup and turn reminders on (30 min before each 07:00 session and at every meal time).

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
npm run build      # dist/
../scripts/build-apk.sh   # needs JDK 21 + Android SDK
```

- Plan content comes from `content/` through `scripts/export_content.py`. Never edit `src/content.json` by hand; it's generated and gitignored.
- Decision logic lives in `src/lib/` as pure functions, each with a `*.test.js` beside it. `schedule.test.js` mirrors `tests/test_gym_program.py`, so change both together.
- `src/store/useData.js` is the one Zustand store. `src/store/mirror.js` keeps the file copy and `src/store/notify.js` handles local notifications.
- After changing `capacitor.config.json` or a Capacitor plugin, run `npx cap sync android` and commit the result.
