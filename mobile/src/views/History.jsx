import { useNavigate, useParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import { formatDate } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { useData } from '../store/useData.js';

export default function History() {
  const { id } = useParams();
  const { data, update, activeWorkoutId, setActiveWorkout } = useData();
  const navigate = useNavigate();
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
    navigate('/stats');
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{w.notes || w.workout_type}</h1>
      <p className="page-sub">{formatDate(w.log_date)}{w.duration_min ? ` · ${w.duration_min} min` : ''}{w.session_rpe ? ` · RPE ${w.session_rpe}` : ''}</p>
      <div className="stat-grid">
        <div className="stat"><div className="label">Sets</div><div className="value">{w.sets.length}</div></div>
        <div className="stat"><div className="label">Volume</div><div className="value">{Math.round(volume)}<span className="unit">kg</span></div></div>
      </div>
      {w.pain_note ? <div className="card small"><span className="chip warn">Pain note</span> {w.pain_note}</div> : null}
      {groups.map((g) => (
        <section key={g.exercise_id} className="card">
          <strong>{g.name}</strong>
          <div style={{ marginTop: 6 }}>
            {g.sets.map((s) => (
              <div key={s.id} className="set-row">
                <span className="set-n done">{s.set_number}</span>
                <span>{s.weight_kg} kg × {s.reps}{s.rpe ? <span className="muted"> · RPE {s.rpe}</span> : null}</span>
                <span />
                <button type="button" className="icon-btn" aria-label={`Delete set ${s.set_number}`} onClick={() => update((d) => D.deleteSet(d, w.id, s.id))}><Icon name="trash" /></button>
              </div>
            ))}
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
