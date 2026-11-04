"""Coverage for content/email_digest.py — previously untested. Two real
bugs prompted this: the day label could show a stale "Edamam Day"
placeholder (see test_edamam_sync.py's self-heal test for the storage-side
half of that fix), and the digest only ever showed the gym session, using
a gym-only session count that could desync its "next up" day from what
/gym and /home themselves show once the user alternates between the two.
"""

from datetime import date

from sqlmodel import Session

from content.email_digest import build_daily_digest_html
from database import engine
from models import Workout


def test_digest_includes_both_gym_and_home_sessions_for_the_same_slot(client):
    """client fixture forces schema creation via TestClient's lifespan
    before this direct-DB test runs."""
    with Session(engine) as db:
        subject, html = build_daily_digest_html(db, date(2026, 8, 14), 0, "https://fitness-os.onrender.com")

        assert "If you're hitting the gym today:" in html
        assert "Or a home session instead:" in html
        assert 'href="https://fitness-os.onrender.com/gym"' in html
        assert 'href="https://fitness-os.onrender.com/home"' in html


def test_digest_gym_follows_weekday_schedule_and_home_keeps_its_rotation(client):
    """The gym section follows the trainer's weekday plan (2026-08-14 is a
    Friday: Leg day); the Home alternative keeps its own rotation counter
    (count=2 is "Upper B")."""
    with Session(engine) as db:
        _, html = build_daily_digest_html(db, date(2026, 8, 14), 2, "https://fitness-os.onrender.com")
        assert "hitting the gym today: Leg at 07:00" in html
        assert "home session instead: Upper B (Home)" in html


def test_digest_on_a_rest_day_names_the_next_session(client):
    with Session(engine) as db:
        # 2026-08-15 is a Saturday, a rest day; Sunday is Upper.
        _, html = build_daily_digest_html(db, date(2026, 8, 15), 0, "https://fitness-os.onrender.com")
        assert "Rest day. Next gym session: Upper on Sunday" in html


def test_digest_home_exercises_render_without_a_sets_field(client):
    """Home exercises are bodyweight (reps/time only, no working-weight
    'sets' key) — the gym row template would KeyError on these."""
    with Session(engine) as db:
        _, html = build_daily_digest_html(db, date(2026, 8, 14), 0, "https://fitness-os.onrender.com")
        assert "Superman Row" in html
        assert "8-12" in html  # Pike Push-up's rep range, reps-only (no "N x" prefix)


def test_digest_subject_includes_the_date(client):
    with Session(engine) as db:
        subject, _ = build_daily_digest_html(db, date(2026, 8, 14), 0, "https://fitness-os.onrender.com")
        assert "Aug 14" in subject


def test_reminders_route_uses_combined_gym_and_home_count(auth_client, test_cron_secret, monkeypatch):
    """Regression guard for the actual bug: the cron route used to count
    only workout_type == "gym" sessions, undercounting the shared
    gym+home rotation and potentially showing the wrong "next up" day in
    the email once the user has logged any Home sessions."""
    import routers.reminders as reminders

    monkeypatch.setattr(reminders, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(reminders, "DIGEST_EMAIL_TO", "test@example.com")

    captured = {}

    def fake_post(url, **kwargs):
        captured["html"] = kwargs["json"]["html"]

        class _Resp:
            def raise_for_status(self):
                pass

        return _Resp()

    monkeypatch.setattr(reminders.httpx, "post", fake_post)

    with Session(engine) as db:
        db.add(Workout(log_date=date(2026, 8, 1), workout_type="gym"))
        db.add(Workout(log_date=date(2026, 8, 3), workout_type="home"))
        db.add(Workout(log_date=date(2026, 8, 5), workout_type="gym"))
        db.commit()

    auth_client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})

    # 3 combined gym+home sessions -> home PROGRAM[3 % 4] == "Lower B". A
    # gym-only count of 2 would have shown "Upper B" instead -- the wrong
    # day. (The gym section itself follows the weekday schedule now.)
    assert "home session instead: Lower B (Home)" in captured["html"]
