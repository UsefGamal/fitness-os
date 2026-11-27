#!/usr/bin/env bash
# A release must say what changed: refuse a tag whose version has no entry in
# mobile/src/lib/whatsNewNotes.js (0.9.9 and 1.0.0 shipped without one).
#
#   scripts/check-whats-new.sh 1.0.1
set -euo pipefail

version="${1:?usage: $0 MAJOR.MINOR.PATCH}"
notes="$(dirname "$0")/../mobile/src/lib/whatsNewNotes.js"
if ! grep -q "version: '${version//./\\.}'," "$notes"; then
  echo "::error::No What's new entry for $version. Add one at the top of mobile/src/lib/whatsNewNotes.js, then tag again." >&2
  exit 1
fi
# Audit REL-1: v1.0.9 was tagged on a commit whose app said 1.1.44, so that
# APK called itself 1.0.9 and showed old notes. The tag must be the app's
# own version.
pkg="${PACKAGE_JSON:-$(dirname "$0")/../mobile/package.json}"
app="$(sed -n 's/^  "version": "\([^"]*\)",$/\1/p' "$pkg" | head -1)"
if [[ "$app" != "$version" ]]; then
  echo "::error::The tag says $version but mobile/package.json says $app. Tag v$app on this commit instead." >&2
  exit 1
fi
echo "What's new has an entry for $version, and it matches the app's version."
