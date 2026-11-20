import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import WeighInSheet from '../components/WeighInSheet.jsx';
import Icon from '../components/Icon.jsx';
import LineChart from '../components/LineChart.jsx';
import { KeptChart, WeeksChart } from '../components/OverviewCharts.jsx';
import { Readiness } from '../components/DataHealth.jsx';
import WeightChart from '../components/WeightChart.jsx';
import YearHeatmap from '../components/YearHeatmap.jsx';
import { badges } from '../lib/achievements.js';
import { nextDue } from '../lib/fitnessTest.js';
import { dayMonth, formatDate, formatNumber } from '../lib/dates.js';
import { currentGoal, macroTargets, profileOf } from '../lib/macros.js';
import { measuredBurn } from '../lib/measuredBurn.js';
import { sparkLine, strengthMovers } from '../lib/movers.js';
import { THIN_WEEK, weeklyAverages } from '../lib/bodyStats.js';
import { AVG_WEEKS, muscleVolume } from '../lib/muscleVolume.js';
import { keptWhileCutting, weeklyDays } from '../lib/overview.js';
import * as D from '../lib/data.js';
import { e1rmSeries, trackedExercises, weekStreaks, yearGrid } from '../lib/insights.js';
import { entryFor } from '../lib/catalogue.js';
import { trainedGroups, GROUP16, GROUPS16, groupStats, recoveryOf } from '../lib/muscleGroups.js';
import { useCatalogue } from '../store/catalogue.js';
import { t } from '../lib/i18n.js';
import { activePlan } from '../lib/plan.js';
import { doneThisWeek, GUIDE, muscleRows, plannedThisWeek } from '../lib/weeklySets.js';
import { activeDays, badgeGroups, daysSince, firstLoadDates, groupStatus, groupVolume, latestBadge, recordSummary, seriesChange, sessionsLast7, statsTabs } from '../lib/statsView.js';
import { content, useData } from '../store/useData.js';
import PullRefresh from '../components/PullRefresh.jsx';
import { healthSettings, syncHealth } from '../store/phoneSync.js';
import { isNative } from '../store/native.js';
import { useToday } from '../store/today.js';

const MEASURES = [
  ['waist_cm', 'Waist'], ['chest_cm', 'Chest'], ['arm_cm', 'Arm'], ['hips_cm', 'Hips'], ['thigh_cm', 'Thigh'],
];
// Body map volume shades, matched to the 10-20 guide (BI-17): fainter is
// fewer sets; the legend names each step, so shade is never the only cue.
const BAND_FILL = { none: null, low: 'color-mix(in srgb, var(--accent) 30%, transparent)', good: 'color-mix(in srgb, var(--accent) 65%, transparent)', high: 'var(--accent)' };
const MODES = [['volume', 'Volume'], ['recovery', 'Recovery'], ['untrained', 'Untrained']];

/** The fitness test's row: when the next one is due (lib/fitnessTest.js). */
function FitnessTestRow({ data, today }) {
  const due = nextDue(data, today, content.training.fitness_test.every_days);
  const meta = due.status === 'never' ? t('ftest.statsMeta') : due.status === 'due' ? t('ftest.statsDue', { date: formatDate(due.last) }) : t('ftest.statsLater', { n: due.days });
  return (
    <Link to="/stats/fitness-test" className="list-row">
      <Icon name="medal" />
      <div className="grow"><div>{t('ftest.title')}</div><div className="meta" style={due.status === 'due' ? { color: 'var(--accent)' } : undefined}>{meta}</div></div>
      <Icon name="chev" className="icon chev" />
    </Link>
  );
}

/** The shared header: two numbers, consistency with the calendar folded
 * away, and the two links. */
