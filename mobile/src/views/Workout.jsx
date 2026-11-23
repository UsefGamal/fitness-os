import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import ExercisePhotos from '../components/ExercisePhotos.jsx';
import Sheet from '../components/Sheet.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import ConfirmSheet from '../components/ConfirmSheet.jsx';
import EquipmentSheet from '../components/EquipmentPicker.jsx';
import Icon from '../components/Icon.jsx';
import LeapMark from '../components/LeapMark.jsx';
import MuscleTags from '../components/MuscleTags.jsx';
import MapImage from '../components/MapImage.jsx';
import Toast from '../components/Toast.jsx';
import { entryFor, groupOf, photoSrc } from '../lib/catalogue.js';
import * as D from '../lib/data.js';
import { safeVideo } from '../lib/links.js';
import { effectiveDay } from '../lib/planEdit.js';
import { isRecoveryWeek, recoveryDay, withoutRecovery } from '../lib/recovery.js';
import { comeback, comebackTarget } from '../lib/comeback.js';
import { activePlan } from '../lib/plan.js';
import { BARS, isBarbell, plateText, platesPerSide, warmupSets } from '../lib/plates.js';
import { holdRange, isBodyweight, progressionTarget, stepFor } from '../lib/progression.js';
import { neighbours } from '../lib/progressions.js';
import { exerciseGroups, GROUP16, GROUPS16 } from '../lib/muscleGroups.js';
import { targetFor, targetText } from '../lib/muscles.js';
import { swapPicks } from '../lib/similar.js';
import { pairedWithNext, pairWithNext, roundDone, roundRest, unpair } from '../lib/superset.js';
import { firstForMuscles, warmupPlan } from '../lib/warmup.js';
import { addExtraSet, applyTweaks, emptyTweaks, exerciseNote, moveBy, pairsFrom, setExerciseNote, setTweaks, skipToEnd, swapFor } from '../lib/tweaks.js';
import { buildSession, buildSwaps, ownedKinds } from '../lib/equipment.js';
import { activeMs, clock, pauseWorkout, restFor, restoreSet, resumeWorkout, targetProgress, trainingSettings } from '../lib/training.js';
import { programDayFor, sessionKeyOn } from '../lib/schedule.js';
import { useKeepAwake } from '../store/awake.js';
import { feedback, unlockAudio } from '../store/feedback.js';
import { syncHealth } from '../store/phoneSync.js';
import { content, useData } from '../store/useData.js';
import { useCatalogue } from '../store/catalogue.js';
import { shadeLines, shadeLogChain } from '../lib/restTimer.js';
import { useTimer } from '../store/useTimer.js';
import { howToSteps, showHowTo, starterProgress } from '../lib/starter.js';
import MoreMenu from '../components/MoreMenu.jsx';
import { t } from '../lib/i18n.js';
import { announce, setLoggedLine } from '../lib/announce.js';
import { isShortSession } from '../lib/summary.js';
import { setChange, setsText as lastText } from '../lib/lastTime.js';
import { gateOn, safeDay } from '../lib/safety.js';
import SafetyChanges from '../components/SafetyChanges.jsx';
import { setFields, setLabel, TYPE_LETTER, typeChoices, withType } from '../lib/sets.js';
import { EFFORT, logBarMode, startMode } from '../lib/workoutFlow.js';
import { useToday } from '../store/today.js';
import { plannedSet, readNumber, setRows, stopwatch, workoutKcal, workoutVolume } from '../lib/liveStats.js';
import { reducedMotion } from '../store/motionFx.js';

// Long enough to notice and reach the button (E6-S2: at least 6 s).
const UNDO_MS = 7000;
const setsText = (n) => `${n} logged set${n === 1 ? '' : 's'}`;

/** Run `fn` after the next frame is painted, in a task of its own, so
 * slow work never holds up what a tap shows. Returns a cancel function. */
function afterPaint(fn) {
  let id = null;
  const raf = requestAnimationFrame(() => { id = setTimeout(fn, 0); });
  return () => { cancelAnimationFrame(raf); clearTimeout(id); };
}

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
    return e ? workout.sets.filter((s) => s.exercise_id === e.id && plannedSet(s)).length : 0;
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

/** Time, volume and kcal at the top of a running workout (B2). It ticks
 * every second on its own, so the rest of the screen doesn't re-render. */
function LiveStrip({ workout, bodyKg }) {
  const [now, setNow] = useState(Date.now());
  const paused = Boolean(workout.paused_at);
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);
  const ms = activeMs(workout, now);
  return (
    <div className="live-strip">
      <div className="live-cell"><div className="live-val"><i className={`live-dot${paused ? ' off' : ''}`} aria-hidden="true" />{stopwatch(ms)}</div><div className="live-label">{t('workout.duration')}</div></div>
      <div className="live-cell"><div className="live-val">{workoutVolume(workout.sets)}</div><div className="live-label">{t('workout.volumeKg')}</div></div>
      <div className="live-cell"><div className="live-val">{workoutKcal(ms, bodyKg)}</div><div className="live-label">{t('workout.kcalAbout')}</div></div>
    </div>
  );
}

/** A reps or kg cell you tap to type in (B1). Keeps what's typed until it
 * reads as a number, then hands the number up. */
function NumBox({ value, onChange, whole = false, max, label }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(String(value)); }, [value, editing]);
  return (
    <input
      className="st-input"
      type="text"
      inputMode={whole ? 'numeric' : 'decimal'}
      aria-label={label}
      value={text}
      onFocus={(e) => { setEditing(true); e.target.select(); }}
      onBlur={() => { setEditing(false); setText(String(value)); }}
      onChange={(e) => {
        setText(e.target.value);
        const n = readNumber(e.target.value, { whole, max });
        if (n != null) onChange(n);
      }}
    />
  );
}

/** The exercise's first photo, small. With no photo, a small picture of
 * the muscles it works, as on Plan (design laws #13); the grey barbell only
 * when the muscles aren't known either. */
