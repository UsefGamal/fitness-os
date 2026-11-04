import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import Stepper from '../components/Stepper.jsx';
import { todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { programDay, programDayFor, sessionKeyOn } from '../lib/schedule.js';
import { content, useData } from '../store/useData.js';
import { useTimer } from '../store/useTimer.js';

function targetReps(reps) {
  const m = /\d+/.exec(String(reps || ''));
  return m ? Number(m[0]) : 10;
}

function elapsed(startedAt, now) {
  const m = Math.floor((now - startedAt) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** After logging a set, which exercise comes next: the pair partner while
 * paired sets remain, else the first exercise not finished. */
function nextIndex(day, workout, data, current) {
  const doneOf = (ex) => {
    const e = D.exerciseByName(data, ex.name);
    return e ? workout.sets.filter((s) => s.exercise_id === e.id).length : 0;
  };
  const ex = day.exercises[current];
  if (ex?.pair) {
    const partnerIdx = day.exercises.findIndex((x, i) => i !== current && x.pair && x.pair[0] === ex.pair[0]);
    if (partnerIdx >= 0 && doneOf(day.exercises[partnerIdx]) < day.exercises[partnerIdx].sets) return partnerIdx;
  }
  if (ex && doneOf(ex) < ex.sets) return current;
  const open = day.exercises.findIndex((x) => doneOf(x) < x.sets);
  return open >= 0 ? open : current;
}

function Picker({ onPick }) {
  return (
    <>
      <div className="section-label">Pick a session</div>
      <div className="list">
        {content.training.program.map((d) => (
          <button key={d.key} type="button" className="list-row" onClick={() => onPick(d.key)}>
            <div className="grow"><div>{d.label}</div><div className="meta">{d.focus}</div></div>
            <Icon name="chev" className="icon chev" />
          </button>
        ))}
      </div>
    </>
  );
}

export default function Workout() {
  const { data, update, activeWorkoutId, setActiveWorkout } = useData();
  const timer = useTimer();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const T = content.training;

  const active = data.workouts.find((w) => w.id === activeWorkoutId && !w.finished_at) || null;
  const requested = params.get('session');
  const scheduledKey = sessionKeyOn(today, T);
  const sessionKey = active?.session_key || requested || (scheduledKey !== 'rest' ? scheduledKey : null);
  const day = sessionKey ? programDay(sessionKey, T) : null;

  const [current, setCurrent] = useState(0);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(10);
  const [toast, setToast] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState('');
  const [pain, setPain] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const ex = day?.exercises[current];
  const exRow = ex ? D.exerciseByName(data, ex.name) : null;

  // Prefill weight and reps whenever the exercise changes.
  useEffect(() => {
    if (!active || !ex || !exRow) return;
    const s = D.suggestSet(data, active.id, exRow.id, targetReps(ex.reps));
    setWeight(s.weightKg);
    setReps(s.reps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, current, sessionKey]);

  const doneSets = useMemo(() => {
    if (!active || !day) return {};
    const out = {};
    for (const x of day.exercises) {
      const e = D.exerciseByName(data, x.name);
      out[x.name] = e ? active.sets.filter((s) => s.exercise_id === e.id) : [];
    }
    return out;
  }, [active, day, data]);

  if (!day) {
    return (
      <div className="page">
        <h1 className="page-title">Start</h1>
        <p className="page-sub">Rest day. Next up: {programDayFor(today, T).label}. Training anyway? Pick a session.</p>
        <Picker onPick={(k) => setParams({ session: k })} />
      </div>
    );
  }

  const start = () => {
    let id;
    update((d) => {
      const r = D.startWorkout(d, { date: today, sessionKey: day.key, label: day.label });
      id = r.workoutId;
      return r.data;
    });
    setActiveWorkout(id);
    setCurrent(0);
  };

  if (!active) {
    const prev = D.workoutOn(data, today);
    return (
      <div className="page">
        <h1 className="page-title">{day.label}</h1>
        <p className="page-sub">{day.focus}{day.cardio_after ? `, then ${day.cardio_after.minutes} min cycling` : ''}</p>
        {prev?.finished_at ? <div className="card muted small">You already finished a session today ({prev.notes}, {prev.sets.length} sets).</div> : null}
        <button type="button" className="btn" onClick={start}><Icon name="play" /> Start {day.label}</button>
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Warm up first</strong>
          <div className="stack small muted" style={{ marginTop: 8 }}>{day.warmup.map((l) => <div key={l}>{l}</div>)}</div>
        </div>
        <div className="list">
          {day.exercises.map((x, i) => (
            <div key={`${x.name}-${i}`} className="list-row">
              <div className="grow"><div>{x.pair ? <span className="pair">{x.pair}</span> : null}{x.name}</div><div className="meta">{x.sets} × {x.reps}{x.rir ? ` · RIR ${x.rir}` : ''}</div></div>
            </div>
          ))}
        </div>
        {requested ? <button type="button" className="btn ghost" onClick={() => setParams({})}>Back to today's plan</button> : null}
      </div>
    );
  }

  const logSet = () => {
    if (!exRow || reps < 1) return;
    const set = { exercise_id: exRow.id, reps, weight_kg: weight };
    const pb = D.isPersonalBest(data, active.id, set);
    update((d) => D.addSet(d, active.id, { exerciseId: exRow.id, reps, weightKg: weight }));
    if (pb && weight > 0) {
      setToast(`New best on ${ex.name}: ${weight} kg × ${reps}`);
      setTimeout(() => setToast(''), 2500);
    }
    const after = { ...active, sets: [...active.sets, { ...set, id: -1, set_number: 0 }] };
    const ni = nextIndex(day, after, data, current);
    const restFor = ex.rest_sec || 90;
    timer.start(restFor, day.exercises[ni].name);
    if (ni !== current) setCurrent(ni);
  };

  const finish = () => {
    update((d) => D.finishWorkout(d, active.id, { sessionRpe: rpe ? Number(rpe) : null, painNote: pain }));
    timer.stop();
    setActiveWorkout(null);
    navigate(`/history/${active.id}`);
  };

  const totalTarget = day.exercises.reduce((n, x) => n + x.sets, 0);
  const totalDone = Object.values(doneSets).reduce((n, s) => n + s.length, 0);

  return (
    <div className="page">
      {toast ? <div className="toast" role="status"><span className="pr">PR</span> {toast}</div> : null}
      <div className="row between" style={{ marginTop: 8 }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 4px' }}>{day.label}</h1>
          <div className="muted small" style={{ margin: '2px 4px 14px' }}>{elapsed(active.started_at, now)} · {totalDone}/{totalTarget} sets · tempo {T.trainer_plan.tempo}</div>
        </div>
        <button type="button" className="btn small" onClick={() => setFinishing(true)}>Finish</button>
      </div>

      {finishing ? (
        <section className="card stack">
          <h2>Finish {day.label}</h2>
          <label className="field">
            <span>How hard was it overall? (1-10)</span>
            <select value={rpe} onChange={(e) => setRpe(e.target.value)}>
              <option value="">Skip</option>
              {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <label className="field"><span>Anything hurt?</span><input type="text" value={pain} onChange={(e) => setPain(e.target.value)} placeholder="Optional" /></label>
          {day.cardio_after ? <div className="muted small">Don't forget: {day.cooldown[0]}</div> : null}
          <button type="button" className="btn" onClick={finish}><Icon name="check" /> Save workout</button>
          <button type="button" className="btn ghost" onClick={() => setFinishing(false)}>Keep going</button>
        </section>
      ) : null}

      {day.exercises.map((x, i) => {
        const sets = doneSets[x.name] || [];
        const isCurrent = i === current;
        return (
          <div key={`${x.name}-${i}`} className={`ex-card${isCurrent ? ' current' : ''}`}>
            <button type="button" className="row between" style={{ width: '100%', background: 'none', border: 0, padding: 0, color: 'inherit', textAlign: 'left' }} onClick={() => setCurrent(i)} aria-expanded={isCurrent}>
              <div className="grow">
                <div className="ex-name">{x.pair ? <span className="pair">{x.pair}</span> : null}{x.name}</div>
                <div className="ex-meta">{x.sets} × {x.reps}{x.rir ? ` · leave ${x.rir} in the tank` : ''} · rest {x.rest}</div>
              </div>
              <span className={`chip${sets.length >= x.sets ? ' accent' : ''}`}>{sets.length}/{x.sets}</span>
            </button>
            {isCurrent ? (
              <div className="stack" style={{ marginTop: 12 }}>
                {x.note ? <div className="ex-note">{x.note}</div> : null}
                {sets.map((s) => (
                  <div key={s.id} className="set-row">
                    <span className="set-n done">{s.set_number}</span>
                    <span>{s.weight_kg} kg × {s.reps}</span>
                    <span />
                    <button type="button" className="icon-btn" aria-label={`Delete set ${s.set_number}`} onClick={() => update((d) => D.deleteSet(d, active.id, s.id))}><Icon name="trash" /></button>
                  </div>
                ))}
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="grow"><Stepper label="kg" value={weight} onChange={setWeight} step={2.5} max={500} decimals={2} /></div>
                  <div className="grow"><Stepper label="reps" value={reps} onChange={setReps} step={1} min={0} max={100} /></div>
                </div>
                <button type="button" className="btn" onClick={logSet}><Icon name="check" /> Log set {sets.length + 1}</button>
                <div className="row between">
                  {x.video ? <a href={x.video} target="_blank" rel="noreferrer" className="small"><Icon name="video" className="icon" /> Form video</a> : <span />}
                  {x.alternative ? <span className="muted small">Taken? {x.alternative}</span> : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
