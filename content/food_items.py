# Food item library — Egyptian, Syrian/Levantine, and grilled dishes, no fish/seafood.
# Each value: (kcal, protein_g, carbs_g, fat_g, fiber_g) per the stated portion.
# Approximate structured-portion figures, not lab-precision macros.

import re

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

# Grocery-aisle grouping for the shopping list — cosmetic only, doesn't
# affect macros. Order here is the display order (roughly aisle order).
CATEGORY_ORDER = [
    "Protein & Mains",
    "Dairy & Eggs",
    "Grains & Bakery",
    "Legumes",
    "Produce & Salads",
    "Nuts, Sauces & Extras",
]

# One accent color per category so the list is visually scannable at a
# glance — decorative only (the category heading text is always the real
# identifier), so this doesn't need to pass the dataviz skill's chart-mark
# CVD validation the way an actual data-encoding chart color would.
CATEGORY_COLORS = {
    "Protein & Mains": "#f87171",
    "Dairy & Eggs": "#60a5fa",
    "Grains & Bakery": "#fbbf24",
    "Legumes": "#34d399",
    "Produce & Salads": "#a3e635",
    "Nuts, Sauces & Extras": "#a78bfa",
}
CATEGORY_ICONS = {
    "Protein & Mains": "utensils",
    "Dairy & Eggs": "droplet",
    "Grains & Bakery": "lunchbox",
    "Legumes": "bean",
    "Produce & Salads": "salad",
    "Nuts, Sauces & Extras": "nut",
}

FOOD_CATEGORIES = {
    "ful_medames_bowl": "Legumes",
    "boiled_egg": "Dairy & Eggs",
    "whole_wheat_pita_half": "Grains & Bakery",
    "whole_wheat_pita": "Grains & Bakery",
    "greek_yogurt_lowfat_200g": "Dairy & Eggs",
    "fruit_medium": "Produce & Salads",
    "grilled_chicken_breast_200g": "Protein & Mains",
    "grilled_chicken_breast_150g": "Protein & Mains",
    "white_rice_150g": "Grains & Bakery",
    "salad_tomato_cucumber": "Produce & Salads",
    "mixed_nuts_25g": "Nuts, Sauces & Extras",
    "lentil_soup_bowl": "Legumes",
    "cottage_cheese_100g": "Dairy & Eggs",
    "cottage_cheese_150g": "Dairy & Eggs",
    "shakshuka_3eggs": "Dairy & Eggs",
    "feta_50g": "Dairy & Eggs",
    "beef_kofta_150g": "Protein & Mains",
    "beef_kofta_100g": "Protein & Mains",
    "molokhia_bowl": "Protein & Mains",
    "bamia_chicken_bowl": "Protein & Mains",
    "freekeh_150g": "Grains & Bakery",
    "hawawshi_baked": "Protein & Mains",
    "fattah_portion": "Protein & Mains",
    "koshari_bowl_small": "Legumes",
    "omelet_3egg_veg": "Dairy & Eggs",
    "roasted_chickpeas_30g": "Legumes",
    "labneh_2tbsp": "Dairy & Eggs",
    "grilled_beef_steak_180g": "Protein & Mains",
    "mahshi_zucchini_bowl": "Protein & Mains",
    "turkey_breast_150g": "Protein & Mains",
    "chicken_shawarma_home_200g": "Protein & Mains",
    "grilled_chicken_thigh_200g": "Protein & Mains",
    "rice_pudding_small": "Grains & Bakery",
    "dates_3pc": "Produce & Salads",
    "hummus_2tbsp": "Legumes",
    "whole_wheat_toast_2slices": "Grains & Bakery",
    "avocado_half": "Produce & Salads",
    "shish_tawook_200g": "Protein & Mains",
    "grilled_kofta_skewer_150g": "Protein & Mains",
    "grilled_lamb_chops_180g": "Protein & Mains",
    "grilled_kebab_hindi_150g": "Protein & Mains",
    "shawarma_plate_220g": "Protein & Mains",
    "grilled_halloumi_50g": "Dairy & Eggs",
    "fattoush_bowl": "Produce & Salads",
    "tabbouleh_bowl": "Produce & Salads",
    "mutabbal_2tbsp": "Nuts, Sauces & Extras",
    "toum_1tbsp": "Nuts, Sauces & Extras",
    "batata_harra_100g": "Produce & Salads",
    "syrian_rice_vermicelli_150g": "Grains & Bakery",
    "zaatar_manakish_half": "Grains & Bakery",
}

