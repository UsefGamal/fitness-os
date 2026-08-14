---
name: sync-job-pattern
description: Use when adding a new external-API-backed sync job to Fitness OS (a third meal-plan source, a wearable/fitness-tracker integration, etc.) — anything that fetches from a third-party API and needs to survive rate limits, slow responses, and mid-flight process restarts. Codifies the async state-machine pattern edamam_sync.py and fitchef_sync.py both independently arrived at.
---

# External sync job pattern

`edamam_sync.py` and `fitchef_sync.py` both sync a third-party meal-plan API into this app's own shape, and both converged on the same design under real production constraints (an Edamam rate limit far tighter than documented; a FitChef generation that can take 30-180s). A new integration should start from this pattern, not reinvent it.

## Why not just call the API synchronously in the request handler

A sync can legitimately take over a minute (retries with backoff, or an async job on the provider's side). Blocking a request/response cycle that long is a bad user experience and risks a platform timeout. Both existing syncs instead:

1. **A trigger route creates a `pending` DB row and returns immediately** — the real work happens elsewhere (FastAPI `BackgroundTasks` for Edamam; a cheap idempotent "poke" on page load for FitChef's async job). The route response never waits on the third-party API.

2. **The background/poke function has its own DB session** — the request-scoped session is long closed by the time slow background work finishes. `Session(engine) as session` inside the function, not a session passed in from the route.

3. **It must never raise out of its entry point.** Wrap the real work in try/except, and land in a `complete` or `error` status row either way — an unhandled exception in a background task fails silently with no user-visible error and no way to retry. Catch the provider-specific error type narrowly first (`EdamamError`/`FitChefError`), then a broad `except Exception` as the last resort with a truncated `error_detail` (`str(exc)[:300]` — don't store an unbounded traceback in the DB).

4. **Guard against orphaned `pending` state.** A background task has no durability guarantee — a deploy, manual restart, or (on Render's free tier) a spin-down can kill the process mid-sync, leaving a `pending` row with nothing left running to finish it. Add a `is_pending_stale()`-shaped check (elapsed time since `requested_at` past any plausible real duration) so a stuck row doesn't block every future sync attempt forever.

5. **The trigger route blocks a second sync while one's already in flight**, checking `latest_sync(session).status` before calling `start_sync()` — a duplicate in-flight sync wastes API quota and can orphan the first one's identifiers. Also allow starting a new one if the existing row is stale (see #4), so a genuinely stuck sync isn't permanent.

6. **Retries against the provider's API go in the client module, not the sync orchestration module** (see `edamam_client.py`'s `MAX_RETRIES`/`RETRY_BACKOFF_SECONDS` pattern) — a 429 gets backed off and retried at the HTTP-call level, so the orchestration code above never has to think about it.

7. **Adapt the provider's response shape into this app's own shape at the sync-module boundary** (`_build_synced_day()` in both existing modules) — nothing downstream (`routers/meals.py`, the dashboard, the email digest) should need to know which provider (or the static fallback) produced the data it's rendering.

8. **If this is meant to sit alongside an existing sync as a fallback chain** (like Edamam → FitChef → static), the priority order lives in the *primary* module's `get_active_*()` functions, falling through explicitly — don't scatter provider-priority logic across callers.

9. **New DB columns for the sync's state table go through `db-migration-checklist`**, same as any other schema change.

10. **Write tests mirroring `tests/test_edamam_sync.py`/`tests/test_fitchef_sync.py`**: the happy path, a stale-pending recovery case, and a provider-error path that lands in `error` status without raising.
