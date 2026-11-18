"""Ingredients for the meal library (content/meal_library.py), with
nutrition per 100 g from USDA FoodData Central, SR Legacy (public domain).

Each row: key -> (name, plural, shopping category, FDC id,
                  kcal, protein, carbs, fat, fiber per 100 g, grams per piece)

Weights are as bought: raw meat and fish, dry rice, pasta, oats and
lentils, drained canned beans. "grams per piece" is set for foods counted
in pieces (eggs, pitas, bananas); recipes then use pieces, not grams.

Labneh, freekeh and baladi bread have no SR Legacy row, so recipes use
the closest listed food (Greek yogurt, bulgur, wholewheat pita).
"""

USDA_SOURCE = "USDA FoodData Central, SR Legacy (April 2018), public domain"

P, D, G, L, V, X = (
    "Protein & Mains",
    "Dairy & Eggs",
    "Grains & Bakery",
    "Legumes",
    "Produce & Salads",
    "Nuts, Sauces & Extras",
)

INGREDIENTS = {
    # Meat and fish (raw)
    "chicken_breast": ("chicken breast", "chicken breast", P, 171077, 120, 22.5, 0, 2.62, 0, None),
    "chicken_thigh": ("boneless chicken thigh", "boneless chicken thigh", P, 173627, 121, 19.66, 0, 4.12, 0, None),
    "beef_mince": ("lean beef mince (10% fat)", "lean beef mince (10% fat)", P, 174030, 176, 20, 0, 10, 0, None),
    "beef_steak": ("lean beef steak", "lean beef steak", P, 171804, 127, 22.27, 0, 3.54, 0, None),
    "lamb_mince": ("lamb mince", "lamb mince", P, 174370, 282, 16.56, 0, 23.41, 0, None),
    "turkey_breast": ("turkey breast", "turkey breast", P, 174515, 114, 23.34, 0, 2.33, 0, None),
    "salmon": ("salmon fillet", "salmon fillet", P, 175167, 208, 20.42, 0, 13.42, 0, None),
    "white_fish": ("white fish fillet (bolti or tilapia)", "white fish fillet (bolti or tilapia)", P, 175176, 96, 20.08, 0, 1.7, 0, None),
    "tuna": ("tuna in water, drained", "tuna in water, drained", P, 171986, 116, 25.51, 0, 0.82, 0, None),
    "shrimp": ("raw shrimp, peeled", "raw shrimp, peeled", P, 175179, 85, 20.1, 0, 0.51, 0, None),
    "beef_liver": ("beef liver", "beef liver", P, 169451, 135, 20.36, 3.89, 3.63, 0, None),
    "turkey_mince": ("turkey mince", "turkey mince", P, 171505, 148, 19.66, 0, 7.66, 0, None),
    "sardines": ("canned sardines in oil, drained", "canned sardines in oil, drained", P, 175139, 208, 24.62, 0, 11.45, 0, None),
    "squid": ("squid (calamari)", "squid (calamari)", P, 174223, 92, 15.58, 3.08, 1.38, 0, None),
    # Dairy and eggs
    "egg": ("egg", "eggs", D, 171287, 143, 12.56, 0.72, 9.51, 0, 50),
    "greek_yogurt": ("low-fat Greek yogurt", "low-fat Greek yogurt", D, 170903, 73, 9.95, 3.94, 1.92, 0, None),
    "milk": ("low-fat milk", "low-fat milk", D, 170872, 42, 3.37, 4.99, 0.97, 0, None),
    "cottage_cheese": ("low-fat cottage cheese (areesh)", "low-fat cottage cheese (areesh)", D, 172182, 81, 10.45, 4.76, 2.27, 0, None),
    "feta": ("feta (gebna beida)", "feta (gebna beida)", D, 173420, 265, 14.21, 3.88, 21.49, 0, None),
    "mozzarella": ("light mozzarella", "light mozzarella", D, 170847, 254, 24.26, 2.77, 15.92, 0, None),
    "parmesan": ("grated parmesan", "grated parmesan", D, 171247, 420, 28.42, 13.91, 27.84, 0, None),
    "whey": ("scoop of whey protein (30 g)", "scoops of whey protein (30 g)", D, 173180, 352, 78.13, 6.25, 1.56, 3.1, 30),
    # Grains and bread (dry or as bought)
    "oats": ("rolled oats", "rolled oats", G, 173904, 379, 13.15, 67.7, 6.52, 10.1, None),
    "rice": ("white rice (dry)", "white rice (dry)", G, 168877, 365, 7.13, 79.95, 0.66, 1.3, None),
    "pasta": ("pasta (dry)", "pasta (dry)", G, 169736, 371, 13.04, 74.67, 1.51, 3.2, None),
    "bulgur": ("bulgur (dry)", "bulgur (dry)", G, 170688, 342, 12.29, 75.87, 1.33, 12.5, None),
    "rice_noodles": ("rice noodles (dry)", "rice noodles (dry)", G, 169742, 364, 5.95, 80.18, 0.56, 1.6, None),
    "pita": ("wholewheat pita", "wholewheat pitas", G, 174916, 262, 9.8, 55.89, 1.71, 6.1, 60),
    "tortilla": ("flour tortilla wrap", "flour tortilla wraps", G, 167535, 297, 8.01, 49.27, 7.58, 2.4, 45),
    "bread": ("slice of wholewheat bread", "slices of wholewheat bread", G, 172688, 252, 12.45, 42.71, 3.5, 6, 32),
    "bun": ("burger bun", "burger buns", G, 172796, 279, 9.77, 50.12, 3.91, 1.8, 50),
    "rice_cakes": ("rice cake", "rice cakes", G, 170250, 387, 8.2, 81.5, 2.8, 4.2, 9),
    "couscous": ("couscous (dry)", "couscous (dry)", G, 169699, 376, 12.76, 77.43, 0.64, 5, None),
    "quinoa": ("quinoa (dry)", "quinoa (dry)", G, 168874, 368, 14.12, 64.16, 6.07, 7, None),
    "granola": ("granola", "granola", G, 171646, 489, 13.67, 53.88, 24.31, 8.9, None),
    # Legumes
    "red_lentils": ("red lentils (dry)", "red lentils (dry)", L, 174284, 358, 23.91, 63.1, 2.17, 10.8, None),
    "fava_beans": ("canned fava beans (ful)", "canned fava beans (ful)", L, 173754, 71, 5.47, 12.41, 0.22, 3.7, None),
    "chickpeas": ("canned chickpeas, drained", "canned chickpeas, drained", L, 173800, 139, 7.05, 22.53, 2.77, 6.4, None),
    "black_beans": ("canned black beans", "canned black beans", L, 175238, 91, 6.03, 16.55, 0.29, 6.9, None),
    "white_beans": ("canned white beans", "canned white beans", L, 175204, 114, 7.26, 21.2, 0.29, 4.8, None),
    "hummus": ("hummus", "hummus", L, 174289, 237, 7.78, 15, 17.82, 5.5, None),
    "kidney_beans": ("canned red kidney beans, drained", "canned red kidney beans, drained", L, 174285, 124, 7.98, 21.49, 1.05, 5.5, None),
    "edamame": ("frozen edamame", "frozen edamame", L, 168410, 109, 11.22, 7.61, 4.73, 4.8, None),
    # Vegetables, fruit and herbs
    "potato": ("potatoes", "potatoes", V, 170026, 77, 2.05, 17.49, 0.09, 2.1, None),
    "sweet_potato": ("sweet potato", "sweet potato", V, 168482, 86, 1.57, 20.12, 0.05, 3, None),
    "tomato": ("tomatoes", "tomatoes", V, 170457, 18, 0.88, 3.89, 0.2, 1.2, None),
    "canned_tomato": ("canned chopped tomatoes", "canned chopped tomatoes", V, 170051, 16, 0.79, 3.47, 0.25, 1.9, None),
    "tomato_paste": ("tomato paste", "tomato paste", V, 170459, 82, 4.32, 18.91, 0.47, 4.1, None),
    "cucumber": ("cucumber", "cucumber", V, 168409, 15, 0.65, 3.63, 0.11, 0.5, None),
    "lettuce": ("romaine lettuce", "romaine lettuce", V, 169247, 17, 1.23, 3.29, 0.3, 2.1, None),
    "spinach": ("spinach", "spinach", V, 168462, 23, 2.86, 3.63, 0.39, 2.2, None),
    "onion": ("onion", "onion", V, 170000, 40, 1.1, 9.34, 0.1, 1.7, None),
    "garlic": ("garlic", "garlic", V, 169230, 149, 6.36, 33.06, 0.5, 2.1, None),
    "pepper": ("bell pepper", "bell pepper", V, 170108, 26, 0.99, 6.03, 0.3, 2.1, None),
    "broccoli": ("broccoli", "broccoli", V, 170379, 34, 2.82, 6.64, 0.37, 2.6, None),
    "zucchini": ("zucchini (kousa)", "zucchini (kousa)", V, 169291, 17, 1.21, 3.11, 0.32, 1, None),
    "carrot": ("carrots", "carrots", V, 170393, 41, 0.93, 9.58, 0.24, 2.8, None),
    "mushroom": ("mushrooms", "mushrooms", V, 169251, 22, 3.09, 3.26, 0.34, 1, None),
    "green_beans": ("green beans", "green beans", V, 169961, 31, 1.83, 6.97, 0.22, 2.7, None),
    "peas": ("frozen peas", "frozen peas", V, 170016, 77, 5.22, 13.62, 0.4, 4.5, None),
    "sweetcorn": ("canned sweetcorn", "canned sweetcorn", V, 169214, 67, 2.29, 14.34, 1.22, 2, None),
    "lemon": ("lemon juice", "lemon juice", V, 167747, 22, 0.35, 6.9, 0.24, 0.3, None),
    "banana": ("banana", "bananas", V, 173944, 89, 1.09, 22.84, 0.33, 2.6, 120),
    "apple": ("apple", "apples", V, 171688, 52, 0.26, 13.81, 0.17, 2.4, 180),
    "berries": ("frozen strawberries", "frozen strawberries", V, 168173, 35, 0.43, 9.13, 0.11, 2.1, None),
    "dates": ("date", "dates", V, 168191, 277, 1.81, 74.97, 0.15, 6.7, 24),
    "avocado": ("avocado", "avocado", V, 171705, 160, 2, 8.53, 14.66, 6.7, None),
    "parsley": ("parsley", "parsley", V, 170416, 36, 2.97, 6.33, 0.79, 3.3, None),
    "mint": ("fresh mint", "fresh mint", V, 173475, 44, 3.29, 8.41, 0.73, 6.8, None),
    "coriander": ("fresh coriander", "fresh coriander", V, 169997, 23, 2.13, 3.67, 0.52, 2.8, None),
    "okra": ("okra (bamia)", "okra (bamia)", V, 169260, 33, 1.93, 7.45, 0.19, 3.2, None),
    "molokhia": ("molokhia (jute leaves)", "molokhia (jute leaves)", V, 168419, 34, 4.65, 5.8, 0.25, 0, None),
    "eggplant": ("eggplant", "eggplant", V, 169228, 25, 0.98, 5.88, 0.18, 3, None),
    "cabbage": ("cabbage", "cabbage", V, 169975, 25, 1.28, 5.8, 0.1, 2.5, None),
    "cauliflower": ("cauliflower", "cauliflower", V, 169986, 25, 1.92, 4.97, 0.28, 2, None),
    "orange": ("orange", "orange", V, 169097, 47, 0.94, 11.75, 0.12, 2.4, None),
    "pineapple": ("pineapple", "pineapple", V, 169124, 50, 0.54, 13.12, 0.12, 1.4, None),
    "mango": ("mango", "mango", V, 169910, 60, 0.82, 14.98, 0.38, 1.6, None),
    "blueberries": ("blueberries", "blueberries", V, 171711, 57, 0.74, 14.49, 0.33, 2.4, None),
    "watermelon": ("watermelon", "watermelon", V, 167765, 30, 0.61, 7.55, 0.15, 0.4, None),
    # Oils, nuts, sauces and extras
    "olive_oil": ("olive oil", "olive oil", X, 171413, 884, 0, 0, 100, 0, None),
    "tahini": ("tahini", "tahini", X, 170189, 595, 17, 21.19, 53.76, 9.3, None),
    "peanut_butter": ("peanut butter", "peanut butter", X, 172470, 598, 22.21, 22.31, 51.36, 5, None),
    "almonds": ("almonds", "almonds", X, 170567, 579, 21.15, 21.55, 49.93, 12.5, None),
    "cashews": ("cashews", "cashews", X, 170162, 553, 18.22, 30.19, 43.85, 3.3, None),
    "honey": ("honey", "honey", X, 169640, 304, 0.3, 82.4, 0, 0.2, None),
    "chia": ("chia seeds", "chia seeds", X, 170554, 486, 16.54, 42.12, 30.74, 34.4, None),
    "soy_sauce": ("soy sauce", "soy sauce", X, 174277, 53, 8.14, 4.93, 0.57, 0.8, None),
    "sesame": ("sesame seeds", "sesame seeds", X, 170150, 573, 17.73, 23.45, 49.67, 11.8, None),
    "peanuts": ("roasted peanuts, unsalted", "roasted peanuts, unsalted", X, 173806, 587, 24.35, 21.26, 49.66, 8.4, None),
}

# Spices and staples a recipe may name but the shopping list and the
# numbers leave out: they add next to nothing and most kitchens have them.
PANTRY = {
    "salt", "black pepper", "cumin", "paprika", "chilli flakes", "cajun seasoning", "garam masala",
    "curry powder", "turmeric", "dried oregano", "dried thyme", "cinnamon", "ground coriander",
    "sumac", "za'atar", "stock cube", "vinegar", "mustard", "hot sauce", "ginger", "baking powder",
    "seven spice", "kofta spice", "fajita seasoning", "garlic", "harissa",
    "cardamom", "bay leaf", "dill", "green chilli", "vanilla", "oyster sauce", "flour",
}


def per_portion(key, amount, unit):
    """(kcal, protein, carbs, fat, fiber) for `amount` g, or pieces when unit == "pc"."""
    _n, _pl, _cat, _fdc, kcal, protein, carbs, fat, fiber, piece_g = INGREDIENTS[key]
    grams = amount * piece_g if unit == "pc" else amount
    f = grams / 100
    return (kcal * f, protein * f, carbs * f, fat * f, fiber * f)
