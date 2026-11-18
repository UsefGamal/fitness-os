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
    # ------------------------------------------------- more meals (Nov 2026)
    # breakfast and suhoor
    meal("akoori_eggs", "Akoori (Indian scrambled eggs)", ["breakfast", "suhoor"], "eggs", 15, ["quick", "budget"],
         [("egg", 3, "pc"), ("onion", 40), ("tomato", 60), ("coriander", 5), ("cottage_cheese", 80), ("bread", 2, "pc"), ("olive_oil", 4)],
         ["Soften chopped onion in the oil, add tomato, turmeric and chilli for 2 minutes.", "Pour in the beaten eggs and stir gently until just set.", "Finish with coriander; serve with toast and the cottage cheese."],
         ["turmeric", "green chilli", "salt"]),
    meal("avocado_black_bean_eggs", "Avocado & black bean eggs", ["breakfast"], "eggs", 10, ["quick"],
         [("egg", 2, "pc"), ("black_beans", 100), ("avocado", 40), ("tomato", 60), ("tortilla", 1, "pc"), ("greek_yogurt", 80), ("olive_oil", 3)],
         ["Warm the beans with cumin and a splash of water.", "Fry the eggs in the oil.", "Pile beans, eggs, tomato and avocado on the warm wrap, with yogurt on the side."],
         ["cumin", "chilli flakes", "salt"]),
    meal("banana_bread_baked_oats", "Banana bread baked oats", ["breakfast", "suhoor"], "dairy", 30, ["batch"],
         [("oats", 50), ("banana", 1, "pc"), ("egg", 1, "pc"), ("milk", 120), ("greek_yogurt", 150), ("honey", 5)],
         ["Heat the oven to 180°C.", "Mash the banana and mix with the oats, egg, milk, cinnamon and baking powder.", "Bake in a small dish for 25 minutes; serve warm with the yogurt and honey."],
         ["cinnamon", "baking powder"]),
    meal("breakfast_egg_wraps", "Breakfast egg wraps", ["breakfast", "suhoor"], "eggs", 12, ["quick"],
         [("egg", 3, "pc"), ("tortilla", 1, "pc"), ("spinach", 30), ("feta", 20), ("tomato", 60), ("cottage_cheese", 60)],
         ["Beat the eggs with the cottage cheese and cook as a thin omelette.", "Lay it on the wrap, add spinach, tomato and crumbled feta.", "Roll up and toast seam-side down for a minute."],
         ["black pepper"]),
    meal("cheesy_mushroom_omelette", "Cheesy mushroom omelette", ["breakfast", "suhoor", "dinner"], "eggs", 15, ["quick"],
         [("egg", 3, "pc"), ("mushroom", 100), ("mozzarella", 25), ("cottage_cheese", 80), ("bread", 1, "pc"), ("olive_oil", 3)],
         ["Fry the sliced mushrooms in the oil until golden, then tip out.", "Cook the beaten eggs, scatter mushrooms and cheese on one half and fold.", "Serve with the toast and cottage cheese."],
         ["salt", "black pepper"]),
    meal("baked_eggs_spinach", "Baked eggs with spinach & tomato", ["breakfast", "suhoor"], "eggs", 20, ["one-pan"],
         [("egg", 3, "pc"), ("spinach", 80), ("canned_tomato", 150), ("feta", 20), ("pita", 1, "pc")],
         ["Simmer the tomatoes with garlic and cumin for 5 minutes, stir in the spinach.", "Make hollows, crack in the eggs, cover and cook until set.", "Top with feta and eat with the pita."],
         ["garlic", "cumin", "salt"]),
    meal("berry_omelette", "Berry omelette with yogurt", ["breakfast"], "eggs", 7, ["quick"],
         [("egg", 3, "pc"), ("berries", 80), ("greek_yogurt", 120), ("honey", 5)],
         ["Beat the eggs with a pinch of cinnamon and cook a thin omelette.", "Fill with the berries and fold; serve with yogurt and honey."],
         ["cinnamon"]),
    meal("protein_yogurt_bowl", "Protein yogurt bowl with granola", ["breakfast", "suhoor"], "dairy", 3, ["quick", "no-cook"],
         [("greek_yogurt", 250), ("granola", 30), ("blueberries", 80), ("chia", 5)],
         ["Spoon the yogurt into a bowl.", "Top with granola, blueberries and chia."]),
    meal("eggah_herb_omelette", "Eggah (Egyptian herb omelette)", ["breakfast", "suhoor", "dinner"], "eggs", 15, ["quick", "egyptian", "budget"],
         [("egg", 3, "pc"), ("parsley", 15), ("onion", 40), ("cottage_cheese", 100), ("tomato", 80), ("pita", 1, "pc"), ("olive_oil", 4)],
         ["Beat the eggs with chopped parsley, grated onion, cumin and a pinch of flour.", "Cook in the oil over medium heat, flip when set underneath.", "Serve with cottage cheese, tomato and the pita."],
         ["cumin", "flour", "salt"]),
    meal("ful_iskandarani", "Ful iskandarani", ["breakfast", "suhoor"], "legumes", 15, ["quick", "egyptian", "budget"],
         [("fava_beans", 200), ("tomato", 80), ("pepper", 50), ("onion", 40), ("tahini", 10), ("egg", 2, "pc"), ("pita", 1, "pc")],
         ["Soften chopped onion, pepper and tomato in a dry pan with cumin.", "Add the beans with a splash of water and mash lightly.", "Drizzle with tahini; serve with boiled eggs and the pita."],
         ["cumin", "green chilli", "salt"]),
    meal("salmon_eggs_toast", "Salmon & eggs on toast", ["breakfast"], "fish", 15, ["quick"],
         [("salmon", 80), ("egg", 2, "pc"), ("bread", 2, "pc"), ("spinach", 30), ("lemon", 5)],
         ["Pan-fry the salmon 3-4 minutes a side and flake it.", "Scramble or poach the eggs.", "Pile spinach, salmon and eggs on the toast with a squeeze of lemon."],
         ["black pepper", "dill"]),
    meal("peanut_date_porridge", "Peanut butter & date porridge", ["suhoor", "breakfast"], "dairy", 8, ["quick"],
         [("oats", 50), ("milk", 250), ("peanut_butter", 15), ("dates", 2, "pc"), ("greek_yogurt", 100)],
         ["Cook the oats in the milk for 4 minutes.", "Stir in the chopped dates and peanut butter.", "Top with the yogurt: slow energy for a long fast."],
         ["cinnamon"]),
    # lunch, dinner, iftar
    meal("chicken_souvlaki", "Chicken souvlaki with tzatziki", ["lunch", "dinner", "iftar"], "chicken", 35, ["batch"],
         [("chicken_breast", 170), ("pita", 1, "pc"), ("greek_yogurt", 80), ("cucumber", 100), ("tomato", 80), ("onion", 30), ("olive_oil", 5), ("lemon", 10)],
         ["Marinate cubes of chicken in lemon, oregano, garlic and the oil; thread onto skewers.", "Grill 10-12 minutes, turning.", "Grate half the cucumber into the yogurt with garlic for tzatziki.", "Serve with the pita, tomato, onion and the rest of the cucumber."],
         ["dried oregano", "garlic", "salt"]),
    meal("chicken_tzatziki_wraps", "Chicken & tzatziki wraps", ["lunch", "dinner"], "chicken", 25, [],
         [("chicken_breast", 150), ("tortilla", 2, "pc"), ("greek_yogurt", 80), ("cucumber", 60), ("lettuce", 40), ("tomato", 60)],
         ["Season and grill the chicken, then slice.", "Mix grated cucumber, garlic and mint into the yogurt.", "Fill the wraps with lettuce, tomato, chicken and tzatziki."],
         ["garlic", "salt"]),
    meal("chicken_harissa_chickpeas", "Chicken with crushed harissa chickpeas", ["lunch", "dinner", "iftar"], "chicken", 15, ["quick"],
         [("chicken_breast", 170), ("chickpeas", 150), ("spinach", 60), ("olive_oil", 6), ("lemon", 10)],
         ["Rub the chicken with harissa and pan-fry 5-6 minutes a side.", "Warm the chickpeas with a little more harissa and crush roughly.", "Stir in the spinach and lemon; serve with the sliced chicken."],
         ["harissa", "salt"]),
    meal("chicken_shawarma_plate", "Chicken shawarma plate", ["lunch", "dinner", "iftar"], "chicken", 30, ["egyptian", "batch"],
         [("chicken_thigh", 180), ("rice", 60), ("cabbage", 80), ("tomato", 60), ("tahini", 10), ("pita", 0.5, "pc"), ("lemon", 10)],
         ["Marinate thin strips of chicken in seven spice, garlic and lemon.", "Cook in a very hot pan until charred at the edges.", "Serve on rice with shredded cabbage, tomato and tahini thinned with water."],
         ["seven spice", "garlic", "salt"]),
    meal("chicken_chow_mein", "Chicken chow mein", ["lunch", "dinner"], "chicken", 20, [],
         [("chicken_breast", 150), ("rice_noodles", 60), ("cabbage", 100), ("carrot", 50), ("pepper", 60), ("soy_sauce", 15), ("olive_oil", 6)],
         ["Soak the noodles.", "Stir-fry strips of chicken in the oil until golden.", "Add the cabbage, carrot and pepper for 3 minutes, then the noodles and soy sauce."],
         ["ginger", "garlic"]),
    meal("chicken_satay_salad", "Chicken satay salad", ["lunch", "dinner"], "chicken", 25, ["light"],
         [("chicken_breast", 160), ("peanut_butter", 15), ("lettuce", 80), ("cucumber", 80), ("carrot", 60), ("soy_sauce", 10), ("lemon", 10), ("rice", 40)],
         ["Grill the chicken and slice it.", "Whisk peanut butter, soy sauce, lemon and hot water into a dressing.", "Toss the salad with the dressing; serve with the chicken and rice."],
         ["chilli flakes"]),
    meal("chicken_noodle_soup", "Chicken noodle soup", ["lunch", "dinner", "iftar"], "chicken", 30, ["light", "batch"],
         [("chicken_breast", 150), ("rice_noodles", 50), ("carrot", 60), ("spinach", 40), ("onion", 40), ("bread", 1, "pc")],
         ["Simmer the chicken, onion and carrot in 600 ml stock for 15 minutes.", "Shred the chicken back into the pot with the noodles and spinach.", "Serve with the bread."],
         ["stock cube", "bay leaf", "black pepper"]),
    meal("chicken_jalfrezi", "Chicken jalfrezi with rice", ["lunch", "dinner", "iftar"], "chicken", 35, ["batch"],
         [("chicken_breast", 170), ("pepper", 100), ("onion", 60), ("canned_tomato", 150), ("rice", 60), ("olive_oil", 6)],
         ["Fry onion and peppers in the oil with curry powder.", "Add the chicken and brown it, then the tomatoes; simmer 15 minutes.", "Serve with rice."],
         ["curry powder", "garam masala", "green chilli", "salt"]),
    meal("chicken_saag", "Chicken saag", ["lunch", "dinner", "iftar"], "chicken", 35, [],
         [("chicken_breast", 170), ("spinach", 150), ("onion", 60), ("greek_yogurt", 60), ("rice", 50), ("olive_oil", 6)],
         ["Soften the onion in the oil with garlic, ginger and garam masala.", "Add the chicken and a splash of water, simmer 12 minutes.", "Wilt in the spinach, take off the heat and stir in the yogurt; serve with rice."],
         ["garam masala", "garlic", "ginger", "salt"]),
    meal("chicken_parmigiana", "Chicken parmigiana with pasta", ["lunch", "dinner"], "chicken", 30, ["hearty"],
         [("chicken_breast", 170), ("canned_tomato", 150), ("mozzarella", 30), ("parmesan", 5), ("pasta", 50), ("olive_oil", 4)],
         ["Flatten the chicken and pan-fry in the oil 4 minutes a side.", "Spoon over tomatoes simmered with oregano, top with the cheeses.", "Bake or grill until bubbling; serve with the pasta."],
         ["dried oregano", "garlic", "salt"]),
    meal("baked_chicken_katsu", "Baked chicken katsu with rice", ["lunch", "dinner"], "chicken", 40, ["air-fryer"],
         [("chicken_breast", 170), ("bread", 1, "pc"), ("egg", 1, "pc"), ("rice", 60), ("cabbage", 80), ("soy_sauce", 10)],
         ["Dip the chicken in beaten egg, then the blitzed bread crumbs.", "Bake at 200°C or air-fry for 18-20 minutes.", "Serve sliced on rice with shredded cabbage and a sauce of curry powder, soy sauce and water."],
         ["curry powder", "flour"]),
    meal("chicken_edamame_pilaf", "Chicken, edamame & ginger pilaf", ["lunch", "dinner"], "chicken", 27, ["one-pan", "batch"],
         [("chicken_breast", 150), ("rice", 60), ("edamame", 80), ("onion", 40), ("olive_oil", 5)],
         ["Brown the chicken pieces and onion in the oil with ginger.", "Add the rice and twice its volume of stock; cover and cook 12 minutes.", "Stir in the edamame for the last 3 minutes."],
         ["ginger", "stock cube", "salt"]),
    meal("bang_bang_chicken_noodles", "Bang bang chicken & vegetable noodles", ["lunch", "dinner"], "chicken", 30, [],
         [("chicken_breast", 150), ("rice_noodles", 60), ("peanut_butter", 12), ("carrot", 60), ("cucumber", 60), ("soy_sauce", 10)],
         ["Poach the chicken 12 minutes and shred it.", "Soak the noodles.", "Mix peanut butter, soy sauce, chilli and hot water into a sauce.", "Toss noodles, vegetables and chicken in the sauce."],
         ["chilli flakes"]),
    meal("beef_stroganoff", "Beef stroganoff with pasta", ["lunch", "dinner"], "beef", 30, ["hearty"],
         [("beef_steak", 150), ("mushroom", 120), ("onion", 60), ("greek_yogurt", 80), ("pasta", 60), ("olive_oil", 5)],
         ["Sear thin strips of beef in the oil for 2 minutes and take out.", "Soften the onion and mushrooms with paprika.", "Off the heat, stir in the yogurt and the beef; serve over the pasta."],
         ["paprika", "mustard", "salt"]),
    meal("bulgogi_rice", "Bulgogi beef with rice", ["lunch", "dinner"], "beef", 35, [],
         [("beef_steak", 150), ("rice", 60), ("onion", 40), ("carrot", 50), ("soy_sauce", 15), ("sesame", 3), ("honey", 5), ("cucumber", 60)],
         ["Marinate thinly sliced beef in soy sauce, honey, garlic and ginger for 15 minutes.", "Stir-fry with the onion and carrot in a very hot pan.", "Serve on rice with sliced cucumber and sesame seeds."],
         ["garlic", "ginger"]),
    meal("beef_orange_stirfry", "Beef & orange stir-fry", ["lunch", "dinner"], "beef", 25, [],
         [("beef_steak", 150), ("orange", 100), ("broccoli", 100), ("pepper", 60), ("rice", 60), ("soy_sauce", 10)],
         ["Sear strips of beef in a hot pan and take out.", "Stir-fry broccoli and pepper for 3 minutes.", "Add the juice and segments of the orange with soy sauce, return the beef; serve with rice."],
         ["ginger", "garlic"]),
    meal("chilli_con_carne", "Chilli con carne", ["lunch", "dinner"], "beef", 40, ["batch", "budget"],
         [("beef_mince", 150), ("kidney_beans", 120), ("canned_tomato", 150), ("onion", 50), ("pepper", 60), ("rice", 60)],
         ["Brown the mince with the onion and pepper.", "Add cumin, paprika, chilli, the tomatoes and beans; simmer 25 minutes.", "Serve with rice. It keeps well for 3 days."],
         ["cumin", "paprika", "chilli flakes", "salt"]),
    meal("lean_bolognese", "Lean bolognese pasta", ["lunch", "dinner"], "beef", 35, ["batch", "budget"],
         [("beef_mince", 140), ("pasta", 70), ("canned_tomato", 200), ("onion", 50), ("carrot", 40), ("parmesan", 5)],
         ["Brown the mince with chopped onion and carrot.", "Add the tomatoes and oregano and simmer 20 minutes.", "Serve over the pasta with parmesan."],
         ["dried oregano", "garlic", "salt"]),
    meal("kebda_iskandarani", "Kebda iskandarani (Alexandrian liver)", ["lunch", "dinner", "iftar"], "beef", 15, ["quick", "egyptian", "budget"],
         [("beef_liver", 180), ("pepper", 80), ("onion", 40), ("garlic", 5), ("lemon", 10), ("pita", 1, "pc"), ("tahini", 10)],
         ["Cut the liver into thin strips.", "Stir-fry with garlic, green chilli and cumin in a very hot pan for 3-4 minutes, then the pepper and onion for 2 more.", "Finish with lemon; eat in the pita with tahini."],
         ["cumin", "green chilli", "salt"]),
    meal("bamia_beef", "Bamia (okra & beef stew) with rice", ["lunch", "dinner", "iftar"], "beef", 40, ["egyptian", "batch"],
         [("beef_steak", 140), ("okra", 150), ("canned_tomato", 150), ("onion", 40), ("rice", 60), ("olive_oil", 4)],
         ["Brown cubes of beef with the onion in the oil.", "Add the tomatoes, garlic and a cup of water; simmer 20 minutes.", "Add the okra and cook 12 minutes more; serve with rice."],
         ["garlic", "ground coriander", "salt"]),
    meal("molokhia_chicken", "Molokhia with chicken & rice", ["lunch", "dinner", "iftar"], "chicken", 35, ["egyptian"],
         [("molokhia", 150), ("chicken_breast", 160), ("rice", 60), ("olive_oil", 5)],
         ["Simmer the chicken in 500 ml water with a bay leaf and cardamom, then lift out.", "Stir the molokhia into the hot stock and bring just to a simmer.", "Fry crushed garlic and ground coriander in the oil and pour over; serve with the chicken and rice."],
         ["bay leaf", "cardamom", "garlic", "ground coriander", "salt"]),
    meal("lamb_dates_couscous", "Aromatic lamb with dates & couscous", ["lunch", "dinner", "iftar"], "lamb", 25, ["hearty"],
         [("lamb_mince", 90), ("dates", 1, "pc"), ("onion", 40), ("couscous", 40), ("spinach", 40), ("greek_yogurt", 100)],
         ["Brown the lamb with the onion, cinnamon and cumin.", "Stir in the chopped date and a splash of water for 5 minutes.", "Pour boiling water over the couscous and leave 5 minutes; serve with the lamb, spinach and yogurt."],
         ["cinnamon", "cumin", "salt"]),
    meal("turkey_kofta_couscous", "Turkey kofta with couscous", ["lunch", "dinner"], "turkey", 25, [],
         [("turkey_mince", 160), ("couscous", 60), ("cucumber", 80), ("tomato", 80), ("greek_yogurt", 60), ("mint", 3)],
         ["Mix the mince with cumin and grated onion and shape into koftas.", "Grill 10 minutes, turning.", "Soak the couscous; serve with salad and minty yogurt."],
         ["cumin", "salt"]),
    meal("turkey_burger_wedges", "Turkey burger with sweet potato wedges", ["lunch", "dinner"], "turkey", 25, ["air-fryer"],
         [("turkey_mince", 160), ("bun", 1, "pc"), ("lettuce", 40), ("tomato", 60), ("sweet_potato", 120)],
         ["Air-fry the sweet potato wedges at 200°C for 18 minutes.", "Shape the mince into a burger and cook 5 minutes a side.", "Serve in the bun with lettuce and tomato."],
         ["paprika", "salt"]),
    meal("cajun_salmon_couscous", "Cajun spiced salmon with couscous", ["lunch", "dinner"], "fish", 25, [],
         [("salmon", 150), ("couscous", 50), ("pepper", 60), ("zucchini", 80), ("lemon", 10)],
         ["Rub the salmon with Cajun seasoning and roast at 200°C for 12 minutes with the pepper and zucchini.", "Soak the couscous in boiling water for 5 minutes.", "Serve together with lemon."],
         ["cajun seasoning"]),
    meal("basque_salmon_stew", "Basque-style salmon stew", ["lunch", "dinner", "iftar"], "fish", 35, ["one-pan"],
         [("salmon", 140), ("potato", 150), ("pepper", 100), ("canned_tomato", 150), ("onion", 40), ("olive_oil", 4)],
         ["Soften onion and pepper in the oil with paprika.", "Add the potatoes, tomatoes and a splash of water; simmer 15 minutes.", "Lay the salmon on top, cover and cook 8 minutes."],
         ["paprika", "garlic", "salt"]),
    meal("fish_butter_beans", "Braised white fish with butter beans & mint", ["lunch", "dinner", "iftar"], "fish", 27, ["one-pan", "light"],
         [("white_fish", 180), ("white_beans", 150), ("peas", 60), ("mint", 3), ("olive_oil", 5), ("lemon", 10)],
         ["Warm the beans and peas in a pan with a splash of stock and the oil.", "Nestle in the fish, cover and simmer 8 minutes.", "Finish with mint and lemon."],
         ["stock cube", "garlic"]),
    meal("moroccan_fish_couscous", "White fish with Moroccan spices & couscous", ["lunch", "dinner", "iftar"], "fish", 30, [],
         [("white_fish", 200), ("couscous", 50), ("carrot", 60), ("chickpeas", 60), ("olive_oil", 5), ("lemon", 10)],
         ["Rub the fish with cumin, paprika and cinnamon.", "Roast at 200°C for 12 minutes with the carrots.", "Soak the couscous with the chickpeas; serve with lemon."],
         ["cumin", "paprika", "cinnamon", "salt"]),
    meal("sardines_chermoula", "Sardines with chermoula & potatoes", ["lunch", "dinner"], "fish", 15, ["quick", "budget"],
         [("sardines", 120), ("potato", 180), ("parsley", 10), ("coriander", 10), ("lemon", 10), ("olive_oil", 5), ("tomato", 80)],
         ["Boil or microwave the potatoes until tender.", "Blitz the herbs, lemon, oil, cumin and garlic into chermoula.", "Spoon over the sardines; serve with potatoes and tomato."],
         ["cumin", "garlic", "salt"]),
    meal("prawn_fried_rice", "Garlic prawn fried rice", ["lunch", "dinner"], "seafood", 20, [],
         [("shrimp", 160), ("rice", 60), ("egg", 1, "pc"), ("peas", 60), ("carrot", 40), ("soy_sauce", 10), ("olive_oil", 5)],
         ["Cook the rice ahead and let it cool.", "Stir-fry the garlic and prawns in the oil for 2 minutes.", "Add the vegetables and rice, push aside and scramble the egg, then toss with soy sauce."],
         ["garlic"]),
    meal("kung_pao_prawns", "Kung pao-style peanut prawns", ["lunch", "dinner"], "seafood", 20, ["air-fryer"],
         [("shrimp", 170), ("peanuts", 15), ("pepper", 80), ("zucchini", 80), ("rice", 60), ("soy_sauce", 15)],
         ["Air-fry or stir-fry the prawns with chilli for 6 minutes.", "Stir-fry the pepper and zucchini.", "Toss everything with soy sauce and the peanuts; serve with rice."],
         ["chilli flakes", "garlic", "ginger"]),
    meal("seafood_pasta", "Seafood pasta", ["lunch", "dinner"], "seafood", 20, [],
         [("shrimp", 120), ("squid", 80), ("pasta", 70), ("canned_tomato", 150), ("garlic", 8), ("olive_oil", 5)],
         ["Boil the pasta.", "Fry the garlic in the oil, add the tomatoes and simmer 5 minutes.", "Add the prawns and squid rings for 3 minutes; toss with the pasta."],
         ["chilli flakes", "salt"]),
    meal("grilled_squid_salad", "Grilled squid salad", ["lunch", "dinner"], "seafood", 25, ["light"],
         [("squid", 200), ("lettuce", 60), ("tomato", 80), ("cucumber", 80), ("potato", 150), ("olive_oil", 6), ("lemon", 10)],
         ["Boil the potatoes.", "Grill the squid rings 1-2 minutes in a very hot pan.", "Toss with the salad, potatoes, oil and lemon."],
         ["garlic", "salt"]),
    meal("tuna_pasta_bake", "Tuna pasta bake", ["lunch", "dinner"], "fish", 30, ["batch", "budget"],
         [("tuna", 120), ("pasta", 70), ("canned_tomato", 150), ("sweetcorn", 50), ("mozzarella", 25)],
         ["Boil the pasta and mix with the tomatoes, tuna and sweetcorn.", "Top with mozzarella and bake at 200°C for 15 minutes."],
         ["dried oregano"]),
    meal("light_koshari", "Light koshari with egg", ["lunch", "dinner", "iftar"], "legumes", 40, ["egyptian", "budget"],
         [("red_lentils", 50), ("rice", 35), ("pasta", 20), ("chickpeas", 60), ("canned_tomato", 150), ("onion", 60), ("olive_oil", 4), ("egg", 1, "pc")],
         ["Cook the lentils and rice together; boil the pasta.", "Simmer the tomatoes with garlic, cumin and vinegar.", "Crisp the onion in the oil; layer everything, top with chickpeas, sauce, onions and a boiled egg."],
         ["garlic", "cumin", "vinegar", "salt"]),
    meal("chickpea_spinach_curry", "Chickpea & spinach curry with eggs", ["lunch", "dinner"], "legumes", 25, ["budget"],
         [("chickpeas", 180), ("spinach", 100), ("canned_tomato", 150), ("egg", 2, "pc"), ("rice", 40), ("onion", 40)],
         ["Soften the onion with curry powder.", "Add the tomatoes and chickpeas, simmer 10 minutes, then wilt in the spinach.", "Serve with rice and halved boiled eggs."],
         ["curry powder", "garlic", "salt"]),
    meal("chicken_black_bean_quesadillas", "Chicken & black bean quesadillas", ["lunch", "dinner"], "chicken", 25, [],
         [("chicken_breast", 120), ("black_beans", 100), ("tortilla", 2, "pc"), ("mozzarella", 25), ("pepper", 60)],
         ["Cook and shred the chicken; mash the beans with cumin.", "Fill the wraps with beans, chicken, pepper and cheese.", "Toast in a dry pan 2-3 minutes a side and cut into wedges."],
         ["cumin", "chilli flakes"]),
    meal("chicken_cauliflower_rice", "Chicken kebabs with cauliflower rice", ["lunch", "dinner", "iftar"], "chicken", 35, ["light"],
         [("chicken_breast", 180), ("cauliflower", 200), ("pepper", 60), ("onion", 40), ("greek_yogurt", 60), ("olive_oil", 5)],
         ["Marinate the chicken in half the yogurt with paprika and garlic; thread with pepper and onion.", "Grill 12 minutes, turning.", "Grate the cauliflower and stir-fry in the oil for 5 minutes; serve with the rest of the yogurt."],
         ["paprika", "garlic", "salt"]),
    meal("stuffed_eggplant", "Beef-stuffed eggplant (betengan mahshi)", ["lunch", "dinner", "iftar"], "beef", 45, ["egyptian"],
         [("beef_mince", 130), ("eggplant", 250), ("canned_tomato", 120), ("rice", 30), ("onion", 40), ("olive_oil", 5)],
         ["Halve the eggplant, scoop out some flesh and roast at 200°C for 15 minutes.", "Brown the mince with onion, the chopped flesh, rice and seven spice.", "Fill the eggplant, pour over the tomatoes and bake 20 minutes."],
         ["seven spice", "salt"]),
    meal("iftar_chicken_veg_soup", "Chicken & vegetable soup", ["iftar", "lunch", "dinner"], "chicken", 30, ["light", "batch"],
         [("chicken_breast", 150), ("carrot", 60), ("zucchini", 80), ("potato", 80), ("onion", 40), ("bread", 1, "pc")],
         ["Simmer everything except the bread in 600 ml stock for 20 minutes.", "Shred the chicken back in; serve with the bread.", "A gentle way to break the fast."],
         ["stock cube", "black pepper"]),
    meal("light_chicken_fattah", "Light chicken fattah", ["iftar", "lunch", "dinner"], "chicken", 35, ["egyptian"],
         [("chicken_breast", 160), ("rice", 50), ("pita", 0.5, "pc"), ("greek_yogurt", 80), ("garlic", 5), ("canned_tomato", 80)],
         ["Simmer the chicken in water with cardamom and a bay leaf, then slice.", "Toast the pita and break it into a dish, moistened with a little stock.", "Layer the rice, a garlicky tomato sauce, the chicken, and the yogurt on top."],
         ["cardamom", "bay leaf", "vinegar", "salt"]),
    meal("shish_tawook_plate", "Shish tawook with garlic yogurt & salad", ["iftar", "lunch", "dinner"], "chicken", 30, ["batch"],
         [("chicken_breast", 180), ("greek_yogurt", 60), ("garlic", 5), ("tomato", 80), ("cucumber", 80), ("pita", 1, "pc"), ("lemon", 10)],
         ["Marinate chicken cubes in yogurt, lemon, garlic and paprika for 20 minutes.", "Grill on skewers 10-12 minutes.", "Serve with the pita, salad and a little more garlicky yogurt."],
         ["paprika", "salt"]),
    # snacks
    meal("banana_protein_shake", "Banana protein shake", ["snack", "suhoor"], "dairy", 3, ["quick", "no-cook"],
         [("whey", 1, "pc"), ("milk", 250), ("banana", 1, "pc")],
         ["Blend everything with a few ice cubes."]),
    meal("salted_edamame", "Salted edamame", ["snack"], "legumes", 5, ["quick"],
         [("edamame", 150)],
         ["Boil or microwave the edamame for 4 minutes.", "Sprinkle with salt and chilli and pop them from the pods."],
         ["salt", "chilli flakes"]),
    meal("cottage_pineapple", "Cottage cheese & pineapple", ["snack"], "dairy", 2, ["quick", "no-cook"],
         [("cottage_cheese", 180), ("pineapple", 80)],
         ["Top the cottage cheese with chopped pineapple."]),
    meal("tuna_cucumber_boats", "Tuna cucumber boats", ["snack"], "fish", 5, ["quick", "no-cook"],
         [("tuna", 80), ("cucumber", 150), ("greek_yogurt", 30)],
         ["Halve the cucumber lengthways and scoop out the seeds.", "Fill with tuna mixed with the yogurt and black pepper."],
         ["black pepper"]),
    meal("turkey_roll_ups", "Turkey & cheese roll-ups", ["snack"], "turkey", 5, ["quick"],
         [("turkey_breast", 80), ("mozzarella", 20), ("cucumber", 80)],
         ["Roll slices of cooked turkey breast around sticks of cheese and cucumber."],
         ["mustard"]),
    meal("egg_avocado_toast", "Egg & avocado toast", ["snack", "breakfast"], "eggs", 10, ["quick"],
         [("egg", 1, "pc"), ("avocado", 40), ("bread", 1, "pc")],
         ["Toast the bread and mash the avocado on it.", "Top with a fried or boiled egg and chilli flakes."],
         ["chilli flakes", "salt"]),
    meal("yogurt_mango", "Greek yogurt with mango", ["snack", "suhoor"], "dairy", 3, ["quick", "no-cook"],
         [("greek_yogurt", 200), ("mango", 100)],
         ["Top the yogurt with diced mango."]),
    meal("watermelon_feta", "Watermelon & feta", ["snack", "iftar"], "dairy", 5, ["quick", "no-cook", "light"],
         [("watermelon", 250), ("feta", 30), ("mint", 2)],
         ["Cube the watermelon, crumble the feta over and add torn mint."]),
    meal("dates_peanuts_milk", "Dates, peanuts & milk", ["snack", "iftar"], "dairy", 1, ["quick", "no-cook"],
         [("dates", 2, "pc"), ("peanuts", 15), ("milk", 200)],
         ["Break the fast, or snack, with the dates, a few peanuts and a glass of milk."]),
    meal("iftar_lentil_soup_cup", "Lentil soup cup & dates", ["snack", "iftar"], "legumes", 25, ["egyptian", "budget", "batch"],
         [("red_lentils", 40), ("carrot", 40), ("onion", 40), ("dates", 2, "pc"), ("lemon", 5)],
         ["Simmer the lentils, carrot and onion in stock with cumin for 20 minutes and blend.", "Start the iftar with the dates and a cup of soup."],
         ["cumin", "stock cube"]),
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
