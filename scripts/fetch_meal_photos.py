"""Fetch the meal-library photos the phone app bundles.

    python scripts/fetch_meal_photos.py mobile/public/meal-photos

Downloads each photo in content/meal_photos.py from Wikimedia Commons at
WIDTH px and writes <out>/<meal key>.jpg plus NOTICE.txt with every
credit. Photos already there are kept, so a rebuild downloads nothing.
The output is gitignored.
"""

import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from content.meal_photos import MEAL_PHOTOS  # noqa: E402

WIDTH = 640
UA = "FitnessOS-build/1.0 (meal photos; contact via repository)"


def photo_url(title: str) -> str:
    name = title.removeprefix("File:")
    return f"https://commons.wikimedia.org/w/index.php?title=Special:FilePath/{urllib.parse.quote(name)}&width={WIDTH}"


def fetch(url: str, dest: Path) -> None:
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                dest.write_bytes(r.read())
            return
        except OSError:
            time.sleep(10 * (attempt + 1))
    raise SystemExit(f"Could not download {url}")


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "meal-photos")
    out.mkdir(parents=True, exist_ok=True)
    notice = ["Meal photos from Wikimedia Commons (https://commons.wikimedia.org), under the licences below.", ""]
    for key, (title, author, licence) in sorted(MEAL_PHOTOS.items()):
        dest = out / f"{key}.jpg"
        if not dest.exists():
            fetch(photo_url(title), dest)
            time.sleep(1)
        notice.append(f"{key}.jpg: {title}, by {author}, {licence}")
    (out / "NOTICE.txt").write_text("\n".join(notice) + "\n", encoding="utf-8")
    print(f"{len(MEAL_PHOTOS)} meal photos in {out}")


if __name__ == "__main__":
    main()
