import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import Stepper from '../components/Stepper.jsx';
import { formatDate, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { useData } from '../store/useData.js';

function SetEditor({ set, onSave, onCancel }) {
  const [w, setW] = useState(set.weight_kg);
  const [r, setR] = useState(set.reps);
  return (
    <div className="stack" style={{ padding: '8px 0' }}>
      <div className="row">
        <div className="grow"><Stepper label="kg" value={w} onChange={setW} step={2.5} max={500} decimals={2} /></div>
        <div className="grow"><Stepper label="reps" value={r} onChange={setR} min={1} max={100} /></div>
      </div>
      <div className="row">
        <button type="button" className="btn small grow" onClick={() => onSave({ weight_kg: w, reps: r })}>Save set</button>
        <button type="button" className="btn ghost small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function History() {
  const { id } = useParams();
  const { data, update, activeWorkoutId, setActiveWorkout } = useData();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [editDate, setEditDate] = useState(false);
  const w = data.workouts.find((x) => x.id === Number(id));
  if (!w) return <div className="page"><div className="card empty">That workout isn't here anymore.</div></div>;

  const groups = [];
  for (const s of w.sets) {
    let g = groups.find((x) => x.exercise_id === s.exercise_id);
    if (!g) groups.push((g = { exercise_id: s.exercise_id, name: data.exercises.find((e) => e.id === s.exercise_id)?.name || 'Exercise', sets: [] }));
    g.sets.push(s);
  }
  const volume = w.sets.reduce((v, s) => v + s.weight_kg * s.reps, 0);

  const remove = () => {
    if (!window.confirm('Delete this workout and all its sets?')) return;
    if (activeWorkoutId === w.id) setActiveWorkout(null);
    update((d) => D.deleteWorkout(d, w.id));
    navigate('/history');
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{w.notes || w.workout_type}</h1>
      {editDate ? (
        <div className="row" style={{ margin: '-8px 0 16px' }}>
          <input type="date" value={w.log_date} max={todayISO()} aria-label="Workout date" onChange={(e) => e.target.value && update((d) => D.editWorkout(d, w.id, { log_date: e.target.value }))} />
          <button type="button" className="btn small" onClick={() => setEditDate(false)}>Done</button>
        </div>
      ) : (
        <p className="page-sub">
          {formatDate(w.log_date)}{w.duration_min ? ` · ${w.duration_min} min` : ''}{w.session_rpe ? ` · RPE ${w.session_rpe}` : ''}{' '}
          <button type="button" className="btn ghost small" style={{ display: 'inline-flex', minHeight: 28, padding: '0 6px' }} onClick={() => setEditDate(true)}>Change date</button>
        </p>
      )}
      <div className="stat-grid">
        <div className="stat"><div className="label">Sets</div><div className="value">{w.sets.length}</div></div>
        <div className="stat"><div className="label">Volume</div><div className="value">{Math.round(volume)}<span className="unit">kg</span></div></div>
      </div>
      {w.pain_note ? <div className="card small"><span className="chip warn">Pain note</span> {w.pain_note}</div> : null}
      {groups.map((g) => (
        <section key={g.exercise_id} className="card">
          <strong>{g.name}</strong>
          <div style={{ marginTop: 6 }}>
            {g.sets.map((s) => (editing === s.id ? (
              <SetEditor key={s.id} set={s} onCancel={() => setEditing(null)} onSave={(changes) => { update((d) => D.updateSet(d, w.id, s.id, changes)); setEditing(null); }} />
            ) : (
              <div key={s.id} className="set-row">
                <span className="set-n done">{s.set_number}</span>
                <button type="button" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', minHeight: 44, padding: 0 }} onClick={() => setEditing(s.id)} aria-label={`Edit set ${s.set_number}`}>
                  {s.weight_kg} kg × {s.reps}{s.rpe ? <span className="muted"> · RPE {s.rpe}</span> : null}
                </button>
                <span />
                <button type="button" className="icon-btn" aria-label={`Delete set ${s.set_number}`} onClick={() => update((d) => D.deleteSet(d, w.id, s.id))}><Icon name="trash" /></button>
              </div>
            )))}
          </div>
        </section>
      ))}
      {w.checklist_items.length ? (
        <section className="card">
          {w.checklist_items.map((c) => <div key={c.id} className="row small"><Icon name={c.completed ? 'check' : 'x'} /> {c.item_name}{c.reps_achieved ? ` · ${c.reps_achieved} reps` : ''}</div>)}
        </section>
      ) : null}
      <button type="button" className="btn danger" onClick={remove}><Icon name="trash" /> Delete workout</button>
    </div>
  );
}
