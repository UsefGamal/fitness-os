"""CI: does a PR touch what the phone checks (screens, device tests,
journeys) look at? Reads changed paths on stdin, one per line, and prints
"app=true" or "app=false" for $GITHUB_OUTPUT.

The checks run the web build of mobile/ with the content from content/, so
they matter for those. Notes (*.md), docs/, Python tests and the native
Android code (mobile/android/, built by the Android APK workflow) don't
change what they see. When unsure (no paths at all), run them.

    git diff --name-only BASE HEAD | python3 scripts/ci_changes.py
"""

import sys

APP_FILES = {
    "scripts/export_content.py",
    "scripts/ci_changes.py",
    ".github/workflows/ci.yml",
}


def touches_app(path: str) -> bool:
    if path in APP_FILES or path.startswith("content/"):
        return True
    if path.startswith("mobile/"):
        return not (path.startswith("mobile/android/") or path.endswith(".md"))
    return False


def app_changed(paths: list[str]) -> bool:
    paths = [p.strip() for p in paths if p.strip()]
    return not paths or any(touches_app(p) for p in paths)


if __name__ == "__main__":
    print(f"app={'true' if app_changed(sys.stdin.readlines()) else 'false'}")