# Zero/near-zero calorie drinks selectable per meal.
DRINKS = {
    "water": (0, 0, 0, 0, 0),
    "unsweetened_tea": (2, 0, 0, 0, 0),
    "unsweetened_coffee": (2, 0, 0, 0, 0),
    "diet_soda": (2, 0, 0.5, 0, 0),
    "flavored_sparkling_water": (0, 0, 0, 0, 0),
}

# How each food reads in the app (P14-19): sentence case, keyed by the base
# key that parse_shopping_unit() leaves once the portion suffix is gone.
# (singular, plural); the plural is used when a meal has more than one.
FOOD_NAMES = {
    "ful_medames_bowl": ("bowl of ful medames", "bowls of ful medames"),
    "boiled_egg": ("boiled egg", "boiled eggs"),
    "whole_wheat_pita": ("wholewheat pita", "wholewheat pitas"),
    "greek_yogurt_lowfat": ("low-fat Greek yogurt", "low-fat Greek yogurt"),
    "fruit_medium": ("piece of fruit", "pieces of fruit"),
    "grilled_chicken_breast": ("grilled chicken breast", "grilled chicken breast"),
    "white_rice": ("white rice", "white rice"),
    "salad_tomato_cucumber": ("tomato and cucumber salad", "tomato and cucumber salads"),
    "mixed_nuts": ("mixed nuts", "mixed nuts"),
    "lentil_soup_bowl": ("bowl of lentil soup", "bowls of lentil soup"),
    "cottage_cheese": ("cottage cheese", "cottage cheese"),
    "shakshuka_3eggs": ("shakshuka with 3 eggs", "shakshuka with 3 eggs"),
    "feta": ("feta", "feta"),
    "beef_kofta": ("beef kofta", "beef kofta"),
    "molokhia_bowl": ("bowl of molokhia", "bowls of molokhia"),
    "bamia_chicken_bowl": ("bowl of bamia with chicken", "bowls of bamia with chicken"),
    "freekeh": ("freekeh", "freekeh"),
    "hawawshi_baked": ("baked hawawshi", "baked hawawshi"),
    "fattah_portion": ("portion of fattah", "portions of fattah"),
    "koshari_bowl_small": ("small bowl of koshari", "small bowls of koshari"),
    "omelet_3egg_veg": ("3-egg vegetable omelette", "3-egg vegetable omelettes"),
    "roasted_chickpeas": ("roasted chickpeas", "roasted chickpeas"),
    "labneh": ("labneh", "labneh"),
    "grilled_beef_steak": ("grilled beef steak", "grilled beef steak"),
    "mahshi_zucchini_bowl": ("bowl of zucchini mahshi", "bowls of zucchini mahshi"),
    "turkey_breast": ("turkey breast", "turkey breast"),
    "chicken_shawarma_home": ("homemade chicken shawarma", "homemade chicken shawarma"),
    "grilled_chicken_thigh": ("grilled chicken thigh", "grilled chicken thigh"),
    "rice_pudding_small": ("small rice pudding", "small rice puddings"),
    "dates": ("date", "dates"),
    "hummus": ("hummus", "hummus"),
    "whole_wheat_toast": ("wholewheat toast", "wholewheat toast"),
    "avocado": ("avocado", "avocados"),
    "shish_tawook": ("shish tawook", "shish tawook"),
    "grilled_kofta_skewer": ("grilled kofta skewers", "grilled kofta skewers"),
    "grilled_lamb_chops": ("grilled lamb chops", "grilled lamb chops"),
    "grilled_kebab_hindi": ("grilled kebab hindi", "grilled kebab hindi"),
    "shawarma_plate": ("shawarma plate", "shawarma plate"),
    "grilled_halloumi": ("grilled halloumi", "grilled halloumi"),
    "fattoush_bowl": ("bowl of fattoush", "bowls of fattoush"),
    "tabbouleh_bowl": ("bowl of tabbouleh", "bowls of tabbouleh"),
    "mutabbal": ("mutabbal", "mutabbal"),
    "toum": ("toum", "toum"),
    "batata_harra": ("batata harra", "batata harra"),
    "syrian_rice_vermicelli": ("Syrian rice with vermicelli", "Syrian rice with vermicelli"),
    "zaatar_manakish": ("za'atar manakish", "za'atar manakish"),
}


