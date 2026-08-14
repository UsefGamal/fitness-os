---
name: smoke-test
description: Use after making a change to Fitness OS (this app) to verify it actually works end-to-end, beyond what pytest covers — the README notes verification here has historically been "local server + manual smoke tests." Spins up uvicorn, logs in through the real password-auth flow, and hits every router's main page to catch startup errors, 500s, and template-rendering breaks that unit tests wouldn't.
---

# Smoke test

`pytest` covers CRUD/validation/auth logic against a temp SQLite DB, but nothing in the test suite renders every page with a real browser-shaped request or boots the app process itself. This skill is the manual-verification pass the README describes — run it after any change that touches a route, a template, `main.py`'s startup/lifespan, or `database.py`.

## Steps

1. **Confirm `.env` exists** (`cp .env.example .env` if not) and note the `APP_PASSWORD` value — you'll need it to log in.

2. **Start the server in the background:**
   ```bash
   cd app
   .venv/Scripts/uvicorn main:app --host 127.0.0.1 --port 8000 &
   ```
   Watch the startup output for anything besides the normal Uvicorn "Application startup complete" — a traceback here usually means `init_db()`/`_seed_profile()`/`_seed_exercises()` broke, which takes the whole app down before it ever serves a request.

3. **Log in and capture the session cookie** (rate limiter allows 5 attempts/60s — don't guess the password repeatedly):
   ```bash
   curl -s -c cookies.txt -d "password=$APP_PASSWORD" -o /dev/null -w "login: %{http_code}\n" http://127.0.0.1:8000/login
   ```
   Expect `303` (redirect to `/`). A `401` means the password is wrong; a `429` means the rate limiter is already tripped from a prior run — wait 60s.

4. **Hit the dashboard and every router's main page**, checking for `200` and scanning the body for a Jinja2 traceback (`jinja2.exceptions` / `TemplateSyntaxError` / a raw Python traceback embedded in HTML — FastAPI's debug page — means a template or route broke; a clean redirect to `/login` on any of these means the session cookie didn't take):
   ```bash
   for path in / /body /gym /home /recovery /cardio /padel /meals /bonus /training /more /help /settings; do
     code=$(curl -s -b cookies.txt -o response.html -w "%{http_code}" "http://127.0.0.1:8000$path")
     echo "$path -> $code"
     grep -qi "traceback\|internal server error" response.html && echo "  !! possible error in body"
   done
   ```

5. **If the change touched a specific POST handler** (add/edit/delete a logged entry), exercise it directly instead of relying on the GET pass alone — e.g. for a body-log change:
   ```bash
   curl -s -b cookies.txt -d "log_date=2026-08-14&weight_kg=80" -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/body
   ```
   Expect a `303` redirect to `?saved=1`, then re-`GET /body` and confirm the new row shows up in the rendered table.

6. **Check `/healthz`** returns `{"status":"ok"}` — this is what Render's health check and the keep-alive cron hit in production.

7. **Stop the server and clean up** (`kill %1` or the equivalent for how it was backgrounded; `rm cookies.txt response.html`).

If anything in steps 3–6 didn't come back clean, don't report the change as verified — say explicitly what broke and where, the same way you would for a failing pytest run.
