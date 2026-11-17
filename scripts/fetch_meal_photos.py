"""Fetch the meal-library photos the phone app bundles.

    python scripts/fetch_meal_photos.py mobile/public/meal-photos

Downloads each photo in content/meal_photos.py from Wikimedia Commons and
writes, per meal:

    <out>/<key>.webp        the photo, WIDTH px wide
    <out>/<key>-thumb.webp  a THUMB px thumbnail for list rows
    <out>/NOTICE.txt        every photo's credit and licence

Pillow does the WebP conversion (CI installs it; see android.yml).
Photos already there are kept, so a rebuild downloads nothing new. The
output is gitignored. Commons limits request rates, so downloads are
spaced out and retried with a growing pause.
"""

import io
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


def photo_url(title: str) -> str:
    """Commons serves a scaled copy at this address (it may round the width up)."""
    name = title.removeprefix("File:")
    return f"https://commons.wikimedia.org/w/index.php?title=Special:FilePath/{urllib.parse.quote(name)}&width={WIDTH}"


def download(url: str) -> bytes:
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except OSError:
            time.sleep(20 * (attempt + 1))
    raise SystemExit(f"Could not download {url}")


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
    notice = ["Meal photos from Wikimedia Commons (https://commons.wikimedia.org), under the licences below.", ""]
    for key, (title, author, licence) in sorted(MEAL_PHOTOS.items()):
        photo, thumb = out / f"{key}.webp", out / f"{key}-thumb.webp"
        if not (photo.exists() and thumb.exists()):
            data = download(photo_url(title))
            save_webp(data, photo, WIDTH)
            save_webp(data, thumb, THUMB)
            time.sleep(2)
        notice.append(f"{key}: {title}, by {author}, {licence}")
    (out / "NOTICE.txt").write_text("\n".join(notice) + "\n", encoding="utf-8")
    print(f"{len(MEAL_PHOTOS)} meal photos in {out}")


if __name__ == "__main__":
    main()
