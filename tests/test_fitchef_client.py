"""Regression coverage for fitchef_client.fetch_mealplan()'s response
normalization. This is where a real bug came from: the docs claim GET
returns "the same shape" as the webhook payload (flat, top-level "days"),
but the real API nests everything under a "result" key instead — every
completed generation was silently read as empty until this was fixed."""

import httpx
import pytest

import fitchef_client


class _FakeResponse:
    def __init__(self, status_code, json_body):
        self.status_code = status_code
        self._json_body = json_body

    def json(self):
        return self._json_body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=self)


def test_fetch_mealplan_unwraps_the_real_result_wrapper(monkeypatch):
    """Matches the actual shape observed from the live API."""
    real_shape = {
        "identifier": 123,
        "status": "completed",
        "result": {
            "days": [{"meals": [{"mealName": "breakfast"}]}],
            "recipeHistory": {"w": []},
            "identifier": 123,
        },
    }
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(200, real_shape))

    payload = fitchef_client.fetch_mealplan("token", 123)
    assert len(payload["days"]) == 1
    assert payload["days"][0]["meals"][0]["mealName"] == "breakfast"
    assert "recipeHistory" in payload


def test_fetch_mealplan_falls_back_to_flat_shape_if_no_result_key(monkeypatch):
    """In case a different account tier really does return the flat shape
    the docs describe — must not break that case while fixing the nested
    one."""
    flat_shape = {"identifier": 123, "days": [{"meals": []}]}
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(200, flat_shape))

    payload = fitchef_client.fetch_mealplan("token", 123)
    assert len(payload["days"]) == 1


def test_fetch_mealplan_returns_none_while_still_generating(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(404, {}))
    assert fitchef_client.fetch_mealplan("token", 123) is None


def test_fetch_mealplan_raises_on_expired_generation(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(410, {}))
    with pytest.raises(fitchef_client.FitChefError):
        fitchef_client.fetch_mealplan("token", 123)
