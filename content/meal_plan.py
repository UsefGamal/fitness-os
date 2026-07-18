from content.food_items import FOODS

MEAL_SLOTS = ["breakfast", "snack1", "lunch", "snack2", "dinner"]

# 14-day rotating Egyptian meal plan. No fish/seafood. Structured portions,
# not calorie-counted day to day — targets ~1900-2050 kcal / ~175-195g protein.
MEAL_PLAN_14_DAY = [
    {
        "day_index": 1,
        "label": "Ful Medames Day",
        "meals": {
            "breakfast": ["ful_medames_bowl", "boiled_egg", "boiled_egg", "whole_wheat_pita_half"],
            "snack1": ["greek_yogurt_lowfat_200g", "fruit_medium"],
            "lunch": ["grilled_chicken_breast_200g", "white_rice_150g", "salad_tomato_cucumber"],
            "snack2": ["mixed_nuts_25g"],
            "dinner": ["lentil_soup_bowl", "cottage_cheese_150g", "whole_wheat_pita_half", "turkey_breast_150g"],
        },
    },
    {
        "day_index": 2,
        "label": "Shakshuka Day",
        "meals": {
            "breakfast": ["shakshuka_3eggs", "whole_wheat_pita_half"],
            "snack1": ["fruit_medium", "mixed_nuts_25g"],
            "lunch": ["beef_kofta_150g", "freekeh_150g", "salad_tomato_cucumber"],
            "snack2": ["greek_yogurt_lowfat_200g"],
            "dinner": ["grilled_chicken_breast_150g", "molokhia_bowl", "turkey_breast_150g"],
        },
    },
    {
        "day_index": 3,
        "label": "Molokhia & Chicken Day",
        "meals": {
            "breakfast": ["ful_medames_bowl", "boiled_egg", "feta_50g"],
            "snack1": ["greek_yogurt_lowfat_200g", "dates_3pc"],
            "lunch": ["molokhia_bowl", "grilled_chicken_breast_200g", "white_rice_150g"],
            "snack2": ["roasted_chickpeas_30g"],
            "dinner": ["omelet_3egg_veg", "salad_tomato_cucumber", "turkey_breast_150g"],
        },
    },
    {
        "day_index": 4,
        "label": "Bamia Day",
        "meals": {
            "breakfast": ["whole_wheat_toast_2slices", "boiled_egg", "boiled_egg", "avocado_half"],
            "snack1": ["fruit_medium", "mixed_nuts_25g"],
            "lunch": ["bamia_chicken_bowl", "white_rice_150g", "grilled_chicken_breast_200g"],
            "snack2": ["greek_yogurt_lowfat_200g"],
            "dinner": ["turkey_breast_150g", "salad_tomato_cucumber", "whole_wheat_pita_half"],
        },
    },
    {
        "day_index": 5,
        "label": "Hawawshi Day",
        "meals": {
            "breakfast": ["ful_medames_bowl", "boiled_egg"],
            "snack1": ["greek_yogurt_lowfat_200g", "fruit_medium"],
            "lunch": ["hawawshi_baked", "salad_tomato_cucumber"],
            "snack2": ["mixed_nuts_25g"],
            "dinner": ["lentil_soup_bowl", "cottage_cheese_100g", "grilled_chicken_breast_200g", "cottage_cheese_100g"],
        },
    },
    {
        "day_index": 6,
        "label": "Grilled Steak Day",
        "meals": {
            "breakfast": ["shakshuka_3eggs"],
            "snack1": ["fruit_medium", "roasted_chickpeas_30g"],
            "lunch": ["grilled_beef_steak_180g", "freekeh_150g", "salad_tomato_cucumber"],
            "snack2": ["greek_yogurt_lowfat_200g"],
            "dinner": ["mahshi_zucchini_bowl", "grilled_chicken_breast_200g"],
        },
    },
    {
        "day_index": 7,
        "label": "Koshari Day",
        "meals": {
            "breakfast": ["whole_wheat_toast_2slices", "boiled_egg", "boiled_egg"],
            "snack1": ["greek_yogurt_lowfat_200g"],
            "lunch": ["koshari_bowl_small", "salad_tomato_cucumber", "grilled_chicken_breast_200g"],
            "snack2": ["fruit_medium", "boiled_egg", "greek_yogurt_lowfat_200g"],
            "dinner": ["grilled_chicken_breast_150g", "molokhia_bowl"],
        },
    },
    {
        "day_index": 8,
        "label": "Shawarma Day",
        "meals": {
            "breakfast": ["ful_medames_bowl", "boiled_egg"],
            "snack1": ["fruit_medium", "mixed_nuts_25g"],
            "lunch": ["chicken_shawarma_home_200g", "whole_wheat_pita", "salad_tomato_cucumber"],
            "snack2": ["greek_yogurt_lowfat_200g"],
            "dinner": ["lentil_soup_bowl", "cottage_cheese_100g", "turkey_breast_150g", "cottage_cheese_100g"],
        },
    },
    {
        "day_index": 9,
        "label": "Kofta & Freekeh Day",
        "meals": {
            "breakfast": ["omelet_3egg_veg", "whole_wheat_pita_half"],
            "snack1": ["greek_yogurt_lowfat_200g", "dates_3pc"],
            "lunch": ["beef_kofta_150g", "freekeh_150g", "salad_tomato_cucumber"],
            "snack2": ["roasted_chickpeas_30g"],
            "dinner": ["turkey_breast_150g", "salad_tomato_cucumber", "grilled_chicken_breast_150g", "cottage_cheese_100g"],
        },
    },
    {
        "day_index": 10,
        "label": "Grilled Thigh Day",
        "meals": {
            "breakfast": ["ful_medames_bowl", "boiled_egg"],
            "snack1": ["fruit_medium", "mixed_nuts_25g"],
            "lunch": ["grilled_chicken_thigh_200g", "white_rice_150g", "molokhia_bowl"],
            "snack2": ["greek_yogurt_lowfat_200g"],
            "dinner": ["cottage_cheese_150g", "salad_tomato_cucumber", "whole_wheat_pita_half", "grilled_chicken_breast_150g", "boiled_egg"],
        },
    },
    {
        "day_index": 11,
        "label": "Mahshi Day",
        "meals": {
            "breakfast": ["whole_wheat_toast_2slices", "boiled_egg", "boiled_egg", "feta_50g"],
            "snack1": ["fruit_medium"],
            "lunch": ["mahshi_zucchini_bowl", "grilled_chicken_breast_150g"],
            "snack2": ["mixed_nuts_25g"],
            "dinner": ["lentil_soup_bowl", "greek_yogurt_lowfat_200g", "grilled_chicken_breast_150g", "cottage_cheese_100g"],
        },
    },
    {
        "day_index": 12,
        "label": "Fattah Day",
        "meals": {
            "breakfast": ["shakshuka_3eggs", "whole_wheat_pita_half"],
            "snack1": ["fruit_medium", "roasted_chickpeas_30g"],
            "lunch": ["fattah_portion", "salad_tomato_cucumber"],
            "snack2": ["greek_yogurt_lowfat_200g"],
            "dinner": ["grilled_chicken_breast_150g", "salad_tomato_cucumber", "grilled_chicken_breast_150g", "boiled_egg"],
        },
    },
    {
        "day_index": 13,
        "label": "Bamia & Turkey Day",
        "meals": {
            "breakfast": ["ful_medames_bowl", "boiled_egg"],
            "snack1": ["greek_yogurt_lowfat_200g", "dates_3pc"],
            "lunch": ["bamia_chicken_bowl", "freekeh_150g", "grilled_chicken_breast_200g", "boiled_egg"],
            "snack2": ["mixed_nuts_25g"],
            "dinner": ["turkey_breast_150g", "molokhia_bowl"],
        },
    },
    {
        "day_index": 14,
        "label": "Steak & Rice Pudding Day",
        "meals": {
            "breakfast": ["omelet_3egg_veg", "whole_wheat_pita_half"],
            "snack1": ["fruit_medium"],
            "lunch": ["grilled_beef_steak_180g", "white_rice_150g", "salad_tomato_cucumber"],
            "snack2": ["rice_pudding_small"],
            "dinner": ["lentil_soup_bowl", "cottage_cheese_100g", "grilled_chicken_breast_200g", "cottage_cheese_100g"],
        },
    },
]


def display_name(food_key: str) -> str:
    return food_key.replace("_", " ").title()


def compute_macros(item_keys):
    kcal = protein = carbs = fat = 0.0
    for key in item_keys:
        k, p, c, f = FOODS[key]
        kcal += k
        protein += p
        carbs += c
        fat += f
    return round(kcal), round(protein, 1), round(carbs, 1), round(fat, 1)


def get_day(day_number_1_indexed: int):
    """day_number_1_indexed cycles 1-14 regardless of input range."""
    idx = ((day_number_1_indexed - 1) % 14)
    day = MEAL_PLAN_14_DAY[idx]
    meals_out = []
    day_kcal = day_protein = day_carbs = day_fat = 0.0
    for slot in MEAL_SLOTS:
        items = day["meals"][slot]
        kcal, protein, carbs, fat = compute_macros(items)
        meals_out.append(
            {
                "slot": slot,
                "ingredients": [display_name(i) for i in items],
                "kcal": kcal,
                "protein": protein,
                "carbs": carbs,
                "fat": fat,
            }
        )
        day_kcal += kcal
        day_protein += protein
        day_carbs += carbs
        day_fat += fat
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
