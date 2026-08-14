"""Single source of truth for "what day is it right now" for this app's one
user (Africa/Cairo, UTC+2, no DST).

This app runs on Render in production, whose containers run in UTC. Calling
`date.today()` directly anywhere uses the *server's* local clock, not the
user's — for roughly the first two hours after midnight in Cairo, the
server's `date.today()` is still on the previous calendar day. A workout
logged during that window as "today" (from the user's perspective) would
get compared against, or default to, the server's still-yesterday date
depending on the call site — e.g. a session actually logged for the
previous day reading back as attributed to "today" on the dashboard.

Every "what's today" call in this app should go through `today()` here
instead of `date.today()` directly. This is deliberately unrelated to the
`datetime.utcnow()` timestamps in models.py/edamam_sync.py/fitchef_sync.py
(`sent_at`/`requested_at`/`synced_at`/`completed_at`) — those are absolute
bookkeeping timestamps compared against each other in the same clock, not
"what calendar day is the user on" judgments, so they're correct as UTC
and out of scope for this fix.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

# `zoneinfo` needs an IANA tz database to resolve "Africa/Cairo" — most
# Linux hosts (including Render's) ship one, but Windows never does and a
# minimal container image might not either, so `tzdata` (requirements.txt)
# is a hard dependency here, not an optional extra.
APP_TIMEZONE = ZoneInfo("Africa/Cairo")


def today() -> date:
    return datetime.now(APP_TIMEZONE).date()
