import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import ExercisePhotos from '../components/ExercisePhotos.jsx';
import Sheet from '../components/Sheet.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import Icon from '../components/Icon.jsx';
import Stepper from '../components/Stepper.jsx';
import { entryFor, groupOf } from '../lib/catalogue.js';
import { todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { effectiveDay } from '../lib/planEdit.js';
import { BARS, isBarbell, plateText, platesPerSide, warmupSets } from '../lib/plates.js';
import { progressionTarget } from '../lib/progression.js';
import { alternatives } from '../lib/similar.js';
import { addExtraSet, applyTweaks, emptyTweaks, exerciseNote, moveBy, setExerciseNote, setTweaks, skipToEnd, swapFor } from '../lib/tweaks.js';
import { buildSession, buildSwaps, ownedKinds } from '../lib/equipment.js';
import { activeMs, clock, pauseWorkout, restFor, restoreSet, resumeWorkout, targetProgress, trainingSettings } from '../lib/training.js';
import { programDayFor, sessionKeyOn } from '../lib/schedule.js';
import { useKeepAwake } from '../store/awake.js';
import { feedback, unlockAudio } from '../store/feedback.js';
import { syncHealth } from '../store/phoneSync.js';
import { content, useData } from '../store/useData.js';
import { useCatalogue } from '../store/catalogue.js';
import { useTimer } from '../store/useTimer.js';

function targetReps(reps) {
  const m = /\d+/.exec(String(reps || ''));
  return m ? Number(m[0]) : 10;
}

// Rest choices for one exercise in this session: 0:15 to 3:00 in 15 s
// steps, then to 15:00 in 30 s steps.
const REST_STEPS = [...Array.from({ length: 12 }, (_, i) => (i + 1) * 15), ...Array.from({ length: 24 }, (_, i) => 210 + i * 30)];

function elapsed(ms) {
  const m = Math.floor(ms / 60000);
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

function IntervalsLink() {
  const navigate = useNavigate();
  return (
    <div className="list" style={{ marginTop: 12 }}>
      <button type="button" className="list-row" onClick={() => navigate('/intervals')}>
        <Icon name="waves" />
        <div className="grow"><div>Intervals</div><div className="meta">HIIT, Tabata, EMOM or your own</div></div>
        <Icon name="chev" className="icon chev" />
      </button>
    </div>
  );
}

function Picker({ onPick }) {
  return (
    <>
      <IntervalsLink />
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
  const { catalogue } = useCatalogue();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  const T = content.training;

  const active = data.workouts.find((w) => w.id === activeWorkoutId && !w.finished_at) || null;
  const requested = params.get('session');
  const scheduledKey = sessionKeyOn(today, T, data.session_moves || []);
  const sessionKey = active?.session_key || requested || (scheduledKey !== 'rest' ? scheduledKey : null);
  const planDay = sessionKey ? effectiveDay(sessionKey, T, data) : null;
  // Today's changes (extra sets, skips, swaps) live on the workout, not the plan.
  const day = planDay && active ? applyTweaks(planDay, active.tweaks) : planDay;

  const [current, setCurrent] = useState(0);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(10);
  const [toast, setToast] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState('');
  const [pain, setPain] = useState('');
  const [now, setNow] = useState(Date.now());
  const [restOverride, setRestOverride] = useState({}); // exercise name -> seconds for this session
  const [undo, setUndo] = useState(null); // { set, label } after a delete
  const [sheet, setSheet] = useState(null); // 'warmups' | 'swap' | 'note' | null
  const [noteText, setNoteText] = useState('');
  const settings = trainingSettings(data);
  const [useBuild, setUseBuild] = useState(true);
  useKeepAwake(Boolean(active));

  useEffect(() => {
    if (!undo) return undefined;
    const id = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(id);
  }, [undo]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const ex = day?.exercises[current];
  const exRow = ex ? D.exerciseByName(data, ex.name) : null;
  const entry = ex && catalogue ? entryFor(ex.name, content.training, catalogue.byId) : null;
  const barbell = ex ? isBarbell(ex.name, entry) : false;
  const barKg = BARS[settings.bar]?.kg ?? 20;

  // Double progression from earlier sessions (lib/progression.js).
  const target = useMemo(() => {
    if (!active || !ex || !exRow) return null;
    const sessions = D.exerciseHistory(data, exRow.id).filter((h) => h.workoutId !== active.id).map((h) => h.sets);
    const small = entry ? entry.mechanic === 'isolation' : !barbell;
    return progressionTarget(ex.reps, ex.sets, sessions, { step: small ? 1 : 2.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, ex?.name, exRow?.id, catalogue]);

  // Prefill weight and reps whenever the exercise changes: the last set of
  // today, else the progression target, else last time's first set.
  useEffect(() => {
    if (!active || !ex || !exRow) return;
    const doneToday = active.sets.some((s) => s.exercise_id === exRow.id);
    const s = D.suggestSet(data, active.id, exRow.id, targetReps(ex.reps));
    if (!doneToday && target?.weightKg != null) {
      setWeight(target.weightKg);
      setReps(target.reps ?? s.reps);
    } else {
      setWeight(s.weightKg);
      setReps(doneToday ? s.reps : target?.reps ?? s.reps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, current, sessionKey, ex?.name, target]);

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
        <p className="page-sub">Rest day. Next up: {programDayFor(today, T, data.session_moves || []).label}. Training anyway? Pick a session.</p>
        <Picker onPick={(k) => setParams({ session: k })} />
      </div>
    );
  }

  // With limited equipment, swap what can't be done for the closest match.
  const owned = ownedKinds(settings);
  const build = !active && owned && planDay && catalogue ? buildSession(planDay, { training: T, catalogue, owned }) : null;
  const swaps = build && useBuild ? buildSwaps(build) : {};

  const start = () => {
    unlockAudio();
    feedback('workoutStart');
    let id;
    update((d) => {
      let next = d;
      for (const b of build || []) {
        if (b.status === 'swap' && swaps[b.orig]) next = D.addCustomExercise(next, { name: b.to.name, muscle_group: groupOf(b.to), equipment: b.to.equipment });
      }
      const r = D.startWorkout(next, { date: today, sessionKey: day.key, label: day.label });
      id = r.workoutId;
      return Object.keys(swaps).length ? setTweaks(r.data, id, { ...emptyTweaks(day.exercises.length), swaps }) : r.data;
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
        {build && build.some((b) => b.status !== 'keep') ? (
          <section className="card stack">
            <div className="row between"><strong>With your equipment</strong><Link to="/settings" className="small">Change</Link></div>
            {build.filter((b) => b.status !== 'keep').map((b) => (
              <div key={b.orig} className="small">
                {b.status === 'swap' ? <>{b.name} <span className="muted">→</span> <strong>{b.to.name}</strong></> : null}
                {b.status === 'none' ? <>{b.name} <span className="muted">· no match without more equipment, skip it or do it as planned</span></> : null}
                {b.status === 'unknown' ? <span className="muted">{b.name} · kept (can't tell its equipment)</span> : null}
              </div>
            ))}
            {Object.keys(buildSwaps(build)).length ? (
              <label className="row" style={{ gap: 10, minHeight: 44 }}>
                <input type="checkbox" checked={useBuild} onChange={(e) => setUseBuild(e.target.checked)} style={{ width: 22, height: 22 }} />
                <span>Use these swaps today</span>
              </label>
            ) : null}
          </section>
        ) : null}
        <button type="button" className="btn" onClick={start}><Icon name="play" /> Start {day.label}</button>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row between"><strong>Warm up first</strong><Link to={`/follow?src=warmup:${day.key}`} className="small"><Icon name="play" /> Follow along</Link></div>
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
        <IntervalsLink />
      </div>
    );
  }

  const logSet = (w = weight, r = reps) => {
    if (!exRow || r < 1) return;
    const set = { exercise_id: exRow.id, reps: r, weight_kg: w };
    const pb = D.isPersonalBest(data, active.id, set);
    update((d) => D.addSet(d, active.id, { exerciseId: exRow.id, reps: r, weightKg: w }));
    unlockAudio();
    if (pb && w > 0) {
      feedback('pr');
      setToast(`New best on ${ex.name}: ${w} kg × ${r}`);
      setTimeout(() => setToast(''), 2500);
    }
    if (active.paused_at) update((d) => resumeWorkout(d, active.id));
    const after = { ...active, sets: [...active.sets, { ...set, id: -1, set_number: 0 }] };
    const ni = nextIndex(day, after, data, current);
    const rest = restFor(ex, settings, { mechanic: entry?.mechanic, override: restOverride[ex.name] });
    if (settings.auto_rest && rest > 0) timer.start(rest, day.exercises[ni].name);
    if (ni !== current) setCurrent(ni);
  };

  const tweak = (fn) => update((d) => setTweaks(d, active.id, fn(active.tweaks, planDay.exercises.length)));
  const swapTo = (alt) => {
    // Catalogue exercises join the Library so their sets can be logged.
    update((d) => setTweaks(
      alt ? D.addCustomExercise(d, { name: alt.name, muscle_group: groupOf(alt), equipment: alt.equipment }) : d,
      active.id,
      swapFor(active.tweaks, planDay.exercises.length, ex.orig, alt ? alt.name : null),
    ));
    setSheet(null);
  };
  const swapOptions = entry && catalogue ? alternatives(entry, catalogue.exercises, { limit: 8 }).map((r) => r.entry) : [];

  const removeSet = (s) => {
    update((d) => D.deleteSet(d, active.id, s.id));
    setUndo({ set: s, label: `Set ${s.set_number} of ${ex?.name || 'exercise'} deleted` });
  };

  const discard = () => {
    if (!window.confirm(`Discard this ${day.label} workout? Its ${active.sets.length} logged sets will be deleted.`)) return;
    timer.stop();
    update((d) => D.deleteWorkout(d, active.id));
    setActiveWorkout(null);
  };

  const finish = () => {
    feedback('workoutSaved');
    update((d) => D.finishWorkout(d, active.id, { sessionRpe: rpe ? Number(rpe) : null, painNote: pain }));
    syncHealth().catch(() => {});
    timer.stop();
    setActiveWorkout(null);
    navigate(`/history/${active.id}`);
  };

  const totalTarget = day.exercises.reduce((n, x) => n + x.sets, 0);
  const totalDone = Object.values(doneSets).reduce((n, s) => n + s.length, 0);
  const ms = activeMs(active, now);
  const lengthTarget = targetProgress(ms, settings.target_min);
  const paused = Boolean(active.paused_at);

  return (
    <div className="page">
      {toast ? <div className="toast" role="status"><span className="pr">PR</span> {toast}</div> : null}
      {undo && !toast ? (
        <div className="toast" role="status">
          {undo.label}
          <button type="button" className="undo" onClick={() => { update((d) => restoreSet(d, active.id, undo.set)); setUndo(null); }}><Icon name="undo" className="icon" /> Undo</button>
        </div>
      ) : null}
      <div className="row between" style={{ marginTop: 8 }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 4px' }}>{day.label}</h1>
          <div className="muted small" style={{ margin: '2px 4px 8px' }}>
            {paused ? 'Paused · ' : ''}{elapsed(ms)}{lengthTarget ? ` of ${settings.target_min}` : ''} · {totalDone}/{totalTarget} sets · tempo {T.trainer_plan.tempo}
          </div>
        </div>
        <button type="button" className="btn small" onClick={() => setFinishing(true)}>Finish</button>
      </div>
      {lengthTarget ? <div className={`target-bar${lengthTarget.over ? ' over' : ''}`} role="progressbar" aria-valuenow={Math.round(lengthTarget.fraction * 100)} aria-label="Workout length against your target"><span style={{ width: `${Math.min(100, lengthTarget.fraction * 100)}%` }} /></div> : null}
      <div className="row" style={{ gap: 8, margin: '0 0 12px' }}>
        <button type="button" className="btn small secondary grow" onClick={() => update((d) => (paused ? resumeWorkout(d, active.id) : pauseWorkout(d, active.id)))}>
          <Icon name={paused ? 'play' : 'pause'} /> {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="btn small ghost grow" onClick={discard}><Icon name="trash" /> Discard</button>
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
                {catalogue && entryFor(x.name, content.training, catalogue.byId) ? <ExercisePhotos entry={entryFor(x.name, content.training, catalogue.byId)} compact /> : null}
                {x.note ? <div className="ex-note">{x.note}</div> : null}
                {exerciseNote(data, x.name) ? <div className="ex-note">Note: {exerciseNote(data, x.name)}</div> : null}
                {sets.map((s) => (
                  <SwipeRow key={s.id} onLeft={() => removeSet(s)} onRight={() => logSet(s.weight_kg, s.reps)}>
                  <div className="set-row">
                    <span className="set-n done">{s.set_number}</span>
                    <span>{s.weight_kg} kg × {s.reps}</span>
                    <span />
                    <button type="button" className="icon-btn" aria-label={`Delete set ${s.set_number}`} onClick={() => removeSet(s)}><Icon name="trash" /></button>
                  </div>
                  </SwipeRow>
                ))}
                {target && sets.length === 0 ? <div className={`reason ${target.kind}`}>{target.reason}</div> : null}
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="grow"><Stepper label="kg" value={weight} onChange={setWeight} step={2.5} max={500} decimals={2} /></div>
                  <div className="grow"><Stepper label="reps" value={reps} onChange={setReps} step={1} min={0} max={100} /></div>
                </div>
                {barbell && weight > barKg ? <div className="plate-line">Per side: {plateText(platesPerSide(weight, barKg, settings.plates).plates)} kg{platesPerSide(weight, barKg, settings.plates).exact ? '' : ` (makes ${platesPerSide(weight, barKg, settings.plates).loaded} kg)`}</div> : null}
                <button type="button" className="btn" onClick={() => logSet()}><Icon name="check" /> Log set {sets.length + 1}</button>
                <div className="ex-actions">
                  <button type="button" className="chip" onClick={() => tweak((t, n) => addExtraSet(t, n, x.orig))}>+ Set</button>
                  <button type="button" className="chip" disabled={i === day.exercises.length - 1} onClick={() => { tweak((t, n) => skipToEnd(t, n, i)); }}>Skip for now</button>
                  <button type="button" className="chip" disabled={i === 0} aria-label={`Move ${x.name} up`} onClick={() => { tweak((t, n) => moveBy(t, n, i, -1)); setCurrent(i - 1); }}>↑</button>
                  <button type="button" className="chip" disabled={i === day.exercises.length - 1} aria-label={`Move ${x.name} down`} onClick={() => { tweak((t, n) => moveBy(t, n, i, 1)); setCurrent(i + 1); }}>↓</button>
                  <button type="button" className="chip" onClick={() => setSheet('swap')}>Swap</button>
                  {barbell ? <button type="button" className="chip" onClick={() => setSheet('warmups')}>Warm-ups</button> : null}
                  <button type="button" className="chip" onClick={() => { setNoteText(exerciseNote(data, x.name)); setSheet('note'); }}>Note</button>
                </div>
                <label className="field row" style={{ alignItems: 'center', gap: 10 }}>
                  <span className="grow">Rest after this exercise</span>
                  <select style={{ width: 'auto' }} value={restOverride[x.name] ?? ''} onChange={(e) => setRestOverride({ ...restOverride, [x.name]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                    <option value="">{x.rest_sec ? `Plan (${clock(x.rest_sec)})` : 'Default'}</option>
                    {REST_STEPS.map((sec) => <option key={sec} value={sec}>{clock(sec)}</option>)}
                    <option value="0">No timer</option>
                  </select>
                </label>
                <div className="row between">
                  {x.video ? <a href={x.video} target="_blank" rel="noreferrer" className="small"><Icon name="video" className="icon" /> Form video</a> : <span />}
                  {x.alternative ? <span className="muted small">Taken? {x.alternative}</span> : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {sheet === 'warmups' && ex ? (
        <Sheet title={`Warm-ups for ${weight} kg`} onClose={() => setSheet(null)}>
          {warmupSets(weight, barKg, settings.plates).length ? (
            <div className="list">
              {warmupSets(weight, barKg, settings.plates).map((w) => (
                <div key={w.kg} className="list-row">
                  <div className="grow"><div>{w.kg} kg × {w.reps}</div><div className="meta">{w.pct}% · {w.kg === barKg ? 'empty bar' : `${plateText(platesPerSide(w.kg, barKg, settings.plates).plates)} kg per side`}</div></div>
                </div>
              ))}
            </div>
          ) : <div className="card empty">Set a working weight above the empty bar first.</div>}
          <p className="muted small">Warm-ups aren't logged, so they don't count toward volume or records.</p>
        </Sheet>
      ) : null}
      {sheet === 'swap' && ex ? (
        <Sheet title={`Swap ${ex.swapped_from || ex.name}`} onClose={() => setSheet(null)}>
          <p className="muted small" style={{ marginTop: 0 }}>For today only; your plan stays the same.</p>
          <div className="list">
            {ex.swapped_from ? <button type="button" className="list-row" onClick={() => swapTo(null)}><div className="grow">Back to {ex.swapped_from}</div></button> : null}
            {ex.alternative ? <div className="list-row"><div className="grow"><div>Trainer's backup</div><div className="meta">{ex.alternative}</div></div></div> : null}
            {swapOptions.map((o) => (
              <button key={o.id} type="button" className="list-row" onClick={() => swapTo(o)}>
                <div className="grow"><div>{o.name}</div><div className="meta">{o.equipment || 'body only'}</div></div>
                <Icon name="chev" className="icon chev" />
              </button>
            ))}
            {!swapOptions.length ? <div className="list-row muted">No close matches in the exercise library.</div> : null}
          </div>
        </Sheet>
      ) : null}
      {sheet === 'note' && ex ? (
        <Sheet title={`Note for ${ex.name}`} onClose={() => { update((d) => setExerciseNote(d, ex.name, noteText)); setSheet(null); }}>
          <label className="field"><span>Seat height, grip, pin… shown next time</span>
            <input type="text" value={noteText} maxLength={200} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. seat 4, pin 7" />
          </label>
        </Sheet>
      ) : null}
    </div>
  );
}
