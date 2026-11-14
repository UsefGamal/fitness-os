import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import ConfirmSheet from '../components/ConfirmSheet.jsx';
import Icon from '../components/Icon.jsx';
import LineChart from '../components/LineChart.jsx';
import Stepper from '../components/Stepper.jsx';
import { formatDate } from '../lib/dates.js';
import { clock, deleteTest, nextDue, saveTest, series, summary, testList, timerAt } from '../lib/fitnessTest.js';
import { t } from '../lib/i18n.js';
import { gateOn } from '../lib/safety.js';
import { useKeepAwake } from '../store/awake.js';
import { feedback } from '../store/feedback.js';
import { useToday } from '../store/today.js';
import { content, useData } from '../store/useData.js';

const FT = content.training.fitness_test;
const unit = (item) => t(`ftest.unit.${item.unit}`);

/** The fitness test (content/fitness_test.py): when the next one is due,
 * the latest results against the last time, and the form to log a test. */
export default function FitnessTest() {
  const navigate = useNavigate();
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  const [taking, setTaking] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');
  const tests = testList(data);
  const due = nextDue(data, today, FT.every_days);
  const rows = summary(data, FT.items);
  const clearance = gateOn(data, 'needs_clearance', today);
  const easy = gateOn(data, 'beginner_only', today);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  if (taking) {
    return (
      <TestForm
        data={data}
        today={today}
        notes={{ clearance, easy }}
        onCancel={() => setTaking(false)}
        onSave={(date, inputs) => {
          update((d) => saveTest(d, date, inputs, FT.items));
          setTaking(false);
          setToast(t('ftest.saved'));
        }}
      />
    );
  }

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> {t('nav.back')}</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{t('ftest.title')}</h1>
      <p className="page-sub">{t('ftest.sub', { n: Math.round(FT.every_days / 7) })}</p>
      <Notes clearance={clearance} easy={easy} />
      <section className="card stack">
        <div>
          <strong>{due.status === 'never' ? t('ftest.never') : due.status === 'due' ? t('ftest.due') : t('ftest.later', { n: due.days })}</strong>
          {due.last ? <div className="muted small">{t('ftest.lastOn', { date: formatDate(due.last) })}</div> : null}
        </div>
        <button type="button" className={due.status === 'later' ? 'btn secondary' : 'btn'} onClick={() => setTaking(true)}><Icon name="play" /> {t('ftest.start')}</button>
      </section>

      {tests.length ? (
        <>
          <div className="section-label">{t('ftest.results')}</div>
          <div className="list">
            {rows.map(({ item, latest, change, best }) => (
              <div key={item.key} className="list-row">
                <div className="grow">
                  <div>{item.label}</div>
                  <div className="meta">{latest ? `${latest.move} · ${formatDate(latest.date)}` : t('ftest.notYet')}</div>
                </div>
                {latest ? (
                  <div style={{ textAlign: 'end' }}>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{latest.value} {unit(item)}</strong>
                    <div className="small">
                      {change != null && change !== 0 ? <span className={`chip${change > 0 ? ' accent' : ' warn'}`}>{change > 0 ? '+' : ''}{change}</span> : null}
                      {latest.value < best ? <span className="muted"> {t('ftest.best')} {best}</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <Trends data={data} rows={rows} />
          <div className="section-label">{t('ftest.past')}</div>
          <div className="list">
            {[...tests].reverse().map((test) => (
              <div key={test.date} className="list-row">
                <div className="grow">
                  <div>{formatDate(test.date)}</div>
                  <div className="meta">{FT.items.filter((i) => test.results[i.key]).map((i) => `${i.label} ${test.results[i.key].value}`).join(' · ')}</div>
                </div>
                <button type="button" className="btn ghost small" aria-label={t('ftest.delete')} onClick={() => setDeleting(test.date)}><Icon name="trash" /></button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {deleting ? (
        <ConfirmSheet
          title={t('ftest.deleteTitle')}
          body={t('ftest.deleteBody', { date: formatDate(deleting) })}
          action={t('ftest.delete')}
          onConfirm={() => update((d) => deleteTest(d, deleting))}
          onClose={() => setDeleting(null)}
        />
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

function Notes({ clearance, easy }) {
  if (!clearance && !easy) return null;
  return (
    <section className="card small stack">
      {clearance ? <div className="row"><Icon name="alert" className="icon" /> <span>{t('ftest.clearance')}</span></div> : null}
      {easy ? <div className="row"><Icon name="info" className="icon" /> <span>{t('ftest.easy')}</span></div> : null}
    </section>
  );
}

/** One chart at a time, on the move of each item's latest result. */
function Trends({ data, rows }) {
  const tested = rows.filter((r) => r.latest);
  const [key, setKey] = useState(tested[0]?.item.key);
  const row = tested.find((r) => r.item.key === key) || tested[0];
  if (!row) return null;
  const points = series(data, row.item.key, row.latest.move);
  return (
    <>
      <div className="section-label">{t('ftest.trend')}</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, margin: '0 4px 10px' }}>
        {tested.map((r) => (
          <button key={r.item.key} type="button" className={`chip${r.item.key === row.item.key ? ' accent' : ''}`} onClick={() => setKey(r.item.key)}>{r.item.label}</button>
        ))}
      </div>
      <section className="card"><LineChart points={points} unit={unit(row.item)} label={`${row.item.label}, ${row.latest.move}`} /></section>
    </>
  );
}

/** Logging a test: the guide, then one card per item with its move, an
 * optional timer and the result. Items left empty are left out. */
function TestForm({ data, today, notes, onCancel, onSave }) {
  const last = useMemo(() => Object.fromEntries(summary(data, FT.items).map((r) => [r.item.key, r.latest])), [data]);
  const [date, setDate] = useState(today);
  const [inputs, setInputs] = useState(() => Object.fromEntries(FT.items.map((i) => [i.key, { value: null, move: last[i.key]?.move ?? i.moves[0] }])));
  const [error, setError] = useState('');
  useKeepAwake(true);
  const set = (key, patch) => { setError(''); setInputs((all) => ({ ...all, [key]: { ...all[key], ...patch } })); };
  const save = () => {
    const filled = Object.fromEntries(Object.entries(inputs).filter(([, v]) => v.value != null));
    if (!Object.keys(filled).length) { setError(t('ftest.nothing')); return; }
    onSave(date && date <= today ? date : today, filled);
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('ftest.title')}</h1>
      <Notes {...notes} />
      <details className="card small" open={!Object.values(last).some(Boolean)}>
        <summary><strong>{t('ftest.how')}</strong></summary>
        <ul style={{ margin: '8px 0 0', paddingInlineStart: 20 }}>{FT.guide.map((g) => <li key={g}>{g}</li>)}</ul>
      </details>
      {FT.items.map((item) => {
        const input = inputs[item.key];
        return (
          <section key={item.key} className="card stack">
            <div>
              <strong>{item.label}</strong>
              <div className="muted small">{item.how}</div>
            </div>
            {item.moves.length > 1 ? (
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {item.moves.map((m) => (
                  <button key={m} type="button" className={`chip${input.move === m ? ' accent' : ''}`} onClick={() => set(item.key, { move: m })}>{m}</button>
                ))}
              </div>
            ) : null}
            {item.timer ? <TestTimer timer={item.timer} onStop={item.unit === 'seconds' ? (s) => set(item.key, { value: Math.min(s, item.max) }) : null} /> : null}
            {input.value == null ? (
              <button type="button" className="btn secondary" onClick={() => set(item.key, { value: last[item.key]?.move === input.move ? last[item.key].value : 0 })}>{t('ftest.enter')}</button>
            ) : (
              <>
                <Stepper value={input.value} min={0} max={item.max} step={1} label={`${item.label} (${unit(item)})`} onChange={(v) => set(item.key, { value: v })} />
                <button type="button" className="btn ghost small" onClick={() => set(item.key, { value: null })}>{t('ftest.skip')}</button>
              </>
            )}
          </section>
        );
      })}
      <div className="list">
        <label className="list-row">
          <div className="grow">{t('ftest.date')}</div>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {error ? <p className="small" role="alert" style={{ color: 'var(--danger)', margin: '12px 4px 0' }}>{error}</p> : null}
      <div className="stack" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={save}><Icon name="check" /> {t('ftest.save')}</button>
        <button type="button" className="btn secondary" onClick={onCancel}>{t('ftest.cancel')}</button>
      </div>
    </div>
  );
}

/** A countdown (squats in a minute) or a stopwatch (the plank hold).
 * Stopping the stopwatch passes the seconds on as the result. */
function TestTimer({ timer, onStop }) {
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [stopped, setStopped] = useState(null);
  const running = startedAt != null && stopped == null;
  const at = startedAt != null ? timerAt(timer, startedAt, stopped ?? now) : null;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      // A countdown ends by itself, with the same sound as the rest timer.
      if (timerAt(timer, startedAt, n).done) {
        setStopped(n);
        feedback('stop', { force: true });
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, startedAt, timer]);

  const start = () => { const n = Date.now(); setStartedAt(n); setNow(n); setStopped(null); feedback('work', { force: true }); };
  const stop = () => {
    const n = Date.now();
    setStopped(n);
    if (onStop) onStop(timerAt(timer, startedAt, n).elapsed);
  };
  const shown = at ? (timer.kind === 'countdown' ? at.left : at.elapsed) : timer.kind === 'countdown' ? timer.seconds : 0;

  const wide = { width: 'auto', padding: '0 20px' };
  let button;
  if (running) button = <button type="button" className="btn secondary" style={wide} onClick={stop}><Icon name="pause" /> {t('ftest.timerStop')}</button>;
  else if (startedAt == null) button = <button type="button" className="btn" style={wide} onClick={start}><Icon name="timer" /> {t('ftest.timerStart')}</button>;
  else button = <button type="button" className="btn secondary" style={wide} onClick={() => { setStartedAt(null); setStopped(null); }}><Icon name="undo" /> {t('ftest.timerReset')}</button>;

  return (
    <div className="row between" style={{ alignItems: 'center' }}>
      <span className="macro-value" style={{ fontSize: 32, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">{at?.done ? t('ftest.timerDone') : clock(shown)}</span>
      {button}
    </div>
  );
}
