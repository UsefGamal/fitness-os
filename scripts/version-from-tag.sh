#!/usr/bin/env bash
# Turn a release tag into the APK's version (E1-S3).
#
#   scripts/version-from-tag.sh v0.4.1   ->  APK_VERSION_NAME=0.4.1
#                                            APK_VERSION_CODE=4001
#
# versionCode = major * 1000000 + minor * 1000 + patch, so every later tag
# is higher and Android installs it over the last one. Every APK built
# before tags (CI run numbers, all below 1000) is lower, so the first tag
# installs over them too, as long as it is signed with the same key.
set -euo pipefail

tag="${1:?usage: $0 vMAJOR.MINOR.PATCH}"
if [[ ! "$tag" =~ ^v([0-9]+)\.([0-9]{1,3})\.([0-9]{1,3})$ ]]; then
  echo "Release tags look like v0.4.1 (got '$tag')." >&2
  exit 2
fi
major="${BASH_REMATCH[1]}" minor="${BASH_REMATCH[2]}" patch="${BASH_REMATCH[3]}"
code=$((10#$major * 1000000 + 10#$minor * 1000 + 10#$patch))
# Above every run-number build so far, and below Android's limit.
if (( code < 1000 || code > 2100000000 )); then
  echo "Tag $tag gives versionCode $code; use v0.1.0 or later." >&2
  exit 2
fi
echo "APK_VERSION_NAME=$major.$minor.$patch"
echo "APK_VERSION_CODE=$code"
