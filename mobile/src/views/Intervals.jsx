import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { clock, COUNTDOWN_BEEPS, INTERVAL_PRESETS, intervalSteps, normalizeIntervals, stepAt, totalSeconds } from '../lib/training.js';
import { feedback, unlockAudio } from '../store/feedback.js';
import { useData } from '../store/useData.js';

const PHASE = { warmup: 'Warm up', work: 'Work', rest: 'Rest', setrest: 'Set rest', cooldown: 'Cool down' };

function Num({ label, value, onChange, unit }) {
  return (
    <label className="field grow">
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Interval mode: HIIT, Tabata, EMOM or a custom set, run with the same
 * sounds as the rest timer and saved as a cardio session. */
export default function Intervals() {
  const navigate = useNavigate();
  const { update } = useData();
  const [config, setConfig] = useState(INTERVAL_PRESETS[0]);
  const [run, setRun] = useState(null); // { startedAt, pausedAt, pausedMs }
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState(false);
  const last = useRef(null);

  const steps = useMemo(() => intervalSteps(config), [config]);
  const total = totalSeconds(steps);
  const elapsedMs = run ? (run.pausedAt || now) - run.startedAt - run.pausedMs : 0;
  const at = run ? stepAt(steps, Math.floor(elapsedMs / 1000)) : null;

  useEffect(() => {
    if (!run || run.pausedAt || at?.done) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [run, at?.done]);

  // Sounds: a cue at the start of each step, 3-2-1 before the next one.
  useEffect(() => {
    if (!run || run.pausedAt) return;
    if (at.done) {
      if (last.current !== 'done') {
        last.current = 'done';
        feedback('workoutSaved');
      }
      return;
    }
    const step = steps[at.index];
    const key = `${at.index}:${at.left}`;
    if (last.current === key) return;
    const first = last.current === null || !last.current.startsWith(`${at.index}:`);
    last.current = key;
    if (first) feedback(step.kind === 'work' ? 'work' : 'rest');
    else if (COUNTDOWN_BEEPS.includes(at.left)) feedback('countdown');
  });

  const start = () => {
    unlockAudio();
    last.current = null;
    setSaved(false);
    setRun({ startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  };
  const togglePause = () => setRun((r) => (r.pausedAt ? { ...r, pausedAt: null, pausedMs: r.pausedMs + (Date.now() - r.pausedAt) } : { ...r, pausedAt: Date.now() }));
  const save = () => {
    const mins = Math.max(1, Math.round(elapsedMs / 60000));
    update((d) => D.logSession(d, { date: todayISO(), type: 'cardio', label: config.label || 'Intervals', durationMin: mins }));
    setSaved(true);
  };

  if (run) {
    const step = at.done ? null : steps[at.index];
    const works = steps.filter((s) => s.kind === 'work').length;
    const workNo = at.done ? works : steps.slice(0, at.index + 1).filter((s) => s.kind === 'work').length;
    const next = at.done ? null : steps[at.index + 1];
    return (
      <div className="timer-full" role="timer" aria-live="polite">
        <div className="muted">{config.label}</div>
        {at.done ? (
          <>
            <div className="interval-phase work">Done</div>
            <div className="big-next">{clock(total)} · {works} rounds</div>
            {saved ? <div className="muted">Saved to History as a cardio session.</div> : <button type="button" className="btn" style={{ width: 240 }} onClick={save}><Icon name="check" /> Save to History</button>}
            <button type="button" className="btn ghost" style={{ width: 240 }} onClick={() => setRun(null)}>Close</button>
          </>
        ) : (
          <>
            <div className={`interval-phase ${step.kind}`}>{PHASE[step.kind]}</div>
            <div style={{ fontSize: 96, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{clock(at.left)}</div>
            <div className="big-next">{step.kind === 'warmup' ? 'Get ready' : step.kind === 'cooldown' ? 'Nice work, ease off' : `Round ${workNo} of ${works}${config.sets > 1 ? ` · set ${step.set} of ${config.sets}` : ''}`}</div>
            <div className="muted">{next ? `Next: ${PHASE[next.kind]} ${clock(next.seconds)}` : 'Last one'}</div>
            <div className="muted small">{clock(Math.max(0, total - Math.floor(elapsedMs / 1000)))} left in total</div>
            <div className="row" style={{ gap: 12 }}>
              <button type="button" className="btn secondary" style={{ width: 140 }} onClick={togglePause}><Icon name={run.pausedAt ? 'play' : 'pause'} /> {run.pausedAt ? 'Resume' : 'Pause'}</button>
              <button type="button" className="btn ghost" style={{ width: 140 }} onClick={() => window.confirm('Stop this interval session?') && setRun(null)}><Icon name="x" /> Stop</button>
            </div>
          </>
        )}
      </div>
    );
  }

  const custom = (field) => (v) => setConfig((c) => ({ ...c, key: 'custom', label: 'Custom intervals', note: '', [field]: v }));
  const clean = normalizeIntervals(config);
  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Intervals</h1>
      <p className="page-sub">Pick a preset or set your own. Sounds follow Settings → Training.</p>
      <div className="list">
        {INTERVAL_PRESETS.map((p) => (
          <button key={p.key} type="button" className="list-row" aria-pressed={config.key === p.key} onClick={() => setConfig(p)}>
            <div className="grow"><div>{p.label}</div><div className="meta">{p.note} · {clock(totalSeconds(intervalSteps(p)))}</div></div>
            <span className={`check${config.key === p.key ? ' on' : ''}`}>{config.key === p.key ? <Icon name="check" /> : null}</span>
          </button>
        ))}
      </div>
      <div className="section-label">Adjust</div>
      <section className="card stack">
        <div className="row"><Num label="Work" unit="s" value={config.work} onChange={custom('work')} /><Num label="Rest" unit="s" value={config.rest} onChange={custom('rest')} /><Num label="Rounds" value={config.rounds} onChange={custom('rounds')} /></div>
        <div className="row"><Num label="Sets" value={config.sets} onChange={custom('sets')} /><Num label="Between sets" unit="s" value={config.setRest} onChange={custom('setRest')} /></div>
        <div className="row"><Num label="Warm-up" unit="s" value={config.warmup} onChange={custom('warmup')} /><Num label="Cool-down" unit="s" value={config.cooldown} onChange={custom('cooldown')} /></div>
        <div className="muted small">{clean.sets > 1 ? `${clean.sets} sets of ` : ''}{clean.rounds} × {clean.work} s work{clean.rest ? ` / ${clean.rest} s rest` : ''} · {clock(total)} in total</div>
      </section>
      <button type="button" className="btn" onClick={start}><Icon name="play" /> Start {clock(total)}</button>
    </div>
  );
}
