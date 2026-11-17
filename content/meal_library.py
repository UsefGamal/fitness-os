"""The meal library (Nov 2026): every meal the plan and the swap screen can
offer, like the exercise library is for training.

Each meal:
    key       stable id, stored in meal logs when someone swaps to it
    name      the dish's usual name
    meals     which meals of the day it suits: breakfast, lunch, dinner,
              snack, suhoor, iftar
    protein   main protein, for grouping: chicken, beef, lamb, turkey,
              fish, seafood, eggs, dairy, legumes
    minutes   hands-on plus cooking time
    tags      quick (15 min or less), no-cook, batch, budget, air-fryer,
              one-pan, egyptian, light, hearty
    items     one portion: (ingredient, grams) or (ingredient, pieces, "pc"),
              ingredients from content/ingredients.py
    pantry    spices and staples left out of the numbers and the list
    steps     the method, in our own words

Rules: no pork, no alcohol (tests/test_meal_library.py). Fish and seafood
are fine (Nov 2026). The numbers are worked out from the ingredients, never
typed in. Dish names may match well-known recipes; amounts and steps are
written for Fitness OS.
"""

SLOTS = ["breakfast", "lunch", "dinner", "snack", "suhoor", "iftar"]
PROTEINS = ["chicken", "beef", "lamb", "turkey", "fish", "seafood", "eggs", "dairy", "legumes"]
TAGS = ["quick", "no-cook", "batch", "budget", "air-fryer", "one-pan", "egyptian", "light", "hearty"]


def meal(key, name, meals, protein, minutes, tags, items, steps, pantry=()):
    return {"key": key, "name": name, "meals": meals, "protein": protein, "minutes": minutes, "tags": tags, "items": items, "steps": steps, "pantry": list(pantry)}


