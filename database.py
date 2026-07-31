import os

from dotenv import load_dotenv
from sqlalchemy import inspect
from sqlmodel import SQLModel, Session, create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fitness.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

# Columns added to existing tables after their first deploy. SQLModel's
# create_all() only creates missing tables, not missing columns on tables
# that already exist, so new columns need this tiny idempotent migration.
_LIGHT_MIGRATIONS = [
    "ALTER TABLE profile ADD COLUMN fitness_level VARCHAR DEFAULT 'intermediate'",
    "ALTER TABLE profile ADD COLUMN start_weight_kg FLOAT",
    "ALTER TABLE meallog ADD COLUMN option_key VARCHAR",
    "ALTER TABLE meallog ADD COLUMN drink_key VARCHAR",
    "ALTER TABLE bodylog ADD COLUMN sleep_hours FLOAT",
    "ALTER TABLE bodylog ADD COLUMN chest_cm FLOAT",
    "ALTER TABLE bodylog ADD COLUMN arm_cm FLOAT",
    "ALTER TABLE bodylog ADD COLUMN hips_cm FLOAT",
    "ALTER TABLE bodylog ADD COLUMN thigh_cm FLOAT",
    "ALTER TABLE workout ADD COLUMN session_rpe INTEGER",
    "ALTER TABLE workout ADD COLUMN is_deload BOOLEAN DEFAULT false",
    "ALTER TABLE workout ADD COLUMN pain_note VARCHAR",
    "ALTER TABLE workoutset ADD COLUMN rpe FLOAT",
    "ALTER TABLE workout ADD COLUMN result VARCHAR",
]


def _drop_stale_mealplansync_table() -> None:
    """The reverted Spoonacular meal-sync feature used this exact table
    name with a different schema (see git history around "Add
    Spoonacular-backed meal plan sync" / its revert). `git revert` doesn't
    touch the live database, and create_all() only creates *missing*
    tables — it never alters an existing one — so the old columns were
    silently left in place under the new FitChef-sync model's name,
    causing UndefinedColumn errors on any query. One-time cleanup: if the
    table exists but doesn't look like the current schema, drop it so
    create_all() (called right after this) recreates it fresh. The old
    data has zero value — it's leftover from a feature that was live only
    briefly before being rolled back."""
    try:
        with engine.begin() as conn:
            inspector = inspect(conn)
            if "mealplansync" in inspector.get_table_names():
                columns = {col["name"] for col in inspector.get_columns("mealplansync")}
                if "requested_at" not in columns:
                    conn.execute(text("DROP TABLE mealplansync"))
    except Exception:
        pass  # best-effort cleanup — a failure here shouldn't block startup


def init_db() -> None:
    import models  # noqa: F401  (ensures models are registered before create_all)

    _drop_stale_mealplansync_table()
    SQLModel.metadata.create_all(engine)
    run_light_migrations()


def run_light_migrations() -> None:
    for statement in _LIGHT_MIGRATIONS:
        try:
            with engine.begin() as conn:
                conn.execute(text(statement))
        except Exception:
            pass  # column already exists


def get_session():
    with Session(engine) as session:
        yield session
