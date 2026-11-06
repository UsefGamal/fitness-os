import { Link, useNavigate } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import GoalCard from '../components/GoalCard.jsx';
import Icon from '../components/Icon.jsx';
import WeekStrip from '../components/WeekStrip.jsx';
import { formatDate, longWeekday, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { dayGroups } from '../lib/insights.js';
import { timesOf } from '../lib/times.js';
import { hm, READINESS_TEXT, readiness } from '../lib/activity.js';
import { eveningDone, eveningOn } from '../lib/evening.js';
import { mealDayFor } from '../lib/meals.js';
import * as P from '../lib/planEdit.js';
import { doneKeys, totalPoints } from '../lib/quests.js';
import { programDayFor, sessionKeyOn, weekView } from '../lib/schedule.js';
import { activePlan } from '../lib/plan.js';
import { backupDue } from '../lib/durable.js';
import { content, useData } from '../store/useData.js';
import { SESSIONS } from './Session.jsx';

const WATER_GOAL = 3000;

export default function Today() {
  const { data, update } = useData();
  const navigate = useNavigate();
  const today = todayISO();
  const T = activePlan(data, content);
  const times = timesOf(data, content);
  const moves = data.session_moves || [];
  const next = programDayFor(today, T, moves);
  const week = weekView(today, T, moves);
  const tonight = eveningOn(data, today);
  const nextGroups = dayGroups(data, P.effectiveDay(next.key, T, data)?.exercises);
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
  const healthOn = data.settings?.health?.enabled;
  const ready = healthOn ? readiness(data.health_daily, today) : null;
  const moved = healthOn ? data.health_daily?.[today] : null;
  const backup = backupDue(data);

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
            <p className="muted" style={{ margin: 0 }}>{longWeekday(next.onDate)} at {times.session_time} · {next.focus}</p>
          </>
        ) : (
          <>
            <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <div className="grow">
                <span className="chip accent">Today at {times.session_time}</span>
                <h2 style={{ marginTop: 10 }}>{next.label}</h2>
                <p className="muted" style={{ margin: '0 0 14px' }}>
                  {next.focus}{next.cardio_after ? `, then ${next.cardio_after.minutes} min cycling` : ''}
                </p>
              </div>
              <div style={{ width: 104, flex: 'none' }}><BodyMap hit={nextGroups} size={104} label={`${next.label} works ${[...nextGroups].join(', ')}`} /></div>
            </div>
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

      {D.moduleOn(data, 'weight') && !data.safety?.hide_weight ? <GoalCard data={data} today={today} /> : null}

      {backup ? (
        <section className="card row" style={{ gap: 10 }} role="status">
          <Icon name="download" />
          <div className="grow small">
            <strong>Back up your data</strong>
            <div className="muted">{backup.days == null ? "You haven't saved a backup yet." : `Last backup ${backup.days} days ago.`} It's the only copy, so keep one somewhere safe.</div>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <Link className="btn small" to="/settings">Back up</Link>
            <button type="button" className="btn ghost small" onClick={() => update((d) => ({ ...d, settings: { ...d.settings, backup_snoozed_at: Date.now() } }))}>Later</button>
          </div>
        </section>
      ) : null}

      {ready && (ready.level !== 'unknown' || moved?.steps != null) ? (
        <section className="card">
          {ready.level !== 'unknown' ? (
            <>
              <div className="row between" style={{ gap: 8 }}>
                <strong>Recovery</strong>
                <span className={`chip${ready.level === 'good' ? ' accent' : ' warn'}`}>
                  <Icon name={ready.level === 'good' ? 'check' : 'heart'} className="icon" /> {ready.level === 'good' ? 'Ready' : ready.level === 'easy' ? 'Take it easy' : 'Go steady'}
                </span>
              </div>
              <div style={{ margin: '6px 0 2px' }}>{READINESS_TEXT[ready.level]}</div>
              <div className="muted small">
                {[
                  ready.sleep_min != null ? `Slept ${hm(ready.sleep_min)}${ready.sleep_base != null ? ` (usual ${hm(ready.sleep_base)})` : ''}` : null,
                  ready.resting_hr != null ? `resting heart rate ${ready.resting_hr}${ready.hr_base != null ? ` (usual ${Math.round(ready.hr_base)})` : ''}` : null,
                ].filter(Boolean).join(' · ')}
              </div>
            </>
          ) : null}
          {moved?.steps != null ? (
            <div className="muted small" style={ready.level !== 'unknown' ? { marginTop: 6 } : undefined}>
              {moved.steps.toLocaleString()} steps today{moved.active_kcal != null ? ` · ${moved.active_kcal} active kcal` : ''}
            </div>
          ) : null}
        </section>
      ) : null}

      {tonight ? (
        <section className="card row" style={{ gap: 12 }}>
          <div className="grow">
            <span className="chip">Tonight at {times.evening_time}</span>
            <div style={{ fontWeight: 600, marginTop: 6 }}>{tonight.label}</div>
            <div className="muted small">{tonight.note}</div>
          </div>
          {eveningDone(data, today, tonight) ? <span className="chip accent"><Icon name="check" /> Done</span> : <button type="button" className="btn secondary small" style={{ width: 'auto' }} onClick={() => navigate(tonight.route)}><Icon name="play" /> Start</button>}
        </section>
      ) : null}

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
