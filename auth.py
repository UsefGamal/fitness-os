import os

from dotenv import load_dotenv
from fastapi import Request
from fastapi.responses import RedirectResponse

load_dotenv()

APP_PASSWORD = os.getenv("APP_PASSWORD", "change-me")


def is_logged_in(request: Request) -> bool:
    return bool(request.session.get("authed"))


def require_login(request: Request):
    """Dependency: redirect to /login if not authenticated.

    Raises a RedirectResponse via an exception FastAPI can't catch directly,
    so routes instead call this and check the return value themselves.
    """
    if not is_logged_in(request):
        return RedirectResponse(url="/login", status_code=303)
    return None
