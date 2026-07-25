import os

from dotenv import load_dotenv
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
]


def init_db() -> None:
    import models  # noqa: F401  (ensures models are registered before create_all)

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
