import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import Icon from '../components/Icon.jsx';
import LineChart from '../components/LineChart.jsx';
import WeightChart from '../components/WeightChart.jsx';
import YearHeatmap from '../components/YearHeatmap.jsx';
import { badges } from '../lib/achievements.js';
import { formatDate } from '../lib/dates.js';
import { profileOf } from '../lib/macros.js';
import * as D from '../lib/data.js';
import { e1rmSeries, GROUPS, lastTrained, recoveryState, setsByGroup, trackedExercises, volumeLevel, weekStreaks, yearGrid } from '../lib/insights.js';
import { t } from '../lib/i18n.js';
import { activePlan } from '../lib/plan.js';
import { doneThisWeek, GUIDE, muscleRows, plannedThisWeek } from '../lib/weeklySets.js';
import { content, useData } from '../store/useData.js';
import { useToday } from '../store/today.js';

const MEASURES = [
  ['waist_cm', 'Waist'], ['chest_cm', 'Chest'], ['arm_cm', 'Arm'], ['hips_cm', 'Hips'], ['thigh_cm', 'Thigh'],
];
const VOLUME_FILL = [null, 'rgba(48,209,88,0.35)', 'rgba(48,209,88,0.65)', '#30d158'];
const STATE_FILL = { recovering: '#ff9f0a', ready: 'rgba(48,209,88,0.65)', untrained: null };
const MODES = [['volume', 'Volume'], ['recovery', 'Recovery'], ['untrained', 'Untrained']];

function Heat({ data, today }) {
  const grid = useMemo(() => yearGrid(data, today), [data, today]);
  const weeks = weekStreaks(data, today);
  const days = grid.flat().filter((d) => d.count).length;
  return (
    <section className="card stack">
      <div className="row between"><strong>Training days</strong><span className="muted small">{days} in the last year</span></div>
      <YearHeatmap grid={grid} />
      <div className="row" style={{ gap: 18 }}>
        <span className="row" style={{ gap: 6 }}><Icon name="flame" /><span><strong>{weeks.current}</strong> <span className="muted small">week streak</span></span></span>
        <span className="muted small">Best {weeks.longest} weeks</span>
      </div>
    </section>
  );
}

