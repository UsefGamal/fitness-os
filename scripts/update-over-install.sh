#!/usr/bin/env bash
# P14-17: on each tag, install the previous release on an Android emulator,
# open it, then install this release over it (adb install -r) and open it
# again. Fails if the update is refused (a key or version mistake that
# would make friends uninstall and lose their data), if Android treats it
# as a fresh install, or if the app crashes on start after the update.
#
#   scripts/update-over-install.sh <this tag>
# Needs: GH_TOKEN, the Android SDK (ANDROID_HOME) and KVM.
set -euo pipefail

TAG="${1:?usage: update-over-install.sh <tag>}"
PKG=com.usefgamal.fitnessos
API="${EMULATOR_API:-34}"
IMAGE="system-images;android-${API};google_apis;x86_64"
WORK="${RUNNER_TEMP:-/tmp}/update-test"
mkdir -p "$WORK/old" "$WORK/new"

# The release before this one.
PREV=$(gh release list --limit 20 --json tagName,isDraft,createdAt --jq '[.[] | select(.isDraft | not) | .tagName] | .[]' | grep -v -x "$TAG" | head -n 1 || true)
if [ -z "$PREV" ]; then
  echo "No earlier release to update from; nothing to check."
  exit 0
fi
echo "Updating $PREV -> $TAG"
gh release download "$PREV" --pattern '*-yusuf.apk' --dir "$WORK/old"
gh release download "$TAG" --pattern '*-yusuf.apk' --dir "$WORK/new"
OLD_APK=$(ls "$WORK"/old/*.apk | head -n 1)
NEW_APK=$(ls "$WORK"/new/*.apk | head -n 1)

SDK="${ANDROID_HOME:?ANDROID_HOME is not set}"
SDKM="$SDK/cmdline-tools/latest/bin/sdkmanager"
AVDM="$SDK/cmdline-tools/latest/bin/avdmanager"
yes | "$SDKM" --licenses >/dev/null || true
"$SDKM" --install "emulator" "platform-tools" "$IMAGE" >/dev/null
echo no | "$AVDM" create avd --force -n update-test -k "$IMAGE" >/dev/null
"$SDK/emulator/emulator" -avd update-test -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot >"$WORK/emulator.log" 2>&1 &
ADB="$SDK/platform-tools/adb"
EMU_PID=$!

# Never wait forever: on the first tag (v0.8.1) adb waited for a device that
# never came until the 30-minute job limit. Give the emulator 5 minutes to
# appear and 5 more to boot, and show its log when it doesn't.
emulator_failed() {
  echo "::error::$1"
  echo "--- emulator log (last 80 lines) ---"
  tail -n 80 "$WORK/emulator.log" || true
  ls -l /dev/kvm || true
  exit 1
}
if ! timeout 300 "$ADB" wait-for-device; then
  kill -0 "$EMU_PID" 2>/dev/null || emulator_failed "The emulator exited before a device appeared."
  emulator_failed "No emulator device appeared within 5 minutes."
fi
booted=""
for _ in $(seq 1 150); do
  if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then booted=1; break; fi
  sleep 2
done
[ -n "$booted" ] || emulator_failed "The emulator didn't finish booting within 5 minutes."
"$ADB" shell input keyevent 82 || true

open_app() {
  "$ADB" logcat -c
  "$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
  sleep 15
  if "$ADB" logcat -d | grep -E "FATAL EXCEPTION|Process: $PKG" | grep -q .; then
    "$ADB" logcat -d | grep -A 20 "FATAL EXCEPTION" || true
    echo "::error::$1 crashed on start"
    exit 1
  fi
  "$ADB" shell pidof "$PKG" >/dev/null || { echo "::error::$1 is not running after start"; exit 1; }
}

field() { "$ADB" shell dumpsys package "$PKG" | grep -m1 "$1" | sed "s/.*$1=\([^ ]*\).*/\1/" | tr -d '\r'; }

"$ADB" install "$OLD_APK"
open_app "$PREV"
FIRST=$(field firstInstallTime)
OLD_CODE=$(field versionCode)

if ! "$ADB" install -r "$NEW_APK"; then
  echo "::error::Android refused to install $TAG over $PREV. Friends would have to uninstall, which deletes their data."
  exit 1
fi
open_app "$TAG"
NEW_CODE=$(field versionCode)
if [ "$(field firstInstallTime)" != "$FIRST" ]; then
  echo "::error::$TAG went in as a new install, not an update."
  exit 1
fi
echo "Update over install OK: $PREV (versionCode $OLD_CODE) -> $TAG (versionCode $NEW_CODE), first installed $FIRST."
"$ADB" emu kill || true
