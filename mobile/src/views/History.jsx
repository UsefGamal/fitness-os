import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import ConfirmSheet from '../components/ConfirmSheet.jsx';
import Icon from '../components/Icon.jsx';
import LeapMark from '../components/LeapMark.jsx';
import MoreMenu from '../components/MoreMenu.jsx';
import Stepper from '../components/Stepper.jsx';
import { formatDate, LOCALE, todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { setLabel } from '../lib/sets.js';
import { t } from '../lib/i18n.js';
import { starterJustDone, starterProgress, STARTER_SESSIONS } from '../lib/starter.js';
import { workoutSummary } from '../lib/summary.js';
import { keptWeekBy } from '../lib/weekStats.js';
import { useFinishBadges } from '../store/finishBadges.js';
import { compareToLast, setsText } from '../lib/lastTime.js';
import { activePlan } from '../lib/plan.js';
import { nextSessionAfter } from '../lib/schedule.js';
import { content, useData } from '../store/useData.js';

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
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const activeWorkoutId = useData((s) => s.activeWorkoutId);
  const setActiveWorkout = useData((s) => s.setActiveWorkout);
  const navigate = useNavigate();
  const justFinished = Boolean(useLocation().state?.finished);
  // This workout's badges (Fanfare hands them over); gone once you leave.
  const earned = useFinishBadges((st) => st.list);
  const clearEarned = useFinishBadges((st) => st.clear);
  useEffect(() => clearEarned, [clearEarned]);
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
  const volume = w.sets.reduce((v, s) => v + (D.isWorkSet(s) && s.track !== 'time' ? s.weight_kg * s.reps : 0), 0);

  const sum = justFinished ? workoutSummary(data, w.id) : null;
  const kept = justFinished ? keptWeekBy(data, w) : 0;
  // The finish is the moment people remember (LF-9): the mark, the one best
  // number, then what comes next.
  const comingUp = sum ? nextSessionAfter(w.log_date, activePlan(data, content), data.session_moves || []) : null;
  const topBest = sum?.bests?.[0] || null;
  // Against the last run of the same session (charts step 3).
  const cmp = w.session_key ? compareToLast(data, w) : null;
  // Starter fortnight: say where a beginner is after this session.
  const starter = justFinished ? starterProgress(data) : null;
  const starterNote = !justFinished ? null
    : starterJustDone(data, w.id) ? t('starter.finished', { all: STARTER_SESSIONS })
      : starter && starter.done > 0 ? t('starter.done', { n: starter.done, all: starter.total }) : null;

  const remove = () => {
    if (activeWorkoutId === w.id) setActiveWorkout(null);
    update((d) => D.deleteWorkout(d, w.id));
    navigate('/history');
  };

  return (
    <div className="page">
      {sum ? (
        <section className="card finish-card" aria-label={t('finish.title')}>
          <div className="finish-tick" aria-hidden="true"><LeapMark size={34} draw /></div>
          <h2 className="finish-title">{t('finish.title')}</h2>
          <p className="muted" style={{ margin: '2px 0 14px' }}>{t(sum.weekSessions === 1 ? 'finish.weekOne' : 'finish.week', { n: sum.weekSessions })}</p>
          {starterNote ? <p className="starter-line" style={{ margin: '-6px 0 14px' }}>{starterNote}</p> : null}
          {kept ? <p className="finish-kept small">{kept >= 2 ? t('finish.kept', { n: kept }) : t('finish.keptOne')}</p> : null}
          {earned.length ? (
            <div className="finish-badges" role="list" aria-label={t('finish.badges')}>
              {earned.map((b) => <span key={b.id} role="listitem" className="chip accent"><Icon name="trophy" className="icon" /> {b.label}</span>)}
            </div>
          ) : null}
          {topBest ? (
            <div className="finish-hero">
              <span className="muted small">{t('finish.newBest', { name: topBest.name })}</span>
              <span className="hero-num finish-hero-num">{t('workout.setLine', { kg: topBest.kg, reps: topBest.reps })}</span>
            </div>
          ) : null}
          <div className="finish-stats">
            {sum.durationMin ? <div><strong>{sum.durationMin}</strong><span>{t('finish.min')}</span></div> : null}
            <div><strong>{sum.sets}</strong><span>{t('finish.sets')}</span></div>
            <div><strong>{sum.volumeKg.toLocaleString(LOCALE)}</strong><span>{t('finish.lifted')}</span></div>
          </div>
          {sum.ranLong ? <p className="muted small" style={{ margin: '10px 0 0' }}>{t('finish.ranLong')}</p> : null}
          {cmp?.last ? <Compare cmp={cmp} data={data} w={w} /> : null}
          {sum.bests.length ? (
            <div className="finish-bests">
              <div className="muted small">{t(sum.bests.length === 1 ? 'finish.bestOne' : 'finish.bests', { n: sum.bests.length })}</div>
              {sum.bests.map((b) => <div key={b.name} className="row between"><span>{b.name}</span><strong>{t('workout.setLine', { kg: b.kg, reps: b.reps })}</strong></div>)}
            </div>
          ) : null}
          {comingUp ? <p className="finish-next small"><Icon name="calendar" className="icon" /> {t('finish.next', { label: comingUp.label, date: formatDate(comingUp.onDate) })}</p> : null}
          <button type="button" className="btn hero" onClick={() => { clearEarned(); navigate('/', { replace: true }); }}>{t('finish.done')}</button>
        </section>
      ) : (
        <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      )}
      <div className="plan-head">
        <h1 className="page-title" style={{ marginTop: 4 }}>{w.notes || w.workout_type}</h1>
        <MoreMenu title={w.notes || w.workout_type} actions={[{ key: 'delete', label: t('history.deleteTitle'), icon: 'trash', danger: true, onClick: () => setConfirming(true) }]} />
      </div>
      {editDate ? (
        <div className="row" style={{ margin: '-8px 0 16px' }}>
          <input type="date" value={w.log_date} max={todayISO()} aria-label={t('aria.workoutDate')} onChange={(e) => e.target.value && update((d) => D.editWorkout(d, w.id, { log_date: e.target.value }))} />
          <button type="button" className="btn small" onClick={() => setEditDate(false)}>Done</button>
        </div>
      ) : (
        <p className="page-sub">
          {formatDate(w.log_date)}{w.duration_min ? ` · ${w.duration_min} min` : ''}{w.session_rpe ? ` · RPE ${w.session_rpe}` : ''}{' '}
          <button type="button" className="btn ghost small" style={{ display: 'inline-flex', minHeight: 44, padding: '0 6px' }} onClick={() => setEditDate(true)}>Change date</button>
        </p>
      )}
      <div className="stat-grid">
        <div className="stat"><div className="label">Sets</div><div className="value">{w.sets.length}</div></div>
        <div className="stat"><div className="label">Volume</div><div className="value">{Math.round(volume).toLocaleString(LOCALE)}<span className="unit">kg</span></div></div>
      </div>
      {!sum && cmp?.last ? <section className="card"><Compare cmp={cmp} data={data} w={w} /></section> : null}
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
                <button type="button" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'start', minHeight: 44, padding: 0 }} onClick={() => setEditing(s.id)} aria-label={`${setLabel(s)}${s.rpe ? ` · RPE ${s.rpe}` : ''}, edit set ${s.set_number}`}>
                  {setLabel(s)}{s.rpe ? <span className="muted"> · RPE {s.rpe}</span> : null}
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
          {w.checklist_items.map((c) => <div key={c.id} className="row small"><Icon name={c.completed ? 'check' : 'x'} /> {c.item_name}{c.reps_achieved ? ` · ${c.reps_achieved} ${w.intervals ? 'rounds' : 'reps'}` : ''}</div>)}
        </section>
      ) : null}
      {confirming ? <ConfirmSheet title={t('history.deleteTitle')} body={t('history.deleteBody', { n: w.sets.length })} action={t('history.deleteTitle')} onConfirm={remove} onClose={() => setConfirming(false)} /> : null}
    </div>
  );
}

