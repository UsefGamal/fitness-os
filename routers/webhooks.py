from fastapi import APIRouter, Request

router = APIRouter()


@router.post("/webhooks/fitchef")
async def fitchef_webhook(request: Request):
    """FitChef requires a callback URL on every /mealplan request when the
    account has no default webhook configured in its portal. We don't have
    the signing secret needed to verify X-FitChef-Signature, so this
    deliberately does nothing with the payload beyond acknowledging
    receipt — the real completion check is fitchef_sync.advance_sync()'s
    polling via GET /api/v2/mealplan/{identifier}, triggered on the next
    /more or /meals page load."""
    return {"status": "acknowledged"}
