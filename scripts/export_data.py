"""Write every logged entry to a JSON file, straight from the database.

    DATABASE_URL=postgresql://... python scripts/export_data.py fitness-os-export.json

Same content as Settings > "Download my data". Use this one when the site
itself is no longer running. Read-only: it never writes to the database."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session  # noqa: E402

from data_export import build_export  # noqa: E402
from database import engine  # noqa: E402


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "fitness-os-export.json")
    with Session(engine) as session:
        data = build_export(session)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out}: {len(data['body_logs'])} weigh-ins, {len(data['workouts'])} workouts, {len(data['meal_logs'])} meal logs")


if __name__ == "__main__":
    main()
