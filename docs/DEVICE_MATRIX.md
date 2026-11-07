# Device checks (P14-17)

CI covers what a browser and an emulator can: the screen harness (both
APKs), `npm run e2e:device` (setup states, 3 years of data at 6x slower
CPU, midnight, the file mirror on a fake file system) and, on each tag, an
update over the previous release on an Android 14 emulator.

The rest needs real phones. Before each pilot build, run these on as many
of the phones below as the pilot has.

| Phone | Why it's here |
|---|---|
| Yusuf's phone | The main user, with the real data file |
| Xiaomi / Redmi / Poco (MIUI or HyperOS) | Kills background apps; autostart switch |
| Infinix or Tecno (XOS / HiOS) | Kills background apps; Phone Master |
| Samsung A series | Sleeping apps list; the most common friend phone |
| An Android 8-10 phone | Oldest supported WebView and no exact-alarm screen |
| Android 16 emulator | Newest permission and back-gesture rules |

## On each phone

1. **Update over install.** Install the last release, log a set, then install the new APK over it. The set is still there.
2. **Reminders** (P14-12). On the first open, the "Allow reminders" sheet appears. Allow everything, set a reminder 2 minutes ahead and lock the phone. It arrives on time and the lock screen shows no text. Log the session, and its reminder doesn't come.
3. **Rest buzz with the screen locked** (P14-07). Start a 60 s rest and lock the phone. It buzzes at 0.
4. **Photo lock** (P14-13). Open Photos and unlock it with a PIN or fingerprint. A screenshot is blocked. Pick a photo, and Photos doesn't lock again. Leave Photos for over a minute, and it asks again.
5. **Crash trace** (P14-15). In Settings > About > Send a bug report, the preview opens and can be edited.
6. **Midnight.** Leave Home open across midnight, and the week strip moves to the new day.
