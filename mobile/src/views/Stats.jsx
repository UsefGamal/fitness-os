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
import { activeDays, badgeGroups, daysSince, groupStatus, groupVolume, latestBadge, recordSummary, seriesChange, sessionsLast7 } from '../lib/statsView.js';
import { content, useData } from '../store/useData.js';
import { useToday } from '../store/today.js';

const MEASURES = [
  ['waist_cm', 'Waist'], ['chest_cm', 'Chest'], ['arm_cm', 'Arm'], ['hips_cm', 'Hips'], ['thigh_cm', 'Thigh'],
];
const VOLUME_FILL = [null, 'rgba(48,209,88,0.35)', 'rgba(48,209,88,0.65)', '#30d158'];
const MODES = [['volume', 'Volume'], ['recovery', 'Recovery'], ['untrained', 'Untrained']];

/** The shared header: two numbers, consistency with the calendar folded
 * away, and the two links. */
function Summary({ data, today }) {
  const grid = useMemo(() => yearGrid(data, today), [data, today]);
  const weeks = weekStreaks(data, today);
  const days = activeDays(data.workouts, today);
  return (
    <>
      <div className="tile-grid">
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.sessions7')}</div><div className="macro-value">{sessionsLast7(data.workouts, today)}</div></div>
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.streak')}</div><div className="macro-value">{t('stats.weeks', { n: weeks.current })}</div></div>
      </div>
      <details className="card consistency">
        <summary>
          <div className="grow">
            <div className="row between"><strong>{t('stats.consistency')}</strong><span className="muted small">{t('stats.last6')}</span></div>
            <div className="row between" style={{ alignItems: 'baseline', marginTop: 4 }}>
              <span className="macro-value" style={{ fontSize: 28 }}>{t('stats.days', { n: days })}</span>
              <span className="muted small">{t('stats.best', { n: weeks.longest })}</span>
            </div>
            <div className="small" style={{ color: 'var(--accent)', marginTop: 2 }}>{t('stats.showCalendar')} <Icon name="chev" className="icon inline chev" /></div>
          </div>
        </summary>
        <div style={{ marginTop: 12 }}><YearHeatmap grid={grid} /></div>
      </details>
      <div className="list">
        <Link to="/history" className="list-row"><Icon name="calendar" /><div className="grow"><div>{t('stats.history')}</div><div className="meta">{t('stats.historyMeta', { n: data.workouts.length })}</div></div><Icon name="chev" className="icon chev" /></Link>
        <Link to="/library" className="list-row"><Icon name="book" /><div className="grow">{t('plan.library')}</div><Icon name="chev" className="icon chev" /></Link>
      </div>
    </>
  );
}

const STATUS_FILL = { recovering: '#ff9f0a', ready: '#30d158', untrained: '#ff453a', none: null };
const LEGEND = {
  volume: [['v3', VOLUME_FILL[3], 'stats.lg.full'], ['v2', VOLUME_FILL[2], 'stats.lg.some'], ['v1', VOLUME_FILL[1], 'stats.lg.little'], ['v0', null, 'stats.lg.none']],
  recovery: [['ready', STATUS_FILL.ready, 'stats.st.ready'], ['recovering', STATUS_FILL.recovering, 'stats.st.recovering'], ['untrained', STATUS_FILL.untrained, 'stats.st.untrained'], ['none', null, 'stats.st.none']],
  untrained: [['untrained', STATUS_FILL.untrained, 'stats.st.untrained'], ['ok', null, 'stats.lg.trained']],
};
const STATUS_ICON = { ready: 'check', recovering: 'timer', untrained: 'alert', none: 'minus' };

function Legend({ mode }) {
  return (
    <div className="legend" role="list">
      {LEGEND[mode].map(([k, c, label]) => (
        <span key={k} className="legend-item" role="listitem"><i style={{ background: c || 'var(--surface3)' }} />{t(label)}</span>
      ))}
    </div>
  );
}

