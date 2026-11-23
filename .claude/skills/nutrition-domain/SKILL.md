---
name: nutrition-domain
description: Use when writing or reviewing anything nutrition-related in Tafra: meal library and meal plan content (content/meal_library.py, content/meal_plan.py, content/ingredients.py), calorie and macro maths (mobile/src/lib/macros.js), portion scaling, the shopping list, Ramadan or maintenance. Keeps new content and logic consistent with the rules already set.
---

# Nutrition rules

The app's targets and meal plan follow one set of rules. Changing them, even towards something that sounds healthier, is a product decision, not a fix.

## Food rules (hard)

- **No pork, no alcohol** anywhere in the meal library (`tests/test_meal_library.py` bans the words). Fish and seafood are fine.
- **One meal library.** Every meal lives in `content/meal_library.py`, tagged by the meals of the day it suits (breakfast, lunch, dinner, snack, suhoor, iftar), main protein and tags. The 14-day plan (`PLAN_DAYS` in `content/meal_plan.py`) puts a default library meal in each slot, and people swap any slot for another meal that suits it (`mobile/src/lib/mealLibrary.js`). Day 14 is a refeed day.
- **Numbers come from ingredients**, never typed in: each meal lists portions of `content/ingredients.py` rows (USDA FoodData Central, public domain, FDC id per row). Steps are written in our own words; no third-party recipe text or photos.
- **A plan, not a food log.** Meals are ticked, swapped or scaled. People can add their own foods (`myFoods.js`), but there's no food search, barcode scanning or food database (PRODUCT.md "Won't now").

## Targets: `mobile/src/lib/macros.js` is the only source

`content/tdee.py` is a frozen old copy; the app's maths lives in `macros.js` and its tests.

1. **BMR** Mifflin-St Jeor, times an activity multiplier (sedentary 1.2 to very active 1.9) = TDEE. With enough watch days and the setting on, measured active calories replace the multiplier (`activity.js`).
2. **By goal direction:**
   - *lose:* the deficit for the pace to the goal weight by the goal date, capped at 25% of TDEE (`max_deficit_share` from `scripts/export_content.py`, one limit for everyone), 1000 kcal a day and 1% of body weight a week, and never below 1500 kcal (men) / 1200 (women);
   - *recomp:* a small deficit of 10-15% of TDEE (12.5% default), same floors;
   - *maintain:* TDEE; *gain:* TDEE + 300 kcal.
3. **Protein** 2.0 / 2.2 / 1.8 / 1.6 g per kg of **goal** weight (lose / recomp / maintain / gain); **fat** 0.8 g/kg of goal weight; carbs fill the rest.
4. **Safety gates win** (`safety.js`): a gated person gets no deficit, capped protein (1.2 g/kg), or hidden numbers; nursing adds 400 kcal. Skipped screening counts as gated.
5. **Ramadan** caps the deficit at 15% (`ramadan.js`); after the goal, **maintenance** steps calories back up (`maintenance.js`).
6. Never hand-pick a number (no flat "500 kcal deficit"). The target, the pace band and the goal date all come from the same maths, so they can't disagree.

## Portions and shopping

- `portions.js` gives everyone one factor: their kcal target over the plan's normal day. Inside 0.95-1.05 nothing changes; 0.7-1.4 scales portions in kitchen steps (carbs and fat move first, protein last); outside that the plan shows unscaled with a calm note.
- `shopping.js` builds the week's list from the meals actually shown (swaps included), merged by ingredient key, so "1 clove garlic" and "2 cloves garlic" are one line.

## Eating out

`content/eating_out_guide.py` tips are keyed by meal slot and stay practical swaps ("grilled, not fried"), not general nutrition advice.
