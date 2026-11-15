"""Photos for the meal library, from Wikimedia Commons under open licences
(CC0, public domain, CC BY, CC BY-SA). Each photo shows the same dish or a
close one; meals with no good match stay without a photo.

scripts/fetch_meal_photos.py downloads them into mobile/public/meal-photos
(gitignored) at build time, and the meal page shows each photo's credit.
No photo comes from a recipe site.

meal key -> (Commons file title, author, licence)
"""

MEAL_PHOTOS = {}
