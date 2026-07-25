# Food item library — Egyptian, Syrian/Levantine, and grilled dishes, no fish/seafood.
# Each value: (kcal, protein_g, carbs_g, fat_g, fiber_g) per the stated portion.
# Approximate structured-portion figures, not lab-precision macros.

FOODS = {
    "ful_medames_bowl": (280, 15, 35, 9, 9),  # ~250g fava beans, olive oil, cumin, lemon
    "boiled_egg": (70, 6, 0.5, 5, 0),
    "whole_wheat_pita_half": (75, 3, 15, 0.75, 2),
    "whole_wheat_pita": (150, 6, 30, 1.5, 4),
    "greek_yogurt_lowfat_200g": (120, 17, 8, 2, 0),
    "fruit_medium": (70, 1, 17, 0.3, 3),  # guava / orange / apple
    "grilled_chicken_breast_200g": (330, 62, 0, 7, 0),
    "grilled_chicken_breast_150g": (250, 47, 0, 5, 0),
    "white_rice_150g": (195, 4, 43, 0.5, 0.5),
    "salad_tomato_cucumber": (80, 2, 8, 5, 2),
    "mixed_nuts_25g": (150, 5, 5, 13, 2.5),
    "lentil_soup_bowl": (220, 14, 32, 4, 8),  # shorbet ads
    "cottage_cheese_100g": (75, 12, 3, 1.3, 0),  # gebna qareesh
    "cottage_cheese_150g": (110, 18, 5, 2, 0),
    "shakshuka_3eggs": (330, 21, 12, 22, 2),
    "feta_50g": (130, 7, 2, 11, 0),  # gebna beida
    "beef_kofta_150g": (330, 30, 0, 22, 0),
    "beef_kofta_100g": (220, 20, 0, 15, 0),
    "molokhia_bowl": (120, 6, 10, 7, 4),
    "bamia_chicken_bowl": (280, 28, 15, 12, 5),  # okra & chicken stew
    "freekeh_150g": (200, 7, 40, 2, 8),
    "hawawshi_baked": (420, 24, 40, 18, 3),  # baked, not fried
    "fattah_portion": (480, 28, 55, 16, 3),
    "koshari_bowl_small": (400, 12, 70, 9, 7),
    "omelet_3egg_veg": (300, 21, 6, 21, 1.5),
    "roasted_chickpeas_30g": (130, 6, 20, 3, 4),
    "labneh_2tbsp": (60, 3, 2, 5, 0),
    "grilled_beef_steak_180g": (350, 40, 0, 20, 0),
    "mahshi_zucchini_bowl": (320, 14, 40, 12, 4),  # rice-stuffed zucchini, light meat
    "turkey_breast_150g": (200, 40, 0, 3, 0),
    "chicken_shawarma_home_200g": (350, 45, 5, 15, 1),
    "grilled_chicken_thigh_200g": (380, 46, 0, 20, 0),
    "rice_pudding_small": (180, 6, 30, 4, 0.3),  # roz bel laban, occasional dessert-style snack
    "dates_3pc": (70, 0.5, 18, 0, 2),
    "hummus_2tbsp": (70, 3, 6, 4, 2),
    "whole_wheat_toast_2slices": (140, 6, 26, 2, 4),
    "avocado_half": (120, 1.5, 6, 11, 5),
    # Syrian / Levantine / grilled additions
    "shish_tawook_200g": (320, 55, 3, 9, 0),  # marinated grilled chicken skewers
    "grilled_kofta_skewer_150g": (300, 28, 2, 19, 0),  # Syrian-spiced grilled beef kofta
    "grilled_lamb_chops_180g": (380, 38, 0, 24, 0),
    "grilled_kebab_hindi_150g": (280, 30, 1, 17, 0),  # grilled minced-beef kebab roll
    "shawarma_plate_220g": (300, 48, 4, 10, 1),  # grilled chicken shawarma spice, plate not sandwich
    "grilled_halloumi_50g": (170, 11, 2, 13, 0),
    "fattoush_bowl": (150, 4, 20, 7, 3),  # toasted pita, sumac, mixed veg
    "tabbouleh_bowl": (140, 4, 20, 5, 3),  # parsley & bulgur salad
    "mutabbal_2tbsp": (70, 2, 4, 5, 1.5),  # smoky grilled-eggplant dip
    "toum_1tbsp": (90, 0.3, 2, 9, 0),  # Levantine garlic sauce, small portion
    "batata_harra_100g": (150, 2, 22, 6, 2),  # spiced pan-roasted potatoes
    "syrian_rice_vermicelli_150g": (210, 4, 42, 3, 1),  # roz bi shaghria
    "zaatar_manakish_half": (220, 6, 30, 9, 2),  # baked thyme flatbread
}

# Zero/near-zero calorie drinks selectable per meal.
DRINKS = {
    "water": (0, 0, 0, 0, 0),
    "unsweetened_tea": (2, 0, 0, 0, 0),
    "unsweetened_coffee": (2, 0, 0, 0, 0),
    "diet_soda": (2, 0, 0.5, 0, 0),
    "flavored_sparkling_water": (0, 0, 0, 0, 0),
}
