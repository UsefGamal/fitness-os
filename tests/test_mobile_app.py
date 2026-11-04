"""Guards for the phase 3 phone app config (mobile/)."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "mobile" / "capacitor.config.json").read_text(encoding="utf-8"))


def test_app_is_standalone():
    # No server.url: the app runs from the files bundled in the APK.
    assert "url" not in CONFIG.get("server", {})
    assert CONFIG["webDir"] == "dist"


def test_app_id_stays_the_same():
    # Changing it would install a second app instead of updating this one.
    assert CONFIG["appId"] == "com.usefgamal.fitnessos"


def test_no_plain_http():
    assert CONFIG["android"]["allowMixedContent"] is False
    assert CONFIG["server"].get("cleartext", False) is False
