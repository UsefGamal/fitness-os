import logging
import os
import threading
import time

from dotenv import load_dotenv
from fastapi import HTTPException, Request

load_dotenv()

logger = logging.getLogger("fitness_os.auth")

APP_PASSWORD = os.getenv("APP_PASSWORD", "change-me")
if APP_PASSWORD == "change-me":
    logger.warning(
        "APP_PASSWORD is not set (using the insecure default) — set it in your environment before deploying."
    )

# Global, in-memory login rate limiter. Deliberately not per-IP: this app
# sits behind Render/Cloudflare where the "real" client IP needs trusted
# proxy-header handling to detect reliably, and a single-user app has
# essentially one legitimate caller anyway — a global cooldown after
# repeated failures stops automated brute-forcing just as well and can't
# be defeated by spoofing an X-Forwarded-For header. Resets on process
# restart, which is fine for this threat model. Only safe because the app
# runs as a single uvicorn worker (see render.yaml) — sharding workers
# would give each its own counter.
LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 60

_login_lock = threading.Lock()
_failed_login_times: list = []


def is_login_locked_out() -> bool:
    now = time.time()
    with _login_lock:
        cutoff = now - LOGIN_WINDOW_SECONDS
        while _failed_login_times and _failed_login_times[0] < cutoff:
            _failed_login_times.pop(0)
        return len(_failed_login_times) >= LOGIN_MAX_ATTEMPTS


def record_failed_login() -> None:
    with _login_lock:
        _failed_login_times.append(time.time())


def record_successful_login() -> None:
    with _login_lock:
        _failed_login_times.clear()


def is_logged_in(request: Request) -> bool:
    return bool(request.session.get("authed"))


def require_login(request: Request) -> None:
    """FastAPI dependency: redirect to /login if not authenticated."""
    if not is_logged_in(request):
        raise HTTPException(status_code=303, headers={"Location": "/login"})
