import { Link, useNavigate } from 'react-router';
import { cloneElement, useEffect, useState } from 'react';

import DayPicker from '../components/DayPicker.jsx';
import Icon from '../components/Icon.jsx';
import QuickAction from '../components/QuickAction.jsx';
import StatTile from '../components/StatTile.jsx';
import WeighInSheet from '../components/WeighInSheet.jsx';
import WhatsNewSheet from '../components/WhatsNewSheet.jsx';
import WeightCard from '../components/WeightCard.jsx';
import WorkoutCard from '../components/WorkoutCard.jsx';
import { addDays, formatDate, longWeekday } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { weekStreaks } from '../lib/insights.js';
import { afterRamadan, effectiveTimes, ramadanActive } from '../lib/ramadan.js';
import { sessionAt } from '../lib/times.js';
import { hm, READINESS_TEXT, readiness } from '../lib/activity.js';
import { eveningDone, eveningOn } from '../lib/evening.js';
import { firstName, partOfDay, watchTiles } from '../lib/home.js';
import * as P from '../lib/planEdit.js';
import { mealDayFor, mealStart } from '../lib/meals.js';
import { doneKeys, questsOn } from '../lib/quests.js';
import { lastTimePreview } from '../lib/lastTime.js';
import { isChangedOn, moveSession, moveTargets, programDayFor, sessionKeyOn, weekView } from '../lib/schedule.js';
import { weekGlance } from '../lib/weekGlance.js';
import WeekStrip from '../components/WeekStrip.jsx';
import { t } from '../lib/i18n.js';
import { activePlan } from '../lib/plan.js';
import { sessionMinutes } from '../lib/calendar.js';
import { backupDue } from '../lib/durable.js';
import { hardWeeksInARow, isRecoveryWeek, setRecoveryWeek } from '../lib/recovery.js';
import { APP } from '../lib/version.js';
import { markSeen, unseenNotes } from '../lib/whatsNew.js';
import { WHATS_NEW } from '../lib/whatsNewNotes.js';
import { starterProgress } from '../lib/starter.js';
import { feedback } from '../store/feedback.js';
import { content, useData } from '../store/useData.js';
import { hasScreenLock, widgetStatus } from '../store/native.js';
import { SESSIONS, SessionSheet } from './Session.jsx';
import { useToday } from '../store/today.js';
import { kcalHidden, markClearanceSeen } from '../lib/safety.js';
import { homeCard } from '../lib/homeCard.js';
import { homeLine, homeOrder, whatsNewMode } from '../lib/interrupts.js';
import { comeback, hideBack, showBack, skipToday, stillTime } from '../lib/comeback.js';
import { dismissWrap, weekShortLine, weekStats, wrapWeek } from '../lib/weekStats.js';
import { WrapCard, WrapSheet } from '../components/WrapUp.jsx';
import FirstWeekCard from '../components/FirstWeekCard.jsx';
import GoalReachedCard from '../components/GoalReachedCard.jsx';
import { hideGoalReached, showGoalReached, startMaintenance } from '../lib/maintenance.js';
import { currentGoal, macroTargets, MIN_KCAL, profileOf } from '../lib/macros.js';
import TargetCheckCard from '../components/TargetCheckCard.jsx';
import { keepTarget, lowerTarget, targetCheckDue } from '../lib/targetCheck.js';
import { goalProgress } from '../lib/progress.js';
import { announce } from '../lib/announce.js';
import { firstWeekSteps, hideFirstWeek, markWidgetDone, showFirstWeek } from '../lib/firstWeek.js';
import { MARK } from '../lib/brand.js';

const QUICK = { home: ['dumbbell', 'accent'], recovery: ['heart', 'accent'], cardio: ['chart', 'accent'], padel: ['racket', 'accent'] };

