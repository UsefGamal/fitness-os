"""Web Push subscription management. Sending pushes (the evening-nudge
cron) lives in reminders.py alongside the existing email digest crons,
following the same pattern — this file only owns the subscribe/unsubscribe
endpoints a browser calls after the user opts in from Settings.

Generate a VAPID keypair once (the same pair works for local dev and
production — see .env.example):

    python -c "
    from py_vapid import Vapid
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    import base64
    v = Vapid(); v.generate_keys()
    def b64url(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
    raw_public = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    raw_private = v.private_key.private_numbers().private_value.to_bytes(32, 'big')
    print('VAPID_PUBLIC_KEY=' + b64url(raw_public))
    print('VAPID_PRIVATE_KEY=' + b64url(raw_private))
    "
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from auth import require_login
from database import get_session
from models import PushSubscription

router = APIRouter()


class PushKeysIn(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushKeysIn


class PushEndpointIn(BaseModel):
    endpoint: str


@router.post("/push/subscribe", dependencies=[Depends(require_login)])
def subscribe(sub: PushSubscriptionIn, session: Session = Depends(get_session)):
    existing = session.exec(select(PushSubscription).where(PushSubscription.endpoint == sub.endpoint)).first()
    if existing:
        existing.p256dh = sub.keys.p256dh
        existing.auth = sub.keys.auth
        session.add(existing)
    else:
        session.add(PushSubscription(endpoint=sub.endpoint, p256dh=sub.keys.p256dh, auth=sub.keys.auth))
    session.commit()
    return {"status": "ok"}


@router.post("/push/unsubscribe", dependencies=[Depends(require_login)])
def unsubscribe(sub: PushEndpointIn, session: Session = Depends(get_session)):
    existing = session.exec(select(PushSubscription).where(PushSubscription.endpoint == sub.endpoint)).first()
    if existing:
        session.delete(existing)
        session.commit()
    return {"status": "ok"}
