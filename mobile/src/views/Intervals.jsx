import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import Icon from '../components/Icon.jsx';
import Sheet, { useCloseSheet } from '../components/Sheet.jsx';
import { entryFor, photoSrc, thumbOf } from '../lib/catalogue.js';
import { intervalLines, moveAt, workBefore, MAX_MOVES, movePool, nextMove, PHASE_LABEL, presetMoves, roundsDone, toggleMove } from '../lib/intervals.js';
import { clock, INTERVAL_PRESETS, intervalSteps, normalizeIntervals, totalSeconds } from '../lib/training.js';
import { useCatalogue } from '../store/catalogue.js';
import { unlockAudio } from '../store/feedback.js';
import { elapsedOf, positionOf, useIntervalRun } from '../store/intervalRun.js';
import { content } from '../store/useData.js';
import { t } from '../lib/i18n.js';

const T = content.training;

function Num({ label, value, onChange, unit }) {
  return (
    <label className="field grow">
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** A move's photo path (catalogue), or null. */
function usePhotoOf() {
  const { catalogue } = useCatalogue();
  return (name, thumb = false) => {
    const e = name && catalogue ? entryFor(name, T, catalogue.byId) : null;
    if (!e) return null;
    return photoSrc(thumb ? thumbOf(e) : e.photos?.[0] || thumbOf(e));
  };
}

function MoveThumb({ src }) {
  if (!src) return <span className="ex-thumb empty" aria-hidden="true"><Icon name="waves" /></span>;
  return <span className="ex-thumb" aria-hidden="true"><img src={src} alt="" decoding="async" onError={(e) => { e.currentTarget.hidden = true; }} /></span>;
}

/** Interval mode: HIIT, Tabata, EMOM or a custom set, with a move for each
 * work round. It runs on in the background (IntervalRunner) and saves
 * itself to History as a cardio session. */
export default function Intervals() {
  const run = useIntervalRun((s) => s.run);
  return run ? <Running run={run} /> : <SetUp />;
}

function SetUp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const photoOf = usePhotoOf();
  // ?preset=tabata opens with that preset picked (the 8 PM session links here).
  const [config, setConfig] = useState(() => INTERVAL_PRESETS.find((p) => p.key === params.get('preset')) || INTERVAL_PRESETS[0]);
  const [moves, setMoves] = useState(() => presetMoves(T, config.key));
  const [adding, setAdding] = useState(false);
  const steps = intervalSteps(config);
  const total = totalSeconds(steps);
  const pickPreset = (p) => { setConfig(p); setMoves(presetMoves(T, p.key)); };
  const custom = (field) => (v) => setConfig((c) => ({ ...c, key: 'custom', label: 'Custom intervals', note: '', [field]: v }));
  const clean = normalizeIntervals(config);
  const start = () => {
    unlockAudio();
    useIntervalRun.getState().start(clean, moves);
  };
  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Intervals</h1>
      <p className="page-sub">{t('intervals.sub')}</p>
      <div className="list">
        {INTERVAL_PRESETS.map((p) => (
          <button key={p.key} type="button" className="list-row" aria-pressed={config.key === p.key} onClick={() => pickPreset(p)}>
            <div className="grow"><div>{p.label}</div><div className="meta">{p.note} · {clock(totalSeconds(intervalSteps(p)))}</div></div>
            <span className={`check${config.key === p.key ? ' on' : ''}`}>{config.key === p.key ? <Icon name="check" /> : null}</span>
          </button>
        ))}
      </div>

      <div className="section-label">{t('intervals.moves')}</div>
      <div className="list">
        {moves.map((m, i) => (
          <div key={m} className="list-row">
            <MoveThumb src={photoOf(m, true)} />
            <div className="grow"><div>{m}</div><div className="meta">{t('intervals.roundsOf', { list: roundsList(steps, moves, i) })}</div></div>
            <button type="button" className="icon-btn" aria-label={t('intervals.removeMove', { name: m })} onClick={() => setMoves((ms) => ms.filter((x) => x !== m))}><Icon name="x" /></button>
          </div>
        ))}
        <button type="button" className="list-row" onClick={() => setAdding(true)} disabled={moves.length >= MAX_MOVES}>
          <Icon name="plus" />
          <div className="grow"><div>{t('intervals.addMove')}</div><div className="meta">{moves.length ? t('intervals.addMeta') : t('intervals.noMoves')}</div></div>
        </button>
      </div>
      {adding ? <MovesSheet moves={moves} photoOf={photoOf} onToggle={(m) => setMoves((ms) => toggleMove(ms, m))} onClose={() => setAdding(false)} /> : null}

      <div className="section-label">Adjust</div>
      <section className="card stack">
        <div className="row"><Num label="Work" unit="s" value={config.work} onChange={custom('work')} /><Num label="Rest" unit="s" value={config.rest} onChange={custom('rest')} /><Num label="Rounds" value={config.rounds} onChange={custom('rounds')} /></div>
        <div className="row"><Num label="Sets" value={config.sets} onChange={custom('sets')} /><Num label="Between sets" unit="s" value={config.setRest} onChange={custom('setRest')} /></div>
        <div className="row"><Num label="Warm-up" unit="s" value={config.warmup} onChange={custom('warmup')} /><Num label="Cool-down" unit="s" value={config.cooldown} onChange={custom('cooldown')} /></div>
        <div className="muted small">{clean.sets > 1 ? `${clean.sets} sets of ` : ''}{clean.rounds} × {clean.work} s work{clean.rest ? ` / ${clean.rest} s rest` : ''} · {clock(total)} in total</div>
      </section>
      <p className="muted small" style={{ margin: '0 4px 12px' }}>{t('intervals.savedNote')}</p>
      <button type="button" className="btn" onClick={start}><Icon name="play" /> Start {clock(total)}</button>
    </div>
  );
}

