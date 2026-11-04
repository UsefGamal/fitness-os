import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import { formatDate, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { syncHealth } from '../store/phoneSync.js';
import { content, useData } from '../store/useData.js';

const T = content.training;

export const SESSIONS = {
  home: { label: 'Home workout', note: 'Bodyweight, no gym needed', minutes: 40 },
  recovery: { label: 'Recovery', note: 'Walk, stretch, breathe', minutes: 30 },
  cardio: { label: 'Cardio', note: T.cardio_session.label, minutes: 25 },
  padel: { label: 'Padel', note: 'Match or practice', minutes: 90 },
};

const RESULTS = [['win', 'Win'], ['draw', 'Draw'], ['loss', 'Loss']];

function Checklist({ title, items, ticked, onTick }) {
  if (!items?.length) return null;
  return (
    <>
      <div className="section-label">{title}</div>
      <div className="list">
        {items.map((name) => {
          const on = ticked.has(name);
          return (
            <button key={name} type="button" className="list-row" aria-pressed={on} onClick={() => onTick(name)}>
              <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
              <div className="grow">{name}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function Session() {
  const { type } = useParams();
  const meta = SESSIONS[type];
  const navigate = useNavigate();
  const { update } = useData();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [homeDay, setHomeDay] = useState(0);
  const [machine, setMachine] = useState(T.cardio_session.label);
  const [minutes, setMinutes] = useState(meta?.minutes ?? 30);
  const [rpe, setRpe] = useState('');
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [ticked, setTicked] = useState(new Set());
  if (!meta) return <div className="page"><div className="card empty">Unknown session.</div></div>;

  const tick = (name) => setTicked((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const home = T.home_program[homeDay];
  let sections = [];
  if (type === 'home') {
    sections = [['Warm-up', home.warmup], ['Exercises', home.exercises.map((e) => `${e.name} · ${e.reps}`)], ['Cool-down', home.cooldown]];
  } else if (type === 'recovery') {
    sections = [['Checklist', T.recovery_checklist]];
  } else if (type === 'cardio') {
    sections = [['Warm-up', T.cardio_session.warmup], ['Cool-down', T.cardio_session.cooldown]];
  }
  const items = sections.flatMap(([, list]) => list || []);
  const label = type === 'home' ? home.label : type === 'cardio' ? machine : meta.label;
  const mins = Number(minutes);
  const rpeN = rpe === '' ? null : Number(rpe);
  const valid = mins >= 1 && mins <= 600 && (rpeN == null || (rpeN >= 1 && rpeN <= 10)) && date <= today;

  const save = () => {
    update((d) => D.logSession(d, {
      date, type, label, durationMin: mins, sessionRpe: rpeN, result: type === 'padel' ? result : null, notes: notes.trim() || null,
      checklist: items.map((name) => ({ item_name: name, completed: ticked.has(name) })),
    }));
    syncHealth().catch(() => {});
    navigate('/history');
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{meta.label}</h1>
      <p className="page-sub">{date === today ? 'Today' : formatDate(date)}</p>

      {type === 'home' ? (
        <div className="seg" style={{ marginBottom: 12 }}>
          {T.home_program.map((d, i) => (
            <button key={d.day_letter} type="button" className={i === homeDay ? 'on' : ''} onClick={() => { setHomeDay(i); setTicked(new Set()); }}>{d.label.replace(' (Home)', '')}</button>
          ))}
        </div>
      ) : null}
      {type === 'home' ? <div className="card small muted">{home.focus}</div> : null}
      {type === 'cardio' ? (
        <section className="card stack">
          <div className="small">{T.cardio_session.target}</div>
          <div className="muted small">{T.cardio_session.frequency_note}</div>
          <label className="field"><span>Machine</span>
            <select value={machine} onChange={(e) => setMachine(e.target.value)}>
              {[T.cardio_session.label, ...T.cardio_alternatives.map((a) => a.split(',')[0])].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
        </section>
      ) : null}

      {sections.map(([title, list]) => <Checklist key={title} title={title} items={list} ticked={ticked} onTick={tick} />)}

      <section className="card stack">
        <div className="row">
          <label className="field grow"><span>Minutes</span><input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
          <label className="field grow"><span>Effort, 1-10</span><input type="number" inputMode="numeric" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} /></label>
        </div>
        {type === 'padel' ? (
          <div className="seg">
            {RESULTS.map(([k, l]) => <button key={k} type="button" className={result === k ? 'on' : ''} onClick={() => setResult(result === k ? null : k)}>{l}</button>)}
          </div>
        ) : null}
        <label className="field"><span>Date</span><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Notes</span><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
        <button type="button" className="btn" disabled={!valid} onClick={save}><Icon name="check" /> Save session</button>
      </section>
    </div>
  );
}
