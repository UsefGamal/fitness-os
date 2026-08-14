---
name: pre-deploy-checklist
description: Use before pushing to main in Fitness OS, or when the user asks to ship/deploy a change — Render auto-deploys on every push to main with no staging environment and no manual approval step, so this is the only gate before a change hits the real production database and the user's actual daily-use app.
---

# Pre-deploy checklist

`render.yaml`'s blueprint auto-deploys on push to `main` (see `CLAUDE.md`'s Deployment section). There is no staging environment and no separate approval step — a push to `main` **is** the deploy. This is the last checkpoint before that happens.

1. **CI-equivalent checks pass locally**: `ruff check .`, `mypy .`, `pytest` — all three, not just the one relevant to what you touched. CI runs these on push too, but a red CI run on `main` means the deploy already happened before you find out.

2. **Any new/changed migration is ANSI-safe and idempotent** — see `db-migration-checklist` if `_LIGHT_MIGRATIONS` or `models.py` changed. This is the single highest-consequence category: the one production outage in this app's history was a migration that worked locally (SQLite) and broke prod (Postgres) silently.

3. **Any new env var is in both places**: documented in `.env.example` (so local dev stays reproducible) *and* actually set in Render's dashboard (`.env.example`/`render.yaml` note `sync: false` — nothing there is committed with real values, so Render won't have it unless you set it there yourself). A route that reads a new env var will 500 or silently misbehave in prod if this step is skipped.

4. **`docs/ROUTES.md` and `docs/DATA_MODEL.md` reflect any new/changed route or table** — see `new-logged-entity` if this is a new feature area.

5. **If a secret was ever pasted in plaintext (chat, a shared doc, etc.), rotate it** before or as part of this deploy — `CRON_SECRET` and `APP_PASSWORD` both gate real access to this app. See `CLAUDE.md`'s Security section.

6. **Run `smoke-test`** against the local server one more time if the change touched a route, template, or `main.py`'s startup path — pytest doesn't render every page or boot the actual process.

7. **Check `git status`/`git diff` for anything unintended riding along** — a stray debug print, a hardcoded value that should've stayed a config default, an accidentally-staged `.env`. `.env`/`*.db` are gitignored, but double-check nothing else sensitive got swept in by a broad `git add`.

8. **Push to `main`.** After the push, Render's deploy uses `runtime.txt`/`render.yaml`'s pinned Python 3.12.10 — if a new dependency needs a newer Python, that pin needs a deliberate, separate decision, not a side effect of this deploy.

Only step 8 is actually risky/irreversible (or requires confirmation before you take it) — everything before it is local verification. Don't skip straight to pushing because the change "felt small"; the migration-safety and env-var checks are exactly the kind of thing that looks fine on a small change and breaks prod anyway.
