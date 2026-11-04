# Android shell (phase 1)

A Capacitor app that opens the live site, https://fitness-os.onrender.com,
in a full-screen WebView. There's no offline mode yet; that comes in phase 3
(`mobile/`), which replaces this folder.

- App id `com.usefgamal.fitnessos`, name "Fitness OS", black splash with the green bolt.
- Links to other sites (form videos) open in the phone's browser.
- If the site can't be reached, `www/offline.html` shows a "Try again" screen.
  Render's free plan sleeps, so the first open of the day can take up to a minute.
- The Android back button goes back a page and leaves the app from the first page (`@capacitor/app`).

## Getting the APK

Every push to `main` that touches this folder, and every PR that does, runs
the **Android APK** workflow. Open the run in the Actions tab and download
the `fitness-os-apk-<n>` artifact. It contains:

- `fitness-os-debug.apk`, always.
- `fitness-os-release.apk`, when the keystore secrets below are set.

On the phone, open the APK and allow your browser or file app to install
unknown apps when Android asks.

**Updating:** a debug APK built in CI is signed with that run's throwaway key,
so Android won't install it over an earlier build. Uninstall the old app
first, which also signs you out. To get updates that install in place, set up
release signing once:

1. Make a keystore and keep a backup of it and its password somewhere safe.
   If you lose it, updates can't install over the old app.
   `keytool -genkeypair -v -keystore fitness-os.jks -alias fitnessos -keyalg RSA -keysize 2048 -validity 10000`
2. In the repo's Settings > Secrets and variables > Actions, add
   `FITNESS_OS_KEYSTORE_BASE64` (output of `base64 -w0 fitness-os.jks`),
   `FITNESS_OS_KEYSTORE_PASSWORD` and, if they differ from the defaults,
   `FITNESS_OS_KEY_ALIAS` and `FITNESS_OS_KEY_PASSWORD`.

Never commit the keystore (`*.jks` and `*.keystore` are gitignored).

## Building locally

Needs Node 22+, JDK 21 and the Android SDK.

```bash
scripts/build-apk.sh            # dist/fitness-os-debug.apk
FITNESS_OS_KEYSTORE=~/keys/fitness-os.jks FITNESS_OS_KEYSTORE_PASSWORD=... \
  scripts/build-apk.sh release  # dist/fitness-os-release.apk
```

After editing `capacitor.config.json` or upgrading Capacitor, run
`npx cap sync android` in this folder and commit the result.
