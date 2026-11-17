"""Fetch the meal-library photos the phone app bundles.

    python scripts/fetch_meal_photos.py mobile/public/meal-photos

Downloads each photo in content/meal_photos.py from Wikimedia Commons and
writes, per meal:

    <out>/<key>.webp        the photo, WIDTH px wide
    <out>/<key>-thumb.webp  a THUMB px thumbnail for list rows
    <out>/NOTICE.txt        every photo's credit and licence

Pillow does the WebP conversion (CI installs it; see android.yml).
Photos already there are kept, so a rebuild downloads nothing new. The
output is gitignored. Commons limits request rates, so thumbnails come
from its API (cached), downloads are spaced out and retried, and a photo
that still fails is skipped (the app shows a placeholder) and listed.
"""

import io
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from content.meal_photos import MEAL_PHOTOS  # noqa: E402

WIDTH = 640
THUMB = 112  # rows show photos at 56 px; 2x for sharp screens
QUALITY = 70
UA = "FitnessOS-build/1.0 (meal photos for a personal app)"

try:
    from PIL import Image
except ImportError:  # pragma: no cover - CI and dev installs have it
    Image = None


def thumb_urls(titles: list[str]) -> dict[str, str]:
    """Commons' own WIDTH px thumbnails for the titles, 20 per API call.
    Thumbnails are cached by Wikimedia, which keeps us inside its limits."""
    out = {}
    for i in range(0, len(titles), 20):
        batch = titles[i : i + 20]
        q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": str(WIDTH), "titles": "|".join(batch)})
        data = json.loads(download(f"https://commons.wikimedia.org/w/api.php?{q}"))
        norm = {n["to"]: n["from"] for n in data.get("query", {}).get("normalized", [])}
        for page in data.get("query", {}).get("pages", {}).values():
            info = (page.get("imageinfo") or [{}])[0]
            url = info.get("thumburl") or info.get("url")
            if url:
                out[norm.get(page["title"], page["title"])] = url
        time.sleep(1)
    return out


def download(url: str) -> bytes:
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except OSError:
            time.sleep(15 * (attempt + 1))
    raise OSError(f"Could not download {url}")


def save_webp(data: bytes, dest: Path, width: int) -> None:
    with Image.open(io.BytesIO(data)) as im:
        im = im.convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(dest, "WEBP", quality=QUALITY, method=6)


def main() -> None:
    if Image is None:
        raise SystemExit("Pillow is needed for the meal photos: pip install pillow")
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "meal-photos")
    out.mkdir(parents=True, exist_ok=True)
    todo = {key: title for key, (title, _a, _l) in MEAL_PHOTOS.items() if not ((out / f"{key}.webp").exists() and (out / f"{key}-thumb.webp").exists())}
    urls = thumb_urls(sorted(set(todo.values()))) if todo else {}
    missing = []
    for key, title in sorted(todo.items()):
        try:
            data = download(urls[title])
        except (KeyError, OSError):
            missing.append(key)
            continue
        save_webp(data, out / f"{key}.webp", WIDTH)
        save_webp(data, out / f"{key}-thumb.webp", THUMB)
        time.sleep(3)
    notice = ["Meal photos from Wikimedia Commons (https://commons.wikimedia.org), under the licences below.", ""]
    notice += [f"{key}: {title}, by {author}, {licence}" for key, (title, author, licence) in sorted(MEAL_PHOTOS.items())]
    (out / "NOTICE.txt").write_text("\n".join(notice) + "\n", encoding="utf-8")
    print(f"{len(MEAL_PHOTOS) - len(missing)} of {len(MEAL_PHOTOS)} meal photos in {out}")
    if missing:
        # The app shows a placeholder for these; a later run fetches them.
        print("Not downloaded this time (Commons rate limit?): " + ", ".join(missing))


if __name__ == "__main__":
    main()