# Shopping-list quantity parsing — lets the same base ingredient sold at
# different portion sizes (e.g. grilled_chicken_breast_150g and _200g)
# consolidate into one real-world shopping quantity instead of listing
# as two separate lines. Only strips a trailing "_<N><unit>" or "_half"
# — composite dish names (ful_medames_bowl, koshari_bowl_small, ...)
# have no such suffix and fall through unmerged, which is correct: they
# aren't decomposed into raw ingredients here, just consolidated by name.
_SHOPPING_UNIT_RE = re.compile(r"^(.+)_(\d+(?:\.\d+)?)(g|tbsp|pc|slices?)$")


def parse_shopping_unit(key: str) -> tuple:
    """Returns (base_key, quantity, unit). unit is 'g', 'tbsp', 'pc',
    'slice', or 'unit' (whole dishes, pitas, halves, generic counts)."""
    match = _SHOPPING_UNIT_RE.match(key)
    if match:
        base, qty, unit = match.group(1), float(match.group(2)), match.group(3)
        return base, qty, "slice" if unit.startswith("slice") else unit
    if key.endswith("_half"):
        return key[: -len("_half")], 0.5, "unit"
    return key, 1.0, "unit"


def format_shopping_qty(total: float, unit: str) -> str:
    if unit == "g":
        return f"{total / 1000:g} kg" if total >= 1000 else f"{total:g} g"
    if unit in ("tbsp", "pc"):
        return f"{total:g} {unit}"
    if unit == "slice":
        return f"{total:g} slice" if total == 1 else f"{total:g} slices"
    if total == int(total):
        return f"×{int(total)}"
    return f"×{total:g}"


def _num(x: float) -> str:
    return f"{x:g}"


def food_phrase(base: str, qty: float, unit: str) -> str:
    """One food in words: "grilled chicken breast 200 g", "2 boiled eggs",
    "half an avocado", "3 dates", "2 slices of wholewheat toast"."""
    one, many = FOOD_NAMES.get(base, (base.replace("_", " "), base.replace("_", " ")))
    if unit in ("g", "tbsp"):
        return f"{one} {_num(qty)} {unit}"
    if unit == "pc":
        return f"{_num(qty)} {one if qty == 1 else many}"
    if unit == "slice":
        return f"{_num(qty)} {'slice' if qty == 1 else 'slices'} of {one}"
    if qty == 0.5:
        return f"half {'an' if one[0] in 'aeiou' else 'a'} {one}"
    if qty == 1:
        # Countable foods (their plural differs) get "a"/"an".
        return one if one == many else f"{'an' if one[0] in 'aeiou' else 'a'} {one}"
    return f"{_num(qty)} {many}"


def natural_items(keys) -> list:
    """A meal's food keys as words, repeats merged ("2 boiled eggs",
    "grilled chicken breast 300 g"), in the order they first appear."""
    totals = {}
    for key in keys:
        base, qty, unit = parse_shopping_unit(key)
        totals[(base, unit)] = totals.get((base, unit), 0) + qty
    return [food_phrase(base, qty, unit) for (base, unit), qty in totals.items()]
