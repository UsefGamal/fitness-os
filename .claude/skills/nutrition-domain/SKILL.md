---
name: nutrition-domain
description: Use when writing or reviewing anything nutrition-related in Fitness OS — meal plan content (content/meal_plan.py, content/food_items.py), macro/calorie math (macro_targets.py, content/tdee.py), the Edamam sync's query/filter logic, or the eating-out guide. Encodes the diet rules and calculation methodology already established, so new content or logic doesn't quietly contradict it.
---

# Nutrition domain rules

This app has one real diet spec, not general nutrition best practices — deviating from it (even with something nutritionally "healthier") is a regression, not an improvement, unless the user has explicitly changed the spec in `models.Profile` or asked for it.

## Diet constraints (hard rules)

- **No fish/seafood, ever** — stated explicitly in the README's philosophy. Not even in a "healthy option."
- **No pork, no alcohol, no shellfish** — enforced via Edamam's `HEALTH_LABELS = ["pork-free", "alcohol-free", "shellfish-free"]` in `edamam_sync.py`, and via `PORK_EXCLUDED_SETS` in `fitchef_sync.py` (a weaker guarantee — FitChef only has per-ingredient bacon/ham excludes, no generic "pork" tag; don't treat it as equivalent to Edamam's label).
- **Two options per meal slot**, Egyptian-leaning (`option_a`) and Syrian/grilled-leaning (`option_b`) — both macro-matched to the same daily band. A new meal/recipe addition needs both, not just one.
- **Structured portions, not calorie-counting** — the user philosophy is explicit two-option meals with fixed items, not an open food log. Don't propose free-form calorie/macro entry as a "simpler" alternative; that's a different product than this one.

## Calorie/macro methodology — don't hand-pick numbers

`macro_targets.get_macro_targets()` is the only source of truth for daily targets, and it's a real calculation, not a constant:
1. **BMR**: Mifflin-St Jeor (`content/tdee.py bmr_mifflin_st_jeor`) — `10×weight + 6.25×height − 5×age (+5 male / −161 female)`.
2. **TDEE**: BMR × activity multiplier (`ACTIVITY_MULTIPLIERS`, sedentary 1.2 → very_active 1.9).
3. **Deficit**: derived from `baseline.py`'s `target_rate_kg_per_week` — the pace *already implied* by the profile's own goal weight and goal date — converted via `KCAL_PER_KG_FAT = 7700`, capped to `MAX_DAILY_DEFICIT = 1000` and floored at `MIN_DAILY_KCAL = 1200`. Never hand-pick a deficit (no generic "500 kcal/day") — the whole point of this design is that the calorie target and the dashboard's predicted-goal-date projection can never silently disagree with each other. If you change one, you change both, because they share this one calculation.
4. **Macro split**: protein `PROTEIN_G_PER_KG = 2.0` (high end of evidence-based range for a cut, favors muscle retention on a deficit), fat `FAT_G_PER_KG = 0.8` (hormonal-health floor, independent of deficit size), carbs fill the remainder.
5. **Fallback**: `content.meal_plan.MACRO_TARGETS` (static band) when there isn't enough profile data yet (no weight logged, or age outside `MIN_AGE_YEARS`/`MAX_AGE_YEARS`) — this is the *only* place a fixed constant belongs; don't reintroduce fixed numbers anywhere else in the calculation path.

Refeed day (day 14 of the 14-day rotation, `is_refeed`) is a genuine higher-calorie day (~2400-2600 kcal per the README), same protein target (preserve muscle) with extra carbs/fat — see `fitchef_sync.py`'s `REFEED_EXTRA_CARBS_G`/`REFEED_EXTRA_FAT_G` for the exact shape if adding a refeed-aware feature elsewhere.

## Edamam sync specifics (if touching edamam_sync.py/edamam_client.py)

- Recipe macros come back **per whole recipe** — always divide by `yield` (servings) before using a number anywhere else in the app; `normalize_recipe()` already does this, don't re-derive it differently elsewhere.
- Two distinct ingredient representations exist for two distinct jobs: `ingredients` (exact per-recipe phrasing, e.g. "4 boneless chicken breasts") is for *display*; `structured_ingredients` (normalized food name + foodId + weight in grams) is for the *shopping list*, specifically so "1 clove garlic" / "2 cloves garlic" merge into one line instead of listing near-duplicates. Using the display form for aggregation was a real shipped bug — don't reintroduce it.
- Edamam's real per-account rate limit is much tighter than documented — see `sync-job-pattern` for the retry/backoff handling this requires; don't add a new Edamam call site that skips `edamam_client.search_recipes()`'s existing retry wrapper.

## Eating-out guidance

`content/eating_out_guide.py`'s tips are keyed by meal-slot bucket (`breakfast`/`lunch`/`dinner`/`snack`), shown per-meal on `/meals` plus a general set. New tips should stay practical/swap-oriented ("choose grilled over fried") consistent with the existing tone, not generic nutrition advice — the user already has the structured plan; eating-out tips exist for the exception case.
