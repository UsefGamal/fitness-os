from datetime import date

from sqlmodel import Session, select

from database import engine
from macro_targets import get_macro_targets
from models import BodyLog, Profile


def test_falls_back_to_static_targets_with_no_weight_data(client):
    with Session(engine) as db:
        targets = get_macro_targets(db)
        assert targets["protein"] == 185  # the original static constant
        assert "kcal" in targets


def test_computes_real_targets_from_profile_and_body_log(client):
    with Session(engine) as db:
        profile = db.exec(select(Profile)).first()
        profile.height_cm = 180
        profile.date_of_birth = date(1994, 1, 1)  # ~30-31yo depending on test run date
        profile.gender = "male"
        profile.activity_level = "moderate"
        profile.start_weight_kg = 90
        profile.goal_weight_low_kg = 80
        profile.goal_weight_high_kg = 82
        profile.goal_date = date.today().replace(year=date.today().year + 1)
        db.add(profile)
        db.add(BodyLog(log_date=date.today(), weight_kg=90))
        db.commit()

        targets = get_macro_targets(db)
        # No longer the static 185/150/70 constant -- actually derived from stats.
        assert targets["protein"] == round(90 * 2.0)
        assert targets["fat"] == round(90 * 0.8)
        assert targets["kcal"] > 1200  # sane floor, not a degenerate result
        assert "carbs" in targets and "fiber" in targets


def test_falls_back_when_age_is_out_of_sane_range(client):
    with Session(engine) as db:
        profile = db.exec(select(Profile)).first()
        profile.date_of_birth = date(1900, 1, 1)  # absurd age
        db.add(profile)
        db.add(BodyLog(log_date=date.today(), weight_kg=90))
        db.commit()

        targets = get_macro_targets(db)
        assert targets["protein"] == 185  # fallback, not a garbage age-based number
