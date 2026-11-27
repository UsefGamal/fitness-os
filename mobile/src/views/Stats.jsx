import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import WeighInSheet from '../components/WeighInSheet.jsx';
import WeightPace from '../components/WeightPace.jsx';
import { goalProgress } from '../lib/progress.js';
import EmptyState from '../components/EmptyState.jsx';
import Sheet from '../components/Sheet.jsx';
import Icon from '../components/Icon.jsx';
import LineChart from '../components/LineChart.jsx';
import { KeptChart, WeeksChart } from '../components/OverviewCharts.jsx';
import { Readiness } from '../components/DataHealth.jsx';
import WeightChart from '../components/WeightChart.jsx';
import YearHeatmap from '../components/YearHeatmap.jsx';
import { badges } from '../lib/achievements.js';
import { nextDue } from '../lib/fitnessTest.js';
import { addDays, dayMonth, formatDate, formatNumber, weekStart } from '../lib/dates.js';
import { currentGoal, macroTargets, profileOf } from '../lib/macros.js';
import { measuredBurn } from '../lib/measuredBurn.js';
import { sparkLine, strengthMovers } from '../lib/movers.js';
import { lastTwoWeeks, THIN_WEEK, weeklyAverages, weightSummary } from '../lib/bodyStats.js';
import { AVG_WEEKS, muscleVolume } from '../lib/muscleVolume.js';
import { keptWhileCutting, weeklyDays } from '../lib/overview.js';
import * as D from '../lib/data.js';
import { e1rmSeries, trackedExercises, weekStreaks, weightVs, yearGrid } from '../lib/insights.js';
import { entryFor } from '../lib/catalogue.js';
import { trainedGroups, GROUP16, GROUPS16, groupsOfTarget, groupStats, recoveryOf } from '../lib/muscleGroups.js';
import { CARDIO_GUIDE_MIN, cardioMinutes, sessionLoads, WORKED_LOAD } from '../lib/sessionLoad.js';
import { readiness, recoveryExtraDays, TREND_DAYS, watchTrends } from '../lib/activity.js';
import { useCatalogue } from '../store/catalogue.js';
import { t } from '../lib/i18n.js';
import { activePlan } from '../lib/plan.js';
import { doneThisWeek, GUIDE, muscleRows, plannedThisWeek } from '../lib/weeklySets.js';
import { activeDays, BADGE_FILTERS, badgeCounts, badgeSections, badgeState, daysSince, firstLoadDates, groupStatus, groupVolume, latestBadge, recordSummary, seriesChange, sessionsLast7, SPECIAL_BADGES, statsTabs } from '../lib/statsView.js';
import { content, useData } from '../store/useData.js';
import PullRefresh from '../components/PullRefresh.jsx';
import { healthSettings, syncHealth } from '../store/phoneSync.js';
import { isNative } from '../store/native.js';
import { useToday } from '../store/today.js';
import useViewState from '../components/useViewState.js';

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
              <span className="macro-value" style={{ fontSize: 'calc(var(--fs-t1) * var(--ts))' }}>{t('stats.days', { n: days })}</span>
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