const Thumb = memo(function Thumb({ entry, target, onClick, label }) {
  const src = entry?.photos?.[0];
  if (!src && target?.main?.length) return <span className="ex-thumb map-sm" aria-hidden="true"><MapImage target={target} size={50} /></span>;
  if (!src) return <span className="ex-thumb empty" aria-hidden="true"><Icon name="barbell" /></span>;
  const img = <img src={`exercise-db/${src}`} alt="" decoding="async" />;
  return onClick ? <button type="button" className="ex-thumb" onClick={onClick} aria-label={label}>{img}</button> : <span className="ex-thumb" aria-hidden="true">{img}</span>;
});

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
  const data = useData((s) => s.data);
  return (
    <>
      <IntervalsLink />
      <div className="section-label">Pick a session</div>
      <div className="list">
        {activePlan(data, content).program.map((d) => (
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
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const activeWorkoutId = useData((s) => s.activeWorkoutId);
  const setActiveWorkout = useData((s) => s.setActiveWorkout);
  const timer = useTimer();
  const { catalogue } = useCatalogue();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // One-tap Start from Home (design laws plan #6): the session starts
  // straight away unless its preview has something to read first.
  const go = Boolean(location.state?.go);
  const autoRef = useRef(null);
  const [startedUndo, setStartedUndo] = useState(false);
  const today = useToday();
  const T = activePlan(data, content);

  const active = data.workouts.find((w) => w.id === activeWorkoutId && !w.finished_at) || null;
  const requested = params.get('session');
  const scheduledKey = sessionKeyOn(today, T, data.session_moves || []);
  const sessionKey = active?.session_key || requested || (scheduledKey !== 'rest' ? scheduledKey : null);
  const recovery = active ? Boolean(active.is_deload) : isRecoveryWeek(data, today);
  // Away for a while? (BACK-1) Until the first session back is finished.
  const back = comeback(data, today);
  const baseDay = sessionKey ? effectiveDay(sessionKey, T, data) : null;
  // beginner_only (safety check): every set stops 3 reps short of failure.
  const planDay = safeDay(data, recovery ? recoveryDay(baseDay) : baseDay, today, content.training.safety_swaps?.swaps);
  // Today's changes (extra sets, skips, swaps) live on the workout, not the plan.
  const day = planDay && active ? applyTweaks(planDay, active.tweaks) : planDay;

  // Coming back to a workout (tab change, app killed and reopened) opens the
  // first exercise that isn't finished, not exercise 1 (QA-04).
  const [current, setCurrent] = useState(() => (active && day ? nextIndex(day, active, data, 0) : 0));
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(10);
  const [toast, setToast] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [equipOpen, setEquipOpen] = useState(false); // MOVE-2: equipment as a sheet
  const [rpe, setRpe] = useState('');
  const [pain, setPain] = useState('');
  const [now, setNow] = useState(Date.now());
  const [restOverride, setRestOverride] = useState({}); // exercise name -> seconds for this session
  const [undo, setUndo] = useState(null); // { set, label } after a delete
  const [sheet, setSheet] = useState(null); // 'warmups' | 'swap' | 'note' | null
  const [swapGroup, setSwapGroup] = useState(null); // one of the 16 groups, or null for the closest matches
  const [typing, setTyping] = useState(null); // the logged set being edited (kg, reps, kind)
  const [dropFor, setDropFor] = useState(null); // { name, backKg }: the next set of this exercise is a drop set
  const [showPhoto, setShowPhoto] = useState(false); // the big moving photo, opened from the thumbnail
  const openSwap = () => { setSwapGroup(null); setSheet('swap'); };
  const [noteText, setNoteText] = useState('');
  const settings = trainingSettings(data);
  const [useBuild, setUseBuild] = useState(true);
  useKeepAwake(Boolean(active), { idle: true, restRunning: Boolean(timer.endsAt) });

  // One toast at a time (MOVE-2): a record shows for 2.5 s, and an Undo
  // waiting behind it starts its own countdown only once it is on screen.
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!undo || toast) return undefined;
    const id = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(id);
  }, [undo, toast]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // The catalogue entry (photos, mechanic) of each exercise today, looked
  // up once: entryFor scans the catalogue, and every card needs one, so
  // doing it per render made logging a set slow on cheap phones (FEEL-1).
  const names = (day?.exercises || []).map((x) => x.name).join('\n');
  const entryOf = useMemo(() => {
    const m = new Map();
    const look = (n) => {
      if (!catalogue) return null;
      if (!m.has(n)) m.set(n, entryFor(n, content.training, catalogue.byId));
      return m.get(n);
    };
    for (const n of names.split('\n')) if (n) look(n);
    return look;
  }, [catalogue, names]);
  // Each exercise's muscles in today's order, to tell the first lift of a
  // muscle (it gets warm-up sets) from the ones after it.
  const targets = useMemo(() => names.split('\n').filter(Boolean).map((n) => targetFor(n, content.training, entryOf(n))), [names, entryOf]);
  const ex = day?.exercises[current];
  const exRow = ex ? D.exerciseByName(data, ex.name) : null;
  const entry = ex ? entryOf(ex.name) : null;
  // Last time's work sets of this exercise, by set number (charts step 2):
  // the faint "last: 60 × 8" line under each row of the set table.
  const prevWork = useMemo(() => (exRow ? D.lastSets(data, exRow.id, active?.id) : []), [data, exRow, active?.id]);
  const barbell = ex ? isBarbell(ex.name, entry) : false;
  const barKg = BARS[settings.bar]?.kg ?? 20;

  // Double progression from earlier sessions (lib/progression.js).
  const target = useMemo(() => {
    if (!active || !ex || !exRow) return null;
    if (recovery) return null; // same loads as last time: no progression in a recovery week
    const sessions = withoutRecovery(D.exerciseHistory(data, exRow.id), data.workouts).filter((h) => h.workoutId !== active.id).map((h) => h.sets.filter(D.isWorkSet)).filter((s) => s.length);
    const step = stepFor(entry, { barbell });
    const plain = progressionTarget(ex.reps, ex.sets, sessions, { step, bodyweight: entry ? isBodyweight(entry) : null });
    // The first session back after a gap is lighter (BACK-1).
    return active.easy ? comebackTarget(plain, back?.level, { planReps: ex.reps, sessions, step }) : plain;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, ex?.name, exRow?.id, catalogue]);

  // Prefill weight and reps whenever the exercise changes: the last set of
  // today, else the progression target, else last time's first set.
  useEffect(() => {
    if (!active || !ex || !exRow) return;
    // Warm-ups don't count: after them, the work weight still comes from the plan.
    const doneToday = active.sets.some((s) => s.exercise_id === exRow.id && plannedSet(s));
    const s = D.suggestSet(data, active.id, exRow.id, targetReps(ex.reps));
    if (!doneToday && target?.kind === 'fresh') {
      // Back after 8+ weeks: no weight from last time; the person picks it.
      setWeight(0);
      setReps(target.reps ?? s.reps);
    } else if (!doneToday && target?.weightKg != null) {
      setWeight(target.weightKg);
      setReps(target.reps ?? s.reps);
    } else {
      setWeight(s.weightKg);
      setReps(doneToday ? s.reps : target?.reps ?? s.reps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, current, sessionKey, ex?.name, target]);

  // After a set moves you on, bring the next exercise up so its log row
  // sits above the rest timer (E6-S5). Not on the first render.
  const firstScroll = useRef(true);
  useEffect(() => {
    if (firstScroll.current) { firstScroll.current = false; return; }
    if (!active) return;
    // In its own task, after the new set is on screen (FEEL-1): scrolling
    // forces a layout of the whole page.
    return afterPaint(() => {
      const el = document.querySelector('.ex-card.current');
      const reduce = reducedMotion();
      el?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const doneSets = useMemo(() => {
    if (!active || !day) return {};
    const out = {};
    for (const x of day.exercises) {
      const e = D.exerciseByName(data, x.name);
      out[x.name] = e ? active.sets.filter((s) => s.exercise_id === e.id) : [];
    }
    return out;
  }, [active, day, data]);

  // "last 22.5 kg" on each folded exercise (UX-12). Earlier workouts don't
  // change while this one runs, so it isn't worked out again on each set
  // (FEEL-1: it reads the whole history).
  const dayNames = day ? day.exercises.map((x) => x.name).join('|') : '';
  const lastTop = useMemo(() => {
    if (!active || !day) return {};
    const out = {};
    for (const x of day.exercises) {
      const row = D.exerciseByName(data, x.name);
      out[x.name] = row ? D.lastTopKg(data, row.id, active.id) : null;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, dayNames, data.workouts.length, data.exercises]);
  // Easier and harder versions of a bodyweight move (content/progressions.py).
  const ladderSteps = ex ? neighbours(ex.name, content.training.progressions) : null;
  // Swap (BeFit item 10): the closest matches, or any of the 16 groups,
  // never an exercise already in today's session.
  const swapOptions = useMemo(() => {
    if (!catalogue || (!entry && !swapGroup)) return [];
    const skip = (day?.exercises || []).map((x) => x.name);
    return swapPicks(entry, catalogue.exercises, { group: swapGroup, skip, limit: swapGroup ? 12 : 8 });
  }, [entry, catalogue, swapGroup, day]);
  // Its own groups lead the chips.
  const swapGroups = useMemo(() => {
    const own = ex ? exerciseGroups({ name: ex.swapped_from || ex.name, muscle_group: exRow?.muscle_group }, content.training, entry).main : [];
    return [...own, ...GROUPS16.map((g) => g.key).filter((k) => !own.includes(k))];
  }, [ex, exRow, entry]);

  useEffect(() => {
    if (!go || active) return;
    const a = autoRef.current;
    if (!a || a.mode === 'wait') return;
    navigate({ search: location.search }, { replace: true, state: null });
    if (a.mode === 'go') {
      a.start();
      setStartedUndo(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, active, catalogue]);
  useEffect(() => {
    if (!startedUndo) return undefined;
    const id = setTimeout(() => setStartedUndo(false), UNDO_MS);
    return () => clearTimeout(id);
  }, [startedUndo]);

  if (!day) {
    return (
      <div className="page">
        <h1 className="page-title">Start</h1>
        <p className="page-sub">Rest day. {programDayFor(today, T, data.session_moves || []) ? `Next up: ${programDayFor(today, T, data.session_moves || []).label}. ` : ''}Training anyway? Pick a session.</p>
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
      const r = D.startWorkout(next, { date: today, sessionKey: day.key, label: day.label, isDeload: recovery });
      id = r.workoutId;
      // Back after a gap: this session is the easy one (BACK-1), kept out
      // of the progression that follows it.
      if (back) r.data = { ...r.data, workouts: r.data.workouts.map((w) => (w.id === id ? { ...w, easy: true } : w)) };
      return Object.keys(swaps).length ? setTweaks(r.data, id, { ...emptyTweaks(day.exercises.length), swaps }) : r.data;
    });
    setActiveWorkout(id);
    setCurrent(0);
  };

  {
    const prevToday = D.workoutOn(data, today);
    const notes = recovery || (day.safety_changes || []).length > 0 || Boolean(prevToday?.finished_at) || Boolean(build && build.some((b) => b.status !== 'keep'));
    autoRef.current = { start, mode: owned && !catalogue ? 'wait' : startMode({ notes }) };
  }

  if (!active) {
    const prev = D.workoutOn(data, today);
    return (
      <div className="page">
        <h1 className="page-title">{day.label}</h1>
        <p className="page-sub">{day.focus}{day.cardio_after ? `, then ${day.cardio_after.minutes} min cycling` : ''}</p>
        {recovery ? <div className="card small" role="note"><span className="chip warn">{t('recovery.chip')}</span> {t('recovery.banner')}</div> : null}
        <SafetyChanges changes={day.safety_changes} />
        {prev?.finished_at ? <div className="card muted small">You already finished a session today ({prev.notes}, {prev.sets.length} sets).</div> : null}
        {build && build.some((b) => b.status !== 'keep') ? (
          <section className="card stack">
            <div className="row between"><strong>With your equipment</strong><button type="button" className="btn ghost small" style={{ width: 'auto' }} onClick={() => setEquipOpen(true)}>Change</button></div>
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
        <button type="button" className="btn hero" onClick={start}><Icon name="play" /> Start {day.label}</button>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row between"><strong>Warm up first</strong><Link to={`/follow?src=warmup:${day.key}`} className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44 }}><Icon name="play" /> Follow along</Link></div>
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
        {equipOpen ? <EquipmentSheet onClose={() => setEquipOpen(false)} /> : null}
      </div>
    );
  }

  // A timed hold ("30-45s"): one Seconds stepper, no weight to pick.
  const timed = Boolean(ex && holdRange(ex.reps));
  const noWeight = (w) => !timed && D.missingWeight(exRow, w);
  const logSet = (w = weight, r = reps) => {
    if (!exRow || r < 1) return;
    if (noWeight(w)) return;
    // A drop set armed with the Drop set button: logged as a drop, then the
    // weight goes back to the full sets' load for the next one.
    const drop = dropFor?.name === ex.name;
    const set = { exercise_id: exRow.id, reps: r, weight_kg: w, ...(timed ? { track: 'time', duration_s: r } : {}), ...(drop ? { set_type: 'drop' } : {}) };
    update((d) => {
      const x = D.addSet(d, active.id, { exerciseId: exRow.id, reps: r, weightKg: w, seconds: timed ? r : null });
      if (!drop) return x;
      const wk = x.workouts.find((z) => z.id === active.id);
      return D.replaceSet(x, active.id, withType(wk.sets[wk.sets.length - 1], 'drop'));
    });
    if (drop) { setDropFor(null); setWeight(dropFor.backKg); }
    unlockAudio();
    if (active.paused_at) update((d) => resumeWorkout(d, active.id));
    const after = { ...active, sets: [...active.sets, { ...set, id: -1, set_number: 0 }] };
    const ni = nextIndex(day, after, data, current);
    // Supersets (F-01a): straight on to the partner, rest once the round is
    // done, for the longest rest in the pair.
    const done = day.exercises.map((x) => {
      const e = D.exerciseByName(data, x.name);
      return e ? after.sets.filter((s) => s.exercise_id === e.id && plannedSet(s)).length : 0;
    });
    const restOf = (j) => {
      const x = day.exercises[j];
      const mech = j === current ? entry?.mechanic : entryOf(x.name)?.mechanic;
      return restFor(x, settings, { mechanic: mech, override: restOverride[x.name] });
    };
    const rest = roundDone(day.exercises, done, current) ? roundRest(day.exercises, current, restOf) : 0;
    const resting = settings.auto_rest && rest > 0;
    if (resting) {
      const nx = day.exercises[ni];
      // Set numbers in the shade count work sets: a set marked warm-up
      // doesn't move "Set 2 of 3" on.
      const nxRow = ni === current ? exRow : D.exerciseByName(data, nx.name);
      const nxSets = nxRow ? after.sets.filter((s) => s.exercise_id === nxRow.id) : [];
      const nxWork = nxSets.filter(D.isWorkSet).length;
      // A new barbell lift: the warm-up ramp to its weight (last time's, or
      // the weight just lifted on this one) goes first in the shade.
      const nxEntry = ni === current ? entry : entryOf(nx.name);
      const nxKg = ni === current ? w : nxRow ? D.suggestSet(data, active.id, nxRow.id, 0).weightKg : 0;
      const warmup = !nxWork && isBarbell(nx.name, nxEntry) ? warmupSets(nxKg, barKg, settings.plates) : [];
      timer.start(rest, nx.name, {
        ...shadeLines({
          setNo: nxWork + 1, setsPlanned: nx.sets, targetReps: nx.reps,
          // The same exercise again: the load just lifted is the best guess.
          ...(ni === current ? { weightKg: w, reps: r } : nxKg > 0 && warmup.length ? { weightKg: nxKg } : {}),
          workout: day.label, done: after.sets.filter(D.isWorkSet).length, planned: totalTarget, warmup,
        }),
        // The open notification shows the next exercise's photo.
        photo: photoSrc(nxEntry?.photos?.[0]),
      },
      // More sets of this lift next (not a superset): "Log set & rest" on
      // Rest done logs each at this load and starts the same rest again.
      ni === current && !nx.pair ? {
        restS: rest,
        chain: shadeLogChain({
          workoutId: active.id, exerciseId: exRow.id, logged: nxSets.length, workDone: nxWork, setsPlanned: nx.sets,
          reps: r, weightKg: w, timed, workout: day.label, done: after.sets.filter(D.isWorkSet).length, planned: totalTarget,
        }),
      } : null);
    }
    if (ni !== current) setCurrent(ni);
    // Is it a new best? That reads the exercise's whole history, so it runs
    // after the set is on screen (FEEL-1). `data` is still the data from
    // before this set.
    afterPaint(() => {
      const kind = D.setKind(data, active.id, set);
      // TalkBack hears the set and, in the same line, a record (A11Y-1).
      announce(setLoggedLine({ setNo: after.sets.filter((x) => x.exercise_id === exRow.id && D.isWorkSet(x)).length, set, name: ex.name, kind }));
      if (kind === 'best') {
        feedback('pr');
        setToast(t('workout.best', { name: ex.name, kg: w, reps: r }));
      } else if (kind === 'baseline') {
        setToast(t('workout.baseline', { name: ex.name, kg: w, reps: r }));
      }
      // The set tick (SA-03) never stacks: a best plays its own sound and
      // the rest-start cue replaces the tick.
      if (!resting && kind !== 'best') feedback('set');
    });
  };

  const tweak = (fn) => update((d) => setTweaks(d, active.id, fn(active.tweaks, planDay.exercises.length)));

  // One tap logs the suggested warm-ups as W sets: no rest timer, and
  // they never count toward sets, volume or records.
  const logWarmups = (list) => {
    if (!exRow || !list.length) return;
    update((d) => {
      let x = d;
      for (const w of list) {
        x = D.addSet(x, active.id, { exerciseId: exRow.id, reps: w.reps, weightKg: w.kg });
        const wk = x.workouts.find((z) => z.id === active.id);
        x = D.replaceSet(x, active.id, withType(wk.sets[wk.sets.length - 1], 'warmup'));
      }
      return active.paused_at ? resumeWorkout(x, active.id) : x;
    });
    unlockAudio();
    feedback('set');
    announce(t('warm.logged'));
  };

  // Drop set: the next set about 20% lighter, straight away (the rest
  // timer stops). Tap again to cancel and get the weight back.
  const toggleDrop = () => {
    if (!ex) return;
    if (dropFor?.name === ex.name) { setWeight(dropFor.backKg); setDropFor(null); return; }
    const step = stepFor(entry, { barbell });
    const kg = Math.max(0, Math.round((weight * 0.8) / step) * step);
    if (timer.endsAt) timer.stop();
    setDropFor({ name: ex.name, backKg: weight });
    setWeight(+kg.toFixed(2));
  };
  const swapTo = (alt) => {
    // Catalogue exercises join the Library so their sets can be logged.
    update((d) => setTweaks(
      alt ? D.addCustomExercise(d, { name: alt.name, muscle_group: groupOf(alt), equipment: alt.equipment }) : d,
      active.id,
      swapFor(active.tweaks, planDay.exercises.length, ex.orig, alt ? alt.name : null),
    ));
    setSheet(null);
  };
  // The plan's own backup is a name: use the catalogue entry when there is
  // one, otherwise add it to the Library under the same muscle group.
  const swapToName = (name) => {
    const hit = catalogue?.exercises.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (hit) return swapTo(hit);
    update((d) => setTweaks(
      D.addCustomExercise(d, { name, muscle_group: D.exerciseByName(d, ex.swapped_from || ex.name)?.muscle_group || 'Other', equipment: null }),
      active.id,
      swapFor(active.tweaks, planDay.exercises.length, ex.orig, name),
    ));
    setSheet(null);
    return undefined;
  };

  const typingSet = typing ? active.sets.find((s) => s.id === typing.id) || null : null;
  const removeSet = (s) => {
    update((d) => D.deleteSet(d, active.id, s.id));
    setUndo({ set: s, label: `Set ${s.set_number} of ${ex?.name || 'exercise'} deleted` });
  };

  const discard = () => {
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
    navigate(`/history/${active.id}`, { state: { finished: true } });
  };

  // One grey line on a folded exercise: "3 × 10-12 · last 22.5 kg" (UX-12).
  const upcoming = (x) => {
    const last = lastTop[x.name];
    return last ? t('workout.upcomingLast', { sets: x.sets, reps: x.reps, kg: last }) : t('workout.upcoming', { sets: x.sets, reps: x.reps });
  };

  const totalTarget = day.exercises.reduce((n, x) => n + x.sets, 0);
  const totalDone = Object.values(doneSets).reduce((n, s) => n + s.filter(plannedSet).length, 0);
  const short = isShortSession(totalDone, totalTarget);
  const ms = activeMs(active, now);
  const lengthTarget = targetProgress(ms, settings.target_min);
  const paused = Boolean(active.paused_at);
  const starter = starterProgress(data);
  // The bottom bar (design laws plan #7): log the next set, then finish.
  const curWork = ex ? (doneSets[ex.name] || []).filter(plannedSet).length : 0;
  const barMode = logBarMode({ resting: Boolean(timer.endsAt), finishing, done: totalDone, target: totalTarget, canLog: Boolean(exRow) && curWork < (ex?.sets || 0) });

  return (
    <div className={`page${barMode ? ' with-log-bar' : ''}`}>
      {toast ? <Toast hidden onDismiss={() => setToast('')}><LeapMark size={18} /> <span className="pr">PR</span> {toast}</Toast> : null}
      {startedUndo && !toast && !undo ? (
        <Toast className="undo-toast" role="status" ms={UNDO_MS} onDismiss={() => setStartedUndo(false)}>
          {t('workout.started', { label: day.label })}
          {active.sets.length === 0 ? <button type="button" className="undo" onClick={() => { setStartedUndo(false); discard(); navigate('/', { replace: true }); }}><Icon name="undo" className="icon" /> {t('workout.undo')}</button> : null}
        </Toast>
      ) : null}
      {undo && !toast ? (
        <Toast className="undo-toast" role="status" ms={UNDO_MS} onDismiss={() => setUndo(null)}>
          {undo.label}
          <button type="button" className="undo" onClick={() => { update((d) => restoreSet(d, active.id, undo.set)); setUndo(null); }}><Icon name="undo" className="icon" /> {t('workout.undo')}</button>
        </Toast>
      ) : null}
      {/* One compact header; Pause, Finish and Discard sit in the one menu (UX-13). */}
      <section className="card workout-head">
        <div className="row between" style={{ gap: 8 }}>
          <div className="grow" style={{ minWidth: 0 }}>
            <h1 className="section-title" style={{ margin: 0 }}>{day.label}</h1>
            <div className="muted small" style={{ marginTop: 2 }}>{lengthTarget ? t('workout.lengthOf', { time: elapsed(ms), min: settings.target_min }) : null}{t('workout.setsOf', { done: totalDone, all: totalTarget })} · {t('plan.tempo', { tempo: T.trainer_plan.tempo })}</div>
          </div>
          <MoreMenu title={t('workout.more')} actions={[
            { key: 'pause', label: t(paused ? 'workout.resume' : 'workout.pause'), note: paused ? null : t('workout.pauseNote'), icon: paused ? 'play' : 'pause', onClick: () => update((d) => (paused ? resumeWorkout(d, active.id) : pauseWorkout(d, active.id))) },
            { key: 'finish', label: t('workout.finishWorkout'), note: t('workout.finishNote', { done: totalDone, all: totalTarget }), icon: 'check', onClick: () => setFinishing(true) },
            { key: 'discard', label: t('workout.discard'), note: t('workout.discardNote', { sets: setsText(active.sets.length) }), icon: 'trash', danger: true, onClick: () => setSheet('discard') },
          ]} />
        </div>
        <LiveStrip workout={active} bodyKg={D.latestWeight(data)?.weight_kg} />
        {starter ? <div className="starter-line">{t('starter.session', { n: starter.next, all: starter.total })}</div> : null}
        {lengthTarget ? <div className={`target-bar${lengthTarget.over ? ' over' : ''}`} style={{ margin: '10px 0 0' }} role="progressbar" aria-valuenow={Math.round(lengthTarget.fraction * 100)} aria-label={t('aria.workoutLength')}><span style={{ width: `${Math.min(100, lengthTarget.fraction * 100)}%` }} /></div> : null}
        {paused ? (
          <div className="row between" style={{ gap: 8, marginTop: 10 }}>
            <span className="chip warn">{t('workout.paused')}</span>
            <button type="button" className="btn secondary small" onClick={() => update((d) => resumeWorkout(d, active.id))}><Icon name="play" /> {t('workout.resume')}</button>
          </div>
        ) : null}
      </section>

      {finishing ? (
        <Sheet title={t('finish.sheetTitle', { label: day.label })} onClose={() => setFinishing(false)}>
          <div className="stack">
            <div className="muted small">{t('workout.setsOf', { done: totalDone, all: totalTarget })}</div>
            <div role="radiogroup" aria-label={t('finish.effort')}>
              <div className="field-label">{t('finish.effort')}</div>
              <div className="effort-chips">
                {EFFORT.map((e) => (
                  <button key={e.key} type="button" role="radio" aria-checked={rpe === e.value} className={`chip${rpe === e.value ? ' accent' : ''}`} onClick={() => setRpe(e.value)}>{t(e.key)}</button>
                ))}
              </div>
            </div>
            <details className="how-to" open={Boolean(pain)}>
              <summary><Icon name="plus" className="icon" /><span className="grow">{t('finish.painOpen')}</span><Icon name="chev" className="icon chev" /></summary>
              <label className="field" style={{ marginTop: 8 }}><span>{t('finish.pain')}</span><input type="text" value={pain} onChange={(e) => setPain(e.target.value)} placeholder={t('finish.optional')} /></label>
            </details>
            {day.cardio_after ? <div className="muted small">{t('finish.cooldown', { what: day.cooldown[0] })}</div> : null}
            {short ? <div className="small" role="status">{t('workout.shortNote', { done: totalDone, all: totalTarget })}</div> : null}
            <button type="button" className={`btn${short ? ' secondary' : ''}`} onClick={finish}><Icon name="check" /> {t(short ? 'workout.saveShort' : 'workout.save')}</button>
            <button type="button" className={`btn${short ? '' : ' ghost'}`} onClick={() => setFinishing(false)}>{t('workout.keepGoing')}</button>
          </div>
        </Sheet>
      ) : null}

      {day.exercises.map((x, i) => {
        const sets = doneSets[x.name] || [];
        // Sets that fill the plan's rows: warm-ups and drop sets are extras.
        const work = sets.filter(plannedSet).length;
        const isCurrent = i === current;
        const restText = x.pair ? t('workout.restAfterRound', { rest: x.rest }) : x.rest ? t('plan.rest', { rest: x.rest }) : null;
        // "3 × 6-8" once: the status line already says it before the first set.
        const meta = [sets.length ? `${x.sets} × ${x.reps}` : null, restText, x.rir ? t('workout.rir', { rir: x.rir }) : null].filter(Boolean).join(' · ');
        const xEntry = entryOf(x.name);
        // "1/4 logged · 10 kg" once a set is in, else the plan and last time (B2).
        const lastSet = sets[sets.length - 1];
        const status = sets.length
          ? (lastSet && setFields(lastSet).track !== 'time' && lastSet.weight_kg ? t('workout.loggedKg', { done: work, all: x.sets, kg: lastSet.weight_kg }) : t('workout.logged', { done: work, all: x.sets }))
          : upcoming(x);
        if (!isCurrent) {
          return (
            <button key={`${x.name}-${i}`} type="button" className={`ex-card collapsed${work >= x.sets ? ' finished' : ''}${sets.length ? ' started' : ''}`} onClick={() => setCurrent(i)} aria-expanded={false}>
              <div className="ex-line">
                <Thumb entry={xEntry} target={targets[i]} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ex-name">{x.pair ? <span className="pair">{x.pair}</span> : null}{x.name}</div>
                  <div className="small ex-next">{status}</div>
                </div>
                {x.sets <= work ? <span className="st-tick on small" aria-hidden="true"><Icon name="check" /></span> : null}
              </div>
            </button>
          );
        }
        // First time a beginner meets this exercise: the how-to is open (starter fortnight).
        const howToEntry = showHowTo(data, x.name) ? xEntry : null;
        // Warm-ups for the first lift of a muscle today, before any set of it.
        const warm = !sets.length && !timed && weight > 0 && !noWeight(weight) && firstForMuscles(targets, i)
          ? warmupPlan({ workKg: weight, barbell, barKg, plates: settings.plates, step: stepFor(entry, { barbell }) })
          : [];
        const dropOn = dropFor?.name === x.name;
        const howTo = howToSteps(howToEntry);
        return (
          <div key={`${x.name}-${i}`} className="ex-card current">
            <div className="ex-line" style={{ alignItems: 'flex-start' }}>
              <Thumb entry={xEntry} target={targets[i]} onClick={xEntry?.photos?.length ? () => setShowPhoto(!showPhoto) : null} label={t(showPhoto ? 'workout.hidePhoto' : 'workout.showPhoto')} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ex-name big">{x.pair ? <span className="pair">{x.pair}</span> : null}{x.name}</div>
                <MuscleTags target={targets[i]} />
                <div className="ex-status">{status}</div>
                <div className="ex-meta">{meta}</div>
              </div>
            </div>
            <div className="stack" style={{ marginTop: 12 }}>
              {showPhoto && xEntry ? <ExercisePhotos entry={xEntry} compact /> : null}
              {howTo.length ? (
                <details className="how-to" open>
                  <summary><Icon name="bulb" className="icon" /><span className="grow">{t('starter.howTo')}</span><Icon name="chev" className="icon chev" /></summary>
                  <ol>{howTo.map((step) => <li key={step}>{step}</li>)}</ol>
                </details>
              ) : null}
              {x.note ? <div className="ex-note"><Icon name="info" className="icon" /> {x.note}</div> : null}
              {exerciseNote(data, x.name) ? <div className="ex-note"><Icon name="info" className="icon" /> {t('workout.yourNote', { note: exerciseNote(data, x.name) })}</div> : null}
              {target && work === 0 ? <div className={`reason ${target.kind}`}>{target.reason}</div> : null}
              {target?.kind === 'harder' && work === 0 ? <button type="button" className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={openSwap}>{t('workout.harder')}</button> : null}
              {warm.length ? (
                <div className="warm-card" role="group" aria-label={t('warm.title')}>
                  <div className="grow">
                    <div><strong>{t('warm.title')}</strong></div>
                    <div className="warm-sets">{warm.map((w) => `${w.kg}\u00a0kg\u00a0×\u00a0${w.reps}`).join(' · ')}</div>
                    <div className="muted small">{t('warm.note')}</div>
                  </div>
                  <button type="button" className="btn secondary small" aria-label={t('warm.logAria', { n: warm.length, name: x.name })} onClick={() => logWarmups(warm)}>{t('warm.log')}</button>
                </div>
              ) : null}
              {/* The set table (B1): one row per set, tap reps or kg to type, the tick logs it. */}
              <div className={`set-table${timed ? ' timed' : ''}`} role="group" aria-label={t('workout.tableAria', { name: x.name })}>

                <div className="st-row st-head" aria-hidden="true">
                  <span>{t('workout.colSet')}</span>
                  <span>{t(timed ? 'workout.colSecs' : 'workout.colReps')}</span>
                  {timed ? null : <span>{t('workout.colKg')}</span>}
                  <span>{t('workout.colDone')}</span>
                </div>
                {setRows(sets, x.sets).map((r) => {
                  if (r.kind === 'done') {
                    const s = r.set;
                    const type = setFields(s).set_type;
                    const isTime = setFields(s).track === 'time';
                    return (
                      <SwipeRow key={s.id} onLeft={() => removeSet(s)} onRight={() => logSet(s.weight_kg, s.reps)}>
                        <div className="st-row done">
                          <button type="button" className={`set-n${type === 'work' ? '' : ` t-${type}`}`} aria-label={t('setType.aria', { shown: TYPE_LETTER[type] || r.n || s.set_number, n: r.n || s.set_number, type: t(`setType.${type}`) })} onClick={() => setTyping(s)}>
                            {TYPE_LETTER[type] || r.n || s.set_number}
                          </button>
                          <span>{isTime ? setLabel(s) : s.reps}</span>
                          {timed ? null : <span>{isTime ? '' : s.weight_kg}</span>}
                          <button type="button" className="st-tick on" aria-label={t('workout.editSet', { n: s.set_number })} onClick={() => setTyping(s)}><Icon name="check" /></button>
                          <Ghost prev={r.n ? prevWork[r.n - 1] : null} cur={s} />
                        </div>
                      </SwipeRow>
                    );
                  }
                  return (
                    <div key={`open-${r.n}`} className={`st-row open${r.next ? ' next' : ''}`}>
                      <span className="set-n">{r.n}</span>
                      {r.next
                        ? <NumBox value={reps} onChange={setReps} whole max={timed ? 600 : 100} label={t(timed ? 'workout.editSecs' : 'workout.editReps', { n: r.n })} />
                        : <span>{reps}</span>}
                      {timed ? null : r.next
                        ? <NumBox value={weight} onChange={setWeight} max={500} label={t('workout.editKg', { n: r.n })} />
                        : <span>{weight}</span>}
                      {r.next
                        ? <button type="button" className="st-tick next" disabled={noWeight(weight)} aria-label={t('workout.logSet', { n: r.n })} onClick={() => logSet()}><Icon name="check" /></button>
                        : <span className="st-tick" aria-hidden="true"><Icon name="check" /></span>}
                      <Ghost prev={prevWork[r.n - 1]} />
                    </div>
                  );
                })}
              </div>
              {barbell && weight > barKg ? <div className="plate-line">{t('workout.perSide', { plates: plateText(platesPerSide(weight, barKg, settings.plates).plates) })}{platesPerSide(weight, barKg, settings.plates).exact ? '' : ` (${t('workout.makes', { kg: platesPerSide(weight, barKg, settings.plates).loaded })})`}</div> : null}
              {noWeight(weight) ? <div className="muted small" style={{ textAlign: 'center' }}>{t('workout.needWeight')}</div> : null}
              {dropOn ? <div className="small drop-note" role="status">{t('drop.armed', { kg: weight })}</div> : null}
              {settings.auto_rest && !noWeight(weight) && work < x.sets ? <div className="muted small" style={{ textAlign: 'center' }}>{t('workout.autoRestTick')}</div> : null}
              <div className="tool-row">
                <button type="button" className="tbtn" aria-label={t('workout.restAria')} onClick={() => { unlockAudio(); timer.start(restFor(ex, settings, { mechanic: entry?.mechanic, override: restOverride[ex.name] }) || settings.rest_compound, ex.name, shadeLines({ setNo: sets.filter(D.isWorkSet).length + 1, setsPlanned: x.sets, weightKg: weight, reps, workout: day.label, done: totalDone, planned: totalTarget, warmup: barbell && !sets.some(D.isWorkSet) ? warmupSets(weight, barKg, settings.plates) : [] })); }}><Icon name="timer" /> {t('workout.rest')}</button>
                <button type="button" className="tbtn" onClick={() => tweak((tw, n) => addExtraSet(tw, n, x.orig))}><Icon name="plus" /> {t('workout.addSet')}</button>
                {work > 0 && !timed && weight > 0 ? <button type="button" className={`tbtn${dropOn ? ' on' : ''}`} aria-pressed={dropOn} aria-label={dropOn ? t('drop.cancel') : t('drop.aria')} onClick={toggleDrop}><Icon name="drop" /> {t('drop.button')}</button> : null}
                <button type="button" className="tbtn" aria-haspopup="dialog" onClick={() => setSheet('exmore')}><span className="more-dots" aria-hidden="true">⋯</span> {t('workout.moreShort')}</button>
              </div>
            </div>
          </div>
        );
      })}
      {finishing || barMode === 'finish' ? null : (
        <button type="button" className="btn outline" style={{ marginTop: 16 }} onClick={() => setFinishing(true)}>
          <Icon name="check" /> {t('workout.finishWorkout')}
        </button>
      )}
      {barMode === 'finish' ? (
        <div className="log-bar">
          <button type="button" className="btn" onClick={() => setFinishing(true)}><Icon name="check" /> {t('workout.finishWorkout')}</button>
        </div>
      ) : null}
      {barMode === 'log' ? (
        <div className="log-bar">
          {noWeight(weight) ? (
            <button type="button" className="btn secondary" onClick={() => document.querySelector(`input[aria-label="${t('workout.editKg', { n: curWork + 1 })}"]`)?.focus()}>{t('workout.needWeightBar')}</button>
          ) : (
            <button type="button" className="btn" onClick={() => logSet()}><Icon name="check" /> {timed ? t('workout.logBarSecs', { n: curWork + 1, secs: reps }) : t('workout.logBar', { n: curWork + 1, kg: weight, reps })}</button>
          )}
        </div>
      ) : null}
      {typingSet ? (
        <Sheet title={t('setEdit.title', { n: typingSet.set_number })} onClose={() => setTyping(null)}>
          {setFields(typingSet).track === 'time' ? null : (
            <div className="set-edit">
              <label className="field">
                <span>{t('workout.colReps')}</span>
                <NumBox value={typingSet.reps} whole max={100} label={t('workout.editReps', { n: typingSet.set_number })} onChange={(n) => update((d) => D.replaceSet(d, active.id, { ...typingSet, reps: n }))} />
              </label>
              <label className="field">
                <span>{t('workout.colKg')}</span>
                <NumBox value={typingSet.weight_kg} max={500} label={t('workout.editKg', { n: typingSet.set_number })} onChange={(n) => update((d) => D.replaceSet(d, active.id, { ...typingSet, weight_kg: n }))} />
              </label>
            </div>
          )}
          <div className="section-label">{t('setEdit.kind')}</div>
          <div className="list">
            {typeChoices({ gentle: gateOn(data, 'beginner_only', today) || gateOn(data, 'needs_clearance', today) }).map((k) => {
              const on = setFields(typingSet).set_type === k;
              return (
                <button key={k} type="button" className="list-row" aria-pressed={on} onClick={() => { update((d) => D.replaceSet(d, active.id, withType(typingSet, k))); setTyping(null); }}>
                  <div className="grow"><div>{t(`setType.${k}`)}</div><div className="meta">{t(`setType.${k}Note`)}</div></div>
                  <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="btn danger" style={{ marginTop: 16 }} onClick={() => { removeSet(typingSet); setTyping(null); }}><Icon name="trash" /> {t('setEdit.delete')}</button>
        </Sheet>
      ) : null}
      {sheet === 'exmore' && ex ? (
        <Sheet title={ex.name} onClose={() => setSheet(null)}>
          <div className="list">
            <button type="button" className="list-row" onClick={openSwap}><Icon name="undo" /><div className="grow"><div>{t('workout.swap')}</div>{ex.alternative ? <div className="meta">{t('plan.taken', { alt: ex.alternative })}</div> : null}</div><Icon name="chev" className="icon chev" /></button>
            {barbell ? <button type="button" className="list-row" onClick={() => setSheet('warmups')}><Icon name="barbell" /><div className="grow">{t('workout.warmups')}</div><Icon name="chev" className="icon chev" /></button> : null}
            <button type="button" className="list-row" onClick={() => { setNoteText(exerciseNote(data, ex.name)); setSheet('note'); }}><Icon name="book" /><div className="grow">{t('workout.note')}</div><Icon name="chev" className="icon chev" /></button>
            <button type="button" className="list-row" disabled={current === day.exercises.length - 1} onClick={() => { tweak((tw, n) => skipToEnd(tw, n, current)); setSheet(null); }}><Icon name="skip" /><div className="grow">{t('workout.skip')}</div></button>
            <button type="button" className="list-row" disabled={current === 0} onClick={() => { tweak((tw, n) => moveBy(tw, n, current, -1)); setCurrent(current - 1); setSheet(null); }}><span className="rot-up"><Icon name="chev" /></span><div className="grow">{t('workout.moveUp')}</div></button>
            <button type="button" className="list-row" disabled={current === day.exercises.length - 1} onClick={() => { tweak((tw, n) => moveBy(tw, n, current, 1)); setCurrent(current + 1); setSheet(null); }}><span className="rot-down"><Icon name="chev" /></span><div className="grow">{t('workout.moveDown')}</div></button>
            {current < day.exercises.length - 1 && !pairedWithNext(day.exercises, current) ? (
              <button type="button" className="list-row" onClick={() => { tweak((tw, n) => pairsFrom(tw, n, pairWithNext(day.exercises, current))); setSheet(null); }}><Icon name="link" /><div className="grow"><div>{t('superset.withNext')}</div><div className="meta">{t('superset.todayNote')}</div></div></button>
            ) : null}
            {ex.pair ? (
              <button type="button" className="list-row" onClick={() => { tweak((tw, n) => pairsFrom(tw, n, unpair(day.exercises, current))); setSheet(null); }}><Icon name="link" /><div className="grow"><div>{t('superset.undo')}</div><div className="meta">{t('superset.todayNote')}</div></div></button>
            ) : null}
            {safeVideo(ex.video) ? <a className="list-row" href={safeVideo(ex.video)} target="_blank" rel="noreferrer"><Icon name="video" /><div className="grow">{t('workout.video')}</div><Icon name="chev" className="icon chev" /></a> : null}
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>{t('workout.restAfter')}</span>
            <select value={restOverride[ex.name] ?? ''} onChange={(e) => setRestOverride({ ...restOverride, [ex.name]: e.target.value === '' ? undefined : Number(e.target.value) })}>
              <option value="">{ex.rest_sec ? t('workout.restPlan', { rest: clock(ex.rest_sec) }) : t('workout.restDefault')}</option>
              {REST_STEPS.map((sec) => <option key={sec} value={sec}>{clock(sec)}</option>)}
              <option value="0">{t('workout.noTimer')}</option>
            </select>
          </label>
        </Sheet>
      ) : null}
      {sheet === 'discard' ? (
        <ConfirmSheet title={t('workout.discard')} body={t('workout.discardConfirm', { label: day.label, sets: setsText(active.sets.length) })} action={t('workout.discard')} onConfirm={discard} onClose={() => setSheet(null)} />
      ) : null}
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
          <p className="muted small">{t('warm.setsNote')}</p>
        </Sheet>
      ) : null}
      {sheet === 'swap' && ex ? (
        <Sheet title={`Swap ${ex.swapped_from || ex.name}`} onClose={() => setSheet(null)}>
          <p className="muted small" style={{ marginTop: 0 }}>For today only; your plan stays the same.</p>
          <div className="chip-row scroll" role="group" aria-label={t('swap.byMuscle')}>
            <button type="button" className={`chip-btn${!swapGroup ? ' on' : ''}`} aria-pressed={!swapGroup} onClick={() => setSwapGroup(null)}>{t('swap.similar')}</button>
            {swapGroups.map((k) => (
              <button key={k} type="button" className={`chip-btn${swapGroup === k ? ' on' : ''}`} aria-pressed={swapGroup === k} onClick={() => setSwapGroup(k)}>{GROUP16[k].label}</button>
            ))}
          </div>
          <div className="list">
            {ex.swapped_from ? <button type="button" className="list-row" onClick={() => swapTo(null)}><div className="grow">Back to {ex.swapped_from}</div></button> : null}
            {[['easier', 'ladder.swapEasier', 'ladder.down'], ['harder', 'ladder.swapHarder', 'ladder.up']].map(([side, label, dir]) => {
              const step = ladderSteps?.[side];
              // The plan's own move already has its "Back to" row.
              return step && step.name !== ex.swapped_from ? (
                <button key={side} type="button" className="list-row" onClick={() => swapToName(step.name)}>
                  <div className="grow"><div>{t(label, { name: step.name })}</div><div className="meta">{t('ladder.swapMeta', { dir: t(dir) })}</div></div>
                  <Icon name="chev" className="icon chev" />
                </button>
              ) : null;
            })}
            {ex.alternative ? (
              <button type="button" className="list-row" onClick={() => swapToName(ex.alternative)}>
                <div className="grow"><div>{t('workout.planBackup')}</div><div className="meta">{ex.alternative}</div></div>
                <Icon name="chev" className="icon chev" />
              </button>
            ) : null}
            {swapOptions.map((o) => (
              <button key={o.id} type="button" className="list-row" onClick={() => swapTo(o)}>
                <div className="grow"><div>{o.name}</div><div className="meta">{swapGroup ? `${targetText(o)} · ${o.equipment || 'body only'}` : o.equipment || 'body only'}</div></div>
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

/** The faint line under a set-table row: last time's same set, and once
 * this one is logged, how it compares ("+1 rep", "same"). Text says the
 * change too, so it never rests on colour alone. */
function Ghost({ prev, cur = null }) {
  if (!prev) return null;
  const c = cur ? setChange(prev, cur) : null;
  const sign = (n) => (n > 0 ? '+' : '−');
  const what = !c || c.kind === 'same' ? null
    : c.kind === 'kg' ? t('chg.kg', { sign: sign(c.diff), n: Math.abs(c.diff) })
      : c.kind === 'secs' ? t('chg.secs', { sign: sign(c.diff), n: Math.abs(c.diff) })
        : t('chg.reps', { sign: sign(c.diff), n: Math.abs(c.diff), s: Math.abs(c.diff) === 1 ? '' : 's' });
  return (
    <div className="st-ghost">
      <span>{t('last.ghost', { text: lastText([prev]) })}</span>
      {c ? <span className={`chip${c.diff > 0 ? ' accent' : ''}`}>{c.kind === 'same' ? `= ${t('chg.same')}` : `${c.diff > 0 ? '▲' : '▼'} ${what}`}</span> : null}
    </div>
  );
}
