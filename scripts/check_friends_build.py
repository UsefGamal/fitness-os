"""CI check (E4-S2): the friends build carries no trace of Yusuf's
trainer plan. Exports the content with FITNESS_OS_FLAVOR=friends in a fresh
process and fails if any of the trainer plan's sessions, exercises, links
or the word "trainer" show up in what the app would read.

    python scripts/check_friends_build.py [out.json]
    python scripts/check_friends_build.py --apk dist/fitness-os-release-friends.apk

With --apk (P14-02) it opens the built APK instead and fails if any trainer
plan exercise or link appears in the web assets inside it, so the check
covers what actually ships, not only the export.
"""

import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRAINER = json.loads((ROOT / "content" / "trainer_plan.json").read_text(encoding="utf-8"))


def trainer_markers() -> set[str]:
    """Exercise names and links that only the trainer plan has."""
    starter = json.loads((ROOT / "content" / "starter_plan.json").read_text(encoding="utf-8"))
    starter_names = {i["name"] for s in starter["sessions"].values() for b in s["blocks"] for i in b.get("items", [])}
    # The ready-made routines (content/routines.py) are general plans written
    # for both builds, so their exercise names are not trainer markers.
    sys.path.insert(0, str(ROOT))
    from content.routines import ROUTINES  # noqa: PLC0415

    starter_names |= {e["name"] for r in ROUTINES for d in r["program"] for e in d["exercises"]}
    # The exercise library is general too (anyone can add those exercises).
    from content.gym_exercises import SEED_EXERCISES  # noqa: PLC0415

    starter_names |= {name for _g, name, _k in SEED_EXERCISES}
    out = set()
    for session in TRAINER["sessions"].values():
        for block in session["blocks"]:
            for item in block.get("items", []):
                if item["name"] not in starter_names:
                    out.add(item["name"])
                out.update(v for k, v in item.items() if k.startswith("video") and v)
    return out


def strings(value, keys=False):
    if isinstance(value, dict):
        for k, v in value.items():
            if keys:
                yield k
            yield from strings(v, keys)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v, keys)
    elif isinstance(value, str):
        yield value


def problems(content: dict) -> list[str]:
    found = []
    training = content["training"]
    plan_text = list(strings({k: v for k, v in training.items() if k not in ("exercise_library", "exercise_photos")}))
    markers = trainer_markers()
    for text in plan_text:
        if text in markers:
            found.append(f"trainer plan item in the friends plan: {text}")
    for text in strings(content):
        if "trainer" in text.lower():
            found.append(f'the word "trainer" in content: {text[:80]}')
    if training["trainer_plan"].get("id") == "ul-ppl":
        found.append("the friends build carries the ul-ppl plan")
    return found


TEXT_SUFFIXES = (".js", ".json", ".html", ".css", ".txt")


def apk_problems(files: dict[str, str]) -> list[str]:
    """Trainer plan items found in an APK's text assets ({path: text})."""
    markers = sorted(trainer_markers())
    found = []
    for path, text in files.items():
        for m in markers:
            if m in text:
                found.append(f"trainer plan item in {path}: {m}")
    if not any(p.endswith(".js") for p in files):
        found.append("no app code found in the APK (assets/public/)")
    return found


def apk_texts(apk: Path) -> dict[str, str]:
    with zipfile.ZipFile(apk) as z:
        return {
            n: z.read(n).decode("utf-8", "replace")
            for n in z.namelist()
            if n.startswith("assets/public/") and n.endswith(TEXT_SUFFIXES)
        }


def main() -> int:
    if len(sys.argv) > 2 and sys.argv[1] == "--apk":
        found = apk_problems(apk_texts(Path(sys.argv[2])))
        for p in found:
            print(p)
        print("Friends APK: clean." if not found else f"Friends APK: {len(found)} problem(s).")
        return 1 if found else 0
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "mobile" / "src" / "content.friends.json")
    env = {**os.environ, "FITNESS_OS_FLAVOR": "friends"}
    subprocess.run([sys.executable, str(ROOT / "scripts" / "export_content.py"), str(out)], check=True, env=env, cwd=ROOT)
    found = problems(json.loads(out.read_text(encoding="utf-8")))
    for p in found:
        print(p)
    print("Friends build: clean." if not found else f"Friends build: {len(found)} problem(s).")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
