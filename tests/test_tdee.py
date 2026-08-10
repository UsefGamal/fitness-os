from content.tdee import bmr_mifflin_st_jeor, macro_split, target_kcal, tdee_kcal


def test_bmr_mifflin_st_jeor_matches_known_values():
    # 80kg, 180cm, 30yo male: 10*80 + 6.25*180 - 5*30 + 5 = 800+1125-150+5 = 1780
    assert bmr_mifflin_st_jeor(80, 180, 30, "male") == 1780
    # Same stats, female: base - 161 instead of + 5 -> 1780 - 5 - 161 = 1614
    assert bmr_mifflin_st_jeor(80, 180, 30, "female") == 1614


def test_tdee_applies_activity_multiplier():
    assert tdee_kcal(1780, "sedentary") == 1780 * 1.2
    assert tdee_kcal(1780, "very_active") == 1780 * 1.9
    assert tdee_kcal(1780, "not_a_real_level") == 1780 * 1.55  # falls back to moderate


def test_target_kcal_no_rate_returns_maintenance():
    assert target_kcal(2500, None) == 2500
    assert target_kcal(2500, 0) == 2500
    assert target_kcal(2500, -0.5) == 2500


def test_target_kcal_applies_deficit_from_target_rate():
    # 0.5 kg/week -> 0.5*7700/7 = 550 kcal/day deficit
    assert target_kcal(2500, 0.5) == 2500 - 550


def test_target_kcal_caps_deficit_at_max():
    # An extreme rate shouldn't push the deficit past MAX_DAILY_DEFICIT (1000)
    result = target_kcal(3000, 5)
    assert result == 3000 - 1000


def test_target_kcal_never_goes_below_minimum():
    result = target_kcal(1300, 2)  # would imply a deficit deeper than the floor allows
    assert result >= 1200


def test_macro_split_shape_and_kcal_consistency():
    macros = macro_split(2000, 90)
    assert set(macros) == {"protein", "carbs", "fat", "fiber", "kcal"}
    assert macros["kcal"] == 2000
    assert macros["protein"] == round(90 * 2.0)
    assert macros["fat"] == round(90 * 0.8)
    # carbs should fill in whatever's left after protein+fat
    reconstructed = macros["protein"] * 4 + macros["carbs"] * 4 + macros["fat"] * 9
    assert abs(reconstructed - 2000) <= 4  # rounding slack