/** "1, 5, 9" style: the rounds a move plays, for the moves list. */
function roundsList(steps, moves, i) {
  const out = [];
  let n = 0;
  for (let s = 0; s < steps.length; s += 1) {
    if (steps[s].kind !== 'work') continue;
    n += 1;
    if (moveAt(steps, s, moves) === moves[i]) out.push(n);
  }
  return out.length > 4 ? `${out.slice(0, 3).join(', ')} … ${out[out.length - 1]}` : out.join(', ') || '–';
}

function MovesSheet({ moves, photoOf, onToggle, onClose }) {
  return (
    <Sheet title={t('intervals.addMove')} onClose={onClose}>
      <MovesList moves={moves} photoOf={photoOf} onToggle={onToggle} onClose={onClose} />
    </Sheet>
  );
}

function MovesList({ moves, photoOf, onToggle, onClose }) {
  const close = useCloseSheet(onClose);
  return (
    <>
      <div className="list">
        {movePool(T).map((m) => {
          const on = moves.includes(m);
          return (
            <button key={m} type="button" className="list-row" aria-pressed={on} onClick={() => onToggle(m)}>
              <MoveThumb src={photoOf(m, true)} />
              <div className="grow">{m}</div>
              <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={close}>{t('common.done')}</button>
    </>
  );
}

function Running({ run }) {
  const navigate = useNavigate();
  const photoOf = usePhotoOf();
  const { togglePause, jump, clear, save } = useIntervalRun.getState();
  const [stopping, setStopping] = useState(false);
  // The clock is kept by IntervalRunner; this page re-reads it each frame.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (run.pausedAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [run.pausedAt]);
  const { steps, at } = positionOf(run);
  const total = totalSeconds(steps);
  const elapsedS = Math.floor(elapsedOf(run) / 1000);
  const label = run.config.label || 'Intervals';

  if (at.done) {
    const { rounds, byMove } = roundsDone(steps, elapsedS, run.moves);
    return (
      <div className="page interval-run">
        <div className="muted">{label}</div>
        <div className="interval-phase work">{t('intervals.done')}</div>
        <div className="big-next">{clock(total)} · {t('intervals.rounds', { n: rounds })}</div>
        {byMove.length ? <div className="list inset">{byMove.map(([m, n]) => <div key={m} className="list-row"><MoveThumb src={photoOf(m, true)} /><div className="grow">{m}</div><span className="muted small">{t('intervals.rounds', { n })}</span></div>)}</div> : null}
        <p className="muted small" style={{ margin: 0 }}>{run.saved ? t('intervals.saved') : null}</p>
        <div className="stack" style={{ width: '100%' }}>
          <button type="button" className="btn" onClick={() => { clear(); navigate('/history'); }}><Icon name="calendar" /> {t('intervals.seeHistory')}</button>
          <button type="button" className="btn secondary" onClick={clear}>{t('pill.close')}</button>
        </div>
      </div>
    );
  }

  const step = steps[at.index];
  const lines = intervalLines(steps, at.index, run.moves, { sets: run.config.sets });
  const move = moveAt(steps, at.index, run.moves);
  const shown = move || nextMove(steps, at.index, run.moves);
  const img = photoOf(shown);
  return (
    <div className="page interval-run" role="timer" aria-live="polite">
      <div className="row between" style={{ width: '100%' }}>
        <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
        <span className="muted small">{label}</span>
      </div>
      <div className={`interval-phase ${step.kind}`}>{PHASE_LABEL[step.kind]}</div>
      {img ? (
        <figure className={`interval-photo${move ? '' : ' next'}`}>
          <img key={img} src={img} alt="" onError={(e) => { e.currentTarget.parentElement.hidden = true; }} />
          {move ? null : <figcaption>{t('intervals.nextUp')}</figcaption>}
        </figure>
      ) : null}
      <div className="follow-name">{move || (shown ? t('intervals.nextIs', { name: shown }) : lines.title)}</div>
      <div className="interval-clock">{clock(at.left)}</div>
      <div className="muted">{move || !shown ? lines.detail : t('intervals.roundNext', { n: workBefore(steps, at.index) + 1, of: steps.filter((x) => x.kind === 'work').length })}</div>
      <div className="muted small">{t('intervals.left', { time: clock(Math.max(0, total - elapsedS)) })}</div>
      <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
        <button type="button" className="icon-btn" aria-label={t('aria.backOne')} disabled={at.index === 0} onClick={() => jump(at.index - 1)}><Icon name="back" /></button>
        <button type="button" className="btn secondary" style={{ minWidth: 140 }} onClick={togglePause}><Icon name={run.pausedAt ? 'play' : 'pause'} /> {run.pausedAt ? 'Resume' : 'Pause'}</button>
        <button type="button" className="icon-btn" aria-label={t('aria.next')} onClick={() => jump(at.index + 1)}><Icon name="skip" /></button>
      </div>
      <button type="button" className="btn ghost" onClick={() => setStopping(true)}><Icon name="x" /> {t('intervals.stop')}</button>
      {stopping ? <StopSheet rounds={roundsDone(steps, elapsedS, run.moves).rounds} minutes={Math.max(1, Math.round(elapsedS / 60))} onSave={() => { save(); clear(); }} onDiscard={clear} onClose={() => setStopping(false)} /> : null}
    </div>
  );
}

/** Stop early: save the rounds done so far, or drop them. */
function StopSheet({ rounds, minutes, onSave, onDiscard, onClose }) {
  return (
    <Sheet title={t('intervals.stopTitle')} onClose={onClose}>
      <StopButtons rounds={rounds} minutes={minutes} onSave={onSave} onDiscard={onDiscard} onClose={onClose} />
    </Sheet>
  );
}

function StopButtons({ rounds, minutes, onSave, onDiscard, onClose }) {
  const close = useCloseSheet(onClose);
  return (
    <>
      <p style={{ margin: '0 4px 16px' }}>{rounds ? t('intervals.stopBody', { n: rounds, min: minutes }) : t('intervals.stopNothing')}</p>
      <div className="stack">
        {rounds ? <button type="button" className="btn" onClick={() => { onSave(); close(); }}><Icon name="check" /> {t('intervals.stopSave', { min: minutes })}</button> : null}
        <button type="button" className="btn danger-fill" onClick={() => { onDiscard(); close(); }}>{t('intervals.stopDiscard')}</button>
        <button type="button" className="btn secondary" onClick={close}>{t('common.cancel')}</button>
      </div>
    </>
  );
}
