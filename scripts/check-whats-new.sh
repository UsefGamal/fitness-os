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
echo "What's new has an entry for $version."
