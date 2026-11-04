"""Fetch the public-domain exercise photos the phone app bundles.

    python scripts/fetch_exercise_photos.py mobile/public/exercise-db

Downloads free-exercise-db (https://github.com/yuhonas/free-exercise-db,
Unlicense) at the commit pinned in content/exercise_photos.py and writes:

    <out>/index.json        one slim entry per exercise (name, muscles,
                            equipment, level, instructions, photo paths)
    <out>/img/<id>/<n>.webp the photos (or .jpg when Pillow isn't installed)
    <out>/NOTICE.txt        where the photos come from

The output is gitignored, so the repo stays small; the APK build runs this
every time and skips the download when <out> already holds the pinned
commit. Only these public-domain photos are used: openGym's exercise media
is licensed from Gym visual and must never be fetched (see CLAUDE.md).
"""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from content.exercise_photos import EXERCISE_DB_COMMIT, EXERCISE_DB_REPO, EXERCISE_PHOTOS  # noqa: E402

WEBP_QUALITY = 70
MAX_WIDTH = 850  # the dataset's photos are 750-850 px wide; never upscale
THUMB_WIDTH = 112  # list rows show photos at 56 px; 2x for sharp screens

try:
    from PIL import Image
except ImportError:  # Pillow is optional: without it the JPGs are copied as is (bigger APK)
    Image = None


def _clone(dest: Path) -> None:
    def git(*args: str) -> None:
        subprocess.run(["git", *args], cwd=dest, check=True)

    dest.mkdir(parents=True, exist_ok=True)
    git("init", "-q")
    git("remote", "add", "origin", EXERCISE_DB_REPO)
    git("fetch", "-q", "--depth", "1", "origin", EXERCISE_DB_COMMIT)
    git("checkout", "-q", "FETCH_HEAD")


def _write_thumb(src: Path, dest_stem: Path) -> str | None:
    """A small WebP for list rows, so lists don't decode full photos.
    Without Pillow there is no thumbnail and rows use the photo itself."""
    if Image is None:
        return None
    dest_stem.parent.mkdir(parents=True, exist_ok=True)
    out = dest_stem.with_suffix(".webp")
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > THUMB_WIDTH:
            im = im.resize((THUMB_WIDTH, round(im.height * THUMB_WIDTH / im.width)))
        im.save(out, "WEBP", quality=WEBP_QUALITY, method=6)
    return out.name


def _write_photo(src: Path, dest_stem: Path) -> str:
    dest_stem.parent.mkdir(parents=True, exist_ok=True)
    if Image is None:
        out = dest_stem.with_suffix(".jpg")
        shutil.copyfile(src, out)
        return out.name
    out = dest_stem.with_suffix(".webp")
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > MAX_WIDTH:
            im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)))
        im.save(out, "WEBP", quality=WEBP_QUALITY, method=6)
    return out.name


def build(source: Path, out: Path) -> dict:
    exercises = json.loads((source / "dist" / "exercises.json").read_text(encoding="utf-8"))
    known = {e["id"] for e in exercises}
    missing = sorted(set(EXERCISE_PHOTOS.values()) - known)
    if missing:
        raise SystemExit(f"content/exercise_photos.py points at ids the dataset doesn't have: {missing}")

    entries = []
    for e in exercises:
        photos = []
        thumb = None
        for i, rel in enumerate(e.get("images", [])):
            src = source / "exercises" / rel
            if not src.is_file():
                print(f"warning: {e['id']} lists a missing photo {rel}", file=sys.stderr)
                continue
            name = _write_photo(src, out / "img" / e["id"] / str(i))
            photos.append(f"img/{e['id']}/{name}")
            if thumb is None:
                t = _write_thumb(src, out / "img" / e["id"] / "thumb")
                thumb = f"img/{e['id']}/{t}" if t else None
        entries.append(
            {
                "id": e["id"],
                "name": e["name"],
                "level": e.get("level"),
                "equipment": e.get("equipment"),
                "category": e.get("category"),
                "force": e.get("force"),
                "mechanic": e.get("mechanic"),
                "primary": e.get("primaryMuscles", []),
                "secondary": e.get("secondaryMuscles", []),
                "instructions": e.get("instructions", []),
                "photos": photos,
                "thumb": thumb,
            }
        )
    entries.sort(key=lambda x: x["name"].lower())
    index = {
        "source": EXERCISE_DB_REPO,
        "commit": EXERCISE_DB_COMMIT,
        "license": "Unlicense (public domain)",
        "exercises": entries,
    }
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out / "NOTICE.txt").write_text(
        f"Exercise photos and text: free-exercise-db, {EXERCISE_DB_REPO} (commit {EXERCISE_DB_COMMIT}),\n"
        "released into the public domain under the Unlicense.\n",
        encoding="utf-8",
    )
    return index


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "exercise-db")
    index_file = out / "index.json"
    if index_file.is_file():
        try:
            if json.loads(index_file.read_text(encoding="utf-8")).get("commit") == EXERCISE_DB_COMMIT:
                print(f"{out} already has free-exercise-db {EXERCISE_DB_COMMIT[:7]}, skipping")
                return
        except json.JSONDecodeError:
            pass  # a half-written index from an interrupted run: rebuild it
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    with tempfile.TemporaryDirectory() as tmp:
        _clone(Path(tmp))
        index = build(Path(tmp), out)
    photos = sum(len(e["photos"]) for e in index["exercises"])
    size_mb = sum(p.stat().st_size for p in out.rglob("*") if p.is_file()) / 1e6
    print(f"Wrote {len(index['exercises'])} exercises and {photos} photos to {out} ({size_mb:.0f} MB)")
    if Image is None:
        print("note: Pillow isn't installed, so the photos are full-size JPGs", file=sys.stderr)


if __name__ == "__main__":
    main()
