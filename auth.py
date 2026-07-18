import os

from dotenv import load_dotenv
from fastapi import HTTPException, Request

load_dotenv()

APP_PASSWORD = os.getenv("APP_PASSWORD", "change-me")


def is_logged_in(request: Request) -> bool:
    return bool(request.session.get("authed"))


def require_login(request: Request) -> None:
    """FastAPI dependency: redirect to /login if not authenticated."""
    if not is_logged_in(request):
        raise HTTPException(status_code=303, headers={"Location": "/login"})