function Summary({ data, today }) {
  const grid = useMemo(() => yearGrid(data, today), [data, today]);
  const weeks = weekStreaks(data, today);
  const days = activeDays(data.workouts, today);
  const byWeek = useMemo(() => weeklyDays(data, today), [data, today]);
  const kept = useMemo(() => keptWhileCutting(data, today), [data, today]);
  return (
    <>
      <div className="tile-grid">
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.sessions7')}</div><div className="macro-value">{sessionsLast7(data.workouts, today)}</div></div>
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.streak')}</div><div className="macro-value">{t('stats.weeks', { n: weeks.current })}</div></div>
      </div>
      <Readiness data={data} today={today} />
      <section className="card">
        <div className="row between"><strong>{t('ov.weeksTitle')}</strong><span className="muted small">{t('ov.weeksSub')}</span></div>
        <WeeksChart weeks={byWeek} />
      </section>
      {kept ? (
        <section className="card">
          <div className="row between"><strong>{t('ov.keptTitle')}</strong><span className="muted small">{t('ov.keptSub')}</span></div>
          <p className="small" style={{ margin: '4px 0 8px' }}>{t('ov.keptLine', { kg: kept.weight.change, up: kept.counts.up, held: kept.counts.held, down: kept.counts.down })}</p>
          <KeptChart kept={kept} />
          <p className="muted small" style={{ margin: '6px 0 0' }}>{t('ov.keptNote')}</p>
        </section>
      ) : null}
      <details className="card consistency">
        <summary>
          <div className="grow">
            <div className="row between"><strong>{t('stats.consistency')}</strong><span className="muted small">{t('stats.last6')}</span></div>
            <div className="row between" style={{ alignItems: 'baseline', marginTop: 4 }}>
              <span className="macro-value" style={{ fontSize: 'calc(28px * var(--ts))' }}>{t('stats.days', { n: days })}</span>
              <span className="muted small">{t('stats.best', { n: weeks.longest })}</span>
            </div>
            <div className="small" style={{ color: 'var(--accent)', marginTop: 2 }}>{t('stats.showCalendar')} <Icon name="chev" className="icon inline chev" /></div>
          </div>
        </summary>
        <div style={{ marginTop: 12 }}><YearHeatmap grid={grid} /></div>
      </details>
      <div className="list">
        <Link to="/history" className="list-row"><Icon name="calendar" /><div className="grow"><div>{t('stats.history')}</div><div className="meta">{t('stats.historyMeta', { n: data.workouts.length })}</div></div><Icon name="chev" className="icon chev" /></Link>
        <FitnessTestRow data={data} today={today} />
        <Link to="/library" className="list-row"><Icon name="book" /><div className="grow">{t('plan.library')}</div><Icon name="chev" className="icon chev" /></Link>
      </div>
    </>
  );
}

