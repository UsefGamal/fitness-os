from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_line_svg
from database import get_session
from models import BodyLog

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/body", dependencies=[Depends(require_login)])
def body_log_page(request: Request, session: Session = Depends(get_session)):
    logs = session.exec(select(BodyLog).order_by(BodyLog.log_date)).all()
    weights = [log.weight_kg for log in logs]
    return templates.TemplateResponse(
        "body.html",
        {
            "request": request,
            "logged_in": True,
            "logs": list(reversed(logs)),
            "chart_svg": build_line_svg(weights),
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
