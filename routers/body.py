from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from database import get_session
from models import BodyLog

router = APIRouter()
templates = Jinja2Templates(directory="templates")


def _build_chart_points(logs) -> str:
    if len(logs) < 2:
        return ""
    weights = [log.weight_kg for log in logs]
    min_w, max_w = min(weights), max(weights)
    span = max_w - min_w or 1
    width, height, pad = 600, 160, 10
    n = len(logs)
    points = []
    for i, log in enumerate(logs):
        x = pad + (i / (n - 1)) * (width - 2 * pad)
        y = pad + (1 - (log.weight_kg - min_w) / span) * (height - 2 * pad)
        points.append(f"{x:.1f},{y:.1f}")
    return " ".join(points)


@router.get("/body", dependencies=[Depends(require_login)])
def body_log_page(request: Request, session: Session = Depends(get_session)):
    logs = session.exec(select(BodyLog).order_by(BodyLog.log_date)).all()
    return templates.TemplateResponse(
        "body.html",
        {
            "request": request,
            "logged_in": True,
            "logs": list(reversed(logs)),
            "chart_points": _build_chart_points(logs),
            "today": date.today().isoformat(),
        },
    )


@router.post("/body", dependencies=[Depends(require_login)])
def add_body_log(
    log_date: date = Form(...),
    weight_kg: float = Form(...),
    waist_cm: Optional[float] = Form(None),
    chest_cm: Optional[float] = Form(None),
    arm_cm: Optional[float] = Form(None),
    hips_cm: Optional[float] = Form(None),
    thigh_cm: Optional[float] = Form(None),
    sleep_hours: Optional[float] = Form(None),
    notes: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    existing = session.exec(select(BodyLog).where(BodyLog.log_date == log_date)).first()
    if existing:
        existing.weight_kg = weight_kg
        existing.waist_cm = waist_cm
        existing.chest_cm = chest_cm
        existing.arm_cm = arm_cm
        existing.hips_cm = hips_cm
        existing.thigh_cm = thigh_cm
        existing.sleep_hours = sleep_hours
        existing.notes = notes
        session.add(existing)
    else:
        session.add(
            BodyLog(
                log_date=log_date,
                weight_kg=weight_kg,
                waist_cm=waist_cm,
                chest_cm=chest_cm,
                arm_cm=arm_cm,
                hips_cm=hips_cm,
                thigh_cm=thigh_cm,
                sleep_hours=sleep_hours,
                notes=notes,
            )
        )
    session.commit()
    return RedirectResponse(url="/body", status_code=303)
