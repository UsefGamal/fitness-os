from content.food_items import FOODS

MEAL_SLOTS = ["breakfast", "snack1", "lunch", "snack2", "dinner"]

# Hour windows each slot is meant to be eaten in. Main meals are structured,
# snacks stay flexible.
MEAL_SLOT_WINDOWS = {
    "breakfast": "7:00–9:30",
    "snack1": "10:30–11:30",
    "lunch": "13:00–15:00",
    "snack2": "16:30–17:30",
    "dinner": "19:00–21:00",
}

# Drinks selectable alongside any meal — all effectively zero-calorie.
DRINK_OPTIONS = ["water", "unsweetened_tea", "unsweetened_coffee", "diet_soda", "flavored_sparkling_water"]

# 14-day (= 2-week) rotating meal plan. No fish/seafood. Structured portions,
# not calorie-counted day to day — targets ~1900-2050 kcal / ~175-195g protein.
# Each slot offers 2 selectable home-cooked options: A is Egyptian, B leans
# Syrian/Levantine or grilled — both macro-matched to the same daily band.
# This plan refreshes on a 2-week cadence (one full rotation); edit the
# entries below when it's time for a refresh.
MEAL_PLAN_14_DAY = [
    {
        "day_index": 1,
        "label": "Ful Medames / Shish Tawook Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["ful_medames_bowl", "boiled_egg", "boiled_egg", "whole_wheat_pita_half"]},
                "option_b": {"cuisine": "Syrian", "items": ["zaatar_manakish_half", "labneh_2tbsp", "boiled_egg"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g", "fruit_medium"]},
                "option_b": {"cuisine": "Syrian", "items": ["hummus_2tbsp", "whole_wheat_pita_half"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["grilled_chicken_breast_200g", "white_rice_150g", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["shish_tawook_200g", "syrian_rice_vermicelli_150g", "fattoush_bowl"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["roasted_chickpeas_30g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["lentil_soup_bowl", "cottage_cheese_150g", "whole_wheat_pita_half", "turkey_breast_150g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kofta_skewer_150g", "tabbouleh_bowl", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 2,
        "label": "Shakshuka / Grilled Lamb Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["shakshuka_3eggs", "whole_wheat_pita_half"]},
                "option_b": {"cuisine": "Syrian", "items": ["omelet_3egg_veg", "whole_wheat_pita_half"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium", "mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc", "mixed_nuts_25g"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["beef_kofta_150g", "freekeh_150g", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_lamb_chops_180g", "batata_harra_100g", "salad_tomato_cucumber"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["greek_yogurt_lowfat_200g", "dates_3pc"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["grilled_chicken_breast_150g", "molokhia_bowl", "turkey_breast_150g"]},
                "option_b": {"cuisine": "Grilled", "items": ["shawarma_plate_220g", "tabbouleh_bowl", "cottage_cheese_100g", "greek_yogurt_lowfat_200g"]},
            },
        },
    },
    {
        "day_index": 3,
        "label": "Molokhia / Kebab Hindi Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["ful_medames_bowl", "boiled_egg", "feta_50g"]},
                "option_b": {"cuisine": "Syrian", "items": ["cottage_cheese_150g", "whole_wheat_toast_2slices", "salad_tomato_cucumber"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g", "dates_3pc"]},
                "option_b": {"cuisine": "Syrian", "items": ["cottage_cheese_100g", "fruit_medium"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["molokhia_bowl", "grilled_chicken_breast_200g", "white_rice_150g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kebab_hindi_150g", "syrian_rice_vermicelli_150g", "mutabbal_2tbsp"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["roasted_chickpeas_30g"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["omelet_3egg_veg", "salad_tomato_cucumber", "turkey_breast_150g"]},
                "option_b": {"cuisine": "Grilled", "items": ["shish_tawook_200g", "fattoush_bowl", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 4,
        "label": "Bamia / Halloumi & Steak Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["whole_wheat_toast_2slices", "boiled_egg", "boiled_egg", "avocado_half"]},
                "option_b": {"cuisine": "Syrian", "items": ["boiled_egg", "boiled_egg", "grilled_halloumi_50g", "whole_wheat_pita_half"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium", "mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["hummus_2tbsp", "whole_wheat_pita_half"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["bamia_chicken_bowl", "white_rice_150g", "grilled_chicken_breast_200g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_beef_steak_180g", "batata_harra_100g", "salad_tomato_cucumber"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["roasted_chickpeas_30g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["turkey_breast_150g", "salad_tomato_cucumber", "whole_wheat_pita_half"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_chicken_thigh_200g", "tabbouleh_bowl", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 5,
        "label": "Hawawshi / Kofta Skewer Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["ful_medames_bowl", "boiled_egg"]},
                "option_b": {"cuisine": "Syrian", "items": ["zaatar_manakish_half", "labneh_2tbsp", "boiled_egg"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g", "fruit_medium"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc", "mixed_nuts_25g"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["hawawshi_baked", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kofta_skewer_150g", "fattoush_bowl", "toum_1tbsp"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["greek_yogurt_lowfat_200g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["lentil_soup_bowl", "cottage_cheese_100g", "grilled_chicken_breast_200g", "cottage_cheese_100g"]},
                "option_b": {"cuisine": "Grilled", "items": ["shawarma_plate_220g", "salad_tomato_cucumber", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 6,
        "label": "Grilled Steak / Shish Tawook Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["shakshuka_3eggs"]},
                "option_b": {"cuisine": "Syrian", "items": ["omelet_3egg_veg", "whole_wheat_pita_half"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium", "roasted_chickpeas_30g"]},
                "option_b": {"cuisine": "Syrian", "items": ["cottage_cheese_100g", "fruit_medium"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["grilled_beef_steak_180g", "freekeh_150g", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["shish_tawook_200g", "freekeh_150g", "salad_tomato_cucumber"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc", "fruit_medium"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["mahshi_zucchini_bowl", "grilled_chicken_breast_200g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kebab_hindi_150g", "tabbouleh_bowl", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 7,
        "label": "Koshari / Lamb Chops Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["whole_wheat_toast_2slices", "boiled_egg", "boiled_egg"]},
                "option_b": {"cuisine": "Syrian", "items": ["cottage_cheese_150g", "whole_wheat_toast_2slices", "salad_tomato_cucumber"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["hummus_2tbsp", "whole_wheat_pita_half"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["koshari_bowl_small", "salad_tomato_cucumber", "grilled_chicken_breast_200g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_lamb_chops_180g", "syrian_rice_vermicelli_150g", "fattoush_bowl"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium", "boiled_egg", "greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["roasted_chickpeas_30g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["grilled_chicken_breast_150g", "molokhia_bowl"]},
                "option_b": {"cuisine": "Grilled", "items": ["shish_tawook_200g", "mutabbal_2tbsp", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 8,
        "label": "Shawarma Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["ful_medames_bowl", "boiled_egg"]},
                "option_b": {"cuisine": "Syrian", "items": ["boiled_egg", "boiled_egg", "turkey_breast_150g", "whole_wheat_pita_half"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium", "mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc", "mixed_nuts_25g"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["chicken_shawarma_home_200g", "whole_wheat_pita", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kofta_skewer_150g", "batata_harra_100g", "tabbouleh_bowl"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["greek_yogurt_lowfat_200g", "dates_3pc"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["lentil_soup_bowl", "cottage_cheese_100g", "turkey_breast_150g", "cottage_cheese_100g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_chicken_thigh_200g", "fattoush_bowl", "cottage_cheese_100g"]},
            },
        },
    },
    {
        "day_index": 9,
        "label": "Kofta & Freekeh / Shawarma Plate Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["omelet_3egg_veg", "whole_wheat_pita_half"]},
                "option_b": {"cuisine": "Syrian", "items": ["zaatar_manakish_half", "labneh_2tbsp", "boiled_egg"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g", "dates_3pc"]},
                "option_b": {"cuisine": "Syrian", "items": ["cottage_cheese_100g", "fruit_medium", "boiled_egg"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["beef_kofta_150g", "freekeh_150g", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["shawarma_plate_220g", "syrian_rice_vermicelli_150g", "salad_tomato_cucumber"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["roasted_chickpeas_30g"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["turkey_breast_150g", "salad_tomato_cucumber", "grilled_chicken_breast_150g", "cottage_cheese_100g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_lamb_chops_180g", "tabbouleh_bowl", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 10,
        "label": "Grilled Thigh / Steak & Fattoush Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["ful_medames_bowl", "boiled_egg"]},
                "option_b": {"cuisine": "Syrian", "items": ["omelet_3egg_veg", "whole_wheat_pita_half"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium", "mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["hummus_2tbsp", "whole_wheat_pita_half"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["grilled_chicken_thigh_200g", "white_rice_150g", "molokhia_bowl"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_beef_steak_180g", "fattoush_bowl", "mutabbal_2tbsp"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["roasted_chickpeas_30g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["cottage_cheese_150g", "salad_tomato_cucumber", "whole_wheat_pita_half", "grilled_chicken_breast_150g", "boiled_egg"]},
                "option_b": {"cuisine": "Grilled", "items": ["shish_tawook_200g", "batata_harra_100g", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 11,
        "label": "Mahshi / Kebab Hindi Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["whole_wheat_toast_2slices", "boiled_egg", "boiled_egg", "feta_50g"]},
                "option_b": {"cuisine": "Syrian", "items": ["boiled_egg", "boiled_egg", "grilled_halloumi_50g", "whole_wheat_pita_half"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc", "mixed_nuts_25g"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["mahshi_zucchini_bowl", "grilled_chicken_breast_150g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kebab_hindi_150g", "tabbouleh_bowl", "toum_1tbsp"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["greek_yogurt_lowfat_200g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["lentil_soup_bowl", "greek_yogurt_lowfat_200g", "grilled_chicken_breast_150g", "cottage_cheese_100g"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_chicken_thigh_200g", "fattoush_bowl", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 12,
        "label": "Fattah / Lamb & Syrian Rice Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["shakshuka_3eggs", "whole_wheat_pita_half"]},
                "option_b": {"cuisine": "Syrian", "items": ["boiled_egg", "boiled_egg", "grilled_halloumi_50g", "whole_wheat_pita_half"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium", "roasted_chickpeas_30g"]},
                "option_b": {"cuisine": "Syrian", "items": ["cottage_cheese_100g", "fruit_medium"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["fattah_portion", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_lamb_chops_180g", "syrian_rice_vermicelli_150g", "salad_tomato_cucumber"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["grilled_chicken_breast_150g", "salad_tomato_cucumber", "grilled_chicken_breast_150g", "boiled_egg"]},
                "option_b": {"cuisine": "Grilled", "items": ["shawarma_plate_220g", "mutabbal_2tbsp", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 13,
        "label": "Bamia & Turkey / Kofta Skewer Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["ful_medames_bowl", "boiled_egg"]},
                "option_b": {"cuisine": "Syrian", "items": ["zaatar_manakish_half", "labneh_2tbsp", "boiled_egg"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["greek_yogurt_lowfat_200g", "dates_3pc"]},
                "option_b": {"cuisine": "Syrian", "items": ["hummus_2tbsp", "whole_wheat_pita_half"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["bamia_chicken_bowl", "freekeh_150g", "grilled_chicken_breast_200g", "boiled_egg"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kofta_skewer_150g", "freekeh_150g", "fattoush_bowl"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["mixed_nuts_25g"]},
                "option_b": {"cuisine": "Syrian", "items": ["roasted_chickpeas_30g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["turkey_breast_150g", "molokhia_bowl"]},
                "option_b": {"cuisine": "Grilled", "items": ["shish_tawook_200g", "tabbouleh_bowl", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
    {
        "day_index": 14,
        "label": "Steak / Mixed Grill Day",
        "meals": {
            "breakfast": {
                "option_a": {"cuisine": "Egyptian", "items": ["omelet_3egg_veg", "whole_wheat_pita_half"]},
                "option_b": {"cuisine": "Syrian", "items": ["cottage_cheese_150g", "whole_wheat_toast_2slices", "salad_tomato_cucumber"]},
            },
            "snack1": {
                "option_a": {"cuisine": "Egyptian", "items": ["fruit_medium"]},
                "option_b": {"cuisine": "Syrian", "items": ["dates_3pc", "mixed_nuts_25g"]},
            },
            "lunch": {
                "option_a": {"cuisine": "Egyptian", "items": ["grilled_beef_steak_180g", "white_rice_150g", "salad_tomato_cucumber"]},
                "option_b": {"cuisine": "Grilled", "items": ["grilled_kebab_hindi_150g", "grilled_halloumi_50g", "batata_harra_100g"]},
            },
            "snack2": {
                "option_a": {"cuisine": "Egyptian", "items": ["rice_pudding_small"]},
                "option_b": {"cuisine": "Syrian", "items": ["greek_yogurt_lowfat_200g"]},
            },
            "dinner": {
                "option_a": {"cuisine": "Egyptian", "items": ["lentil_soup_bowl", "cottage_cheese_100g", "grilled_chicken_breast_200g", "cottage_cheese_100g"]},
                "option_b": {"cuisine": "Grilled", "items": ["shawarma_plate_220g", "salad_tomato_cucumber", "cottage_cheese_100g", "turkey_breast_150g"]},
            },
        },
    },
]


def display_name(key: str) -> str:
    return key.replace("_", " ").title()


def compute_macros(item_keys):
    kcal = protein = carbs = fat = 0.0
    for key in item_keys:
        k, p, c, f = FOODS[key]
        kcal += k
        protein += p
        carbs += c
        fat += f
    return round(kcal), round(protein, 1), round(carbs, 1), round(fat, 1)


def _build_option(option_key: str, option: dict) -> dict:
    kcal, protein, carbs, fat = compute_macros(option["items"])
    return {
        "key": option_key,
        "cuisine": option["cuisine"],
        "ingredients": [display_name(i) for i in option["items"]],
        "kcal": kcal,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
    }


def get_day(day_number_1_indexed: int):
    """day_number_1_indexed cycles 1-14 regardless of input range."""
    idx = (day_number_1_indexed - 1) % 14
    day = MEAL_PLAN_14_DAY[idx]
    meals_out = []
    # Daily totals are based on option A (the default view); each option's
    # own totals are shown on its card.
    day_kcal = day_protein = day_carbs = day_fat = 0.0
    for slot in MEAL_SLOTS:
        slot_options = day["meals"][slot]
        options = [_build_option(key, slot_options[key]) for key in ("option_a", "option_b")]
        meals_out.append(
            {
                "slot": slot,
                "time_window": MEAL_SLOT_WINDOWS[slot],
                "options": options,
            }
        )
        day_kcal += options[0]["kcal"]
        day_protein += options[0]["protein"]
        day_carbs += options[0]["carbs"]
        day_fat += options[0]["fat"]
    return {
        "day_index": day["day_index"],
        "label": day["label"],
        "meals": meals_out,
        "totals": {
            "kcal": round(day_kcal),
            "protein": round(day_protein, 1),
            "carbs": round(day_carbs, 1),
            "fat": round(day_fat, 1),
        },
    }