function Muscles({ data, today }) {
  const [mode, setMode] = useState('volume');
  const [group, setGroup] = useState(null);
  const sets = setsByGroup(data, today, 7);
  const state = recoveryState(data, today);
  const last = lastTrained(data, today);
  const fill = Object.fromEntries(GROUPS.map((g) => [g, mode === 'volume' ? VOLUME_FILL[volumeLevel(sets[g])]
    : mode === 'recovery' ? STATE_FILL[state[g]] : state[g] === 'untrained' ? '#ff453a' : null]));
  const caption = mode === 'volume' ? 'Working sets in the last 7 days. Brighter means more; 12+ sets a week is a full dose.'
    : mode === 'recovery' ? 'Orange: trained in the last 48 hours, still recovering. Green: ready.'
      : 'Red: no sets in 7 days or more.';
  return (
    <section className="card">
      <div className="seg" style={{ marginBottom: 10 }}>
        {MODES.map(([k, l]) => <button key={k} type="button" className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}
      </div>
      <BodyMap groupFill={fill} label={caption} onPick={(g) => setGroup(group === g ? null : g)} />
      <p className="muted small" style={{ textAlign: 'center', margin: '8px 0 0' }}>{caption}</p>
      <div className="group-rows">
        {GROUPS.map((g) => (
          <button key={g} type="button" className={`group-row${group === g ? ' on' : ''}`} onClick={() => setGroup(group === g ? null : g)}>
            <span>{g}</span>
            <div className="progress"><span style={{ width: `${Math.min(100, (sets[g] / 12) * 100)}%` }} /></div>
            <span className="muted small" style={{ textAlign: 'end' }}>{mode === 'volume' ? `${sets[g]} sets` : last[g] ? formatDate(last[g]).split(',')[0] : 'never'}</span>
          </button>
        ))}
      </div>
      {group ? <GroupExercises data={data} group={group} /> : <p className="muted small" style={{ textAlign: 'center', margin: '10px 0 0' }}>Tap a muscle to see its exercises.</p>}
    </section>
  );
}

const SCALE = 25; // the bar's full width, in sets
const BAND_TONE = { none: 'var(--faint)', low: 'var(--warn)', good: 'var(--accent)', high: 'var(--warn)' };

/** Hard sets per muscle this week against the 10-20 guide (E4-S19). */
function WeeklySets({ data, today }) {
  const T = activePlan(data, content);
  const done = doneThisWeek(data, T, today);
  const planned = plannedThisWeek(data, T, today);
  const rows = muscleRows(done.muscles, planned.muscles);
  const low = rows.filter((r) => r.band === 'low' || r.band === 'none').map((r) => r.label);
  const pct = (n) => `${Math.min(100, (n / SCALE) * 100)}%`;
  return (
    <section className="card">
      <h2 style={{ margin: '0 0 4px' }}>{t('wsets.title')}</h2>
      <p className="muted small" style={{ margin: '0 0 10px' }}>{t('wsets.note', { low: GUIDE.low, high: GUIDE.high })}</p>
      <div className="wsets">
        {rows.map((r) => (
          <div key={r.key} className="wset-row">
            <span>{r.label}</span>
            <div role="img" className="wset-bar" aria-label={t('wsets.rowLabel', { muscle: r.label, done: r.done, planned: r.planned })}>
              <span className="wset-guide" style={{ insetInlineStart: pct(GUIDE.low), width: `${((GUIDE.high - GUIDE.low) / SCALE) * 100}%` }} />
              <span className="wset-plan" style={{ width: pct(r.planned), borderColor: BAND_TONE[r.band] }} />
              <span className="wset-done" style={{ width: pct(r.done) }} />
            </div>
            <span aria-hidden="true" className="muted small" style={{ textAlign: 'end' }}>{t('wsets.count', { done: r.done, planned: r.planned })}</span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: '10px 0 0' }}>{t('wsets.legend')}</p>
      {low.length ? <p className="small" style={{ margin: '6px 0 0' }}>{t('wsets.lowPlan', { list: low.join(', '), low: GUIDE.low })}</p> : null}
      {done.unknown ? <p className="muted small" style={{ margin: '6px 0 0' }}>{t('wsets.unknown', { n: done.unknown })}</p> : null}
    </section>
  );
}

/** A group's exercises, most recently trained first; each opens its page
 * with the same-muscle replacements. */
function GroupExercises({ data, group }) {
  const last = new Map();
  for (const w of data.workouts) for (const st of w.sets) if (!last.has(st.exercise_id) || w.log_date > last.get(st.exercise_id)) last.set(st.exercise_id, w.log_date);
  const list = data.exercises.filter((e) => e.muscle_group === group)
    .sort((a, b) => (last.get(b.id) || '').localeCompare(last.get(a.id) || '') || a.name.localeCompare(b.name)).slice(0, 12);
  return (
    <div className="list" style={{ marginTop: 12, background: 'var(--surface2)' }}>
      {list.map((e) => (
        <Link key={e.id} to={`/library/${e.id}`} className="list-row">
          <div className="grow"><div>{e.name}</div><div className="meta">{last.get(e.id) ? `Last ${formatDate(last.get(e.id))}` : 'Not done yet'}</div></div>
          <Icon name="chev" className="icon chev" />
        </Link>
      ))}
    </div>
  );
}

function Strength({ data }) {
  const tracked = useMemo(() => trackedExercises(data), [data]);
  const [pick, setPick] = useState(null);
  const id = pick ?? tracked[0]?.id;
  const series = id ? e1rmSeries(data, id) : [];
  const bests = [...D.personalBests(data).values()]
    .map((b) => ({ ...b, name: data.exercises.find((e) => e.id === b.exercise_id)?.name || 'Exercise' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!tracked.length) return <div className="card empty">Log a few weighted sets and your strength trends show up here.</div>;
  return (
    <>
      <section className="card stack">
        <label className="field"><span>Estimated 1RM</span>
          <select value={id} onChange={(e) => setPick(Number(e.target.value))}>
            {tracked.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.sessions})</option>)}
          </select>
        </label>
        <LineChart points={series} label="Estimated one-rep max" />
      </section>
      <div className="section-label">Records</div>
      <div className="list">
        {bests.map((b) => (
          <button key={b.exercise_id} type="button" className="list-row" onClick={() => setPick(b.exercise_id)}>
            <div className="grow"><div>{b.name}</div><div className="meta">{formatDate(b.log_date)} · est. 1RM {Math.round(b.score)} kg</div></div>
            <strong>{b.weight_kg} × {b.reps}</strong>
          </button>
        ))}
      </div>
    </>
  );
}

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/** "3 / 10", "0.8 / 1 × BW", "2.5 / 5 kg" */
function progressText(b) {
  const round = (v) => (b.goal >= 1000 ? Math.round(v).toLocaleString() : Math.round(v * 10) / 10);
  const goal = b.goal >= 1000 ? b.goal.toLocaleString() : b.goal;
  return `${round(Math.max(0, b.value || 0))} / ${goal}${b.unit ? ` ${b.unit}` : b.goal >= 1000 ? ' kg' : ''}`;
}

function Badges({ data, today }) {
  const all = badges(data, today);
  const earned = all.filter((b) => b.earned).length;
  return (
    <>
      <p className="muted small" style={{ margin: '0 4px 10px' }}>{earned} of {all.length} earned</p>
      <div className="badges">
        {all.map((b) => (
          <div key={b.id} className={`badge tone-${b.tone}${b.earned ? ' on' : ''}`} style={{ '--p': `${Math.round(b.fraction * 360)}deg` }}>
            <span className="medal" aria-hidden="true">
              <span className="medal-in"><Icon name={b.icon} /></span>
              {b.tier > 1 ? <span className="tier">{ROMAN[b.tier]}</span> : null}
            </span>
            <span className="name">{b.label}</span>
            <span className="meta">{b.earned && b.date ? formatDate(b.date) : b.note}</span>
            {b.earned ? <span className="got"><Icon name="check" /> Earned</span> : <span className="count">{progressText(b)}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

function Body({ data, update, today }) {
  const latest = D.latestWeight(data);
  const [form, setForm] = useState({ weight: latest ? String(latest.weight_kg) : '' });
  const [more, setMore] = useState(false);
  const goalLow = profileOf(data).goal_weight_low_kg;
  const goalHigh = profileOf(data).goal_weight_high_kg;
  const first = data.body_logs[0];
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const lastOf = (k) => [...data.body_logs].reverse().find((b) => b[k] != null);

  const save = (e) => {
    e.preventDefault();
    const kg = parseFloat(form.weight);
    if (!(kg >= 20 && kg <= 400)) return;
    const extra = {};
    for (const [k] of MEASURES) {
      const cm = parseFloat(form[k]);
      if (cm >= 10 && cm <= 300) extra[k] = cm;
    }
    update((d) => D.logBody(d, { log_date: today, weight_kg: kg, ...extra }));
    setForm({ weight: String(kg) });
  };

  return (
    <>
      <div className="stat-grid">
        <div className="stat"><div className="label">Now</div><div className="value">{latest ? latest.weight_kg : '–'}<span className="unit">kg</span></div></div>
        <div className="stat"><div className="label">Change</div><div className="value">{latest && first ? (latest.weight_kg - first.weight_kg).toFixed(1) : '–'}<span className="unit">kg</span></div></div>
      </div>
      <section className="card">
        <div className="row between"><strong>Weight</strong>{goalLow ? <span className="muted small">Goal {goalLow}–{goalHigh} kg</span> : null}</div>
        <WeightChart logs={data.body_logs.slice(-60)} goalLow={goalLow} goalHigh={goalHigh} />
      </section>
      <form className="card stack" onSubmit={save}>
        <strong>Log today</strong>
        <div className="measure-grid">
          <label className="field"><span>Weight (kg)</span><input type="number" inputMode="decimal" step="0.1" value={form.weight} onChange={set('weight')} required /></label>
          <label className="field"><span>Waist (cm)</span><input type="number" inputMode="decimal" step="0.5" value={form.waist_cm || ''} onChange={set('waist_cm')} placeholder={lastOf('waist_cm')?.waist_cm ? String(lastOf('waist_cm').waist_cm) : 'Optional'} /></label>
          {more ? MEASURES.slice(1).map(([k, l]) => (
            <label key={k} className="field"><span>{l} (cm)</span><input type="number" inputMode="decimal" step="0.5" value={form[k] || ''} onChange={set(k)} placeholder={lastOf(k) ? String(lastOf(k)[k]) : 'Optional'} /></label>
          )) : null}
        </div>
        {more ? null : <button type="button" className="btn ghost small" onClick={() => setMore(true)}><Icon name="plus" /> Chest, arm, hips, thigh</button>}
        <button type="submit" className="btn">Save</button>
      </form>
      <div className="list">
        <Link to="/photos" className="list-row"><Icon name="user" /><div className="grow"><div>Progress photos</div><div className="meta">{(data.progress_photos || []).length ? `${data.progress_photos.length} on this phone · before and after` : 'Front, side and back, kept on this phone only'}</div></div><Icon name="chev" className="icon chev" /></Link>
      </div>
      {MEASURES.some(([k]) => lastOf(k)) ? (
        <>
          <div className="section-label">Measurements</div>
          <div className="list">
            {MEASURES.map(([k, l]) => {
              const rows = data.body_logs.filter((b) => b[k] != null);
              if (!rows.length) return null;
              const now = rows[rows.length - 1][k];
              const diff = now - rows[0][k];
              return (
                <div key={k} className="list-row">
                  <div className="grow"><div>{l}</div><div className="meta">{formatDate(rows[rows.length - 1].log_date)}{rows.length > 1 ? ` · ${diff > 0 ? '+' : ''}${diff.toFixed(1)} cm since ${formatDate(rows[0].log_date)}` : ''}</div></div>
                  <strong>{now} cm</strong>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      {data.body_logs.length ? (
        <>
          <div className="section-label">Weigh-ins</div>
          <div className="list">
            {[...data.body_logs].reverse().slice(0, 10).map((b) => (
              <div key={b.id} className="list-row">
                <div className="grow">{b.weight_kg} kg{b.waist_cm ? <span className="meta"> · waist {b.waist_cm} cm</span> : null}</div>
                <span className="meta">{formatDate(b.log_date)}</span>
                <button type="button" className="icon-btn" aria-label={`Delete weigh-in on ${b.log_date}`} onClick={() => update((d) => D.deleteBody(d, b.id))}><Icon name="trash" /></button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export default function Stats() {
  const { data, update } = useData();
  const today = useToday();
  const weightOn = D.moduleOn(data, 'weight');
  const tabs = [['muscles', 'Muscles'], ['strength', 'Strength'], ...(weightOn ? [['body', 'Body']] : []), ['badges', 'Badges']];
  const [tab, setTab] = useState('muscles');
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const thisWeek = data.workouts.filter((w) => new Date(w.log_date) >= weekAgo).length;

  return (
    <div className="page">
      <h1 className="page-title">Stats</h1>
      <div className="list">
        <Link to="/history" className="list-row"><Icon name="calendar" /><div className="grow"><div>History</div><div className="meta">{thisWeek} sessions in the last 7 days · {data.workouts.length} in total</div></div><Icon name="chev" className="icon chev" /></Link>
        <Link to="/library" className="list-row"><Icon name="book" /><div className="grow">Exercise library</div><Icon name="chev" className="icon chev" /></Link>
      </div>
      <Heat data={data} today={today} />
      <div className="seg" style={{ marginBottom: 14 }}>
        {tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'muscles' ? <><Muscles data={data} today={today} /><WeeklySets data={data} today={today} /></> : null}
      {tab === 'strength' ? <Strength data={data} /> : null}
      {tab === 'body' && weightOn ? <Body data={data} update={update} today={today} /> : null}
      {tab === 'badges' ? <Badges data={data} today={today} /> : null}
    </div>
  );
}
