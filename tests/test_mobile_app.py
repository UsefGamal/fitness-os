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
    assert health == [
        # Optional, each can be refused: daily activity, sleep and recovery.
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_RESTING_HEART_RATE",
        "android.permission.health.READ_SLEEP",
        "android.permission.health.READ_STEPS",
        # Required: weigh-ins in, workouts out.
        "android.permission.health.READ_WEIGHT",
        "android.permission.health.WRITE_EXERCISE",
    ]


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


# ── Phase 11: release builds and backups (E1-S3, E8-S1) ──────────────────

import subprocess  # noqa: E402
import xml.etree.ElementTree as ET  # noqa: E402

RES_XML = ANDROID / "res" / "xml"
GRADLE = (ROOT / "mobile" / "android" / "app" / "build.gradle").read_text(encoding="utf-8")


def test_progress_photos_never_go_to_android_backup():
    # Android 12+ (cloud backup and device transfer) and Android 11-.
    assert 'android:dataExtractionRules="@xml/data_extraction_rules"' in MANIFEST
    assert 'android:fullBackupContent="@xml/backup_rules"' in MANIFEST
    rules = ET.parse(RES_XML / "data_extraction_rules.xml").getroot()
    for section in ("cloud-backup", "device-transfer"):
        excludes = [(e.get("domain"), e.get("path")) for e in rules.find(section).findall("exclude")]
        assert ("file", "progress-photos/") in excludes, section
    legacy = ET.parse(RES_XML / "backup_rules.xml").getroot()
    assert ("file", "progress-photos/") in [(e.get("domain"), e.get("path")) for e in legacy.findall("exclude")]


def test_the_photo_folder_in_the_rules_is_the_one_the_app_uses():
    photos = (ROOT / "mobile" / "src" / "store" / "photos.js").read_text(encoding="utf-8")
    assert "const DIR = 'progress-photos';" in photos
    assert "Directory.Data" in photos  # Capacitor's Data directory is files/, the "file" domain


def test_debug_builds_install_beside_the_real_app():
    assert 'applicationId "com.usefgamal.fitnessos"' in GRADLE
    assert 'applicationIdSuffix ".debug"' in GRADLE
    debug_name = (ROOT / "mobile" / "android" / "app" / "src" / "debug" / "res" / "values" / "strings.xml").read_text(encoding="utf-8")
    assert "Fitness OS debug" in debug_name
    # Providers must follow the ID, or the two apps can't be installed together.
    assert "${applicationId}.fileprovider" in MANIFEST
    assert 'android:authorities="com.usefgamal' not in MANIFEST


def _version(tag):
    return subprocess.run(["bash", str(ROOT / "scripts" / "version-from-tag.sh"), tag], capture_output=True, text=True)


def test_release_versions_come_from_the_tag_and_only_go_up():
    out = _version("v0.4.1")
    assert out.returncode == 0
    assert out.stdout.split() == ["APK_VERSION_NAME=0.4.1", "APK_VERSION_CODE=4001"]
    codes = [int(_version(t).stdout.split("=")[-1]) for t in ("v0.4.1", "v0.4.2", "v0.5.0", "v0.10.0", "v1.0.0")]
    assert codes == sorted(codes) and len(set(codes)) == len(codes)
    assert codes[0] > 1000  # above every run-number build installed before tags


def test_bad_tags_are_refused():
    for tag in ("0.4.1", "v0.4", "v0.4.1-beta", "v0.0.9"):
        assert _version(tag).returncode != 0, tag


def test_only_tags_build_a_signed_release():
    wf = (ROOT / ".github" / "workflows" / "android.yml").read_text(encoding="utf-8")
    assert 'tags: ["v*"]' in wf
    assert "scripts/build-apk.sh release" in wf
    assert "if: env.IS_TAG == 'true'" in wf
    assert "check-apk.sh dist/fitness-os-release.apk com.usefgamal.fitnessos" in wf
    assert "check-apk.sh dist/fitness-os-debug.apk com.usefgamal.fitnessos.debug" in wf
