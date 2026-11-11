import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import ConfirmSheet from '../components/ConfirmSheet.jsx';
import Icon from '../components/Icon.jsx';
import Stepper from '../components/Stepper.jsx';
import { formatDate, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { workoutSummary } from '../lib/summary.js';
import { useData } from '../store/useData.js';

function SetEditor({ set, onSave, onCancel, onDelete }) {
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
      <button type="button" className="btn ghost small" style={{ color: 'var(--danger)' }} onClick={onDelete}><Icon name="trash" /> {t('history.deleteSet', { n: set.set_number })}</button>
    </div>
  );
}

export default function History() {
  const { id } = useParams();
  const { data, update, activeWorkoutId, setActiveWorkout } = useData();
  const navigate = useNavigate();
  const justFinished = Boolean(useLocation().state?.finished);
  const [editing, setEditing] = useState(null);
  const [editDate, setEditDate] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const w = data.workouts.find((x) => x.id === Number(id));
  if (!w) return <div className="page"><div className="card empty">That workout isn't here anymore.</div></div>;

  const groups = [];
  for (const s of w.sets) {
    let g = groups.find((x) => x.exercise_id === s.exercise_id);
    if (!g) groups.push((g = { exercise_id: s.exercise_id, name: data.exercises.find((e) => e.id === s.exercise_id)?.name || 'Exercise', sets: [] }));
    g.sets.push(s);
  }
  const volume = w.sets.reduce((v, s) => v + (D.isWorkSet(s) ? s.weight_kg * s.reps : 0), 0);

  const sum = justFinished ? workoutSummary(data, w.id) : null;

  const remove = () => {
    if (activeWorkoutId === w.id) setActiveWorkout(null);
    update((d) => D.deleteWorkout(d, w.id));
    navigate('/history');
  };

  return (
    <div className="page">
      {sum ? (
        <section className="card finish-card" aria-label={t('finish.title')}>
          <div className="finish-tick"><Icon name="check" /></div>
          <h2 className="finish-title">{t('finish.title')}</h2>
          <p className="muted" style={{ margin: '2px 0 14px' }}>{t(sum.weekSessions === 1 ? 'finish.weekOne' : 'finish.week', { n: sum.weekSessions })}</p>
          <div className="finish-stats">
            {sum.durationMin ? <div><strong>{sum.durationMin}</strong><span>{t('finish.min')}</span></div> : null}
            <div><strong>{sum.sets}</strong><span>{t('finish.sets')}</span></div>
            <div><strong>{sum.volumeKg.toLocaleString('en')}</strong><span>{t('finish.lifted')}</span></div>
          </div>
          {sum.bests.length ? (
            <div className="finish-bests">
              <div className="muted small">{t(sum.bests.length === 1 ? 'finish.bestOne' : 'finish.bests', { n: sum.bests.length })}</div>
              {sum.bests.map((b) => <div key={b.name} className="row between"><span>{b.name}</span><strong>{t('workout.setLine', { kg: b.kg, reps: b.reps })}</strong></div>)}
            </div>
          ) : null}
          <button type="button" className="btn" onClick={() => navigate('/', { replace: true })}>{t('finish.done')}</button>
        </section>
      ) : (
        <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      )}
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
              <SetEditor key={s.id} set={s} onCancel={() => setEditing(null)} onSave={(changes) => { update((d) => D.updateSet(d, w.id, s.id, changes)); setEditing(null); }} onDelete={() => { update((d) => D.deleteSet(d, w.id, s.id)); setEditing(null); }} />
            ) : (
              <div key={s.id} className="set-row">
                <span className="set-n done">{s.set_number}</span>
                <button type="button" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'start', minHeight: 44, padding: 0 }} onClick={() => setEditing(s.id)} aria-label={`Edit set ${s.set_number}`}>
                  {s.weight_kg} kg × {s.reps}{s.rpe ? <span className="muted"> · RPE {s.rpe}</span> : null}
                </button>
                <span />
                <Icon name="chev" className="icon chev" />
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
      <button type="button" className="btn danger" onClick={() => setConfirming(true)}><Icon name="trash" /> Delete workout</button>
      {confirming ? <ConfirmSheet title={t('history.deleteTitle')} body={t('history.deleteBody', { n: w.sets.length })} action={t('history.deleteTitle')} onConfirm={remove} onClose={() => setConfirming(false)} /> : null}
    </div>
  );
}
