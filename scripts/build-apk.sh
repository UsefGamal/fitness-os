#!/usr/bin/env bash
# Build the Android app (mobile/): the standalone Fitness OS phone app.
# Everything runs inside the APK and data is saved on the phone; there is
# no server.
#
#   scripts/build-apk.sh            debug APK (debug-signed, for sideloading)
#   scripts/build-apk.sh release    release APK, signed with your keystore
#   scripts/build-apk.sh unsigned   release APK with no signature, for
#                                   scripts/sign-apk.sh (what CI does, so
#                                   the build never sees the key)
#
# Needs Node 22+, Python 3.12 (to export content/), git (to fetch the
# public-domain exercise photos; Pillow, if installed, shrinks them to WebP),
# JDK 21 and the Android SDK (ANDROID_HOME or ANDROID_SDK_ROOT).
#
# Release signing reads these environment variables; nothing is stored in
# the repo:
#   FITNESS_OS_KEYSTORE           path to the .jks/.keystore file
#   FITNESS_OS_KEYSTORE_PASSWORD  its password
#   FITNESS_OS_KEY_ALIAS          key alias (default: fitnessos)
#   FITNESS_OS_KEY_PASSWORD       key password (default: the keystore password)
#
# Make a keystore once and back it up somewhere safe. If it is lost, the
# phone can't install updates over the old app; you'd have to uninstall
# first, which deletes the app's data on the phone (export a backup first):
#   keytool -genkeypair -v -keystore fitness-os.jks -alias fitnessos \
#     -keyalg RSA -keysize 2048 -validity 10000
#
# There is one app for everyone (Nov 2026): no build flavors.
#
# APK_VERSION_CODE (an integer that must go up each build) and
# APK_VERSION_NAME are optional; CI sets them from the run number.
set -euo pipefail

mode="${1:-debug}"
root="$(cd "$(dirname "$0")/.." && pwd)"
app="$root/mobile"
out="$root/dist"

case "$mode" in
  debug) task=assembleDebug; built="app/build/outputs/apk/debug/app-debug.apk" ;;
  release)
    : "${FITNESS_OS_KEYSTORE:?set FITNESS_OS_KEYSTORE to your keystore path}"
    : "${FITNESS_OS_KEYSTORE_PASSWORD:?set FITNESS_OS_KEYSTORE_PASSWORD}"
    FITNESS_OS_KEYSTORE="$(cd "$(dirname "$FITNESS_OS_KEYSTORE")" && pwd)/$(basename "$FITNESS_OS_KEYSTORE")"
    export FITNESS_OS_KEYSTORE
    # Release builds leave flagged, unfinished features out (mobile/src/lib/flags.js).
    export FITNESS_OS_RELEASE=1
    task=assembleRelease; built="app/build/outputs/apk/release/app-release.apk" ;;
  unsigned)
    # The key must not be here: this build runs npm and Gradle code.
    unset FITNESS_OS_KEYSTORE FITNESS_OS_KEYSTORE_PASSWORD FITNESS_OS_KEY_PASSWORD KEYSTORE_B64
    export FITNESS_OS_RELEASE=1
    task=assembleRelease; built="app/build/outputs/apk/release/app-release-unsigned.apk" ;;
  *) echo "usage: $0 [debug|release|unsigned]" >&2; exit 2 ;;
esac

cd "$app"
npm ci --no-audit --no-fund
# APK_SKIP_TESTS=1 skips the unit tests for a debug build only (CI's js job
# has already run them). A release build always runs them.
if [ "${APK_SKIP_TESTS:-}" = 1 ] && [ "$mode" = debug ]; then
  echo "Unit tests skipped (APK_SKIP_TESTS=1, debug build)."
else
  npm test
fi
npm run build:mobile

cd android
chmod +x gradlew
# A busy Maven Central (429, timeouts) fails a build that changed nothing:
# after a download failure, wait a minute and run Gradle once more.
log="$(mktemp)"
gradle() { ./gradlew --no-daemon "$task" 2>&1 | tee "$log"; }
if ! gradle; then
  if grep -qE 'status code (429|5[0-9][0-9])|Could not (GET|HEAD) |Read timed out|Connect timed out|Connection reset' "$log"; then
    echo "Gradle could not download something; trying once more in 60 s."
    sleep 60
    gradle
  else
    exit 1
  fi
fi

mkdir -p "$out"
cp "$built" "$out/fitness-os-$mode.apk"
echo "Built $out/fitness-os-$mode.apk"
