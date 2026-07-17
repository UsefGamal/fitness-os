import os
from datetime import date

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlmodel import Session, select

from auth import APP_PASSWORD, is_logged_in
from database import get_session, init_db
from models import BodyLog, Profile

load_dotenv()

app = FastAPI(title="Fitness OS")
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", "dev-secret-change-me"))
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_profile()


def _seed_profile():
    from database import engine

    with Session(engine) as session:
        existing = session.exec(select(Profile)).first()
        if not existing:
            session.add(Profile())
            session.commit()


@app.get("/login")
def login_form(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "logged_in": False, "error": None})


@app.post("/login")
def login_submit(request: Request, password: str = Form(...)):
    if password == APP_PASSWORD:
        request.session["authed"] = True
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(
        "login.html",
        {"request": request, "logged_in": False, "error": "Wrong password."},
        status_code=401,
    )


@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


@app.get("/")
def dashboard(request: Request, session: Session = Depends(get_session)):
    if not is_logged_in(request):
        return RedirectResponse(url="/login", status_code=303)

    profile = session.exec(select(Profile)).first()
    latest_weight = session.exec(
        select(BodyLog).order_by(BodyLog.log_date.desc())
    ).first()

    days_to_due = (profile.due_date - date.today()).days if profile.due_date else None

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "logged_in": True,
            "profile": profile,
            "latest_weight": latest_weight,
            "days_to_due": days_to_due,
        },
    )


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