const STATUS_FILL = { recovering: 'var(--orange)', ready: 'var(--accent)', untrained: 'var(--danger)', none: null };
const LEGEND = {
  volume: [['high', BAND_FILL.high, 'mvol.lg.high'], ['good', BAND_FILL.good, 'mvol.lg.good'], ['low', BAND_FILL.low, 'mvol.lg.low'], ['none', null, 'stats.lg.none']],
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
  // The 16 groups (BeFit item 17), read from every set logged: an
  // exercise's main muscles count in full, its helpers by half.
  const groupsOf = useGroupsOf(data);
  const stats = useMemo(() => groupStats(data, groupsOf, today), [data, groupsOf, today]);
  const { catalogue } = useCatalogue();
  const vol = useMemo(() => {
    const T = activePlan(data, content);
    return muscleVolume(data, T, today, catalogue ? (name) => entryFor(name, T, catalogue.byId) : undefined);
  }, [data, today, catalogue]);
  const GROUPS = GROUPS16.map((g) => g.key);
  const last = Object.fromEntries(GROUPS.map((g) => [g, stats[g].last]));
  const status = Object.fromEntries(GROUPS.map((g) => [g, groupStatus(recoveryOf(last[g], today), last[g])]));
  const fill = Object.fromEntries(GROUPS.map((g) => [g, mode === 'volume' ? BAND_FILL[vol.groups[g].band]
    : mode === 'recovery' ? STATUS_FILL[status[g]] : status[g] === 'untrained' || status[g] === 'none' ? STATUS_FILL.untrained : null]));
  const pick = (g) => setGroup(group === g ? null : g);
  const untrained = GROUPS.filter((g) => status[g] === 'untrained' || status[g] === 'none');
  return (
    <>
      <section className="card">
        <div className="seg" style={{ marginBottom: 12 }}>
          {MODES.map(([k]) => <button key={k} type="button" className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t(`stats.mode.${k}`)}</button>)}
        </div>
        <BodyMap fine groupFill={fill} label={t(`stats.cap.${mode}`)} onPick={pick} />
        <Legend mode={mode} />
        <p className="muted small" style={{ textAlign: 'center', margin: '8px 0 0' }}>{t(`stats.cap.${mode}`)}</p>
      </section>

      {mode === 'volume' ? <><MuscleWeeks vol={vol} group={group} onPick={pick} />{group ? <section className="card"><GroupExercises data={data} group={group} groupsOf={groupsOf} /></section> : null}<WeeklySets data={data} today={today} /></> : null}

      {mode === 'recovery' ? (
        <section className="card">
          <h2 className="section-title" style={{ margin: '0 0 8px' }}>{t('stats.recoveryTitle')}</h2>
          <div className="list inset">
            {GROUPS.map((g) => {
              const ago = daysSince(last[g], today);
              return (
                <button key={g} type="button" className={`list-row${group === g ? ' on' : ''}`} onClick={() => pick(g)} aria-expanded={group === g}>
                  <span className={`status-dot st-${status[g]}`}><Icon name={STATUS_ICON[status[g]]} className="icon" /></span>
                  <div className="grow"><div>{GROUP16[g].label}</div><div className="meta">{t(`stats.st.${status[g]}`)}</div></div>
                  <span className="muted small">{ago == null ? t('stats.never') : ago === 0 ? t('stats.todayShort') : t('stats.daysAgo', { n: ago })}</span>
                </button>
              );
            })}
          </div>
          {group ? <GroupExercises data={data} group={group} groupsOf={groupsOf} /> : <p className="muted small" style={{ margin: '10px 4px 0' }}>{t('stats.tapGroup')}</p>}
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
                  <div className="grow"><div>{GROUP16[g].label}</div><div className="meta">{last[g] ? t('stats.lastOn', { date: formatDate(last[g]) }) : t('stats.neverTrained')}</div></div>
                  <Icon name="chev" className="icon chev" />
                </button>
              ))}
            </div>
          ) : <p className="small" style={{ margin: 0 }}><Icon name="check" className="icon inline" /> {t('stats.allTrained')}</p>}
          {group && untrained.includes(group) ? <GroupExercises data={data} group={group} groupsOf={groupsOf} /> : null}
        </section>
      ) : null}
    </>
  );
}

const VOL_SCALE = 25; // the bar's full width, in sets a week

/** Sets a week per group (BI-17): the 4-week average as the bar, this
 * week so far as a hollow tick, the 10-20 guide as the shaded band. */