function Muscles({ data, today }) {
  const [mode, setMode] = useState('volume');
  const [group, setGroup] = useState(null);
  const sets = setsByGroup(data, today, 7);
  const state = recoveryState(data, today);
  const last = lastTrained(data, today);
  const status = Object.fromEntries(GROUPS.map((g) => [g, groupStatus(state[g], last[g])]));
  const fill = Object.fromEntries(GROUPS.map((g) => [g, mode === 'volume' ? VOLUME_FILL[volumeLevel(sets[g])]
    : mode === 'recovery' ? STATUS_FILL[status[g]] : status[g] === 'untrained' || status[g] === 'none' ? STATUS_FILL.untrained : null]));
  const pick = (g) => setGroup(group === g ? null : g);
  const untrained = GROUPS.filter((g) => status[g] === 'untrained' || status[g] === 'none');
  return (
    <>
      <section className="card">
        <div className="seg" style={{ marginBottom: 12 }}>
          {MODES.map(([k]) => <button key={k} type="button" className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t(`stats.mode.${k}`)}</button>)}
        </div>
        <BodyMap groupFill={fill} label={t(`stats.cap.${mode}`)} onPick={pick} />
        <Legend mode={mode} />
        <p className="muted small" style={{ textAlign: 'center', margin: '8px 0 0' }}>{t(`stats.cap.${mode}`)}</p>
      </section>

      {mode === 'volume' ? <WeeklySets data={data} today={today} /> : null}

      {mode === 'recovery' ? (
        <section className="card">
          <h2 className="section-title" style={{ margin: '0 0 8px' }}>{t('stats.recoveryTitle')}</h2>
          <div className="list inset">
            {GROUPS.map((g) => {
              const ago = daysSince(last[g], today);
              return (
                <button key={g} type="button" className={`list-row${group === g ? ' on' : ''}`} onClick={() => pick(g)} aria-expanded={group === g}>
                  <span className={`status-dot st-${status[g]}`}><Icon name={STATUS_ICON[status[g]]} className="icon" /></span>
                  <div className="grow"><div>{g}</div><div className="meta">{t(`stats.st.${status[g]}`)}</div></div>
                  <span className="muted small">{ago == null ? t('stats.never') : ago === 0 ? t('stats.todayShort') : t('stats.daysAgo', { n: ago })}</span>
                </button>
              );
            })}
          </div>
          {group ? <GroupExercises data={data} group={group} /> : <p className="muted small" style={{ margin: '10px 4px 0' }}>{t('stats.tapGroup')}</p>}
        </section>
      ) : null}

      {mode === 'untrained' ? (
        <section className="card">
          <h2 className="section-title" style={{ margin: '0 0 8px' }}>{t('stats.untrainedTitle')}</h2>
          {untrained.length ? (
            <div className="list inset">
              {untrained.map((g) => (
                <button key={g} type="button" className="list-row" onClick={() => pick(g)} aria-expanded={group === g}>
                  <span className="status-dot st-untrained"><Icon name="alert" className="icon" /></span>
                  <div className="grow"><div>{g}</div><div className="meta">{last[g] ? t('stats.lastOn', { date: formatDate(last[g]) }) : t('stats.neverTrained')}</div></div>
                  <Icon name="chev" className="icon chev" />
                </button>
              ))}
            </div>
          ) : <p className="small" style={{ margin: 0 }}><Icon name="check" className="icon inline" /> {t('stats.allTrained')}</p>}
          {group && untrained.includes(group) ? <GroupExercises data={data} group={group} /> : null}
        </section>
      ) : null}
    </>
  );
}

const SCALE = 25; // the bar's full width, in sets
const BAND_TONE = { none: 'var(--faint)', low: 'var(--warn)', good: 'var(--accent)', high: 'var(--warn)' };

