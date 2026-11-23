"""scripts/ci_changes.py: which PRs skip the phone checks."""

import pytest

from scripts.ci_changes import app_changed


@pytest.mark.parametrize(
    "paths",
    [
        ["mobile/src/views/Home.jsx"],
        ["mobile/e2e/harness.mjs"],
        ["mobile/package-lock.json"],
        ["content/meal_plan.py"],
        ["scripts/export_content.py"],
        [".github/workflows/ci.yml"],
        [".github/actions/node-setup/action.yml"],
        ["README.md", "mobile/src/lib/plan.js"],
        [],
    ],
)
def test_app_changes_run_the_phone_checks(paths):
    assert app_changed(paths)


@pytest.mark.parametrize(
    "paths",
    [
        ["README.md", "CLAUDE.md", "docs/ANDROID_ROADMAP.md"],
        ["mobile/README.md"],
        ["tests/test_routines.py"],
        ["mobile/android/app/src/main/java/com/usefgamal/fitnessos/RestTimerService.java"],
        [".github/workflows/android.yml", "scripts/build-apk.sh"],
    ],
)
def test_other_changes_skip_them(paths):
    assert not app_changed(paths)
