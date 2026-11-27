"""Notification and widget layouts may only use views a RemoteViews can draw.

A plain <View> (or any other view) in a notification layout makes Android
kill the app with "Bad notification posted" the moment it is shown; in a
widget the launcher shows "Can't load widget". Nothing else catches this
before a phone does (27 Nov 2026: a spacer <View> in notif_adjust.xml
crashed the app at the first rest after logging a set).
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path

LAYOUTS = Path(__file__).resolve().parent.parent / "mobile/android/app/src/main/res/layout"

# android.widget.RemoteViews' supported views (API 31 adds the last four).
ALLOWED = {
    "FrameLayout", "LinearLayout", "RelativeLayout", "GridLayout",
    "AnalogClock", "Button", "Chronometer", "ImageButton", "ImageView",
    "ProgressBar", "TextView", "ViewFlipper", "ListView", "GridView",
    "StackView", "AdapterViewFlipper", "include",
    "CheckBox", "RadioButton", "RadioGroup", "Switch",
}


def remote_layouts():
    return sorted(p for p in LAYOUTS.glob("*.xml") if p.name.startswith(("notif_", "widget_")))


def test_there_are_remote_layouts():
    assert len(remote_layouts()) >= 5


def test_remote_layouts_use_only_remote_views():
    bad = []
    for path in remote_layouts():
        for el in ET.parse(path).iter():
            if el.tag not in ALLOWED:
                bad.append(f"{path.name}: <{el.tag}>")
    assert not bad, "views a notification or widget can't draw: " + ", ".join(bad)


# Added in API 31; the app still runs on Android 8 (minSdk 26), where
# these in a notification crash the same way. Only in layout-v31/.
API_31 = {"CheckBox", "RadioButton", "RadioGroup", "Switch"}


def test_no_api_31_views_below_android_12():
    bad = [f"{p.name}: <{el.tag}>" for p in remote_layouts() for el in ET.parse(p).iter() if el.tag in API_31]
    assert not bad, "move these to layout-v31/ or use a TextView: " + ", ".join(bad)


def test_includes_point_at_checked_layouts():
    """An <include> pulls in a layout the check above must also cover, so it
    has to be another notif_/widget_ layout."""
    bad = []
    for path in remote_layouts():
        for el in ET.parse(path).iter("include"):
            name = el.get("layout", "").removeprefix("@layout/")
            if not name.startswith(("notif_", "widget_")) or not (LAYOUTS / f"{name}.xml").exists():
                bad.append(f"{path.name} includes {name!r}")
    assert not bad, ", ".join(bad)


def test_remote_views_calls_use_typed_setters():
    """RemoteViews.setInt/setFloat/... with a method name call it by
    reflection on the phone; a method that isn't @RemotableViewMethod kills
    the app the same way a bad view does. Keep to the typed setters
    (setTextViewText, setViewVisibility, ...) or add the method here once it
    has been checked against the Android docs."""
    java = Path(__file__).resolve().parent.parent / "mobile/android/app/src/main/java"
    checked = {"setBackgroundResource", "setColorFilter", "setImageResource", "setTextColor", "setAlpha"}
    bad = []
    for f in java.rglob("*.java"):
        for m in re.finditer(r"\.set(?:Int|Float|Boolean|String|Long|Uri|Bitmap|CharSequence|ColorStateList|Icon)\([^,]+,\s*\"(\w+)\"", f.read_text()):
            if m.group(1) not in checked:
                bad.append(f"{f.name}: {m.group(1)}")
    assert not bad, "unchecked reflective RemoteViews calls: " + ", ".join(bad)
