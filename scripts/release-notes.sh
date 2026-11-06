#!/usr/bin/env bash
# Release notes with the numbers a friend can check (P14-08, SEC-04):
# each APK's SHA-256, the signing certificate's SHA-256 and the 8-character
# signing code that Settings > About shows on the phone.
#
#   scripts/release-notes.sh <version> <cert-sha256> dist/*.apk
set -euo pipefail
version="$1"; cert="$2"; shift 2
hex=$(printf '%s' "$cert" | tr -d ': ' | tr '[:lower:]' '[:upper:]')
if ! printf '%s' "$hex" | grep -Eq '^[0-9A-F]{64}$'; then
  echo "release-notes: the certificate SHA-256 must be 64 hex digits" >&2
  exit 1
fi
code="${hex:0:4}-${hex:4:4}"
echo "Fitness OS $version"
echo
echo "Friends: install the file ending in **-friends.apk**. Yusuf: the one ending in **-yusuf.apk**."
echo
echo "**Signing code: \`$code\`.** After installing, open Settings > About on the phone. It must show the same code. If it doesn't, delete that file and message Yusuf."
echo
echo "If Android says **App not installed** when you update, **don't uninstall** (that deletes your data on the phone). Message Yusuf."
echo
echo "| File | SHA-256 |"
echo "|---|---|"
for f in "$@"; do
  echo "| $(basename "$f") | \`$(sha256sum "$f" | cut -d' ' -f1)\` |"
done
echo
echo "Signing certificate SHA-256: \`$hex\`"
