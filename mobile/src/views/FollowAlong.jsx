import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import { entryFor, photoSrc, thumbOf } from '../lib/catalogue.js';
import { todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { amountOf, followSteps, startOf } from '../lib/followAlong.js';
import { effectiveDay } from '../lib/planEdit.js';
import { clock, COUNTDOWN_BEEPS, stepAt, totalSeconds } from '../lib/training.js';
import { useKeepAwake } from '../store/awake.js';
import { useCatalogue } from '../store/catalogue.js';
import { feedback, unlockAudio } from '../store/feedback.js';
import { content, useData } from '../store/useData.js';

/** What to play for `src`: recovery | warmup:<day> | cooldown:<day> |
 * home-warmup:<i> | home-cooldown:<i>. */
function source(src, data) {
  const T = content.training;
  const [kind, arg] = (src || 'recovery').split(':');
  if (kind === 'recovery') return { title: 'Recovery', lines: T.recovery_checklist, log: 'recovery' };
  if (kind === 'warmup' || kind === 'cooldown') {
    const day = effectiveDay(arg, T, data);
    if (!day) return null;
    const lines = kind === 'warmup' ? day.warmup : day.cooldown || [];
    return { title: `${day.label} ${kind === 'warmup' ? 'warm-up' : 'cool-down'}`, lines };
  }
  if (kind === 'home-warmup' || kind === 'home-cooldown') {
    const day = T.home_program[Number(arg)];
    if (!day) return null;
    return { title: `${day.label} ${kind === 'home-warmup' ? 'warm-up' : 'cool-down'}`, lines: kind === 'home-warmup' ? day.warmup : day.cooldown };
  }
  return null;
}

/** Stretch and mobility follow-along: each line plays as a timed hold with
 * the interval sounds and moves on by itself. */
export default function FollowAlong() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data, update } = useData();
  const { catalogue } = useCatalogue();
  const src = source(params.get('src'), data);
  const steps = useMemo(() => (src ? followSteps(src.lines) : []), [src?.title]); // eslint-disable-line react-hooks/exhaustive-deps
  const [run, setRun] = useState(null); // { startedAt, pausedAt, pausedMs }
  const [now, setNow] = useState(Date.now());
  const [saved, setSaved] = useState(false);
  const last = useRef(null);
  useKeepAwake(Boolean(run));

  const total = totalSeconds(steps);
  const elapsedMs = run ? (run.pausedAt || now) - run.startedAt - run.pausedMs : 0;
  const at = run ? stepAt(steps, Math.floor(elapsedMs / 1000)) : null;

  useEffect(() => {
    if (!run || run.pausedAt || at?.done) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [run, at?.done]);

  useEffect(() => {
    if (!run || run.pausedAt) return;
    if (at.done) {
      if (last.current !== 'done') { last.current = 'done'; feedback('workoutSaved'); }
      return;
    }
    const key = `${at.index}:${at.left}`;
    if (last.current === key) return;
    const first = last.current === null || !last.current.startsWith(`${at.index}:`);
    last.current = key;
    if (first) feedback('work');
    else if (COUNTDOWN_BEEPS.includes(at.left)) feedback('countdown');
  });

  if (!src) return <div className="page"><div className="card empty">Nothing to follow here.</div></div>;

  const start = () => {
    unlockAudio();
    last.current = null;
    setSaved(false);
    setRun({ startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  };
  const togglePause = () => setRun((r) => (r.pausedAt ? { ...r, pausedAt: null, pausedMs: r.pausedMs + (Date.now() - r.pausedAt) } : { ...r, pausedAt: Date.now() }));
  // Jump to the start of step i: move startedAt so elapsed time lands there.
  const jump = (i) => {
    const t = Date.now();
    setRun((r) => ({ ...r, startedAt: (r.pausedAt || t) - r.pausedMs - startOf(steps, i) * 1000 }));
    last.current = null;
    setNow(t);
  };
  const save = () => {
    const mins = Math.max(1, Math.round(elapsedMs / 60000));
    update((d) => D.logSession(d, { date: todayISO(), type: 'recovery', label: src.title, durationMin: mins, checklist: src.lines.map((l) => ({ item_name: l, completed: true })) }));
    setSaved(true);
  };
  const photo = (name) => {
    const e = catalogue ? entryFor(name, content.training, catalogue.byId) : null;
    return e ? photoSrc(e.photos?.[0] || thumbOf(e)) : null;
  };

  if (run) {
    if (at.done) {
      return (
        <div className="timer-full" role="timer" aria-live="polite">
          <div className="muted">{src.title}</div>
          <div className="interval-phase work">Done</div>
          <div className="big-next">{clock(total)} · {steps.length} holds</div>
          {src.log ? (saved ? <div className="muted">Saved to History.</div> : <button type="button" className="btn" style={{ width: 240 }} onClick={save}><Icon name="check" /> Save to History</button>) : null}
          <button type="button" className="btn ghost" style={{ width: 240 }} onClick={() => navigate(-1)}>Close</button>
        </div>
      );
    }
    const step = steps[at.index];
    const next = steps[at.index + 1];
    const img = photo(step.name);
    return (
      <div className="timer-full follow" role="timer" aria-live="polite">
        <div className="muted small">{src.title} · {at.index + 1} of {steps.length}</div>
        {img ? <img key={img} className="follow-photo" src={img} alt="" onError={(e) => { e.currentTarget.hidden = true; }} /> : null}
        <div className="follow-name">{step.name}</div>
        {step.side ? <div className="interval-phase rest">{step.side}</div> : <div className="muted small follow-line">{amountOf(step)}</div>}
        <div style={{ fontSize: 80, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{clock(at.left)}</div>
        <div className="muted">{next ? `Next: ${next.name}${next.side ? ` (${next.side.toLowerCase()})` : ''}` : 'Last one'}</div>
        <div className="row" style={{ gap: 12 }}>
          <button type="button" className="icon-btn" aria-label="Back one" disabled={at.index === 0} onClick={() => jump(at.index - 1)}><Icon name="back" /></button>
          <button type="button" className="btn secondary" style={{ width: 140 }} onClick={togglePause}><Icon name={run.pausedAt ? 'play' : 'pause'} /> {run.pausedAt ? 'Resume' : 'Pause'}</button>
          <button type="button" className="icon-btn" aria-label="Next" onClick={() => jump(at.index + 1)}><Icon name="skip" /></button>
        </div>
        <button type="button" className="btn ghost" style={{ width: 200 }} onClick={() => window.confirm('Stop following along?') && setRun(null)}><Icon name="x" /> Stop</button>
      </div>
    );
  }

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{src.title}</h1>
      <p className="page-sub">{steps.length} holds · {clock(total)}. Each one plays with a chime and moves on by itself; sounds follow Settings → Training.</p>
      <div className="list">
        {steps.map((s, i) => (
          <div key={`${s.label}-${i}`} className="list-row">
            <div className="grow"><div>{s.name}{s.side ? <span className="meta"> · {s.side.toLowerCase()}</span> : null}</div><div className="meta">{s.label}</div></div>
            <span className="meta">{clock(s.seconds)}</span>
          </div>
        ))}
      </div>
      <button type="button" className="btn" onClick={start}><Icon name="play" /> Start {clock(total)}</button>
    </div>
  );
}