/** Hard sets this week (E4-S19), as six groups that open to their muscles
 * with the 10-20 guide. The set-counting rules are weeklySets.js's. */
function WeeklySets({ data, today }) {
  const T = activePlan(data, content);
  const done = doneThisWeek(data, T, today);
  const planned = plannedThisWeek(data, T, today);
  const rows = muscleRows(done.muscles, planned.muscles);
  const groups = groupVolume(rows, GUIDE);
  const low = rows.filter((r) => r.band === 'low' || r.band === 'none').map((r) => r.label);
  const pct = (n) => `${Math.min(100, (n / SCALE) * 100)}%`;
  return (
    <section className="card">
      <div className="row between"><h2 className="section-title" style={{ margin: 0 }}>{t('stats.volTitle')}</h2><span className="muted small" style={{ whiteSpace: 'nowrap' }}>{t('stats.thisWeek')}</span></div>
      <p className="muted small" style={{ margin: '4px 0 12px' }}>{t('stats.guide', { low: GUIDE.low, high: GUIDE.high })}</p>
      {groups.map((g) => (
        <details key={g.group} className="vol-group">
          <summary>
            <div className="grow">
              <div className="row between"><strong>{g.group}</strong><span className="muted small">{t('stats.groupSets', { done: g.done, planned: g.planned })}</span></div>
              <div className="progress" style={{ marginTop: 8 }}><span style={{ transform: `scaleX(${g.planned ? Math.min(1, g.done / g.planned) : g.done ? 1 : 0})` }} /></div>
              <div className="muted small" style={{ marginTop: 4 }}>{t('stats.inRange', { n: g.inRange, all: g.muscles.length })}</div>
            </div>
            <Icon name="chev" className="icon chev" />
          </summary>
          <div className="wsets">
            {g.muscles.map((r) => (
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
        </details>
      ))}
      <p className="muted small" style={{ margin: '12px 0 0' }}>{t('stats.countNote')}</p>
      <p className="muted small" style={{ margin: '6px 0 0' }}>{t('wsets.legend')}</p>
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

function Strength({ data, today }) {
  const tracked = useMemo(() => trackedExercises(data), [data]);
  const [pick, setPick] = useState(null);
  const id = pick ?? tracked[0]?.id;
  const series = id ? e1rmSeries(data, id) : [];
  const bests = [...D.personalBests(data).values()]
    .map((b) => ({ ...b, name: data.exercises.find((e) => e.id === b.exercise_id)?.name || 'Exercise' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!tracked.length) {
    return (
      <section className="card empty-cta">
        <Icon name="barbell" className="icon big-icon" />
        <h2 className="section-title" style={{ margin: '8px 0 4px' }}>{t('stats.strEmptyTitle')}</h2>
        <p className="muted small" style={{ margin: '0 0 16px' }}>{t('stats.strEmptyNote')}</p>
        <Link to="/workout" className="btn"><Icon name="play" /> {t('stats.strEmptyCta')}</Link>
      </section>
    );
  }
  const rec = recordSummary(D.personalBests(data).values(), today);
  const change = seriesChange(series);
  return (
    <>
      <div className="tile-grid">
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.prs')}</div><div className="macro-value">{rec.total}</div></div>
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.newPrs')}</div><div className="macro-value" style={{ color: rec.recent ? 'var(--accent)' : undefined }}>{rec.recent}</div></div>
      </div>
      <section className="card stack">
        {change ? (
          <div>
            <div className="row between"><strong>{tracked.find((x) => x.id === id)?.name}</strong>{change.change ? <span className="small" style={{ color: change.change > 0 ? 'var(--accent)' : 'var(--muted)' }}>{change.change > 0 ? '+' : ''}{change.change} kg</span> : null}</div>
            <div className="macro-value">{Math.round(change.now)} kg</div>
            <div className="muted small">{t('stats.e1rm')}</div>
          </div>
        ) : null}
        <label className="field"><span>{t('stats.exercise')}</span>
          <select value={id} onChange={(e) => setPick(Number(e.target.value))}>
            {tracked.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.sessions})</option>)}
          </select>
        </label>
        <LineChart points={series} label="Estimated one-rep max" />
      </section>
      <h2 className="section-title">{t('stats.records')}</h2>
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
  const latest = latestBadge(all);
  return (
    <>
      <section className="card">
        <div className="row between" style={{ alignItems: 'baseline' }}><h2 className="section-title" style={{ margin: 0 }}>{t('stats.achievements')}</h2><span className="macro-value" style={{ fontSize: 28 }}>{earned} / {all.length}</span></div>
        <div className="progress" style={{ margin: '12px 0 8px' }} role="progressbar" aria-label={t('stats.achievements')} aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={earned}><span style={{ transform: `scaleX(${all.length ? earned / all.length : 0})` }} /></div>
        <div className="muted small">{latest ? t('stats.latestBadge', { name: latest.label, date: formatDate(latest.date) }) : t('stats.noBadge')}</div>
      </section>
      {badgeGroups(all).map((g) => (
        <div key={g.key}>
          <div className="section-head"><h2 className="section-title">{t(`stats.cat.${g.key}`)}</h2><span className="muted small">{g.badges.filter((b) => b.earned).length}/{g.badges.length}</span></div>
          <div className="badges">
            {g.badges.map((b) => (
              <div key={b.id} className={`badge tone-${b.tone}${b.earned ? ' on' : ''}`} style={{ '--p': `${Math.round(b.fraction * 360)}deg` }}>
                <span className="medal" aria-hidden="true">
                  <span className="medal-in"><Icon name={b.earned ? b.icon : 'lock'} /></span>
                  {b.tier > 1 ? <span className="tier">{ROMAN[b.tier]}</span> : null}
                </span>
                <span className="name">{b.label}</span>
                <span className="meta">{b.earned && b.date ? formatDate(b.date) : b.note}</span>
                {b.earned ? <span className="got"><Icon name="check" /> {t('stats.earned')}</span> : <span className="count">{progressText(b)}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
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
      <form className="card stack" onSubmit={save}>
        <div className="row between"><strong>{t('stats.logToday')}</strong>{latest ? <span className="muted small">{t('stats.lastLog', { kg: latest.weight_kg, date: formatDate(latest.log_date) })}</span> : null}</div>
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
      <div className="stat-grid three">
        <div className="stat"><div className="label">{t('stats.now')}</div><div className="value">{latest ? latest.weight_kg : '–'}<span className="unit">{t('home.kg')}</span></div></div>
        <div className="stat"><div className="label">{t('stats.change')}</div><div className="value">{latest && first ? (latest.weight_kg - first.weight_kg).toFixed(1) : '–'}<span className="unit">{t('home.kg')}</span></div></div>
        <div className="stat"><div className="label">{t('stats.goal')}</div><div className="value">{goalLow ? `${goalLow}–${goalHigh}` : '–'}</div></div>
      </div>
      <section className="card">
        <div className="row between"><strong>Weight</strong>{goalLow ? <span className="muted small">Goal {goalLow}–{goalHigh} kg</span> : null}</div>
        <WeightChart logs={data.body_logs.slice(-60)} goalLow={goalLow} goalHigh={goalHigh} />
      </section>
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

  return (
    <div className="page">
      <h1 className="page-title">{t('tab.stats')}</h1>
      <Summary data={data} today={today} />
      <div className="seg stats-tabs" style={{ margin: '4px 0 12px' }}>
        {tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'muscles' ? <Muscles data={data} today={today} /> : null}
      {tab === 'strength' ? <Strength data={data} today={today} /> : null}
      {tab === 'body' && weightOn ? <Body data={data} update={update} today={today} /> : null}
      {tab === 'badges' ? <Badges data={data} today={today} /> : null}
    </div>
  );
}
