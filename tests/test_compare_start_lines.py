"""PROOF-1: the release update test's pass/fail rule."""
from scripts.compare_start_lines import compare, last_start_line

A = "11-13 02:00:01.123  4242  4242 I FitnessOSData: OK 0.9.8 W 12 · S 140 · M 61 · B 3 · 3F9A-12CD\n"
B = "11-13 02:01:09.456  4343  4343 I FitnessOSData: OK 0.9.9 W 12 · S 140 · M 61 · B 3 · 3F9A-12CD\n"
NOISE = "--------- beginning of main\n11-13 02:00:00.000  1  1 I Other: FitnessOS started\n"


def test_reads_the_newest_line_and_ignores_other_tags():
    assert last_start_line(NOISE) is None
    assert last_start_line(NOISE + A) == ("OK", "0.9.8", "W 12 · S 140 · M 61 · B 3 · 3F9A-12CD")
    two = A + A.replace("W 12", "W 13")
    assert last_start_line(two)[2].startswith("W 13")
    # The brief logcat format has no "tag:" spacing difference to trip on.
    assert last_start_line("I/FitnessOSData( 4242): OK 0.9.8 W 1 · S 2 · M 3 · B 4 · AAAA-BBBB")[2] == "W 1 · S 2 · M 3 · B 4 · AAAA-BBBB"


def test_same_data_passes_whatever_the_versions():
    ok, message = compare(NOISE + A, NOISE + B)
    assert ok and "Same data" in message and "0.9.8" in message and "0.9.9" in message


def test_lost_or_changed_data_fails():
    ok, message = compare(A, B.replace("W 12", "W 11"))
    assert not ok and "changed" in message
    ok, message = compare(A, B.replace("3F9A-12CD", "3F9A-12CE"))
    assert not ok


def test_a_crash_or_recovery_screen_after_the_update_fails():
    for kind in ("crash", "unreadable", "failed", "newer"):
        ok, message = compare(A, f"I FitnessOSData: ERROR 0.9.9 {kind}\n")
        assert not ok and kind in message
    # A clean start followed by a crash is still a crash.
    ok, _ = compare(A, B + "I FitnessOSData: ERROR 0.9.9 crash\n")
    assert not ok


def test_no_line_after_the_update_fails():
    ok, message = compare(A, NOISE)
    assert not ok and "no data check line" in message


def test_an_older_release_without_the_line_is_reported_not_proved():
    ok, message = compare(NOISE, B)
    assert ok and message.startswith("NOT COMPARED")
    ok, _ = compare("I FitnessOSData: ERROR 0.9.8 failed\n", B)
    assert not ok


def test_the_script_taps_the_setup_skip_button_by_its_real_text():
    """The emulator script gets past first-time setup by the button's text;
    if the wording changes, this fails before a release does."""
    import pathlib
    import re

    root = pathlib.Path(__file__).resolve().parents[1]
    script = (root / "scripts" / "update-over-install.sh").read_text(encoding="utf-8")
    strings = (root / "mobile" / "src" / "i18n" / "en.js").read_text(encoding="utf-8")
    skip = re.search(r"'setup\.skipAll': '([^']+)'", strings).group(1)
    assert f'tap_text "{skip}"' in script
    # And the tag the script reads is the one the app writes.
    plugin = (root / "mobile/android/app/src/main/java/com/usefgamal/fitnessos/appinfo/AppInfoPlugin.java").read_text(encoding="utf-8")
    assert 'Log.i("FitnessOSData"' in plugin and "FitnessOSData:I" in script
