"""The photo mapping (content/exercise_photos.py) and the fetch script."""

import json
import sys
from pathlib import Path

from content.exercise_photos import EXERCISE_DB_COMMIT, EXERCISE_PHOTOS
from content.gym_exercises import SEED_EXERCISES

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import fetch_exercise_photos  # noqa: E402


def _our_names() -> set[str]:
    names = {name for _group, name, *_ in SEED_EXERCISES}

    def walk(value):
        if isinstance(value, dict):
            if isinstance(value.get("name"), str):
                names.add(value["name"])
            for v in value.values():
                walk(v)
        elif isinstance(value, list):
            for v in value:
                walk(v)

    walk(json.loads((ROOT / "content" / "trainer_plan.json").read_text(encoding="utf-8")))
    from content import home_program

    walk(home_program.PROGRAM)
    return names


def test_mapping_only_names_exercises_we_have():
    assert set(EXERCISE_PHOTOS) <= _our_names()


def test_commit_is_pinned():
    assert len(EXERCISE_DB_COMMIT) == 40


def test_build_writes_slim_index_and_photos(tmp_path):
    src = tmp_path / "src"
    (src / "dist").mkdir(parents=True)
    ids = sorted(set(EXERCISE_PHOTOS.values()))
    exercises = []
    for i, ex_id in enumerate(ids):
        images = []
        if i == 0:
            (src / "exercises" / ex_id).mkdir(parents=True)
            for n in range(2):
                (src / "exercises" / ex_id / f"{n}.jpg").write_bytes(_tiny_jpg())
                images.append(f"{ex_id}/{n}.jpg")
        exercises.append(
            {
                "id": ex_id,
                "name": ex_id.replace("_", " "),
                "primaryMuscles": ["chest"],
                "secondaryMuscles": [],
                "instructions": ["Do it."],
                "images": images,
            }
        )
    (src / "dist" / "exercises.json").write_text(json.dumps(exercises))
    out = tmp_path / "out"
    out.mkdir()
    index = fetch_exercise_photos.build(src, out)
    assert index["commit"] == EXERCISE_DB_COMMIT
    first = next(e for e in index["exercises"] if e["id"] == ids[0])
    assert len(first["photos"]) == 2
    assert all((out / p).is_file() for p in first["photos"])
    assert json.loads((out / "index.json").read_text())["exercises"][0]["instructions"] == ["Do it."]


def _tiny_jpg() -> bytes:
    # 1x1 white JPEG.
    import base64

    return base64.b64decode(
        "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k="
    )
