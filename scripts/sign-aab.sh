#!/usr/bin/env bash
# Sign the Play bundle (PLAY-1). Google Play takes .aab files signed with
# the upload key. Tafra uses its one release key for that too, and Play App
# Signing is set up with that same key (docs/play/README.md), so the app
# Play installs carries the same certificate as the APKs on GitHub: either
# one updates over the other and the "signing code" in About stays the same.
#
#   KEYSTORE_B64=... FITNESS_OS_KEYSTORE_PASSWORD=... scripts/sign-aab.sh IN.aab OUT.aab [CERT_SHA256]
#
# Like scripts/sign-apk.sh it only runs JDK tools (jarsigner, keytool), so
# the key never meets npm or Gradle code. With CERT_SHA256 it also checks
# the bundle's certificate, so a wrong key can't reach Play.
set -euo pipefail

in="${1:?usage: $0 IN.aab OUT.aab [CERT_SHA256]}"
out="${2:?usage: $0 IN.aab OUT.aab [CERT_SHA256]}"
want="${3:-}"
: "${KEYSTORE_B64:?set KEYSTORE_B64}"
: "${FITNESS_OS_KEYSTORE_PASSWORD:?set FITNESS_OS_KEYSTORE_PASSWORD}"
export FITNESS_OS_KEY_PASSWORD="${FITNESS_OS_KEY_PASSWORD:-$FITNESS_OS_KEYSTORE_PASSWORD}"
alias="${FITNESS_OS_KEY_ALIAS:-fitnessos}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
ks="$work/release.jks"
(umask 077; base64 -d <<<"$KEYSTORE_B64" > "$ks")

jarsigner -keystore "$ks" -storepass:env FITNESS_OS_KEYSTORE_PASSWORD \
  -keypass:env FITNESS_OS_KEY_PASSWORD -sigalg SHA256withRSA -digestalg SHA-256 \
  -signedjar "$out" "$in" "$alias" >/dev/null
jarsigner -verify "$out" >/dev/null || { echo "::error::$out did not verify after signing." >&2; exit 1; }

if [ -n "$want" ]; then
  got="$(keytool -printcert -jarfile "$out" | sed -n 's/^.*SHA256: *//p' | head -1 | tr -d ':' | tr 'a-f' 'A-F')"
  want="$(tr -d ': ' <<<"$want" | tr 'a-f' 'A-F')"
  if [ "$got" != "$want" ]; then
    echo "::error::The bundle is signed with certificate $got, not the release certificate $want." >&2
    exit 1
  fi
fi
echo "Signed $out"
