"""Notification and widget layouts may only use views a RemoteViews can draw.

A plain <View> (or any other view) in a notification layout makes Android
kill the app with "Bad notification posted" the moment it is shown; in a
widget the launcher shows "Can't load widget". Nothing else catches this
before a phone does (27 Nov 2026: a spacer <View> in notif_adjust.xml
crashed the app at the first rest after logging a set).
"""

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
