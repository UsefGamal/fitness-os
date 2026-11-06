# The simple Meals page (E3-S9): targets and general guidance instead of a
# fixed 14-day menu, for people who cook their own food. The friends build
# opens Meals in this view; anyone can switch to the full meal plan. Foods
# are everyday ones found in most supermarkets, not one country's dishes.
# Protein per serving is rounded from USDA FoodData Central values.

PROTEIN_FOODS = [
    {"name": "Chicken breast, cooked", "serving": "150 g", "protein_g": 45},
    {"name": "Tuna, canned in water", "serving": "1 can (120 g drained)", "protein_g": 30},
    {"name": "Lean beef mince, cooked", "serving": "120 g", "protein_g": 30},
    {"name": "Salmon or white fish, cooked", "serving": "150 g", "protein_g": 33},
    {"name": "Eggs", "serving": "3 large", "protein_g": 19},
    {"name": "Greek yogurt, plain", "serving": "200 g", "protein_g": 20},
    {"name": "Cottage cheese", "serving": "200 g", "protein_g": 22},
    {"name": "Milk", "serving": "1 glass (250 ml)", "protein_g": 8},
    {"name": "Lentils or beans, cooked", "serving": "1 cup (200 g)", "protein_g": 18},
    {"name": "Tofu, firm", "serving": "150 g", "protein_g": 22},
    {"name": "Whey protein", "serving": "1 scoop (30 g)", "protein_g": 24},
]

PLATE_GUIDE = [
    "Half the plate vegetables or salad.",
    "A palm-sized portion of protein (one or two palms for men).",
    "A cupped hand of carbs: rice, potatoes, bread, pasta or fruit.",
    "A thumb of fat: oil, butter, nuts, cheese or avocado.",
]

MEALS_PER_DAY = 4
