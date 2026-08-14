"""Coverage for the cron digest routes' background-task flow (see
routers/reminders.py). The routes used to build the digest HTML and call
Resend inline before responding, which could take longer than
cron-job.org's free-tier 30-second timeout — especially on a cold Render
instance — and any failure was reported as a plain 200 with an easy-to-miss
JSON body, invisible to cron-job.org's own monitoring. Now the route
responds immediately with {"status": "queued"} and the real work (and its
outcome) lands in a ReminderLog row that /more surfaces.

TestClient runs FastAPI BackgroundTasks synchronously before the request
completes (see test_edamam_sync.py's same note), so hitting the route
directly is enough to exercise the background function too — no separate
"pretend to be the background worker" step needed.
"""

from sqlmodel import Session, select

import routers.reminders as reminders
from database import engine
from models import ReminderLog


class _FakeResponse:
    def raise_for_status(self):
        pass


def _stub_resend_success(monkeypatch):
    monkeypatch.setattr(reminders, "RESEND_API_KEY", "test-resend-key")
    monkeypatch.setattr(reminders, "DIGEST_EMAIL_TO", "test@example.com")
    monkeypatch.setattr(reminders.httpx, "post", lambda *a, **kw: _FakeResponse())


def _stub_resend_failure(monkeypatch):
    """Leaves RESEND_API_KEY/DIGEST_EMAIL_TO unset — the exact failure
    mode a misconfigured Render deploy would hit."""
    monkeypatch.setattr(reminders, "RESEND_API_KEY", "")
    monkeypatch.setattr(reminders, "DIGEST_EMAIL_TO", "")


def test_daily_digest_responds_immediately_and_queues(client, test_cron_secret, monkeypatch):
    _stub_resend_success(monkeypatch)
    r = client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})
    assert r.status_code == 200
    assert r.json() == {"status": "queued"}


def test_daily_digest_success_recorded_as_sent(client, test_cron_secret, monkeypatch):
    _stub_resend_success(monkeypatch)
    client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})

    with Session(engine) as db:
        rows = db.exec(select(ReminderLog).where(ReminderLog.reminder_type == "daily_digest")).all()
        assert len(rows) == 1
        assert rows[0].status == "sent"
        assert rows[0].error_detail is None


def test_daily_digest_failure_recorded_with_detail_and_visible_on_more(auth_client, test_cron_secret, monkeypatch):
    """This is the actual bug: previously a failure like this returned a
    plain 200 with a JSON body nobody was reading, so cron-job.org's
    dashboard showed "success" while no email ever arrived. It must now
    show up somewhere a human actually looks."""
    _stub_resend_failure(monkeypatch)
    r = auth_client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})
    assert r.status_code == 200
    assert r.json() == {"status": "queued"}

    with Session(engine) as db:
        rows = db.exec(select(ReminderLog).where(ReminderLog.reminder_type == "daily_digest")).all()
        assert len(rows) == 1
        assert rows[0].status == "error"
        assert "RESEND_API_KEY" in rows[0].error_detail

    more_page = auth_client.get("/more")
    assert "Daily digest failed" in more_page.text
    assert "RESEND_API_KEY" in more_page.text


def test_daily_digest_failed_attempt_does_not_block_a_retry(client, test_cron_secret, monkeypatch):
    """An error today must not count as "already sent" — the next cron
    ping (no &force=true needed) should retry automatically."""
    _stub_resend_failure(monkeypatch)
    client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})

    _stub_resend_success(monkeypatch)
    client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})

    with Session(engine) as db:
        rows = db.exec(select(ReminderLog).where(ReminderLog.reminder_type == "daily_digest")).all()
        assert len(rows) == 2
        assert [r.status for r in rows] == ["error", "sent"]


def test_daily_digest_successful_send_is_skipped_without_force(client, test_cron_secret, monkeypatch):
    _stub_resend_success(monkeypatch)
    client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})

    r = client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})
    assert r.json()["status"] == "skipped"

    with Session(engine) as db:
        rows = db.exec(select(ReminderLog).where(ReminderLog.reminder_type == "daily_digest")).all()
        assert len(rows) == 1  # the skip never queued a second attempt


def test_daily_digest_force_resends_even_after_success(client, test_cron_secret, monkeypatch):
    _stub_resend_success(monkeypatch)
    client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})
    r = client.get("/cron/daily-digest", params={"force": "true"}, headers={"X-Cron-Secret": test_cron_secret})
    assert r.json() == {"status": "queued"}

    with Session(engine) as db:
        rows = db.exec(select(ReminderLog).where(ReminderLog.reminder_type == "daily_digest")).all()
        assert len(rows) == 2


def test_weekly_recap_success_recorded_and_queues_fast(client, test_cron_secret, monkeypatch):
    _stub_resend_success(monkeypatch)
    r = client.get("/cron/weekly-recap", headers={"X-Cron-Secret": test_cron_secret})
    assert r.json() == {"status": "queued"}

    with Session(engine) as db:
        rows = db.exec(select(ReminderLog).where(ReminderLog.reminder_type == "weekly_recap")).all()
        assert len(rows) == 1
        assert rows[0].status == "sent"


def test_more_page_shows_not_sent_yet_before_any_digest(auth_client):
    r = auth_client.get("/more")
    assert "not sent yet" in r.text
