"""Regression coverage for clock.py — the fix for a real bug where the
app's "today" was computed from the server's local clock (UTC in
production on Render) instead of the user's timezone (Africa/Cairo,
UTC+2). Every date-picker default, upsert-by-date match, and dashboard
"is this today" comparison depends on this being the user's actual
calendar day, not the server's.
"""

from datetime import date
from zoneinfo import ZoneInfo

from clock import APP_TIMEZONE, today


def test_today_returns_a_date():
    assert isinstance(today(), date)


def test_app_timezone_is_cairo():
    assert ZoneInfo("Africa/Cairo") == APP_TIMEZONE


def test_today_matches_cairo_wall_clock_even_when_utc_disagrees(monkeypatch):
    """The whole point of this module: right after midnight in Cairo but
    before midnight in UTC, date.today() (server/UTC) and today()
    (Cairo) must disagree — that gap is exactly the bug this fixes."""
    import clock

    class _FixedDatetime:
        @staticmethod
        def now(tz=None):
            # 00:30 Cairo time on Aug 15 == 22:30 UTC on Aug 14 — the
            # ~2-hour daily window where naive date.today() on a UTC
            # server would still read Aug 14.
            from datetime import datetime

            cairo_midnight_thirty = datetime(2026, 8, 15, 0, 30, tzinfo=ZoneInfo("Africa/Cairo"))
            return cairo_midnight_thirty.astimezone(tz) if tz else cairo_midnight_thirty

    monkeypatch.setattr(clock, "datetime", _FixedDatetime)
    assert clock.today() == date(2026, 8, 15)