MEALS = [
    # ---------------------------------------------------------------- breakfast
    meal("shakshuka_feta", "Shakshuka with feta", ["breakfast", "suhoor"], "eggs", 20, ["one-pan", "egyptian", "budget"],
         [("egg", 3, "pc"), ("canned_tomato", 200), ("pepper", 60), ("onion", 50), ("feta", 20), ("olive_oil", 4), ("pita", 1, "pc"), ("greek_yogurt", 100)],
         ["Soften the onion and pepper in the oil for 5 minutes.", "Add the tomatoes and cumin, simmer until thick, about 5 minutes.", "Make three hollows, crack in the eggs, cover and cook until the whites set.", "Crumble the feta over and eat with the pita and a bowl of yogurt."],
         ["cumin", "paprika", "salt"]),
    meal("ful_eggs", "Ful medames with eggs", ["breakfast", "suhoor"], "legumes", 10, ["quick", "egyptian", "budget"],
         [("fava_beans", 200), ("egg", 2, "pc"), ("cottage_cheese", 100), ("olive_oil", 5), ("lemon", 10), ("tomato", 60), ("pita", 1, "pc")],
         ["Warm the beans with a splash of water and mash half of them.", "Season with cumin, lemon juice and the olive oil.", "Boil the eggs for 8 minutes.", "Serve with chopped tomato, the cottage cheese and the pita."],
         ["cumin", "salt"]),
    meal("berry_oats", "Berry protein oats", ["breakfast", "suhoor"], "dairy", 5, ["quick", "budget"],
         [("oats", 50), ("milk", 200), ("greek_yogurt", 200), ("berries", 80), ("honey", 7)],
         ["Cook the oats in the milk for 3 minutes, or soak them overnight.", "Stir in half the yogurt.", "Top with the rest of the yogurt, the berries and the honey."]),
    meal("spinach_scramble", "Scrambled eggs with spinach & tomatoes", ["breakfast", "suhoor"], "eggs", 10, ["quick"],
         [("egg", 3, "pc"), ("spinach", 60), ("tomato", 100), ("cottage_cheese", 100), ("bread", 2, "pc"), ("olive_oil", 3)],
         ["Sear the halved tomatoes in a dry pan and set aside.", "Wilt the spinach in the oil.", "Beat the eggs with the cottage cheese, pour in and stir gently until just set.", "Serve on the toast with the tomatoes."],
         ["salt", "black pepper"]),
    meal("cheese_omelette", "Cheese & herb omelette", ["breakfast", "suhoor", "dinner"], "eggs", 10, ["quick", "budget"],
         [("egg", 3, "pc"), ("mozzarella", 30), ("parsley", 10), ("cottage_cheese", 80), ("cucumber", 100), ("tomato", 100), ("pita", 1, "pc"), ("olive_oil", 3)],
         ["Beat the eggs with the chopped parsley.", "Cook in the oil over medium heat, pulling the edges in.", "Scatter the cheese on one half, fold and slide out.", "Serve with the cottage cheese, cucumber, tomato and the pita."],
         ["salt", "black pepper"]),
    meal("banana_pancakes", "Banana oat pancakes", ["breakfast"], "eggs", 15, ["budget"],
         [("oats", 40), ("egg", 3, "pc"), ("banana", 1, "pc"), ("greek_yogurt", 170), ("honey", 7)],
         ["Blend the oats, eggs and banana into a batter.", "Cook small pancakes in a non-stick pan, 2 minutes a side.", "Serve with the yogurt and the honey."],
         ["cinnamon", "baking powder"]),
    meal("egyptian_breakfast_plate", "Egyptian breakfast plate", ["breakfast", "suhoor"], "dairy", 10, ["quick", "no-cook", "egyptian"],
         [("egg", 2, "pc"), ("cottage_cheese", 180), ("tomato", 100), ("cucumber", 100), ("olive_oil", 5), ("pita", 1, "pc")],
         ["Boil the eggs for 8 minutes.", "Mix the cottage cheese with the olive oil, chopped tomato and cumin.", "Serve with cucumber and the pita."],
         ["cumin", "chilli flakes"]),
    meal("turkey_egg_wrap", "Turkey & egg breakfast wrap", ["breakfast"], "turkey", 10, ["quick"],
         [("egg", 2, "pc"), ("turkey_breast", 90), ("tortilla", 1, "pc"), ("spinach", 30), ("tomato", 60)],
         ["Slice the turkey thinly and warm it in a pan.", "Scramble the eggs.", "Fill the wrap with spinach, tomato, turkey and egg, roll and toast seam-down for a minute."],
         ["salt", "black pepper"]),
    # -------------------------------------------------------------------- lunch
    meal("cajun_chicken_rice", "Cajun chicken with rice & salad", ["lunch", "dinner", "iftar"], "chicken", 25, ["batch"],
         [("chicken_breast", 180), ("rice", 60), ("lettuce", 60), ("tomato", 80), ("cucumber", 80), ("olive_oil", 8), ("lemon", 10)],
         ["Rub the chicken with Cajun seasoning and half the oil.", "Cook the rice.", "Grill or pan-fry the chicken 5-6 minutes a side until cooked through.", "Dress the salad with lemon and the rest of the oil."],
         ["cajun seasoning", "salt"]),
    meal("lemon_chicken_potatoes", "Baked chicken with lemon & potatoes", ["lunch", "dinner", "iftar"], "chicken", 35, ["one-pan", "batch"],
         [("chicken_breast", 180), ("potato", 250), ("green_beans", 100), ("lemon", 15), ("olive_oil", 8), ("garlic", 5)],
         ["Heat the oven to 200°C. Cut the potatoes into chunks and toss with half the oil.", "Roast for 15 minutes.", "Add the chicken, garlic, lemon juice and beans, roast 18-20 minutes more."],
         ["dried oregano", "salt", "black pepper"]),
    meal("broccoli_cashew_chicken", "Broccoli lemon chicken with cashews", ["lunch", "dinner"], "chicken", 25, [],
         [("chicken_breast", 170), ("broccoli", 150), ("cashews", 15), ("rice", 50), ("soy_sauce", 10), ("lemon", 10), ("olive_oil", 5)],
         ["Cook the rice.", "Stir-fry strips of chicken in the oil until golden.", "Add the broccoli and a splash of water, cover for 3 minutes.", "Stir in soy sauce, lemon juice and the cashews."],
         ["ginger", "garlic"]),
    meal("beef_broccoli_stirfry", "Beef stir-fry with broccoli", ["lunch", "dinner"], "beef", 15, ["quick"],
         [("beef_steak", 160), ("broccoli", 150), ("pepper", 80), ("rice_noodles", 60), ("soy_sauce", 15), ("olive_oil", 7)],
         ["Soak the noodles in hot water.", "Sear thin strips of beef in a hot pan for 2 minutes, take out.", "Stir-fry the broccoli and pepper 3 minutes.", "Return the beef, add the noodles and soy sauce, toss well."],
         ["ginger", "garlic", "chilli flakes"]),
    meal("chicken_caesar", "Caesar salad with chicken", ["lunch", "dinner"], "chicken", 20, ["light"],
         [("chicken_breast", 170), ("lettuce", 150), ("parmesan", 15), ("bread", 1, "pc"), ("greek_yogurt", 50), ("lemon", 10), ("olive_oil", 5)],
         ["Cook the chicken and slice it.", "Toast the bread and cut it into croutons.", "Whisk the yogurt, lemon, half the parmesan and mustard into a dressing.", "Toss the lettuce with the dressing, top with chicken, croutons and the rest of the parmesan."],
         ["mustard", "garlic", "black pepper"]),
    meal("tuna_bean_salad", "Tuna & bean salad", ["lunch", "dinner", "suhoor"], "fish", 10, ["quick", "no-cook", "budget"],
         [("tuna", 120), ("white_beans", 150), ("tomato", 100), ("cucumber", 80), ("onion", 30), ("olive_oil", 8), ("lemon", 10)],
         ["Drain the tuna and the beans.", "Chop the tomato, cucumber and onion.", "Toss everything with olive oil, lemon juice and black pepper."],
         ["black pepper", "salt"]),
    meal("adana_kebab_bulgur", "Adana kebab with bulgur & salad", ["lunch", "dinner", "iftar"], "lamb", 30, ["hearty"],
         [("lamb_mince", 60), ("beef_mince", 90), ("bulgur", 55), ("tomato", 100), ("cucumber", 80), ("onion", 30), ("greek_yogurt", 60)],
         ["Mix the mince with grated onion, paprika and chilli, shape onto skewers or into long patties.", "Grill 4-5 minutes a side.", "Cook the bulgur in twice its volume of water for 12 minutes.", "Serve with salad and the yogurt."],
         ["paprika", "chilli flakes", "salt"]),
    meal("chicken_pasta", "15-minute chicken pasta", ["lunch", "dinner"], "chicken", 15, ["quick", "budget"],
         [("chicken_breast", 160), ("pasta", 70), ("canned_tomato", 150), ("spinach", 50), ("parmesan", 10), ("olive_oil", 5), ("garlic", 5)],
         ["Boil the pasta.", "Brown pieces of chicken in the oil with the garlic.", "Add the tomatoes and simmer 5 minutes, then stir in the spinach.", "Toss with the pasta and top with parmesan."],
         ["dried oregano", "salt"]),
    meal("tikka_kebabs_rice", "Chicken tikka kebabs with rice & raita", ["lunch", "dinner", "iftar"], "chicken", 30, ["air-fryer", "batch"],
         [("chicken_breast", 180), ("greek_yogurt", 80), ("rice", 60), ("cucumber", 80), ("onion", 40), ("pepper", 60), ("mint", 3)],
         ["Marinate the chicken in half the yogurt with garam masala and garlic.", "Thread with pepper and onion, air-fry or grill 12-15 minutes.", "Cook the rice.", "Mix grated cucumber and mint into the rest of the yogurt."],
         ["garam masala", "garlic", "salt"]),
    meal("chicken_burrito_bowl", "Chicken burrito bowl", ["lunch", "dinner"], "chicken", 20, ["batch"],
         [("chicken_breast", 160), ("rice", 50), ("black_beans", 100), ("sweetcorn", 50), ("tomato", 80), ("avocado", 40), ("lemon", 10)],
         ["Season the chicken with fajita spice and cook 5-6 minutes a side, then slice.", "Cook the rice and warm the beans and corn.", "Build the bowl and top with chopped tomato, avocado and lime or lemon juice."],
         ["fajita seasoning", "salt"]),
    meal("light_chicken_korma", "Light chicken korma", ["lunch", "dinner", "iftar"], "chicken", 30, ["batch"],
         [("chicken_breast", 170), ("onion", 80), ("greek_yogurt", 80), ("almonds", 10), ("rice", 50), ("olive_oil", 5), ("garlic", 5)],
         ["Soften the onion and garlic in the oil, add curry powder.", "Add the chicken pieces and a splash of water, simmer 12 minutes.", "Off the heat, stir in the yogurt and ground almonds.", "Serve with rice."],
         ["curry powder", "turmeric", "ginger", "salt"]),
    meal("turkey_noodle_soup", "Asian noodle & turkey soup", ["lunch", "dinner", "iftar"], "turkey", 20, ["light"],
         [("turkey_breast", 160), ("rice_noodles", 50), ("mushroom", 80), ("spinach", 50), ("carrot", 50), ("soy_sauce", 15)],
         ["Bring 500 ml stock to a simmer with ginger and soy sauce.", "Add sliced turkey and carrot, simmer 6 minutes.", "Add the mushrooms and noodles for 3 minutes, then the spinach."],
         ["stock cube", "ginger", "chilli flakes"]),
    meal("kofta_bulgur_plate", "Kofta with bulgur & tahini salad", ["lunch", "dinner", "iftar"], "beef", 30, ["egyptian", "batch"],
         [("beef_mince", 160), ("bulgur", 50), ("parsley", 15), ("onion", 30), ("tomato", 100), ("cucumber", 80), ("tahini", 10), ("lemon", 10)],
         ["Mix the mince with grated onion, parsley and kofta spice, shape into fingers.", "Grill or bake at 220°C for 12 minutes.", "Cook the bulgur.", "Chop the salad and dress with tahini thinned with lemon and water."],
         ["kofta spice", "salt"]),
    # ------------------------------------------------------------------- dinner
    meal("baked_salmon_potatoes", "Baked salmon with potatoes & greens", ["dinner", "lunch", "iftar"], "fish", 25, ["one-pan"],
         [("salmon", 170), ("potato", 150), ("green_beans", 100), ("lemon", 10), ("olive_oil", 4)],
         ["Heat the oven to 200°C. Roast chunks of potato in the oil for 15 minutes.", "Add the salmon and beans, season, and roast 12 minutes more.", "Squeeze lemon over to serve."],
         ["dried thyme", "salt", "black pepper"]),
    meal("baked_cod_tomatoes", "Baked fish with tomatoes & crispy crumbs", ["dinner", "lunch", "iftar"], "fish", 30, ["light"],
         [("white_fish", 200), ("tomato", 150), ("bread", 1, "pc"), ("parmesan", 10), ("olive_oil", 5), ("potato", 200)],
         ["Heat the oven to 200°C and boil the potatoes.", "Lay the fish on sliced tomatoes in a dish.", "Blitz the bread with parmesan and oil, scatter over the fish.", "Bake 15 minutes until the crumbs are golden."],
         ["garlic", "salt"]),
    meal("air_fryer_chicken_sweet_potato", "Air fryer chicken breast with sweet potato", ["dinner", "lunch", "iftar"], "chicken", 25, ["air-fryer", "batch"],
         [("chicken_breast", 180), ("sweet_potato", 220), ("broccoli", 120), ("olive_oil", 6)],
         ["Cut the sweet potato into wedges, toss with half the oil and air-fry at 200°C for 10 minutes.", "Rub the chicken with paprika, garlic and the rest of the oil.", "Add the chicken and air-fry 15 minutes, turning once.", "Steam the broccoli."],
         ["paprika", "garlic", "salt"]),
    meal("beef_salsa_burger", "Beef & salsa burger", ["dinner", "lunch"], "beef", 20, ["hearty"],
         [("beef_mince", 150), ("bun", 1, "pc"), ("tomato", 80), ("onion", 30), ("lettuce", 30), ("coriander", 5), ("sweet_potato", 120)],
         ["Shape the mince into one burger and season.", "Grill or pan-fry 4-5 minutes a side.", "Chop tomato, onion and coriander into a quick salsa.", "Serve in the bun with lettuce and salsa, and oven or air-fried sweet potato wedges."],
         ["salt", "black pepper", "chilli flakes"]),
    meal("sticky_lemon_chicken", "Sticky lemon chicken", ["dinner", "lunch"], "chicken", 30, [],
         [("chicken_thigh", 180), ("honey", 10), ("lemon", 15), ("soy_sauce", 10), ("rice", 60), ("green_beans", 100)],
         ["Brown the chicken thighs in a dry non-stick pan, 5 minutes a side.", "Add honey, lemon and soy sauce and bubble until sticky.", "Serve with rice and steamed beans."],
         ["garlic", "chilli flakes"]),
    meal("lamb_kofta_yogurt", "Lamb kofta with minty yogurt", ["dinner", "lunch", "iftar"], "lamb", 25, ["hearty"],
         [("lamb_mince", 80), ("beef_mince", 80), ("greek_yogurt", 100), ("mint", 3), ("pita", 1, "pc"), ("tomato", 100), ("cucumber", 100)],
         ["Mix the mince with cumin and grated onion and shape into small koftas.", "Grill 10-12 minutes, turning.", "Stir chopped mint into the yogurt.", "Serve in or with the pita and a chopped salad."],
         ["cumin", "salt"]),
    meal("shrimp_noodles", "Garlic shrimp noodles", ["dinner", "lunch"], "seafood", 15, ["quick"],
         [("shrimp", 180), ("rice_noodles", 60), ("pepper", 80), ("zucchini", 100), ("soy_sauce", 15), ("olive_oil", 7), ("garlic", 8)],
         ["Soak the noodles.", "Stir-fry the garlic and shrimp in the oil for 2-3 minutes until pink.", "Add sliced pepper and zucchini for 2 minutes.", "Toss in the noodles and soy sauce."],
         ["chilli flakes", "ginger"]),
    meal("steak_roast_veg", "Steak with roasted vegetables", ["dinner", "lunch"], "beef", 30, ["hearty"],
         [("beef_steak", 180), ("potato", 180), ("zucchini", 120), ("pepper", 100), ("olive_oil", 8)],
         ["Roast potato, zucchini and pepper chunks in the oil at 200°C for 25 minutes.", "Season the steak and sear 3-4 minutes a side.", "Rest 5 minutes, slice and serve."],
         ["salt", "black pepper", "dried thyme"]),
    meal("lentil_soup_chicken", "Lentil soup with grilled chicken", ["dinner", "lunch", "iftar"], "legumes", 30, ["egyptian", "budget", "batch"],
         [("red_lentils", 60), ("chicken_breast", 150), ("carrot", 60), ("onion", 60), ("lemon", 10), ("olive_oil", 5), ("pita", 0.5, "pc")],
         ["Simmer the lentils, carrot and onion in 600 ml stock with cumin for 20 minutes.", "Blend smooth and add lemon juice.", "Grill the chicken and slice it.", "Serve the soup with the chicken and the pita."],
         ["cumin", "stock cube", "salt"]),
    meal("chicken_fajita_wraps", "Chicken fajita wraps", ["dinner", "lunch"], "chicken", 15, ["quick"],
         [("chicken_breast", 160), ("tortilla", 2, "pc"), ("pepper", 120), ("onion", 60), ("greek_yogurt", 50), ("olive_oil", 5)],
         ["Slice the chicken, pepper and onion and toss with fajita seasoning.", "Cook in a hot pan with the oil for 8-10 minutes.", "Fill the warm wraps and top with yogurt."],
         ["fajita seasoning", "salt"]),
    meal("chicken_traybake", "All-in-one chicken traybake", ["dinner", "lunch", "iftar"], "chicken", 35, ["one-pan", "batch"],
         [("chicken_thigh", 170), ("potato", 200), ("carrot", 80), ("onion", 60), ("olive_oil", 6)],
         ["Heat the oven to 200°C.", "Toss everything with the oil, paprika and thyme in one tray.", "Roast 30-35 minutes, turning halfway."],
         ["paprika", "dried thyme", "salt"]),
    meal("bolti_tagine", "Spiced fish & tomato tagine", ["dinner", "lunch", "iftar"], "fish", 30, ["one-pan", "egyptian"],
         [("white_fish", 200), ("canned_tomato", 200), ("pepper", 80), ("onion", 60), ("chickpeas", 80), ("olive_oil", 5), ("coriander", 5)],
         ["Soften the onion and pepper in the oil with cumin and paprika.", "Add the tomatoes and chickpeas and simmer 10 minutes.", "Nestle in the fish, cover and cook 8 minutes until it flakes.", "Finish with coriander."],
         ["cumin", "paprika", "salt"]),
    # -------------------------------------------------------------------- snacks
    meal("yogurt_berries", "Greek yogurt & berries", ["snack", "suhoor"], "dairy", 2, ["quick", "no-cook"],
         [("greek_yogurt", 200), ("berries", 80)],
         ["Spoon the yogurt into a bowl and top with the berries."]),
    meal("cottage_cucumber", "Cottage cheese & cucumber", ["snack"], "dairy", 3, ["quick", "no-cook", "egyptian", "budget"],
         [("cottage_cheese", 150), ("cucumber", 120), ("tomato", 60)],
         ["Chop the cucumber and tomato and mix with the cottage cheese, cumin and a pinch of salt."],
         ["cumin", "salt"]),
    meal("boiled_eggs_snack", "Boiled eggs", ["snack", "suhoor"], "eggs", 10, ["quick", "budget"],
         [("egg", 2, "pc"), ("cucumber", 100)],
         ["Boil the eggs for 8 minutes, cool in cold water and peel.", "Eat with cucumber sticks and a pinch of salt."],
         ["salt"]),
    meal("roasted_chickpeas", "Crunchy roasted chickpeas with yogurt dip", ["snack"], "legumes", 30, ["batch", "budget"],
         [("chickpeas", 100), ("olive_oil", 3), ("greek_yogurt", 150)],
         ["Pat the chickpeas dry and toss with the oil and spices.", "Roast at 200°C or air-fry for 20-25 minutes until crisp.", "Dip them in the yogurt mixed with a little garlic and salt."],
         ["paprika", "cumin", "salt"]),
    meal("apple_peanut_butter", "Apple & peanut butter", ["snack"], "legumes", 2, ["quick", "no-cook"],
         [("apple", 1, "pc"), ("peanut_butter", 15), ("greek_yogurt", 170)],
         ["Slice the apple and dip it in the peanut butter.", "Have the yogurt alongside."]),
    meal("hummus_veg", "Hummus & veg sticks", ["snack"], "legumes", 5, ["quick", "no-cook"],
         [("hummus", 60), ("carrot", 80), ("cucumber", 80), ("pepper", 60)],
         ["Cut the vegetables into sticks and dip."]),
    meal("tuna_rice_cakes", "Tuna on rice cakes", ["snack", "suhoor"], "fish", 5, ["quick", "no-cook"],
         [("tuna", 80), ("rice_cakes", 3, "pc"), ("greek_yogurt", 30), ("cucumber", 50)],
         ["Mix the tuna with the yogurt and black pepper.", "Spread on the rice cakes and top with sliced cucumber."],
         ["black pepper"]),
    meal("dates_milk", "Dates & milk", ["snack", "iftar", "suhoor"], "dairy", 1, ["quick", "no-cook", "egyptian"],
         [("dates", 3, "pc"), ("milk", 250)],
         ["Break the fast, or snack, with the dates and a glass of milk."]),
    # ----------------------------------------------------------- suhoor / iftar
    meal("overnight_chia_oats", "Overnight oats with chia & dates", ["suhoor", "breakfast"], "dairy", 5, ["no-cook", "batch"],
         [("oats", 50), ("chia", 10), ("milk", 200), ("greek_yogurt", 200), ("dates", 2, "pc")],
         ["Mix the oats, chia, milk and yogurt in a jar.", "Chop the dates in, cover and chill overnight.", "Eat cold at suhoor: slow carbs and protein keep you full."]),
    meal("suhoor_eggs_cheese", "Eggs, cheese & bread suhoor", ["suhoor"], "eggs", 10, ["quick", "egyptian"],
         [("egg", 2, "pc"), ("feta", 30), ("cucumber", 120), ("tomato", 100), ("pita", 1, "pc"), ("banana", 1, "pc")],
         ["Boil or scramble the eggs.", "Serve with the cheese, cucumber, tomato and pita.", "Finish with the banana, and plenty of water."]),
    meal("iftar_chicken_bulgur", "Grilled chicken with bulgur & fattoush", ["iftar", "dinner"], "chicken", 25, ["egyptian"],
         [("chicken_breast", 180), ("bulgur", 60), ("lettuce", 60), ("tomato", 80), ("cucumber", 80), ("pita", 0.5, "pc"), ("olive_oil", 8), ("lemon", 10)],
         ["Season and grill the chicken.", "Cook the bulgur.", "Toast the pita and break it over the chopped salad, dress with oil, lemon and sumac."],
         ["sumac", "seven spice", "salt"]),
]

