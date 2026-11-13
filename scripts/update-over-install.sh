#!/usr/bin/env bash
# P14-17 + PROOF-1: on each tag, for both APKs (Yusuf's and the friends
# one), install the previous release on an Android emulator, open it, then
# install this release over it (adb install -r) and open it again.
#
# Fails if the update is refused (a key or version mistake that would make
# friends uninstall and lose their data), if Android treats it as a fresh
# install, if the app crashes on start, if it lands on the crash or
# recovery screen, or if the data is not the same before and after.
#
# How the data is compared: at every start the app writes one line to
# logcat under the tag FitnessOSData, "OK <version> W 12 · S 140 · M 61 ·
# B 3 · 3F9A-12CD" (counts and a hash, mobile/src/lib/dataCheck.js).
# scripts/compare_start_lines.py reads the line before and after and
# decides; tests/test_compare_start_lines.py covers its rule. A release
# from before the line existed can't be compared: that run says NOT
# COMPARED and still checks the new build starts cleanly.
#
#   scripts/update-over-install.sh <this tag>
# Run it by hand for an existing release: Actions > Android APK > Run
# workflow, with the tag in "update_test_tag".
# Needs: GH_TOKEN, the Android SDK (ANDROID_HOME), KVM and python3.
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
HERE="$(cd "$(dirname "$0")" && pwd)"
FLAVORS="${UPDATE_FLAVORS:-yusuf friends}"
for f in $FLAVORS; do
  mkdir -p "$WORK/old-$f" "$WORK/new-$f"
  gh release download "$PREV" --pattern "*-$f.apk" --dir "$WORK/old-$f" || true
  gh release download "$TAG" --pattern "*-$f.apk" --dir "$WORK/new-$f" || true
done

SDK="${ANDROID_HOME:?ANDROID_HOME is not set}"
SDKM="$SDK/cmdline-tools/latest/bin/sdkmanager"
AVDM="$SDK/cmdline-tools/latest/bin/avdmanager"
yes | "$SDKM" --licenses >/dev/null || true
"$SDKM" --install "emulator" "platform-tools" "$IMAGE" >/dev/null
# avdmanager and the emulator must agree on where AVDs live. On the GitHub
# runner avdmanager wrote under ~/.config/.android/avd while the emulator
# looked in ~/.android/avd, so every tag since v0.9.0 failed with "Unknown
# AVD name [update-test]" before anything was installed.
export ANDROID_AVD_HOME="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
mkdir -p "$ANDROID_AVD_HOME"
echo no | "$AVDM" create avd --force -n update-test -k "$IMAGE"
if ! "$SDK/emulator/emulator" -list-avds | grep -qx update-test; then
  echo "::error::The emulator can't see the AVD that avdmanager just made (looked in $ANDROID_AVD_HOME)."
  ls -la "$ANDROID_AVD_HOME" "$HOME/.config/.android/avd" 2>/dev/null || true
  exit 1
fi
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

# Save the app's start lines (tag FitnessOSData) to a file. The line is
# written once the data is loaded, so wait up to 30 s more for it.
start_lines() {
  for _ in $(seq 1 15); do
    "$ADB" logcat -d -s FitnessOSData:I >"$1" 2>/dev/null || true
    grep -q "FitnessOSData" "$1" && return 0
    sleep 2
  done
  return 0
}

# Tap the first thing on screen whose text is exactly $1. Best effort:
# returns 1 when nothing matches. Used only to get past first-time setup,
# so the data that is compared is more than an empty install.
tap_text() {
  "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || return 1
  "$ADB" pull /sdcard/ui.xml "$WORK/ui.xml" >/dev/null 2>&1 || return 1
  local xy
  xy=$(python3 - "$WORK/ui.xml" "$1" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding="utf-8", errors="replace").read()
want = sys.argv[2]
for node in re.findall(r"<node [^>]*>", xml):
    text = re.search(r'text="([^"]*)"', node)
    desc = re.search(r'content-desc="([^"]*)"', node)
    if want in ((text.group(1) if text else ""), (desc.group(1) if desc else "")):
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
        if b:
            x1, y1, x2, y2 = map(int, b.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            break
PY
)
  [ -n "$xy" ] || return 1
  # shellcheck disable=SC2086
  "$ADB" shell input tap $xy
  sleep 2
}

field() { "$ADB" shell dumpsys package "$PKG" | grep -m1 "$1" | sed "s/.*$1=\([^ ]*\).*/\1/" | tr -d '\r'; }

FAILED=""
TESTED=""
for f in $FLAVORS; do
  OLD_APK=$(ls "$WORK/old-$f"/*.apk 2>/dev/null | head -n 1 || true)
  NEW_APK=$(ls "$WORK/new-$f"/*.apk 2>/dev/null | head -n 1 || true)
  if [ -z "$NEW_APK" ]; then
    echo "::error::$TAG has no $f APK."
    FAILED="$FAILED $f"
    continue
  fi
  if [ -z "$OLD_APK" ]; then
    echo "::warning::$PREV has no $f APK, so there is nothing to update from for that build."
    continue
  fi
  echo "=== $f: $PREV -> $TAG ==="
  "$ADB" uninstall "$PKG" >/dev/null 2>&1 || true

  "$ADB" install "$OLD_APK"
  open_app "$PREV ($f)"
  # Get past first-time setup if it shows, then start again so the line is
  # written for data the app has really saved.
  if tap_text "Skip, I will set it up later"; then
    sleep 3
    "$ADB" shell am force-stop "$PKG"
    open_app "$PREV ($f)"
  fi
  start_lines "$WORK/before-$f.log"
  FIRST=$(field firstInstallTime)
  OLD_CODE=$(field versionCode)

  if ! "$ADB" install -r "$NEW_APK"; then
    echo "::error::Android refused to install $TAG over $PREV ($f). Friends would have to uninstall, which deletes their data."
    exit 1
  fi
  open_app "$TAG ($f)"
  start_lines "$WORK/after-$f.log"
  NEW_CODE=$(field versionCode)
  if [ "$(field firstInstallTime)" != "$FIRST" ]; then
    echo "::error::$TAG ($f) went in as a new install, not an update."
    exit 1
  fi
  if RESULT=$(python3 "$HERE/compare_start_lines.py" "$WORK/before-$f.log" "$WORK/after-$f.log"); then
    case "$RESULT" in
      "NOT COMPARED"*) echo "::warning::$f: $RESULT" ;;
      *) echo "$f: $RESULT" ;;
    esac
  else
    echo "::error::$f: $RESULT"
    FAILED="$FAILED $f"
    continue
  fi
  TESTED="$TESTED $f"
  echo "Update over install OK ($f): $PREV (versionCode $OLD_CODE) -> $TAG (versionCode $NEW_CODE), first installed $FIRST."
done

"$ADB" emu kill || true
if [ -n "$FAILED" ]; then
  echo "::error::The update test failed for:$FAILED"
  exit 1
fi
if [ -z "$TESTED" ]; then
  echo "::error::No APK could be update-tested."
  exit 1
fi
