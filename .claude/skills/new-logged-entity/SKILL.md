---
name: new-logged-entity
description: Use when adding a new kind of loggable entry to Fitness OS (a new router/model/template following the same shape as body/gym/padel/etc.) — a new feature area, not a tweak to an existing one. Walks through the router-per-feature-area pattern this app uses everywhere so a new feature starts from the right skeleton instead of a fresh design.
---

# Adding a new logged entity

Every feature area in this app (`body`, `gym`, `home`, `recovery`, `cardio`, `padel`, `meals`, `bonus`, …) follows the identical shape. `routers/body.py` is the cleanest reference implementation — read it first. This skill is the checklist for building a new one without silently dropping a piece of the pattern.

## The shape

1. **Model** (`models.py`): a `SQLModel` table class. Optional fields default to `None`; the primary key is `id: int | None = Field(default=None, primary_key=True)` — this is SQLModel's own idiom for autoincrement PKs, not a nullability bug (see `pyproject.toml`'s mypy override comment for why type checking doesn't fight this).

2. **Router** (`routers/<name>.py`): one `APIRouter()`, three handlers minimum —
   - `GET /<name>` — fetch logs (`session.exec(select(Model).order_by(Model.log_date)).all()`), build any chart SVGs via `charting.py`, render a template. Every route dependency-injects auth with `dependencies=[Depends(require_login)]` and the DB session with `session: Session = Depends(get_session)`.
   - `POST /<name>` — form params typed with `Form(...)`/`Form(None)` for required/optional, domain-range checks via `validation.py` (`require_range`/`require_choice`/`require_max_length`/`require_not_future` — call these once per field, at the top, before touching the DB), then the **upsert-by-date pattern**: look up an existing row for that date before deciding insert vs. update, so re-logging the same day edits in place instead of creating a duplicate. Redirect with `?saved=1` on success.
   - `POST /<name>/{id}/delete` — `session.get(Model, id)`, 404 if missing, delete, commit, redirect.
   Register the router in `main.py`'s `app.include_router(...)` block.

3. **Validation stays at the boundary.** `Form(...)` handles required-ness/type coercion; `validation.py` handles domain sanity (a weight of -50kg, an RPE of 15). Don't duplicate either check deeper in the call stack, and don't invent a new validation helper if an existing `require_*` fits.

4. **Errors are boundary-caught, not per-route.** `ValidationError` and Pydantic's `RequestValidationError` are already caught globally in `main.py` and redirect back to the referring page with `?error=` — a new router doesn't need its own try/except for these, just let `ValidationError` propagate from a `require_*` call.

5. **Template**: extend `base.html`, follow `frontend-design`'s conventions (CSS tokens, icon sprite, CSP — no inline handlers, `.confirm-delete` for the delete form, a table view alongside any chart).

6. **If this entity needs a new column added later**, that goes through `db-migration-checklist`, not a model-only change — SQLModel's `create_all()` won't add columns to a table that already exists in a running deployment.

7. **Update `docs/ROUTES.md` and `docs/DATA_MODEL.md`** with the new routes/table — they're hand-maintained references, not generated.

8. **Add a test file** (`tests/test_<name>.py`) mirroring an existing one (`tests/test_body.py`) — CRUD (create/edit/delete), a validation-error path, and anything specific to this entity's logic. `tests/conftest.py`'s `auth_client` fixture gives a pre-logged-in `TestClient`.

9. **Run `db-migration-checklist`'s step 8 equivalent** — `ruff check .`, `mypy .`, `pytest` — before considering it done, same as any other change.
