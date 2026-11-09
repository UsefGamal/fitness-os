#!/usr/bin/env bash
# Sign unsigned release APKs (pentest PT-02, SEC-05):
#   scripts/sign-apk.sh IN.apk OUT.apk [IN2.apk OUT2.apk ...]
# The release build runs npm, the tests, Vite and Gradle without any
# signing secret. Only this step sees the key, and it runs nothing but the
# Android SDK's zipalign and apksigner, so a bad npm or Gradle package can't
# read it.
#
# Reads from the environment:
#   KEYSTORE_B64                   the keystore, base64 (the CI secret)
#   FITNESS_OS_KEYSTORE_PASSWORD   its password
#   FITNESS_OS_KEY_ALIAS           key alias (default: fitnessos)
#   FITNESS_OS_KEY_PASSWORD        key password (default: the keystore password)
set -euo pipefail

if (( $# == 0 || $# % 2 )); then
  echo "usage: $0 IN.apk OUT.apk [IN2.apk OUT2.apk ...]" >&2
  exit 2
fi
: "${KEYSTORE_B64:?set KEYSTORE_B64}"
: "${FITNESS_OS_KEYSTORE_PASSWORD:?set FITNESS_OS_KEYSTORE_PASSWORD}"
export FITNESS_OS_KEY_PASSWORD="${FITNESS_OS_KEY_PASSWORD:-$FITNESS_OS_KEYSTORE_PASSWORD}"
alias="${FITNESS_OS_KEY_ALIAS:-fitnessos}"

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?set ANDROID_HOME}}"
tools="$(ls -d "$sdk"/build-tools/* | sort -V | tail -1)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
ks="$work/release.jks"
(umask 077; base64 -d <<<"$KEYSTORE_B64" > "$ks")

while (( $# )); do
  in="$1" out="$2"
  shift 2
  "$tools/zipalign" -p -f 4 "$in" "$work/aligned.apk"
  "$tools/apksigner" sign --ks "$ks" --ks-key-alias "$alias" \
    --ks-pass env:FITNESS_OS_KEYSTORE_PASSWORD --key-pass env:FITNESS_OS_KEY_PASSWORD \
    --out "$out" "$work/aligned.apk"
  rm -f "$work/aligned.apk" "$out.idsig"
  echo "Signed $out"
done
