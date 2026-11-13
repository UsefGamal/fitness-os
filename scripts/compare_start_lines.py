#!/usr/bin/env python3
"""Decide whether an update kept the data (PROOF-1).

The app writes one line to logcat at every start, under the tag
FitnessOSData (mobile/src/lib/dataCheck.js startLine):

    OK 0.9.8 W 12 · S 140 · M 61 · B 3 · 3F9A-12CD
    ERROR 0.9.8 unreadable

scripts/update-over-install.sh saves `adb logcat -d -s FitnessOSData:I`
before and after the update and calls this with the two files. Exit 0
when the update kept the data, 1 with a reason when it did not.

    compare_start_lines.py before.log after.log

A release from before this line existed has nothing to compare: then the
new build must still start cleanly, and the result says the data was not
compared. That is reported as a pass with a warning, never as proof.
"""
from __future__ import annotations

import re
import sys

TAG = "FitnessOSData"
LINE = re.compile(rf"{TAG}[^:]*:\s*(OK|ERROR) (\S+) (.+)$")


def last_start_line(logcat: str) -> tuple[str, str, str] | None:
    """The newest start line in a logcat dump: (status, version, rest)."""
    found = None
    for raw in logcat.splitlines():
        m = LINE.search(raw)
        if m:
            found = (m.group(1), m.group(2), m.group(3).strip())
    return found


def compare(before: str, after: str) -> tuple[bool, str]:
    """(passed, message) for two logcat dumps."""
    new = last_start_line(after)
    if new is None:
        return False, "The updated app wrote no data check line: it did not finish starting."
    if new[0] != "OK":
        return False, f"The updated app started on an error screen ({new[2]})."
    old = last_start_line(before)
    if old is None:
        return True, f"NOT COMPARED: the older release has no data check line. After the update: {new[2]}"
    if old[0] != "OK":
        return False, f"The older release did not start cleanly ({old[2]}), so there is nothing to compare."
    if old[2] != new[2]:
        return False, f"The data changed across the update.\n  before ({old[1]}): {old[2]}\n  after  ({new[1]}): {new[2]}"
    return True, f"Same data before ({old[1]}) and after ({new[1]}): {new[2]}"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    with open(argv[1], encoding="utf-8", errors="replace") as f:
        before = f.read()
    with open(argv[2], encoding="utf-8", errors="replace") as f:
        after = f.read()
    ok, message = compare(before, after)
    print(message)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