export default function Today() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const navigate = useNavigate();
  const today = useToday();
  const T = activePlan(data, content);
  const times = effectiveTimes(data, content, today);
  const moves = data.session_moves || [];
  const next = programDayFor(today, T, moves);
  const nextDay = next ? P.effectiveDay(next.key, T, data) : null;
  const tonight = eveningOn(data, today);
  const todays = D.workoutOn(data, today);
  const mealSlots = content.nutrition.meal_slots.length;
  const mealsDone = content.nutrition.meal_slots.filter((s) => D.mealLog(data, today, s)?.completed).length;
  const water = D.waterOn(data, today);
  const mealDay = mealDayFor(today, content.nutrition, mealStart(data, content.nutrition));
  const weeks = weekStreaks(data, today);
  const glance = weekGlance(data, today);
  const streak = weeks.current;
  const dailyQuests = content.quests.bonus_tasks.filter((q) => q.frequency === 'daily');
  const questsDone = dailyQuests.filter((q) => doneKeys(data, today, content.quests).has(q.key)).length;
  const otherToday = data.workouts.filter((w) => w.log_date === today && w.workout_type !== 'gym');
  const healthOn = data.settings?.health?.enabled;
  const ready = healthOn ? readiness(data.health_daily, today) : null;
  const moved = healthOn ? data.health_daily?.[today] : null;
  // Watch numbers (optional): steps join the Today tiles, active kcal and
  // sleep stay one quiet line (Home simplify). The module hides them all.
  const tiles = D.moduleOn(data, 'activity') ? watchTiles({ steps: moved?.steps ?? null, kcal: moved?.active_kcal ?? null, sleepMin: moved?.sleep_min ?? null }) : [];
  const steps = tiles.find((x) => x.key === 'steps');
  const watchLine = tiles.filter((x) => x.key !== 'steps').map((x) => `${x.value} ${t(`home.tile.${x.key}`)}`).join(' · ');
  const readyLevel = ready && ready.level !== 'unknown' ? ready.level : null;
  const readyText = readyLevel ? [
    READINESS_TEXT[ready.level],
    ready.resting_hr != null ? `Resting heart rate ${ready.resting_hr}${ready.hr_base != null ? ` (usual ${Math.round(ready.hr_base)})` : ''}.` : null,
    ready.sleep_min != null ? `Slept ${hm(ready.sleep_min)}${ready.sleep_base != null ? ` (usual ${hm(ready.sleep_base)})` : ''}.` : null,
  ].filter(Boolean).join(' ') : null;
  // P14-09: with no screen lock Android makes no cloud copy, so the
  // reminder comes sooner and says why.
  const [screenLock, setScreenLock] = useState(null);
  useEffect(() => { hasScreenLock().then(setScreenLock); }, []);
  const backup = backupDue(data, Date.now(), { screenLock });
  const [picking, setPicking] = useState(false);
  const [weighing, setWeighing] = useState(false);
  const [logging, setLogging] = useState(null); // a session type, logged in a sheet (MOVE-2)
  const clearanceSeen = () => update(markClearanceSeen);
  // One card under the session at most: doctor note, welcome back, the
  // Sunday wrap-up, the recovery suggestion (lib/homeCard.js).
  const back = comeback(data, today);
  // The first-week card (FIRST-1): the phone says whether a widget is
  // placed; asked again when the app comes back from the home screen.
  const [widgets, setWidgets] = useState(null);
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') widgetStatus().then((w) => setWidgets(w ? w.count : null)); };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  const firstSteps = firstWeekSteps(data, { widgetCount: widgets });
  // Goal reached (MAINT-1): offer maintenance, in weekly steps.
  const progress = goalProgress(data.body_logs, currentGoal(data), today);
  const goalCard = showGoalReached(data, progress);
  // The weekly target check (TARGET-1): after 3 flat weeks, a confirm-only offer.
  const targets = macroTargets(data, content.nutrition, today);
  const check = targetCheckDue(data, { targets, slots: content.nutrition.meal_slots, minKcal: MIN_KCAL[profileOf(data).gender] ?? MIN_KCAL.female, today });
  const card = homeCard(data, content, today, { back: showBack(data, today), goal: goalCard, target: Boolean(check), first: showFirstWeek(data, today, firstSteps) });
  const beginMaintenance = () => {
    update((d) => startMaintenance(d, today, { fromKcal: targets.kcal, tdeeKcal: targets.tdee ?? targets.kcal, weightKg: progress?.trend }));
    announce(t('maint.started'));
  };
  // "Still time today?" two hours after the session time (BACK-1 part D).
  const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const moveTo = moveTargets(today, T, moves)[0] || null;
  const still = stillTime({ data, today, nowMinutes: nowMin, sessionTime: sessionAt(times), scheduled: sessionKeyOn(today, T, moves), recovery: isRecoveryWeek(data, today), moveTo });
  const wrapFor = card === 'wrapup' ? wrapWeek(today, data) : null;
  const [wrapOpen, setWrapOpen] = useState(false);
  // What's new (E1-S6): every version since the notes this phone last saw.
  // Only closing the sheet (or finishing setup) marks them seen, so a build
  // with no note of its own never hides the next one's.
  const news = unseenNotes(data, APP.version, WHATS_NEW);
  // One interrupt at a time (design laws plan #4): while today's session is
  // due, What's new waits as a thin line, and only one thin line shows.
  const sessionDue = Boolean(next && !next.isRestToday && !todays);
  const newsMode = whatsNewMode({ hasNews: news.length > 0, sessionDue });
  const [newsOpen, setNewsOpen] = useState(false);
  const line = homeLine({ news: newsMode === 'line', backup: Boolean(backup), firstWeekAsksBackup: card === 'first' && firstSteps.some((s) => s.key === 'backup' && !s.done) });
  const name = firstName(data.profile);
  const greet = t(`home.greet.${partOfDay(new Date().getHours())}`);
  const addWater = (ml) => { update((d) => D.addWater(d, today, ml)); feedback('water'); };

  // Home order (design laws plan #11, Yusuf's pick): on a training day the
  // Today ticks (water, meals) come before the weight; on a rest day the
  // weight leads. The week strip stays next to the plan it shows.
  const weightFirst = homeOrder({ trainingDay: Boolean(next && !next.isRestToday) }) === 'weight';
  const weightBlock = (
    <>
      {D.moduleOn(data, 'weight') && !data.safety?.hide_weight ? <WeightCard data={data} today={today} onLog={() => setWeighing(true)} /> : null}
    </>
  );
  // Today's activity (Home simplify): one grid of the same tiles. Water is
  // wide for its buttons; an odd last tile takes the whole row.
  const halves = [];
  if (D.moduleOn(data, 'meals')) halves.push(<StatTile key="meals" to="/meals" icon="meals" tone="meals" value={mealsDone} of={mealSlots} label={`${t('home.meals')} · ${mealDay.label}`} />);
  if (steps) halves.push(<StatTile key="steps" to="/stats?tab=body" icon="steps" tone="steps" value={steps.value} label={t('home.tile.steps')} />);
  if (questsOn(data)) halves.push(<StatTile key="quests" to="/quests" icon="star" tone="quests" value={questsDone} of={dailyQuests.length} label={t('home.quests')} />);
  const waterOn = D.moduleOn(data, 'water');
  // Nothing to show (modules off, no watch): no empty heading.
  const todayBlock = !waterOn && !halves.length && !watchLine ? null : (
    <>
      <div className="section-head">
        <h2 className="section-title">{t('home.quickStats')}</h2>
        {streak > 0 && !back ? <span className="chip accent" aria-label={t('home.streakAria', { n: streak, done: weeks.week.done, need: weeks.week.need })}><Icon name="bolt" className="icon" /> {t('home.streak', { n: streak })}</span> : null}
      </div>
      <div className="tile-grid" data-tour="today">
        {waterOn ? (
          <StatTile wide icon="drop" tone="water" value={water} of={`${D.waterGoal(data)} ml`} label={t('home.water')}>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="mini-btn" aria-label={t('home.addWater', { ml: 250 })} onClick={() => addWater(250)}>{t('home.add250')}</button>
              <button type="button" className="mini-btn" aria-label={t('home.addWater', { ml: 500 })} onClick={() => addWater(500)}>{t('home.add500')}</button>
              <button type="button" className="mini-btn" aria-label={t('home.undoWater')} disabled={!water} onClick={() => update((d) => D.addWater(d, today, -250))}><Icon name="undo" className="icon" /></button>
            </div>
          </StatTile>
        ) : null}
        {halves.length % 2 ? [...halves.slice(0, -1), cloneElement(halves[halves.length - 1], { wide: true })] : halves}
      </div>
      {watchLine ? <Link to="/stats?tab=body" className="watch-line"><span className="grow">{watchLine}</span><Icon name="chev" className="icon chev" /></Link> : null}
    </>
  );

  return (
    <div className="page home">
      <header className="home-head">
        <div className="row between">
          <div className="wordmark" aria-hidden="true"><svg className="wordmark-mark" viewBox="0 0 24 24"><path d={MARK} /></svg><span className="wordmark-name">{t('home.wordmark')}<span>{t('home.wordmarkOs')}</span></span></div>
          <Link to="/settings" className="icon-btn round" data-tour="settings" aria-label={t('home.settings')}><Icon name="gear" /></Link>
        </div>
        <h1 className="greeting">
          {name ? <><span className="greet-small">{t('home.greetName', { greet })}</span><span className="greet-name">{name} <span aria-hidden="true">👋</span></span></> : <span className="greet-name">{greet}</span>}
        </h1>
        <div className="muted small home-date">{formatDate(today)}</div>
      </header>

      {data.setup?.needs_body ? (
        <Link to="/profile" className="card row banner" role="note">
          <Icon name="user" />
          <div className="grow"><strong>{t('setup.finishTitle')}</strong><div className="muted small">{t('setup.finishNote')}</div></div>
          <Icon name="chev" className="icon chev" />
        </Link>
      ) : null}
      {ramadanActive(data, today) ? (
        <div className="card small banner" role="note"><span className="chip accent">{t('ramadan.chip')}</span> <span className="muted">{t('ramadan.homeNote', { time: times.session_time })}</span></div>
      ) : null}
      {afterRamadan(data, today) ? (
        <div className="card small banner" role="note"><span className="chip accent">{t('ramadan.afterChip')}</span> <span className="muted">{t('ramadan.afterEid')}</span></div>
      ) : null}

      {card === 'clearance' ? (
        <div className="backup-line" role="status">
          <Link className="grow backup-link" to="/settings/safety">
            <Icon name="heart" className="icon tone-accent" />
            <span><strong>{t('safety.clearance')}</strong> <span className="muted">{t('safety.clearanceWhy')}</span></span>
          </Link>
          <button type="button" className="mini-btn" onClick={clearanceSeen}>{t('safety.clearanceDone')}</button>
        </div>
      ) : null}
      <WorkoutCard
        next={next}
        day={nextDay}
        minutes={nextDay ? sessionMinutes(nextDay) : null}
        time={sessionAt(times)}
        todays={todays}
        changed={isChangedOn(today, moves)}
        ready={readyLevel}
        readyText={readyText}
        starter={starterProgress(data)}
        last={next && !next.isRestToday ? lastTimePreview(data, next.key, today) : null}
        onChange={() => setPicking(true)}
        onStart={() => navigate('/workout', { state: { go: true } })}
      />
      {still ? (
        <div className="still-row" role="group" aria-label={t('still.title')}>
          <span className="grow small"><strong>{t('still.title')}</strong></span>
          <button type="button" className="btn small" style={{ width: 'auto' }} onClick={() => navigate('/workout')}>{t('still.start')}</button>
          {still.moveTo ? <button type="button" className="btn ghost small" style={{ width: 'auto' }} onClick={() => update((d) => moveSession(d, T, today, still.moveTo))}>{still.moveTo === addDays(today, 1) ? t('still.tomorrow') : t('still.moveTo', { day: longWeekday(still.moveTo) })}</button> : null}
          <button type="button" className="btn ghost small" style={{ width: 'auto' }} onClick={() => update((d) => skipToday(d, today))}>{t('still.skip')}</button>
        </div>
      ) : null}
      {card === 'back' ? (
        // A thin line, no second Start: the workout card above has it (one screen, one main action).
        <div className="backup-line back-line" role="status">
          <span className="grow back-text"><strong>{t('back.title')}</strong> <span className="muted">{t(back.level === 'short' ? 'back.short' : back.level === 'fresh' ? 'back.fresh' : 'back.easy')}</span></span>
          <button type="button" className="icon-btn" aria-label={t('back.hide')} onClick={() => update((d) => hideBack(d, today))}><Icon name="x" /></button>
        </div>
      ) : null}
      {card === 'goal' ? (
        <GoalReachedCard targets={targets} showKcal={!kcalHidden(data) && targets?.source !== 'plan'} onStart={beginMaintenance} onLater={() => update(hideGoalReached)} />
      ) : null}
      {card === 'target' ? (
        <TargetCheckCard step={check.step} kcal={targets.kcal} onLower={() => { update((d) => lowerTarget(d, check.step, today)); announce(t('tcheck.lowered', { kcal: targets.kcal - check.step })); }} onKeep={() => update((d) => keepTarget(d, today))} />
      ) : null}
      {card === 'first' ? (
        <FirstWeekCard
          steps={firstSteps}
          onWeigh={() => setWeighing(true)}
          onHide={() => update(hideFirstWeek)}
          onWidgetDone={() => update(markWidgetDone)}
          onPinAsked={() => widgetStatus().then((w) => setWidgets(w ? w.count : null))}
        />
      ) : null}
      {picking ? <DayPicker date={today} dayName={longWeekday(today)} training={T} data={data} update={update} onClose={() => setPicking(false)} /> : null}

      {tonight ? (
        <section className="card row" style={{ gap: 12 }}>
          <div className="session-icon small"><Icon name="moon" /></div>
          <div className="grow">
            <div className="session-sub">{t('home.tonight', { time: times.evening_time })}</div>
            <div className="session-name">{tonight.label}</div>
          </div>
          {eveningDone(data, today, tonight) ? <span className="chip accent"><Icon name="check" className="icon" /> {t('home.done')}</span> : <button type="button" className="btn secondary small" onClick={() => navigate(tonight.route)}><Icon name="play" /> {t('home.startShort')}</button>}
        </section>
      ) : null}

      {/* The week at a glance (DV-04): position carries the meaning; a day opens it on Plan. */}
      <section className="home-week" aria-labelledby="home-week-title">
        <div className="card-head">
          <h2 className="card-title" id="home-week-title">{t('home.weekAria')}</h2>
          <span className={`small week-count${weeks.week.planned && glance.days >= weeks.week.need ? ' kept' : ''}`}>{weekShortLine({ days: glance.days, planned: weeks.week.planned, need: weeks.week.need })}</span>
        </div>
        <WeekStrip week={weekView(today, T, data.session_moves || [], data)} doneDates={glance.done} onPick={(d) => navigate(`/plan?day=${d.date}`)} />
      </section>
      {weightFirst ? weightBlock : todayBlock}
      {weightFirst ? todayBlock : weightBlock}
      {newsMode === 'sheet' || (newsOpen && news.length) ? <WhatsNewSheet notes={news} onClose={() => { setNewsOpen(false); update((d) => markSeen(d, APP.version)); }} /> : null}
      {weighing ? <WeighInSheet data={data} update={update} today={today} onClose={() => setWeighing(false)} /> : null}
      {/* One thin line, not a card (UX-02). */}
      {line === 'news' ? (
        <div className="backup-line" role="status">
          <button type="button" className="grow backup-link" onClick={() => setNewsOpen(true)}>
            <Icon name="star" className="icon tone-accent" />
            <span><strong>{t('whatsNew.titleV', { v: APP.version })}</strong></span>
          </button>
          <Icon name="chev" className="icon chev" />
        </div>
      ) : null}
      {line === 'backup' ? (
        <div className="backup-line" role="status">
          <Link className="grow backup-link" to="/settings/data">
            <Icon name="download" className="icon tone-accent" />
            <span><strong>{t(backup.auto ? 'home.backupAutoTitle' : 'home.backupTitle')}</strong> <span className="muted">{backup.days == null ? t('home.backupNeverShort') : t('home.backupDaysShort', { days: backup.days })}{backup.noLock ? ` ${t('home.backupNoLockShort')}` : ''}</span></span>
          </Link>
          <button type="button" className="icon-btn" aria-label={t('home.later')} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, backup_snoozed_at: Date.now() } }))}><Icon name="x" /></button>
        </div>
      ) : null}

      {isRecoveryWeek(data, today) ? (
        <div className="pill-row warn">
          <Icon name="calendar" />
          <div className="grow small"><strong>{t('recovery.chip')}</strong> <span className="muted">{t('recovery.short')}</span></div>
          <button type="button" className="btn ghost small" onClick={() => update((d) => setRecoveryWeek(d, today, false))}>{t('recovery.off')}</button>
        </div>
      ) : null}
      {wrapFor ? <WrapCard stats={weekStats(data, content, wrapFor)} onOpen={() => setWrapOpen(true)} onDismiss={() => update((d) => dismissWrap(d, today))} /> : null}
      {wrapOpen && wrapFor ? <WrapSheet data={data} content={content} week={wrapFor} onClose={() => setWrapOpen(false)} /> : null}
      {card === 'recovery' ? (
        <button type="button" className="pill-row" onClick={() => update((d) => setRecoveryWeek(d, today, true))}>
          <Icon name="calendar" />
          <span className="grow">{t('recovery.due', { n: hardWeeksInARow(data, today) })}</span>
          <Icon name="chev" className="icon chev" />
        </button>
      ) : null}


      {/* Other sessions fold into one row (UX-04); open when one is logged today. */}
      <details className="other-sessions" open={otherToday.length > 0}>
        <summary>
          <Icon name="plus" className="icon" />
          <span className="grow">{t('home.other')}</span>
          <span className="muted small">{otherToday.length ? t('home.loggedToday') : t('home.otherNote')}</span>
          <Icon name="chev" className="icon chev" />
        </summary>
        <div className="tile-grid">
          {Object.entries(SESSIONS).map(([key, s]) => {
            const logged = otherToday.find((w) => w.workout_type === key);
            return (
              <QuickAction
                key={key}
                to={logged ? `/history/${logged.id}` : undefined}
                onClick={logged ? undefined : () => setLogging(key)}
                icon={QUICK[key]?.[0] || 'play'}
                tone={QUICK[key]?.[1]}
                title={s.label}
                note={logged ? `${t('home.loggedToday')}${logged.duration_min ? ` · ${logged.duration_min} min` : ''}` : s.note}
                done={Boolean(logged)}
              />
            );
          })}
        </div>
      </details>
      {logging ? <SessionSheet type={logging} onClose={() => setLogging(null)} /> : null}
      {/* Personal density (Home simplify): hide what you don't use. */}
      <Link to="/settings/modules" className="home-customize">{t('home.customize')}</Link>
    </div>
  );
}
