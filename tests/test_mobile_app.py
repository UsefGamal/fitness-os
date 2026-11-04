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


ANDROID = ROOT / "mobile" / "android" / "app" / "src" / "main"
MANIFEST = (ANDROID / "AndroidManifest.xml").read_text(encoding="utf-8")
MAIN = (ANDROID / "java" / "com" / "usefgamal" / "fitnessos" / "MainActivity.java").read_text(encoding="utf-8")


def test_phase4_plugins_are_registered():
    # Capacitor only finds an app's own plugins when MainActivity registers them.
    for plugin in ("RestTimerPlugin", "WidgetPlugin", "HealthPlugin"):
        assert f"registerPlugin({plugin}.class)" in MAIN


def test_manifest_declares_the_phase4_pieces():
    assert 'android:name=".timer.RestTimerService"' in MANIFEST
    assert 'android:foregroundServiceType="specialUse"' in MANIFEST
    assert "PROPERTY_SPECIAL_USE_FGS_SUBTYPE" in MANIFEST
    assert 'android:name=".widget.TodayWidget"' in MANIFEST
    # Health Connect refuses apps that can't explain their data use.
    assert "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" in MANIFEST
    assert "android.intent.action.VIEW_PERMISSION_USAGE" in MANIFEST


def test_health_permissions_are_only_what_the_app_uses():
    health = sorted(line.split('"')[1] for line in MANIFEST.splitlines() if "android.permission.health." in line)
    assert health == ["android.permission.health.READ_WEIGHT", "android.permission.health.WRITE_EXERCISE"]


# The classes a home-screen widget layout may use (RemoteViews' whitelist).
# Anything else, even a plain <View>, makes the launcher show "Can't load widget".
REMOTE_VIEWS_OK = {
    "FrameLayout", "LinearLayout", "RelativeLayout", "GridLayout",
    "AnalogClock", "Button", "Chronometer", "ImageButton", "ImageView", "ProgressBar", "TextView",
    "ViewFlipper", "ListView", "GridView", "StackView", "AdapterViewFlipper",
}  # fmt: skip


def test_widget_layouts_only_use_remote_views_classes():
    import re

    for layout in (ANDROID / "res" / "layout").glob("widget_*.xml"):
        tags = set(
            re.findall(r"<([A-Za-z][\w.]*)", re.sub(r"<!--.*?-->", "", layout.read_text(encoding="utf-8"), flags=re.S))
        )
        assert tags <= REMOTE_VIEWS_OK, f"{layout.name} uses {sorted(tags - REMOTE_VIEWS_OK)}"
