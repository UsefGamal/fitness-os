#!/usr/bin/env bash
# Check a built APK before anyone installs it (E1-S3):
#   scripts/check-apk.sh APK APP_ID [CERT_SHA256] [VERSION_CODE]
# - the application ID is exactly APP_ID (release: com.usefgamal.fitnessos,
#   debug: com.usefgamal.fitnessos.debug), so a debug build can never
#   install over the real app;
# - with CERT_SHA256, it is signed by that certificate (apksigner), so it
#   installs over the APK already on the phone;
# - with VERSION_CODE, it carries that versionCode.
# Needs the Android SDK build-tools (aapt2, apksigner).
set -euo pipefail

apk="${1:?usage: $0 APK APP_ID [CERT_SHA256] [VERSION_CODE]}"
want_id="${2:?app id}"
want_cert="${3:-}"
want_code="${4:-}"

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?set ANDROID_HOME}}"
tools="$(ls -d "$sdk"/build-tools/* | sort -V | tail -1)"

badging="$("$tools/aapt2" dump badging "$apk" | head -1)"
id="$(sed -n "s/.* name='\([^']*\)'.*/\1/p" <<<"$badging")"
code="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$badging")"
name="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$badging")"
echo "APK: $id $name ($code)"

if [[ "$id" != "$want_id" ]]; then
  echo "::error::Application ID is $id, expected $want_id." >&2
  exit 1
fi
if [[ -n "$want_code" && "$code" != "$want_code" ]]; then
  echo "::error::versionCode is $code, expected $want_code." >&2
  exit 1
fi
if [[ -n "$want_cert" ]]; then
  certs="$("$tools/apksigner" verify --print-certs "$apk")"
  got="$(grep -m1 'certificate SHA-256 digest' <<<"$certs" | awk '{print $NF}')"
  want="$(tr -d ': ' <<<"$want_cert" | tr 'A-F' 'a-f')"
  if [[ "$got" != "$want" ]]; then
    echo "::error::Signed with certificate $got, but the phone's app uses $want. Android would refuse this update." >&2
    exit 1
  fi
  echo "Signed with the expected certificate ($got)."
fi
