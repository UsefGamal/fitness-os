import { useState } from 'react';
import { Link } from 'react-router';

import Icon from '../components/Icon.jsx';
import WeightChart from '../components/WeightChart.jsx';
import { formatDate, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { useData } from '../store/useData.js';

export default function Stats() {
  const { data, update } = useData();
  const today = todayISO();
  const latest = D.latestWeight(data);
  const [weight, setWeight] = useState(latest ? String(latest.weight_kg) : '');
  const [waist, setWaist] = useState('');
  const [tab, setTab] = useState('body');
  const goalLow = data.profile?.goal_weight_low_kg;
  const goalHigh = data.profile?.goal_weight_high_kg;
  const recent = data.body_logs.slice(-60);
  const first = data.body_logs[0];
  const workouts = [...data.workouts].sort((a, b) => (a.log_date === b.log_date ? b.id - a.id : a.log_date < b.log_date ? 1 : -1));
  const bests = [...D.personalBests(data).values()]
    .map((b) => ({ ...b, name: data.exercises.find((e) => e.id === b.exercise_id)?.name || 'Exercise' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const thisWeek = data.workouts.filter((w) => new Date(w.log_date) >= weekAgo).length;

  const save = (e) => {
    e.preventDefault();
    const kg = parseFloat(weight);
    if (!(kg >= 20 && kg <= 400)) return;
    const cm = parseFloat(waist);
    update((d) => D.logBody(d, { log_date: today, weight_kg: kg, ...(cm >= 20 && cm <= 300 ? { waist_cm: cm } : {}) }));
    setWaist('');
  };

  return (
    <div className="page">
      <h1 className="page-title">Stats</h1>
      <div className="seg" style={{ marginBottom: 14 }}>
        {[['body', 'Body'], ['history', 'History'], ['records', 'Records']].map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'body' ? (
        <>
          <div className="stat-grid">
            <div className="stat"><div className="label">Now</div><div className="value">{latest ? latest.weight_kg : '–'}<span className="unit">kg</span></div></div>
            <div className="stat"><div className="label">Change</div><div className="value">{latest && first ? (latest.weight_kg - first.weight_kg).toFixed(1) : '–'}<span className="unit">kg</span></div></div>
          </div>
          <section className="card">
            <div className="row between"><strong>Weight</strong>{goalLow ? <span className="muted small">Goal {goalLow}–{goalHigh} kg</span> : null}</div>
            <WeightChart logs={recent} goalLow={goalLow} goalHigh={goalHigh} />
          </section>
          <form className="card stack" onSubmit={save}>
            <strong>Log today's weigh-in</strong>
            <div className="row">
              <label className="field grow"><span>Weight (kg)</span><input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required /></label>
              <label className="field grow"><span>Waist (cm)</span><input type="number" inputMode="decimal" step="0.5" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="Optional" /></label>
            </div>
            <button type="submit" className="btn">Save</button>
          </form>
          {data.body_logs.length ? (
            <div className="list">
              {[...data.body_logs].reverse().slice(0, 10).map((b) => (
                <div key={b.id} className="list-row">
                  <div className="grow">{b.weight_kg} kg{b.waist_cm ? <span className="meta"> · waist {b.waist_cm} cm</span> : null}</div>
                  <span className="meta">{formatDate(b.log_date)}</span>
                  <button type="button" className="icon-btn" aria-label={`Delete weigh-in on ${b.log_date}`} onClick={() => update((d) => D.deleteBody(d, b.id))}><Icon name="trash" /></button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {tab === 'history' ? (
        <>
          <div className="muted small" style={{ margin: '0 4px 10px' }}>{thisWeek} sessions in the last 7 days · {data.workouts.length} in total</div>
          {workouts.length ? (
            <div className="list">
              {workouts.slice(0, 100).map((w) => (
                <Link key={w.id} to={`/history/${w.id}`} className="list-row">
                  <div className="grow"><div>{w.notes || w.workout_type}</div><div className="meta">{formatDate(w.log_date)} · {w.sets.length} sets{w.duration_min ? ` · ${w.duration_min} min` : ''}</div></div>
                  <Icon name="chev" className="icon chev" />
                </Link>
              ))}
            </div>
          ) : <div className="card empty">No workouts yet. Start one from the Start tab.</div>}
        </>
      ) : null}

      {tab === 'records' ? (
        bests.length ? (
          <div className="list">
            {bests.map((b) => (
              <div key={b.exercise_id} className="list-row">
                <div className="grow"><div>{b.name}</div><div className="meta">{formatDate(b.log_date)} · est. 1RM {Math.round(b.score)} kg</div></div>
                <strong>{b.weight_kg} × {b.reps}</strong>
              </div>
            ))}
          </div>
        ) : <div className="card empty">Your best set per exercise shows up here.</div>
      ) : null}
    </div>
  );
}