MEALS_BY_KEY = {m["key"]: m for m in MEALS}


def _num(x):
    return f"{x:g}"


def item_key(item):
    """("chicken_breast", 180) -> "chicken_breast_180g"; ("egg", 2, "pc") -> "egg_2pc".
    The suffix is the shopping unit the app already merges on."""
    ing, amount, *unit = item
    return f"{ing}_{_num(amount)}{'pc' if unit == ['pc'] else 'g'}"


def item_macros(item):
    from content.ingredients import per_portion

    ing, amount, *unit = item
    return per_portion(ing, amount, unit[0] if unit else "g")


def meal_totals(m):
    """(kcal, protein, carbs, fat, fiber) for one portion, from the ingredients."""
    sums = [0.0] * 5
    for item in m["items"]:
        for i, v in enumerate(item_macros(item)):
            sums[i] += v
    kcal, protein, carbs, fat, fiber = sums
    return round(kcal), round(protein, 1), round(carbs, 1), round(fat, 1), round(fiber, 1)


# The 14-day plan: one library meal per slot as the default. Anyone can
# swap any slot for another library meal that suits it. Day 14 is the
# refeed day: heartier meals, same protein. Spread so no main repeats
# within a week and fish comes twice a week.
PLAN_DAYS = [
    # breakfast,               snack1,             lunch,                    snack2,              dinner
    ("shakshuka_feta", "yogurt_berries", "cajun_chicken_rice", "cottage_cucumber", "bolti_tagine"),
    ("berry_oats", "boiled_eggs_snack", "adana_kebab_bulgur", "cottage_cucumber", "lentil_soup_chicken"),
    ("ful_eggs", "tuna_rice_cakes", "chicken_pasta", "yogurt_berries", "steak_roast_veg"),
    ("spinach_scramble", "cottage_cucumber", "tikka_kebabs_rice", "tuna_rice_cakes", "baked_salmon_potatoes"),
    ("overnight_chia_oats", "boiled_eggs_snack", "tuna_bean_salad", "yogurt_berries", "chicken_fajita_wraps"),
    ("egyptian_breakfast_plate", "yogurt_berries", "kofta_bulgur_plate", "tuna_rice_cakes", "sticky_lemon_chicken"),
    ("cheese_omelette", "cottage_cucumber", "light_chicken_korma", "apple_peanut_butter", "shrimp_noodles"),
    ("turkey_egg_wrap", "yogurt_berries", "broccoli_cashew_chicken", "roasted_chickpeas", "baked_cod_tomatoes"),
    ("berry_oats", "tuna_rice_cakes", "beef_broccoli_stirfry", "cottage_cucumber", "air_fryer_chicken_sweet_potato"),
    ("shakshuka_feta", "boiled_eggs_snack", "chicken_burrito_bowl", "yogurt_berries", "lamb_kofta_yogurt"),
    ("ful_eggs", "roasted_chickpeas", "lemon_chicken_potatoes", "tuna_rice_cakes", "baked_salmon_potatoes"),
    ("spinach_scramble", "cottage_cucumber", "chicken_caesar", "tuna_rice_cakes", "chicken_traybake"),
    ("egyptian_breakfast_plate", "yogurt_berries", "turkey_noodle_soup", "apple_peanut_butter", "iftar_chicken_bulgur"),
    ("banana_pancakes", "dates_milk", "adana_kebab_bulgur", "yogurt_berries", "beef_salsa_burger"),
]
REFEED_DAY = 14
PLAN_SLOTS = ["breakfast", "snack1", "lunch", "snack2", "dinner"]