const MARK = { up: '▲', held: '=', down: '▼' };

/** Lifts up / held / down against the last run of this session, then one
 * row per exercise with its top set (charts step 3). A recovery-week
 * session says lower is expected, so a dip never reads as a failure. */
function Compare({ cmp, data, w }) {
  const name = (id) => data.exercises.find((e) => e.id === id)?.name || 'Exercise';
  const judged = cmp.counts.up + cmp.counts.held + cmp.counts.down;
  return (
    <div className="compare">
      <div className="muted small" style={{ marginTop: 14 }}>{t('compare.title', { date: formatDate(cmp.last.log_date) })}</div>
      {judged ? (
        <div className="movers-counts" role="group" aria-label={t('movers.aria', cmp.counts)}>
          <div className="up"><strong>{cmp.counts.up}</strong><span>{t('movers.up')}</span></div>
          <div><strong>{cmp.counts.held}</strong><span>{t('movers.held')}</span></div>
          <div className="down"><strong>{cmp.counts.down}</strong><span>{t('movers.down')}</span></div>
        </div>
      ) : null}
      {w.is_deload ? <p className="muted small" style={{ margin: '0 0 6px' }}>{t('compare.deload')}</p> : null}
      <div className="compare-rows">
        {cmp.rows.map((r) => (
          <div key={r.exercise_id} className="compare-row">
            <span className="grow"><span>{name(r.exercise_id)}</span>{r.top ? <span className="meta">{t('compare.top', { text: setsText([r.top]) })}</span> : null}</span>
            <span className={`chip${r.outcome === 'up' ? ' accent' : ''}`}>{r.outcome ? `${MARK[r.outcome]} ${t(`movers.${r.outcome}`)}` : t('compare.new')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