function MuscleWeeks({ vol, group, onPick }) {
  const rows = GROUPS16.filter((g) => vol.groups[g.key].avg || vol.groups[g.key].soFar);
  const idle = GROUPS16.filter((g) => !vol.groups[g.key].avg && !vol.groups[g.key].soFar);
  const pct = (n) => `${Math.min(100, (n / VOL_SCALE) * 100)}%`;
  return (
    <section className="card">
      <div className="row between"><h2 className="section-title" style={{ margin: 0 }}>{t('mvol.title')}</h2><span className="muted small" style={{ whiteSpace: 'nowrap' }}>{t('mvol.window', { n: vol.weeks || AVG_WEEKS })}</span></div>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>{vol.ready ? t('mvol.sub', { low: GUIDE.low, high: GUIDE.high }) : t('mvol.notReady')}</p>
      <div className="mvol-list">
        {rows.map((g) => {
          const v = vol.groups[g.key];
          return (
            <button key={g.key} type="button" className={`mvol-row${group === g.key ? ' on' : ''}`} onClick={() => onPick(g.key)}
              aria-label={t('mvol.rowAria', { group: g.label, avg: v.avg, now: v.soFar, state: t(`mvol.band.${v.band}`) })}>
              <span className="mvol-name">{g.label}</span>
              <span className="mvol-bar" aria-hidden="true">
                <span className="wset-guide" style={{ insetInlineStart: pct(GUIDE.low), width: `${((GUIDE.high - GUIDE.low) / VOL_SCALE) * 100}%` }} />
                {vol.ready ? <span className={`mvol-avg b-${v.band}`} style={{ width: pct(v.avg) }} /> : null}
                {v.soFar ? <span className="mvol-now" style={{ insetInlineStart: `calc(${pct(v.soFar)} - 1px)` }} /> : null}
              </span>
              <span className="mvol-num" aria-hidden="true">{vol.ready ? v.avg : t('wavg.dash')}<small>{t(`mvol.band.${v.band}`)}</small></span>
            </button>
          );
        })}
      </div>
      <div className="chart-key" style={{ marginTop: 8 }}>
        <span><i className="key-line" aria-hidden="true" />{t('mvol.keyAvg')}</span>
        <span><i className="key-tick" aria-hidden="true" />{t('mvol.keyNow')}</span>
        <span><i className="key-band" aria-hidden="true" />{t('mvol.keyGuide', { low: GUIDE.low, high: GUIDE.high })}</span>
      </div>
      {idle.length ? <p className="muted small" style={{ margin: '6px 0 0' }}>{t('mvol.idle', { list: idle.map((g) => g.label).join(', ') })}</p> : null}
      {vol.skipped ? <p className="muted small" style={{ margin: '6px 0 0' }}>{t('mvol.skipped', { n: vol.skipped })}</p> : null}
    </section>
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
      <p className="muted small" style={{ margin: '4px 0 12px' }}>{t('stats.volSub')}</p>
      {groups.map((g) => (
        <details key={g.group} className="vol-group">
          <summary>
            <div className="grow">
              <div className="row between"><strong>{g.group}</strong><span className={`chip${g.state === 'on_track' ? ' accent' : ' warn'}`}>{t('stats.planChip', { state: t(`stats.state.${g.state}`) })}</span></div>
              <div className="progress" style={{ marginTop: 8 }}><span style={{ transform: `scaleX(${g.planned ? Math.min(1, g.done / g.planned) : g.done ? 1 : 0})` }} /></div>
              <div className="muted small" style={{ marginTop: 4 }}>{t('stats.groupDone', { done: g.done, planned: g.planned })}</div>
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
      <details className="how-counted">
        <summary>{t('stats.howCounted')}</summary>
        <p className="muted small">{t('stats.guide', { low: GUIDE.low, high: GUIDE.high })}</p>
        <p className="muted small">{t('stats.countNote')}</p>
        <p className="muted small">{t('wsets.legend')}</p>
      </details>
      {low.length ? <p className="small" style={{ margin: '6px 0 0' }}>{t('wsets.lowPlan', { list: low.join(', '), low: GUIDE.low })}</p> : null}
      {done.unknown ? <p className="muted small" style={{ margin: '6px 0 0' }}>{t('wsets.unknown', { n: done.unknown })}</p> : null}
    </section>
  );
}

/** A group's exercises, most recently trained first; each opens its page
 * with the same-muscle replacements. */
/** An exercise id -> its main and helper groups, looked up once each. */
function useGroupsOf(data) {
  const { catalogue } = useCatalogue();
  return useMemo(() => {
    const byId = new Map(data.exercises.map((e) => [e.id, e]));
    const memo = new Map();
    return (id) => {
      if (!memo.has(id)) {
        const e = byId.get(id);
        memo.set(id, trainedGroups(e, content.training, e && catalogue ? entryFor(e.name, content.training, catalogue.byId) : null));
      }
      return memo.get(id);
    };
  }, [data.exercises, catalogue]);
}

function GroupExercises({ data, group, groupsOf }) {
  const last = new Map();
  for (const w of data.workouts) for (const st of w.sets) if (!last.has(st.exercise_id) || w.log_date > last.get(st.exercise_id)) last.set(st.exercise_id, w.log_date);
  const list = data.exercises.filter((e) => groupsOf(e.id).main.includes(group))
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
  const rec = recordSummary(D.personalBests(data).values(), today, 30, firstLoadDates(data.workouts));
  const change = seriesChange(series);
  const movers = strengthMovers(data, today);
  return (
    <>
      <div className="tile-grid">
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.prs')}</div><div className="macro-value">{rec.total}</div></div>
        <div className="stat-tile macro"><div className="stat-tile-label">{t('stats.newPrs')}</div><div className="macro-value" style={{ color: rec.recent ? 'var(--accent)' : undefined }}>{rec.recent}</div></div>
      </div>
      <Movers movers={movers} onPick={setPick} lifting={['gain', 'recomp'].includes(currentGoal(data)?.direction)} />
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
      {/* The full A-Z list is one tap away (charts step 3): the movers above answer "what's changing". */}
      <details className="records-all">
        <summary><h2 className="section-title" style={{ margin: 0 }}>{t('movers.allRecords', { n: bests.length })}</h2><Icon name="chev" className="icon chev" /></summary>
        <div className="list">
          {bests.map((b) => (
            <button key={b.exercise_id} type="button" className="list-row" onClick={() => setPick(b.exercise_id)}>
              <div className="grow"><div>{b.name}</div><div className="meta">{formatDate(b.log_date)} · est. 1RM {Math.round(b.score)} kg</div></div>
              <strong>{b.weight_kg} × {b.reps}</strong>
            </button>
          ))}
        </div>
      </details>
    </>
  );
}

const OUTCOME_ICON = { up: '▲', held: '=', down: '▼' };

/** Lifts that moved: the last 4 weeks against the 4 before (charts step 3).
 * On a cut, holding strength is the win, so "held" is said kindly. */
function Movers({ movers, onPick, lifting }) {
  const { counts, rows, waiting } = movers;
  const judged = counts.up + counts.held + counts.down;
  if (!judged) {
    return <section className="card"><h2 className="section-title" style={{ margin: 0 }}>{t('movers.title')}</h2><p className="muted small" style={{ margin: '6px 0 0' }}>{t('movers.empty')}</p></section>;
  }
  const top = rows.slice(0, 5);
  return (
    <section className="card movers">
      <h2 className="section-title" style={{ margin: 0 }}>{t('movers.title')}</h2>
      <div className="movers-counts" role="group" aria-label={t('movers.aria', counts)}>
        <div className="up"><strong>{counts.up}</strong><span>{t('movers.up')}</span></div>
        <div><strong>{counts.held}</strong><span>{t('movers.held')}</span></div>
        <div className="down"><strong>{counts.down}</strong><span>{t('movers.down')}</span></div>
      </div>
      <p className="muted small" style={{ margin: '0 0 4px' }}>{[lifting ? null : t('movers.cutNote'), waiting ? t('movers.waiting', { n: waiting }) : null].filter(Boolean).join(' ')}</p>
      <div className="movers-list">
        {top.map((r) => {
          const d = sparkLine(r.spark);
          return (
            <button key={r.exercise_id} type="button" className="mover-row" onClick={() => onPick(r.exercise_id)} aria-label={t(`movers.rowAria.${r.outcome}`, { name: r.name, kg: Math.abs(r.kg), now: Math.round(r.now) })}>
              <span className="grow"><span className="mover-name">{r.name}</span><span className="meta">{t('movers.e1rm', { kg: Math.round(r.now) })}</span></span>
              {d ? <svg className={`mover-spark ${r.outcome}`} width="60" height="20" viewBox="0 0 60 20" aria-hidden="true"><path d={d} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              <span className={`chip${r.outcome === 'up' ? ' accent' : r.outcome === 'down' ? ' effort' : ''}`}>{OUTCOME_ICON[r.outcome]} {r.outcome === 'held' ? t('movers.held') : t('movers.kg', { kg: Math.abs(r.kg) })}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/** "3 / 10", "0.8 / 1 × BW", "2.5 / 5 kg" */
function progressText(b) {
  const round = (v) => (b.goal >= 1000 ? formatNumber(Math.round(v)) : Math.round(v * 10) / 10);
  const goal = b.goal >= 1000 ? formatNumber(b.goal) : b.goal;
  return `${round(Math.max(0, b.value || 0))} / ${goal}${b.unit ? ` ${b.unit}` : b.goal >= 1000 ? ' kg' : ''}`;
}

function Badges({ data, today }) {
  const all = badges(data, today);
  const earned = all.filter((b) => b.earned).length;
  const latest = latestBadge(all);
  return (
    <>
      <section className="card">
        <div className="row between" style={{ alignItems: 'baseline' }}><h2 className="section-title" style={{ margin: 0 }}>{t('stats.achievements')}</h2><span className="macro-value" style={{ fontSize: 'calc(28px * var(--ts))' }}>{earned} / {all.length}</span></div>
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

const flat = (c) => Math.abs(c) < 0.05;
/** "▼ -0.4": an arrow and a sign, so the colour is never the only cue. */
function changeText(c) {
  const arrow = flat(c) ? '=' : c > 0 ? '▲' : '▼';
  return `${arrow} ${c > 0 ? '+' : ''}${c.toFixed(1)}`;
}

/** Where the app's estimate sits against the measured range. */
function modelSide(b) {
  if (b.diff == null || (b.model >= b.low && b.model <= b.high)) return 'in';
  return Math.sign(b.diff) === 1 ? 'high' : 'low';
}

/** Measured maintenance (BI-13): what this month's meals and weight say
 * you burn, as a range, beside the app's own estimate. Hidden with
 * calories, under 18, with a safety limit on, and in Ramadan. */
function BurnCard({ data, today }) {
  const model = macroTargets(data, content.nutrition, today)?.tdee ?? null;
  const b = measuredBurn(data, content.nutrition.meal_slots, today, model);
  if (!b.ready && b.reason === 'hidden') return null;
  if (!b.ready) {
    return (
      <section className="card">
        <div className="row between"><strong>{t('burn.title')}</strong><span className="muted small">{t('burn.window')}</span></div>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t(`burn.need.${b.reason}`, { n: b.need })}</p>
      </section>
    );
  }
  const lo = Math.min(b.low, b.model ?? b.low) - 150;
  const hi = Math.max(b.high, b.model ?? b.high) + 150;
  const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const off = modelSide(b);
  return (
    <section className="card">
      <div className="row between"><strong>{t('burn.title')}</strong><span className="muted small">{t('burn.window')}</span></div>
      <div className="burn-num">{t('burn.range', { low: formatNumber(b.low), high: formatNumber(b.high) })}</div>
      <div className="burn-bar" role="img" aria-label={t('burn.aria', { low: b.low, high: b.high, model: b.model ?? '' })}>
        <span className="burn-range" style={{ insetInlineStart: pos(b.low), width: `calc(${pos(b.high)} - ${pos(b.low)})` }} />
        {b.model ? <span className="burn-model" style={{ insetInlineStart: pos(b.model) }} /> : null}
      </div>
      {b.model ? <p className="small" style={{ margin: '6px 0 0' }}>{t(`burn.model.${off}`, { model: formatNumber(b.model), n: formatNumber(Math.abs(b.diff)) })}</p> : null}
      <p className="muted small" style={{ margin: '6px 0 0' }}>{t('burn.note', { days: b.days, eaten: formatNumber(b.eaten) })}</p>
    </section>
  );
}

/** Weekly averages (BI-21): one number a week, which a salty day can't
 * swing. Thin weeks are faint; this week says "so far". */
function WeeklyAverages({ data, today }) {
  const weeks = weeklyAverages(data.body_logs, today, data);
  if (weeks.length < 2) return null;
  const dir = currentGoal(data)?.direction || 'lose';
  const sign = { gain: 1, lose: -1 }[dir] || 0;
  const good = (c) => !flat(c) && Math.sign(c) === sign;
  return (
    <section className="card">
      <div className="row between"><strong>{t('wavg.title')}</strong><span className="muted small">{t('wavg.sub')}</span></div>
      <div className="wavg-list">
        {weeks.map((w) => (
          <div key={w.week} className={`wavg-row${w.thin ? ' thin' : ''}`}>
            <div className="grow">
              <div>{t('wavg.week', { date: dayMonth(w.week) })}</div>
              <div className="meta">{t(w.current ? 'wavg.soFar' : 'wavg.count', { n: w.n })}</div>
            </div>
            <strong className="wavg-kg">{t('wchart.kg', { kg: w.avg.toFixed(1) })}</strong>
            {w.change == null ? <span className="chip wavg-chg" aria-label={t('wavg.noChange')}>{t('wavg.dash')}</span> : (
              <span className={`chip wavg-chg${good(w.change) ? ' accent' : flat(w.change) ? '' : ' effort'}`}>{changeText(w.change)}</span>
            )}
          </div>
        ))}
      </div>
      {weeks.some((w) => w.thin) ? <p className="muted small" style={{ margin: '8px 0 0' }}>{t('wavg.thinNote', { n: THIN_WEEK })}</p> : null}
    </section>
  );
}

function Body({ data, update, today }) {
  const latest = D.latestWeight(data);
  const [form, setForm] = useState({ weight: latest ? String(latest.weight_kg) : '' });
  const [more, setMore] = useState(false);
  const [editingBody, setEditingBody] = useState(null); // a weigh-in row being edited (UX-23)
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
        <WeightChart logs={data.body_logs} today={today} goalLow={goalLow} goalHigh={goalHigh} />
      </section>
      <WeeklyAverages data={data} today={today} />
      <BurnCard data={data} today={today} />
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
          {editingBody ? <WeighInSheet data={data} update={update} today={today} entry={editingBody} onClose={() => setEditingBody(null)} /> : null}
          <div className="section-label">Weigh-ins</div>
          <div className="list">
            {[...data.body_logs].reverse().slice(0, 10).map((b) => (
              <button key={b.id} type="button" className="list-row" aria-label={t('weighIn.editAria', { date: formatDate(b.log_date) })} onClick={() => setEditingBody(b)}>
                <div className="grow">{b.weight_kg} kg{b.waist_cm ? <span className="meta"> · waist {b.waist_cm} cm</span> : null}</div>
                <span className="meta">{formatDate(b.log_date)}</span>
                <Icon name="chev" className="icon chev" />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export default function Stats() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  const weightOn = D.moduleOn(data, 'weight') && data.safety?.hide_weight !== true;
  // The tabs come first and stay pinned, so picking one changes what is on
  // screen (UX-21). ?tab=body opens straight on the weigh-ins (UX-03).
  const [params, setParams] = useSearchParams();
  const tabs = statsTabs(weightOn);
  const tab = tabs.includes(params.get('tab')) ? params.get('tab') : tabs[0];
  const setTab = (k) => setParams(k === tabs[0] ? {} : { tab: k }, { replace: true });
  // Pull to refresh reads Health Connect again, so only on the phone with it on.
  const pullOn = useData((s) => isNative() && healthSettings(s.data).enabled);
  const refresh = useCallback(() => syncHealth().catch(() => null), []);

  return (
    <div className="page">
      <PullRefresh enabled={pullOn} onRefresh={refresh} label={t('stats.refreshing')} />
      <h1 className="page-title">{t('tab.stats')}</h1>
      <div className="seg stats-tabs" role="tablist" aria-label={t('tab.stats')}>
        {tabs.map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(`stats.tab.${k}`)}</button>)}
      </div>
      {tab === 'overview' ? <Summary data={data} today={today} /> : null}
      {tab === 'muscles' ? <Muscles data={data} today={today} /> : null}
      {tab === 'strength' ? <Strength data={data} today={today} /> : null}
      {tab === 'body' && weightOn ? <Body data={data} update={update} today={today} /> : null}
      {tab === 'badges' ? <Badges data={data} today={today} /> : null}
    </div>
  );
}