# Which library meals suit a plan slot, by the meal-of-day tags above.
# In Ramadan the same slots become suhoor, iftar and the late meals.
SLOT_KINDS = {"breakfast": ["breakfast"], "snack1": ["snack"], "lunch": ["lunch"], "snack2": ["snack"], "dinner": ["dinner"]}
RAMADAN_SLOT_KINDS = {"breakfast": ["suhoor"], "snack1": ["snack", "iftar"], "lunch": ["iftar"], "snack2": ["snack"], "dinner": ["dinner"]}

_UNIT_NAMES = None


def item_phrase(item):
    """One ingredient in words: "chicken breast 180 g", "3 eggs", "half a wholewheat pita"."""
    from content.ingredients import INGREDIENTS

    ing, amount, *unit = item
    one, many = INGREDIENTS[ing][0], INGREDIENTS[ing][1]
    if unit != ["pc"]:
        return f"{one} {_num(amount)} g"
    if amount == 0.5:
        return f"half {'an' if one[0] in 'aeiou' else 'a'} {one}"
    if amount == 1:
        return f"{'an' if one[0] in 'aeiou' else 'a'} {one}"
    return f"{_num(amount)} {many}"


def meal_option(m):
    """A library meal in the app's option shape: the same fields a plan
    option has (key, items, ingredients, macros), plus the library's own."""
    from content.meal_photos import MEAL_PHOTOS

    kcal, protein, carbs, fat, fiber = meal_totals(m)
    photo = MEAL_PHOTOS.get(m["key"])
    return {
        "key": m["key"],
        "photo": {"file": f"meal-photos/{m['key']}.webp", "thumb": f"meal-photos/{m['key']}-thumb.webp", "author": photo[1], "license": photo[2]} if photo else None,
        "name": m["name"],
        "meals": m["meals"],
        "protein_source": m["protein"],
        "minutes": m["minutes"],
        "tags": m["tags"],
        "items": [item_key(i) for i in m["items"]],
        "ingredients": [item_phrase(i) for i in m["items"]],
        "pantry": m["pantry"],
        "steps": m["steps"],
        "kcal": kcal,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "fiber": fiber,
    }


def item_foods():
    """Every item key the library uses -> its macros, name and shopping
    category, in the shapes nutrition.foods / food_names / food_categories
    already use, so portion scaling and the shopping list work unchanged."""
    from content.ingredients import INGREDIENTS

    foods, names, categories = {}, {}, {}
    for m in MEALS:
        for item in m["items"]:
            key = item_key(item)
            foods[key] = tuple(round(v, 2) for v in item_macros(item))
            categories[key] = INGREDIENTS[item[0]][2]
            names[item[0]] = INGREDIENTS[item[0]][0]
    return foods, names, categories
