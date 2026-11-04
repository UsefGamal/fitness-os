import { Link, useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import WeekStrip from '../components/WeekStrip.jsx';
import { formatDate, longWeekday, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { mealDayFor } from '../lib/meals.js';
import { doneKeys, totalPoints } from '../lib/quests.js';
import { programDayFor, sessionKeyOn, weekView } from '../lib/schedule.js';
import { content, useData } from '../store/useData.js';
import { SESSIONS } from './Session.jsx';

const WATER_GOAL = 3000;

export default function Today() {
  const { data, update } = useData();
  const navigate = useNavigate();
  const today = todayISO();
  const T = content.training;
  const moves = data.session_moves || [];
  const next = programDayFor(today, T, moves);
  const week = weekView(today, T, moves);
  const done = new Set(data.workouts.filter((w) => w.finished_at || w.sets.length).map((w) => w.log_date));
  const todays = D.workoutOn(data, today);
  const mealsDone = content.nutrition.meal_slots.filter((s) => D.mealLog(data, today, s)?.completed).length;
  const water = D.waterOn(data, today);
  const weight = D.latestWeight(data);
  const streak = D.trainingStreak(data, today, (d) => sessionKeyOn(d, T, moves) === 'rest');
  const mealDay = mealDayFor(today, content.nutrition);
  const dailyQuests = content.quests.bonus_tasks.filter((t) => t.frequency === 'daily');
  const questsDone = dailyQuests.filter((t) => doneKeys(data, today, content.quests).has(t.key)).length;
  const otherToday = data.workouts.filter((w) => w.log_date === today && w.workout_type !== 'gym');

  return (
    <div className="page">
      <div className="row between">
        <div>
          <div className="muted small" style={{ margin: '8px 4px 0' }}>{formatDate(today)}</div>
          <h1 className="page-title" style={{ marginTop: 0 }}>Today</h1>
        </div>
        <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon name="gear" /></Link>
      </div>

      <section className="card">
        {next.isRestToday ? (
          <>
            <span className="chip">Rest day</span>
            <h2 style={{ marginTop: 10 }}>Next: {next.label}</h2>
            <p className="muted" style={{ margin: 0 }}>{longWeekday(next.onDate)} at {T.session_time} · {next.focus}</p>
          </>
        ) : (
          <>
            <span className="chip accent">Today at {T.session_time}</span>
            <h2 style={{ marginTop: 10 }}>{next.label}</h2>
            <p className="muted" style={{ margin: '0 0 14px' }}>
              {next.focus}{next.cardio_after ? `, then ${next.cardio_after.minutes} min cycling` : ''}
            </p>
            {todays?.finished_at ? (
              <Link className="btn secondary" to={`/history/${todays.id}`}><Icon name="check" /> Done · {todays.sets.length} sets</Link>
            ) : (
              <button type="button" className="btn" onClick={() => navigate('/workout')}>
                <Icon name="play" /> {todays ? 'Resume workout' : 'Start workout'}
              </button>
            )}
          </>
        )}
      </section>

      <section className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <strong>This week</strong>
          {streak > 0 ? <span className="chip accent"><Icon name="bolt" className="icon" /> {streak}-day streak</span> : null}
        </div>
        <WeekStrip week={week} doneDates={done} />
      </section>

      <div className="section-label">Other sessions</div>
      <div className="list">
        {Object.entries(SESSIONS).map(([key, s]) => {
          const logged = otherToday.find((w) => w.workout_type === key);
          return (
            <Link key={key} to={logged ? `/history/${logged.id}` : `/session/${key}`} className="list-row">
              <div className="grow"><div>{s.label}</div><div className="meta">{logged ? `Logged today${logged.duration_min ? ` · ${logged.duration_min} min` : ''}` : s.note}</div></div>
              {logged ? <span className="chip accent"><Icon name="check" className="icon" /></span> : null}
              <Icon name="chev" className="icon chev" />
            </Link>
          );
        })}
      </div>

      <Link to="/quests" className="card" style={{ display: 'block', color: 'inherit' }}>
        <div className="row between">
          <strong><Icon name="star" className="icon" /> Quests</strong>
          <span className="muted small">{questsDone}/{dailyQuests.length} habits · {totalPoints(data)} pts <Icon name="chev" className="icon" /></span>
        </div>
        <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${(questsDone / dailyQuests.length) * 100}%` }} /></div>
      </Link>

      {D.moduleOn(data, 'meals') ? (
      <Link to="/meals" className="card" style={{ display: 'block', color: 'inherit' }}>
        <div className="row between">
          <strong>Meals</strong>
          <span className="muted small">{mealsDone}/{content.nutrition.meal_slots.length} logged <Icon name="chev" className="icon" /></span>
        </div>
        <div className="muted small" style={{ margin: '4px 0 10px' }}>{mealDay.label}</div>
        <div className="progress"><span style={{ width: `${(mealsDone / content.nutrition.meal_slots.length) * 100}%` }} /></div>
      </Link>
      ) : null}

      {D.moduleOn(data, 'water') ? (
      <section className="card">
        <div className="row between">
          <strong><Icon name="drop" className="icon" /> Water</strong>
          <span className="muted small">{water} / {WATER_GOAL} ml</span>
        </div>
        <div className="progress" style={{ margin: '10px 0 12px' }}><span style={{ width: `${Math.min(100, (water / WATER_GOAL) * 100)}%` }} /></div>
        <div className="row">
          <button type="button" className="btn secondary small grow" onClick={() => update((d) => D.addWater(d, today, 250))}>+250 ml</button>
          <button type="button" className="btn secondary small grow" onClick={() => update((d) => D.addWater(d, today, 500))}>+500 ml</button>
          <button type="button" className="btn ghost small" aria-label="Undo 250 ml" onClick={() => update((d) => D.addWater(d, today, -250))} disabled={!water}>Undo</button>
        </div>
      </section>
      ) : null}

      {D.moduleOn(data, 'weight') ? (
      <Link to="/stats" className="card" style={{ display: 'block', color: 'inherit' }}>
        <div className="row between">
          <strong><Icon name="scale" className="icon" /> Weight</strong>
          <span className="muted small">{weight ? `${weight.weight_kg} kg · ${formatDate(weight.log_date)}` : 'Log your first weigh-in'} <Icon name="chev" className="icon" /></span>
        </div>
      </Link>
      ) : null}
    </div>
  );
}
