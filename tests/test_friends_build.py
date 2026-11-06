"""E4-S2: Yusuf's trainer plan stays in his build; the friends build gets the
general starter plan and nothing from the trainer's PDF."""

import importlib.util
import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_SPEC = importlib.util.spec_from_file_location("check_friends_build", ROOT / "scripts" / "check_friends_build.py")
assert _SPEC and _SPEC.loader
check = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(check)


def test_friends_build_is_clean(tmp_path):
    out = tmp_path / "content.json"
    env = {**os.environ, "FITNESS_OS_FLAVOR": "friends"}
    subprocess.run([sys.executable, str(ROOT / "scripts" / "check_friends_build.py"), str(out)], check=True, env=env, cwd=ROOT)
    content = json.loads(out.read_text(encoding="utf-8"))
    assert content["training"]["trainer_plan"]["id"] == "starter-3"
    assert [d["key"] for d in content["training"]["program"]] == ["full_a", "full_b", "full_c"]


def test_the_check_catches_the_trainer_plan(tmp_path):
    out = tmp_path / "content.json"
    env = {**os.environ, "FITNESS_OS_FLAVOR": "yusuf"}
    subprocess.run([sys.executable, str(ROOT / "scripts" / "export_content.py"), str(out)], check=True, env=env, cwd=ROOT)
    found = check.problems(json.loads(out.read_text(encoding="utf-8")))
    assert any("ul-ppl" in p for p in found)
    assert any("trainer plan item" in p for p in found)


def test_starter_plan_uses_library_exercises():
    from content.gym_exercises import SEED_EXERCISES

    names = {name for _g, name, _k in SEED_EXERCISES}
    plan = json.loads((ROOT / "content" / "starter_plan.json").read_text(encoding="utf-8"))
    for session in plan["sessions"].values():
        for block in session["blocks"]:
            for item in block.get("items", []):
                assert item["name"] in names, item["name"]


def test_unknown_flavor_is_refused():
    env = {**os.environ, "FITNESS_OS_FLAVOR": "nope"}
    r = subprocess.run([sys.executable, "-c", "import content.gym_program"], env=env, cwd=ROOT, capture_output=True, text=True)
    assert r.returncode != 0 and "FITNESS_OS_FLAVOR" in r.stderr


def _apk(tmp_path, flavor):
    """A stand-in APK: the exported content inside assets/public/, as the
    Vite bundle carries it."""
    out = tmp_path / f"{flavor}.json"
    env = {**os.environ, "FITNESS_OS_FLAVOR": flavor}
    subprocess.run([sys.executable, str(ROOT / "scripts" / "export_content.py"), str(out)], check=True, env=env, cwd=ROOT)
    apk = tmp_path / f"{flavor}.apk"
    with zipfile.ZipFile(apk, "w") as z:
        z.writestr("assets/public/assets/index-abc.js", "export default " + out.read_text(encoding="utf-8"))
        z.writestr("classes.dex", b"\x00binary")
    return apk


def test_the_apk_check_passes_the_friends_apk(tmp_path):
    """P14-02: the APK check reads what ships, and the friends export no
    longer carries the trainer plan's exercise names in photos or muscles."""
    assert check.apk_problems(check.apk_texts(_apk(tmp_path, "friends"))) == []


def test_the_apk_check_catches_the_yusuf_apk(tmp_path):
    found = check.apk_problems(check.apk_texts(_apk(tmp_path, "yusuf")))
    assert any("Y-Bench" in p for p in found)
    assert any("youtu" in p for p in found)


def test_the_apk_check_fails_an_apk_with_no_app_code(tmp_path):
    apk = tmp_path / "empty.apk"
    with zipfile.ZipFile(apk, "w") as z:
        z.writestr("classes.dex", b"\x00")
    assert check.apk_problems(check.apk_texts(apk)) == ["no app code found in the APK (assets/public/)"]
