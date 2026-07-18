import os
from datetime import date, timedelta

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlmodel import Session, select

from auth import APP_PASSWORD, is_logged_in
from content.gym_exercises import SEED_EXERCISES
from database import get_session, init_db
from models import BodyLog, Exercise, Profile, Workout
from routers import body, bonus, gym, home, meals, padel, recovery, reminders, settings

load_dotenv()

app = FastAPI(title="Fitness OS")
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", "dev-secret-change-me"))
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(body.router)
app.include_router(gym.router)
app.include_router(padel.router)
app.include_router(meals.router)
app.include_router(reminders.router)
app.include_router(settings.router)
app.include_router(home.router)
app.include_router(recovery.router)
app.include_router(bonus.router)


@app.on_event("startup")
def on_startup():
    init_db()
    _seed_profile()
    _seed_exercises()


def _seed_profile():
    from database import engine

    with Session(engine) as session:
        existing = session.exec(select(Profile)).first()
        if not existing:
            session.add(Profile())
            session.commit()


def _seed_exercises():
    from database import engine

    with Session(engine) as session:
        existing_names = set(session.exec(select(Exercise.name)).all())
        added = False
        for muscle_group, name, equipment in SEED_EXERCISES:
            if name not in existing_names:
                session.add(Exercise(name=name, muscle_group=muscle_group, equipment=equipment))
                added = True
        if added:
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

    week_start = date.today() - timedelta(days=date.today().weekday())
    week_workouts = session.exec(
        select(Workout).where(Workout.log_date >= week_start)
    ).all()
    gym_count = len([w for w in week_workouts if w.workout_type == "gym"])
    padel_count = len([w for w in week_workouts if w.workout_type == "padel"])

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "logged_in": True,
            "profile": profile,
            "latest_weight": latest_weight,
            "days_to_due": days_to_due,
            "gym_count": gym_count,
            "padel_count": padel_count,
        },
    )


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
