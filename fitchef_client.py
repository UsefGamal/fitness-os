"""Thin client for the FitChef Meal Plan API (OAuth2 client_credentials).

No official SDK exists, so this hand-rolls the three calls the sync flow
needs. See fitchef_sync.py for how these are orchestrated into a full
14-day plan, and routers/meals.py's /meals/fitchef-sync route for the
user-facing trigger.
"""

import os

import httpx

FITCHEF_BASE_URL = "https://api.fitchef.com"


class FitChefError(Exception):
    pass


def _client_id() -> str:
    return os.getenv("FITCHEF_CLIENT_ID", "")


def _client_secret() -> str:
    return os.getenv("FITCHEF_CLIENT_SECRET", "")


def get_access_token() -> str:
    if not _client_id() or not _client_secret():
        raise FitChefError("FITCHEF_CLIENT_ID/FITCHEF_CLIENT_SECRET not configured")
    response = httpx.post(
        f"{FITCHEF_BASE_URL}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": _client_id(),
            "client_secret": _client_secret(),
            "scope": "dynamic",
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def request_mealplan(
    token: str,
    *,
    carbohydrate: int,
    protein: int,
    fat: int,
    excluded_sets: list | None = None,
    recipe_history: str | None = None,
    configured_days: list | None = None,
) -> int:
    """Kicks off one week's async generation. Returns the identifier used to
    poll for the completed plan via fetch_mealplan — this call never
    returns the plan itself."""
    body = {
        "dietRestrictions": {
            "diets": [],
            "excludedSets": excluded_sets or [],
            "includedSets": [],
        },
        "carbohydrate": carbohydrate,
        "protein": protein,
        "fat": fat,
        # Required whenever the client has no default webhook configured in
        # the FitChef portal. Points at our own receiver (routers/webhooks.py),
        # which acknowledges but doesn't act on the payload — we don't have a
        # webhook signing secret to verify it with, so polling via
        # fetch_mealplan (triggered on the next page load) is the real
        # source of truth, not this callback.
        "callback": f"{os.getenv('APP_BASE_URL', '')}/webhooks/fitchef",
    }
    if recipe_history:
        body["recipeHistory"] = recipe_history
    if configured_days:
        body["configuredDays"] = configured_days

    response = httpx.post(
        f"{FITCHEF_BASE_URL}/api/v2/mealplan",
        headers={"Authorization": f"Bearer {token}"},
        json=body,
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    if data.get("status") != "OK" or not data.get("identifier"):
        raise FitChefError(f"FitChef rejected the request: {data.get('errors')}")
    return data["identifier"]


def fetch_mealplan(token: str, identifier: int) -> dict | None:
    """Returns the completed plan dict, or None if generation is still in
    progress (404). Raises FitChefError if the result expired before we
    fetched it (410)."""
    response = httpx.get(
        f"{FITCHEF_BASE_URL}/api/v2/mealplan/{identifier}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    if response.status_code == 404:
        return None
    if response.status_code == 410:
        raise FitChefError("This generation expired before it was fetched — try syncing again.")
    response.raise_for_status()
    return response.json()
