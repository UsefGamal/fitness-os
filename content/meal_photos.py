"""Photos for the meal library, from Wikimedia Commons under open licences
(CC0, public domain, CC BY, CC BY-SA). Each photo shows the same dish or a
close one; meals with no good match stay without a photo.

scripts/fetch_meal_photos.py downloads them into mobile/public/meal-photos
(gitignored) at build time, and the meal page shows each photo's credit.
No photo comes from a recipe site.

meal key -> (Commons file title, author, licence)
"""

MEAL_PHOTOS = {
    "shakshuka_feta": ("File:Shakshuka1.jpg", "Joe Mahoney", "CC BY 2.0"),
    "ful_eggs": ("File:Breakfast in Cairo.jpg", "H. Hakan Atik", "CC BY-SA 4.0"),
    "berry_oats": ("File:Mannapuuroa ja mansikkaa.jpg", "Kotivalo", "CC BY-SA 4.0"),
    "spinach_scramble": ("File:Potatoes, Spinach & Scrambled Eggs (4419885608).jpg", "Katrin Gilger", "CC BY-SA 2.0"),
    "cheese_omelette": ("File:Omelette with bread and parsley 01.jpg", "Krzysztof Golik", "CC BY-SA 4.0"),
    "banana_pancakes": ("File:Nutella Banana Pancakes - Laughing Dog 2026-08-25.jpg", "Andy Li", "CC0"),
    "egyptian_breakfast_plate": ("File:Delcious Egyptian breakfast at nubian village Gharb Soheil, Arti ka Hotel & Restaurant, Aswan at 7 September 2021.jpg", "Same7.sabry", "CC BY-SA 4.0"),
    "turkey_egg_wrap": ("File:Egg Tortilla Wrap (8728191788).jpg", "LeonardKong", "CC BY 2.0"),
    "beef_broccoli_stirfry": ("File:Beef and broccoli stir fry.jpg", "Joy", "CC BY 2.0"),
    "chicken_caesar": ("File:Chicken Caesar salad - Auckland, New Zealand.jpg", "Daderot", "CC0"),
    "tuna_bean_salad": ("File:Insalata di Fagioli e Tonno – Bohnensalat mit Thunfisch (7327273414).jpg", "Katrin Gilger", "CC BY-SA 2.0"),
    "adana_kebab_bulgur": ("File:Adana kebab.jpg", "Anatolianpride", "Public domain"),
    "chicken_pasta": ("File:Fresh Chicken in Tomato Sauce Pasta.jpg", "Ralff Nestor Nacor", "CC BY-SA 4.0"),
    "tikka_kebabs_rice": ("File:Chicken Tikka Kebab.jpg", "Sumit Surai", "CC BY-SA 4.0"),
    "chicken_burrito_bowl": ("File:Los Gallitos - October 31 2022 - Sarah Stierch 04.jpg", "Missvain", "CC BY 4.0"),
    "light_chicken_korma": ("File:Chicken White Qorma (Korma).JPG", "Miansari66", "CC0"),
    "turkey_noodle_soup": ("File:Noodle soup, Rostov-on-Don, Russia.jpg", "Vyacheslav Argenberg", "CC BY 4.0"),
    "baked_salmon_potatoes": ("File:Liat Portal for Foodie Disorder - Oven-baked teriyaki salmon with vegetables.jpg", "HaJunkiyada", "CC BY-SA 4.0"),
    "baked_cod_tomatoes": ("File:Baked Fish with Tomato Sauce with Lemon Slices.jpg", "Peachyeung316", "CC BY-SA 4.0"),
    "beef_salsa_burger": ("File:NCI Visuals Food Hamburger.jpg", "Len Rizzi (photographer)", "Public domain"),
    "sticky_lemon_chicken": ("File:Lemon and Honey Grilled Chicken Wings.jpg", "Peachyeung316", "CC BY-SA 4.0"),
    "shrimp_noodles": ("File:Shrimp on Taiwan noodles, with olive oil, pesto, garlic, and black pepper - Massachusetts.jpg", "Daderot", "CC0"),
    "steak_roast_veg": ("File:Liat Portal for Foodie Disorder - Sirloin steak with Tu B’Shvat vegetables.jpg", "HaJunkiyada", "CC BY-SA 4.0"),
    "lentil_soup_chicken": ("File:Homemade Lentil Soup - Lavash 2025-02-10.jpg", "Andy Li", "CC0"),
    "chicken_fajita_wraps": ("File:Chicken fajitas - La Hacienda - Sarah Stierch.jpg", "Missvain", "CC BY 4.0"),
    "bolti_tagine": ("File:Tajine marocain.jpg", "Bawdeep2010", "CC BY-SA 4.0"),
    "yogurt_berries": ("File:Strawberries & Yogurt.jpg", "Youmna9115", "CC0"),
    "cottage_cucumber": ("File:Liat Portal for Foodie Disorder - Cottage cheese and vegetables on rice cakes.jpg", "HaJunkiyada", "CC BY-SA 4.0"),
    "boiled_eggs_snack": ("File:Boiled Egg - Crossection.jpg", "Ramesh NG", "CC BY-SA 2.0"),
    "roasted_chickpeas": ("File:Leblebi.jpg", "Physicistjedi", "Public domain"),
    "overnight_chia_oats": ("File:Muesli.jpg", "VirtualSteve", "CC BY-SA 2.5"),
    "iftar_chicken_bulgur": ("File:Fattoush.JPG", "Unknown author", "Public domain"),
}
