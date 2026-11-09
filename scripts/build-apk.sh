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
# FITNESS_OS_FLAVOR picks which APK (P14-02): "yusuf" (the default, his own
# plan) or "friends" (the starter plan, no trace of his). Both use the same
# app ID and key; the friends file is named fitness-os-<mode>-friends.apk.
#
# APK_VERSION_CODE (an integer that must go up each build) and
# APK_VERSION_NAME are optional; CI sets them from the run number.
set -euo pipefail

mode="${1:-debug}"
flavor="${FITNESS_OS_FLAVOR:-yusuf}"
case "$flavor" in
  yusuf) suffix="" ;;
  friends) suffix="-friends" ;;
  *) echo "FITNESS_OS_FLAVOR must be yusuf or friends, not $flavor" >&2; exit 2 ;;
esac
export FITNESS_OS_FLAVOR="$flavor"
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
# The unit tests are written against Yusuf's content, whichever APK this is.
FITNESS_OS_FLAVOR=yusuf npm test
npm run build:mobile

cd android
chmod +x gradlew
./gradlew --no-daemon "$task"

mkdir -p "$out"
cp "$built" "$out/fitness-os-$mode$suffix.apk"
echo "Built $out/fitness-os-$mode$suffix.apk ($flavor)"