// Colour roles (LF-3, LF-6): blue = recovering, green = ready, amber = needs work; never red, so ready and untrained don't hinge on red-green vision.
const STATUS_FILL = { recovering: 'var(--blue)', ready: 'var(--accent)', untrained: 'var(--orange)', none: null };
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
  const [mode, setMode] = useViewState('muscle-mode', 'volume');
  const [group, setGroup] = useViewState('muscle-group', null);
  // The 16 groups (BeFit item 17), read from every set logged: an
  // exercise's main muscles count in full, its helpers by half.
  const groupsOf = useGroupsOf(data);
  const { catalogue } = useCatalogue();
  // Intervals, home workouts, cardio and padel count as light sets (sessionLoad.js).
  const stats = useMemo(() => {
    const T = activePlan(data, content);
    const entryOf = catalogue ? (name) => entryFor(name, T, catalogue.byId) : undefined;
    const loadsOf = (w) => sessionLoads(w, T, entryOf).map((l) => ({ groups: groupsOfTarget(l.target), sets: l.sets }));
    return groupStats(data, groupsOf, today, 7, loadsOf, WORKED_LOAD);
  }, [data, groupsOf, today, catalogue]);
  // A short night or a raised resting heart rate (watch, when worn) keeps
  // muscles recovering a day longer.
  const ready = data.settings?.health?.enabled ? readiness(data.health_daily, today) : null;
  const extra = recoveryExtraDays(ready);
  const vol = useMemo(() => {
    const T = activePlan(data, content);
    return muscleVolume(data, T, today, catalogue ? (name) => entryFor(name, T, catalogue.byId) : undefined);
  }, [data, today, catalogue]);
  const GROUPS = GROUPS16.map((g) => g.key);
  const last = Object.fromEntries(GROUPS.map((g) => [g, stats[g].last]));
  const status = Object.fromEntries(GROUPS.map((g) => [g, groupStatus(recoveryOf(last[g], today, extra), last[g])]));
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

      {mode === 'volume' ? <><MuscleWeeks vol={vol} group={group} onPick={pick} /><CardioWeek data={data} today={today} />{group ? <section className="card"><GroupExercises data={data} group={group} groupsOf={groupsOf} /></section> : null}<WeeklySets data={data} today={today} /></> : null}

      {mode === 'recovery' ? (
        <section className="card">
          <h2 className="section-title" style={{ margin: '0 0 8px' }}>{t('stats.recoveryTitle')}</h2>
          {extra ? <p className="small" style={{ margin: '0 0 8px' }}><Icon name="moon" className="icon inline" /> {t('stats.recoveryLonger', { why: ready.reasons.join(' and ') })}</p> : null}
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

/** Cardio and sport minutes this week (cardio, padel, intervals) against
 * the 150-minute guide. They also count on the map as light sets. */
function CardioWeek({ data, today }) {
  const from = weekStart(today, data);
  const mins = cardioMinutes(data.workouts, from, today);
  const last = cardioMinutes(data.workouts, addDays(from, -7), addDays(from, -1));
  if (!mins && !last) return null;
  return (
    <section className="card">
      <div className="row between"><h2 className="section-title" style={{ margin: 0 }}>{t('cardio.title')}</h2><span className="muted small" style={{ whiteSpace: 'nowrap' }}>{t('stats.thisWeek')}</span></div>
      <div className="row between" style={{ alignItems: 'baseline', marginTop: 6 }}>
        <span className="macro-value" style={{ fontSize: 'calc(var(--fs-t1) * var(--ts))' }}>{t('cardio.min', { n: mins })}</span>
        <span className="muted small">{t('cardio.guide', { n: CARDIO_GUIDE_MIN })}</span>
      </div>
      <div className="progress" style={{ marginTop: 8 }} role="img" aria-label={t('cardio.aria', { n: mins, guide: CARDIO_GUIDE_MIN })}><span style={{ transform: `scaleX(${Math.min(1, mins / CARDIO_GUIDE_MIN)})` }} /></div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>{t('cardio.note', { last })}</p>
    </section>
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
  const [pick, setPick] = useViewState('strength', null);
  const id = (tracked.some((x) => x.id === pick) ? pick : null) ?? tracked[0]?.id;
  const series = id ? e1rmSeries(data, id) : [];
  const bests = [...D.personalBests(data).values()]
    .map((b) => ({ ...b, name: data.exercises.find((e) => e.id === b.exercise_id)?.name || 'Exercise' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!tracked.length) {
    return (
      <EmptyState art="strength" title={t('stats.strEmptyTitle')} note={t('stats.strEmptyNote')}>
        <Link to="/workout" className="btn"><Icon name="play" /> {t('stats.strEmptyCta')}</Link>
      </EmptyState>
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

/** "3 / 10", "0.8 / 1 × BW", "2.5 / 5 kg" */
function progressText(b) {
  const round = (v) => (b.goal >= 1000 ? formatNumber(Math.round(v)) : Math.round(v * 10) / 10);
  const goal = b.goal >= 1000 ? formatNumber(b.goal) : b.goal;
  return `${round(Math.max(0, b.value || 0))} / ${goal}${b.unit ? ` ${b.unit}` : b.goal >= 1000 ? ' kg' : ''}`;
}

function Badges({ data, today }) {
  const all = badges(data, today);
  const counts = badgeCounts(all);
  const latest = latestBadge(all);
  const [filter, setFilter] = useViewState('badge-filter', 'all');
  const [openBy, setOpenBy] = useViewState('badge-open', {}); // category -> open, once tapped
  const [info, setInfo] = useState(null); // the badge whose sheet is open
  const sections = badgeSections(all, filter);
  const next = all.filter((b) => badgeState(b) === 'progress').sort((a, b) => b.fraction - a.fraction)[0];
  return (
    <>
      <section className="card">
        <h2 className="section-title" style={{ margin: 0 }}>{t('stats.achievements')}</h2>
        <div className="ach-head">
          <div className="ach-num"><strong>{counts.earned}</strong><span>/{counts.all}</span></div>
          <div className="ach-split">
            <span><b className="dot earned" aria-hidden="true" />{t('badge.nEarned', { n: counts.earned })}</span>
            <span><b className="dot progress" aria-hidden="true" />{t('badge.nProgress', { n: counts.progress })}</span>
            <span><b className="dot locked" aria-hidden="true" />{t('badge.nLocked', { n: counts.locked })}</span>
          </div>
        </div>
        <div className="progress" style={{ margin: '10px 0 8px' }} role="progressbar" aria-label={t('stats.achievements')} aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={counts.earned}><span style={{ transform: `scaleX(${all.length ? counts.earned / all.length : 0})` }} /></div>
        <div className="muted small">{latest ? t('stats.latestBadge', { name: latest.label, date: formatDate(latest.date) }) : t('badge.intro')}</div>
        {next ? <div className="small" style={{ marginTop: 2 }}>{t('badge.closest', { name: next.label, left: progressText(next) })}</div> : null}
      </section>
      <div className="seg badge-filter" role="group" aria-label={t('badge.filter')}>
        {BADGE_FILTERS.map((k) => (
          <button key={k} type="button" className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t(`badge.f.${k}`, { n: counts[k] })}</button>
        ))}
      </div>
      {sections.length ? sections.map((g) => {
        const open = openBy[`${filter}:${g.key}`] ?? g.open;
        return (
          <div key={g.key} className="badge-cat">
            <button type="button" className="badge-cat-head" aria-expanded={open} onClick={() => setOpenBy((o) => ({ ...o, [`${filter}:${g.key}`]: !open }))}>
              <span className="section-title">{t(`stats.cat.${g.key}`)}</span>
              <span className="muted small">{t('badge.catCount', { n: g.earned, all: g.total })}</span>
              <Icon name="chev" className={`icon chev${open ? ' open' : ''}`} />
            </button>
            {open ? (
              <div className="badges">
                {g.badges.map((b) => {
                  const st = badgeState(b);
                  const special = SPECIAL_BADGES.has(b.id);
                  return (
                    <button key={b.id} type="button" className={`badge b-${st}${special ? ' special' : ''}`} style={{ '--p': `${Math.round(b.fraction * 360)}deg` }} onClick={() => setInfo(b)}>
                      <span className="medal" aria-hidden="true">
                        <span className="medal-in"><Icon name={st === 'locked' ? 'lock' : b.icon} /></span>
                        {st === 'earned' ? <span className="tick"><Icon name="check" /></span> : null}
                      </span>
                      <span className="name">{b.label}</span>
                      <span className="sr-only">{t(`badge.state.${st}`)}</span>
                      <span className="count">{st === 'earned' ? (b.date ? formatDate(b.date) : t('stats.earned')) : progressText(b)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      }) : <p className="muted small badge-empty">{t(`badge.empty.${filter}`)}</p>}
      <p className="muted small" style={{ margin: '12px 4px 0' }}>{t('badge.tapHint')}</p>
      {info ? <BadgeSheet b={info} onClose={() => setInfo(null)} /> : null}
    </>
  );
}

/** A badge's criteria, progress and date, on a tap. */
function BadgeSheet({ b, onClose }) {
  const st = badgeState(b);
  return (
    <Sheet title={b.label} onClose={onClose}>
      <div className="stack">
        <p style={{ margin: 0 }}>{b.note}</p>
        <div className="progress" role="progressbar" aria-label={b.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(b.fraction * 100)}><span style={{ transform: `scaleX(${b.fraction})` }} /></div>
        <div className="row between small"><span className="muted">{t(`badge.state.${st}`)}{SPECIAL_BADGES.has(b.id) ? ` · ${t('badge.special')}` : ''}</span><strong>{progressText(b)}</strong></div>
        {b.earned && b.date ? <div className="muted small">{t('badge.earnedOn', { date: formatDate(b.date) })}</div> : null}
      </div>
    </Sheet>
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

/** Measured maintenance (BI-13), inside the consistency card: what this
 * month's meals and weight say you burn, as a range, beside the app's own
 * estimate. In a goal's first 2 weeks it says why the scale moves fast
 * instead (Body review: "Early weight change"). Hidden with calories,
 * under 18, with a safety limit on, and in Ramadan. */
function BurnBlock({ data, today }) {
  const model = macroTargets(data, content.nutrition, today)?.tdee ?? null;
  const b = measuredBurn(data, content.nutrition.meal_slots, today, model);
  if (!b.ready && b.reason === 'hidden') return null;
  if (!b.ready && b.reason === 'water') {
    return (
      <div className="sub-block">
        <strong>{t('body.early')}</strong>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('body.earlyNote')}</p>
      </div>
    );
  }
  if (!b.ready) {
    return (
      <div className="sub-block">
        <div className="row between"><strong>{t('burn.title')}</strong><span className="muted small">{t('burn.window')}</span></div>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t(`burn.need.${b.reason}`, { n: b.need })}</p>
      </div>
    );
  }
  const lo = Math.min(b.low, b.model ?? b.low) - 150;
  const hi = Math.max(b.high, b.model ?? b.high) + 150;
  const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const off = modelSide(b);
  return (
    <div className="sub-block">
      <div className="row between"><strong>{t('burn.title')}</strong><span className="muted small">{t('burn.window')}</span></div>
      <div className="burn-num">{t('burn.range', { low: formatNumber(b.low), high: formatNumber(b.high) })}</div>
      <div className="burn-bar" role="img" aria-label={t('burn.aria', { low: b.low, high: b.high, model: b.model ?? '' })}>
        <span className="burn-range" style={{ insetInlineStart: pos(b.low), width: `calc(${pos(b.high)} - ${pos(b.low)})` }} />
        {b.model ? <span className="burn-model" style={{ insetInlineStart: pos(b.model) }} /> : null}
      </div>
      {b.model ? <p className="small" style={{ margin: '6px 0 0' }}>{t(`burn.model.${off}`, { model: formatNumber(b.model), n: formatNumber(Math.abs(b.diff)) })}</p> : null}
      <p className="muted small" style={{ margin: '6px 0 0' }}>{t('burn.note', { days: b.days, eaten: formatNumber(b.eaten) })}</p>
    </div>
  );
}

/** 2. Weight consistency: the last two weekly averages side by side (one
 * number a week, which a salty day can't swing), the older weeks one tap
 * away, then measured burn. Thin weeks are faint. */
function Consistency({ data, today, good }) {
  const [all, setAll] = useViewState('weeks-all', false);
  const weeks = weeklyAverages(data.body_logs, today, data);
  const pair = lastTwoWeeks(weeks);
  return (
    <section className="card">
      <h2 className="section-title" style={{ margin: 0 }}>{t('body.consistency')}</h2>
      <div className="muted small">{t('body.weeklyAvg')}</div>
      {pair ? (
        <div className="wk-pair">
          {pair.weeks.map((w) => (
            <div key={w.week} className={`wk${w.thin ? ' thin' : ''}`}>
              <div className="meta">{w.current ? t('body.thisWeek') : t('wavg.week', { date: dayMonth(w.week) })}</div>
              <strong className="wk-kg">{t('wchart.kg', { kg: w.avg.toFixed(1) })}</strong>
              <div className="meta">{t('wavg.count', { n: w.n })}</div>
            </div>
          ))}
          <span className={`chip wavg-chg${good(pair.change) ? ' accent' : ''}`}>{changeText(pair.change)}</span>
        </div>
      ) : (
        <p className="muted small" style={{ margin: '6px 0 0' }}>{t(weeks.length ? 'body.oneWeek' : 'body.noWeeks')}</p>
      )}
      {all && weeks.length > 2 ? (
        <div className="wavg-list">
          {weeks.slice(2).map((w) => (
            <div key={w.week} className={`wavg-row${w.thin ? ' thin' : ''}`}>
              <div className="grow"><div>{t('wavg.week', { date: dayMonth(w.week) })}</div><div className="meta">{t('wavg.count', { n: w.n })}</div></div>
              <strong className="wavg-kg">{t('wchart.kg', { kg: w.avg.toFixed(1) })}</strong>
              {w.change == null ? <span className="chip wavg-chg" aria-label={t('wavg.noChange')}>{t('wavg.dash')}</span> : <span className={`chip wavg-chg${good(w.change) ? ' accent' : ''}`}>{changeText(w.change)}</span>}
            </div>
          ))}
        </div>
      ) : null}
      {weeks.length > 2 ? <button type="button" className="btn ghost small" aria-expanded={all} onClick={() => setAll((v) => !v)}>{t(all ? 'body.fewerWeeks' : 'body.allWeeks', { n: weeks.length })}</button> : null}
      {pair && weeks.slice(0, all ? weeks.length : 2).some((w) => w.thin) ? <p className="muted small" style={{ margin: '8px 0 0' }}>{t('body.thinNote', { n: THIN_WEEK })}</p> : null}
      <BurnBlock data={data} today={today} />
    </section>
  );
}

const METRICS = [
  ['steps', 'watch.steps', 'body.stepsSub', (v) => formatNumber(Math.round(v)), 'steps'],
  ['sleep', 'watch.sleep', 'body.sleepSub', (v) => `${v.toFixed(1)} h`, 'h'],
  ['rhr', 'body.hr', 'body.hrSub', (v) => `${Math.round(v)}`, 'bpm'],
];

/** 3. Daily activity: steps, sleep and resting heart rate from Health
 * Connect behind one selector, so the card shows the one chart it names.
 * A metric with no days says so instead of drawing an empty chart. Hidden
 * when Health Connect is off (watch data is always optional). */
function Activity({ data, today }) {
  const tr = watchTrends(data.health_daily, today);
  const [pick, setPick] = useViewState('activity', () => (METRICS.find(([k]) => tr[k]) || METRICS[0])[0]);
  if (!data.settings?.health?.enabled) return null;
  const [, labelKey, subKey, , unit] = METRICS.find(([k]) => k === pick);
  const s = tr[pick];
  return (
    <section className="card">
      <div className="row between"><h2 className="section-title" style={{ margin: 0 }}>{t('body.activity')}</h2><span className="muted small">{t('watch.window', { n: TREND_DAYS })}</span></div>
      <div className="metric-pick" role="group" aria-label={t('body.activity')}>
        {METRICS.map(([k, lk, , f]) => (
          <button key={k} type="button" className={pick === k ? 'on' : ''} aria-pressed={pick === k} onClick={() => setPick(k)}>
            <span className="label">{t(lk)}</span>
            <span className="v">{tr[k] ? f(tr[k].avg) : '—'}</span>
            <span className="meta">{tr[k] ? t('body.dailyAvg') : t('body.noData')}</span>
          </button>
        ))}
      </div>
      {s ? (
        <>
          <div className="muted small" style={{ marginTop: 10 }}>{t(subKey)} · {t('watch.days', { n: s.points.length })}</div>
          <LineChart points={s.points} unit={unit} label={t(labelKey)} summary={t('watch.days', { n: s.points.length })} />
        </>
      ) : (
        <p className="muted small" style={{ margin: '10px 0 0' }}>{t('body.metricEmpty', { name: t(labelKey).toLowerCase() })}</p>
      )}
      <p className="muted small" style={{ margin: '8px 0 0' }}>{t('watch.note')}</p>
    </section>
  );
}

function Body({ data, update, today }) {
  const [logging, setLogging] = useState(false);
  const p = profileOf(data);
  const goalLow = p.goal_weight_low_kg;
  const goalHigh = p.goal_weight_high_kg;
  const s = weightSummary(data.body_logs, goalLow && goalHigh ? { low: goalLow, high: goalHigh } : null);
  const sign = { gain: 1, lose: -1 }[currentGoal(data)?.direction || 'lose'] || 0;
  const good = (c) => !flat(c) && Math.sign(c) === sign;
  const vs = weightVs(data, today);
  const n = data.body_logs.length;
  const lastWaist = [...data.body_logs].reverse().find((b) => b.waist_cm != null);
  const photos = (data.progress_photos || []).length;
  // The pace in words, moved here from Home's weight card (Home simplify).
  const goal = currentGoal(data);
  const prog = goalProgress(data.body_logs, goal, today);

  return (
    <>
      {logging ? <WeighInSheet data={data} update={update} today={today} measures onClose={() => setLogging(false)} /> : null}
      <section className="card">
        <div className="row between">
          <h2 className="section-title" style={{ margin: 0 }}>{t('body.progress')}</h2>
          <button type="button" className="btn small log-btn" onClick={() => setLogging(true)}><Icon name="plus" /> {t('body.log')}</button>
        </div>
        {s.current == null ? (
          <p className="muted small" style={{ margin: '10px 0 0' }}>{t('body.firstLog')}</p>
        ) : (
          <>
            <div className="body-sum">
              <div>
                <div className="label">{t('body.current')}</div>
                <div className="body-num">{s.current}<span className="unit">{t('home.kg')}</span></div>
                <div className="meta">{formatDate(s.currentDate)}</div>
              </div>
              <div>
                <div className="label">{t('body.total')}</div>
                <div className={`body-num sm${s.change != null && good(s.change) ? ' good' : ''}`}>{s.change == null ? '–' : changeText(s.change)}<span className="unit">{t('home.kg')}</span></div>
                <div className="meta">{s.change == null ? t('body.needTwo') : t('body.fromStart', { kg: s.start })}</div>
              </div>
            </div>
            <div className="body-goal">
              {goalLow ? <span className="chip">{t('body.goal', { low: goalLow, high: goalHigh })}</span> : null}
              {s.toGoal != null ? <span className={`chip${s.toGoal === 0 ? ' accent' : ''}`}>{s.toGoal === 0 ? t('body.inGoal') : t('body.toGo', { kg: s.toGoal })}</span> : null}
            </div>
            {vs ? <p className="vs-line" style={{ margin: '10px 0 0' }}><Icon name="trend" className="icon" /> {t(vs.kg < 0 ? 'stats.vsWeightDown' : vs.kg > 0 ? 'stats.vsWeightUp' : 'stats.vsWeightSame', { kg: Math.abs(vs.kg), date: formatDate(vs.date), from: vs.from, now: vs.now })}</p> : null}
            {prog ? <WeightPace data={data} goal={goal} p={prog} today={today} /> : null}
            <WeightChart logs={data.body_logs} today={today} goalLow={goalLow} goalHigh={goalHigh} />
          </>
        )}
      </section>
      {n ? <Consistency data={data} today={today} good={good} /> : null}
      <Activity data={data} today={today} />
      <div className="section-label">{t('body.more')}</div>
      <div className="list">
        <Link to="/photos" className="list-row"><Icon name="user" /><div className="grow"><div>{t('body.photos')}</div><div className="meta">{photos ? t('body.photosN', { n: photos }) : t('body.photosSub')}</div></div><Icon name="chev" className="icon chev" /></Link>
        <Link to="/stats/body/measurements" className="list-row"><Icon name="tape" /><div className="grow"><div>{t('body.measTitle')}</div><div className="meta">{lastWaist ? t('body.waistLast', { cm: lastWaist.waist_cm, date: formatDate(lastWaist.log_date) }) : t('body.measSub')}</div></div><Icon name="chev" className="icon chev" /></Link>
        <Link to="/stats/body/weigh-ins" className="list-row"><Icon name="scale" /><div className="grow"><div>{t('body.histTitle')}</div><div className="meta">{n ? t('body.histMeta', { n, date: formatDate(s.currentDate) }) : t('body.histNone')}</div></div><Icon name="chev" className="icon chev" /></Link>
      </div>
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
  // Opened from the tab bar (no ?tab): the tab you were on last (Yusuf, 27 Nov).
  const [lastTab, setLastTab] = useViewState('tab', tabs[0]);
  const tab = tabs.includes(params.get('tab')) ? params.get('tab') : tabs.includes(lastTab) ? lastTab : tabs[0];
  const setTab = (k) => { setLastTab(k); setParams(k === tabs[0] ? {} : { tab: k }, { replace: true }); };
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
