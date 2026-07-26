from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from auth import require_login
from charting import build_diverging_bar_svg, build_line_svg
from database import get_session
from models import BodyLog

router = APIRouter()
templates = Jinja2Templates(directory="templates")

WEEKLY_DELTA_WEEKS = 10


def _weekly_weight_deltas(logs: list[BodyLog]) -> tuple[list[float], list[str]]:
    """One average weight per ISO week, then week-over-week deltas — a
    steadier signal than the noisy daily line for 'am I on pace'."""
    by_week: dict[date, list[float]] = defaultdict(list)
    for log in logs:
        week_start = log.log_date - timedelta(days=log.log_date.weekday())
        by_week[week_start].append(log.weight_kg)

    weeks = sorted(by_week)
    averages = [sum(by_week[wk]) / len(by_week[wk]) for wk in weeks]

    deltas = [round(averages[i] - averages[i - 1], 2) for i in range(1, len(averages))]
    labels = [weeks[i].isoformat() for i in range(1, len(weeks))]
    return deltas[-WEEKLY_DELTA_WEEKS:], labels[-WEEKLY_DELTA_WEEKS:]


@router.get("/body", dependencies=[Depends(require_login)])
def body_log_page(request: Request, edit: Optional[int] = None, session: Session = Depends(get_session)):
    logs = session.exec(select(BodyLog).order_by(BodyLog.log_date)).all()
    weights = [log.weight_kg for log in logs]

    weekly_deltas, weekly_labels = _weekly_weight_deltas(logs)
    weekly_rows = list(reversed(list(zip(weekly_labels, weekly_deltas))))

    edit_log = next((log for log in logs if log.id == edit), None) if edit else None

    return templates.TemplateResponse(
        "body.html",
        {
            "request": request,
            "logged_in": True,
            "logs": list(reversed(logs)),
            "chart_svg": build_line_svg(weights),
            "weekly_delta_svg": build_diverging_bar_svg(weekly_deltas),
            "weekly_delta_rows": weekly_rows,
            "today": date.today().isoformat(),
            "edit_log": edit_log,
            "saved": request.query_params.get("saved") == "1",
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
    return RedirectResponse(url="/body?saved=1", status_code=303)


@router.post("/body/{log_id}/delete", dependencies=[Depends(require_login)])
def delete_body_log(log_id: int, session: Session = Depends(get_session)):
    log = session.get(BodyLog, log_id)
    if not log:
        raise HTTPException(status_code=404)
    session.delete(log)
    session.commit()
    return RedirectResponse(url="/body", status_code=303)
