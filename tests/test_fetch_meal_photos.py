"""scripts/fetch_meal_photos.py keeps photos across runs, refetches a
meal's photo when its Commons file changes, and never leaves a photo
under the wrong credit. No network: downloads are faked."""

import io
import json
import sys

import pytest

PIL = pytest.importorskip("PIL.Image")

sys.path.insert(0, "scripts")
import fetch_meal_photos as F  # noqa: E402


def _jpeg():
    buf = io.BytesIO()
    PIL.new("RGB", (1000, 600), (200, 100, 50)).save(buf, "JPEG")
    return buf.getvalue()


@pytest.fixture
def run(tmp_path, monkeypatch):
    fetched = []

    def thumb_urls(titles):
        return {t: f"https://x/{t}" for t in titles}

    def download(url, deadline=float("inf")):
        fetched.append(url)
        if "broken" in url:
            raise OSError("nope")
        return _jpeg()

    monkeypatch.setattr(F, "thumb_urls", thumb_urls)
    monkeypatch.setattr(F, "download", download)
    monkeypatch.setattr(F.time, "sleep", lambda s: None)
    monkeypatch.delenv("MEAL_PHOTOS_SKIP", raising=False)
    monkeypatch.delenv("MEAL_PHOTOS_BUDGET", raising=False)

    def go(photos):
        monkeypatch.setattr(F, "MEAL_PHOTOS", photos)
        monkeypatch.setattr(sys, "argv", ["x", str(tmp_path)])
        fetched.clear()
        F.main()
        return list(fetched)

    return go, tmp_path


def test_keeps_saved_photos_and_records_titles(run):
    go, out = run
    assert len(go({"a": ("File:A.jpg", "x", "CC0")})) == 1
    assert (out / "a.webp").exists() and (out / "a-thumb.webp").exists()
    assert json.loads((out / "titles.json").read_text()) == {"a": "File:A.jpg"}
    assert go({"a": ("File:A.jpg", "x", "CC0"), "b": ("File:B.jpg", "y", "CC0")}) == ["https://x/File:B.jpg"]


def test_changed_photo_is_refetched(run):
    go, out = run
    go({"a": ("File:A.jpg", "x", "CC0")})
    assert go({"a": ("File:A2.jpg", "x", "CC0")}) == ["https://x/File:A2.jpg"]
    assert json.loads((out / "titles.json").read_text()) == {"a": "File:A2.jpg"}


def test_changed_photo_that_fails_is_removed_not_left_with_wrong_credit(run):
    go, out = run
    go({"a": ("File:A.jpg", "x", "CC0")})
    go({"a": ("File:broken.jpg", "x", "CC0")})
    assert not (out / "a.webp").exists()
    assert json.loads((out / "titles.json").read_text()) == {}


def test_photos_from_before_titles_json_count_as_current(run):
    go, out = run
    go({"a": ("File:A.jpg", "x", "CC0")})
    (out / "titles.json").unlink()
    assert go({"a": ("File:A.jpg", "x", "CC0")}) == []
    assert (out / "a.webp").exists()


def test_photo_of_a_dropped_meal_is_removed(run):
    go, out = run
    go({"a": ("File:A.jpg", "x", "CC0"), "b": ("File:B.jpg", "y", "CC0")})
    go({"a": ("File:A.jpg", "x", "CC0")})
    assert not (out / "b.webp").exists()
