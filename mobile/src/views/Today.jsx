import { Link, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';

import DayPicker from '../components/DayPicker.jsx';
import Icon from '../components/Icon.jsx';
import MetricStrip from '../components/MetricStrip.jsx';
import QuickAction from '../components/QuickAction.jsx';
import StatTile from '../components/StatTile.jsx';
import WeighInSheet from '../components/WeighInSheet.jsx';
import WhatsNewSheet from '../components/WhatsNewSheet.jsx';
import WeightCard from '../components/WeightCard.jsx';
import WorkoutCard from '../components/WorkoutCard.jsx';
import { formatDate, longWeekday } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { dayGroups, weekStreaks } from '../lib/insights.js';
import { effectiveTimes, ramadanActive } from '../lib/ramadan.js';
import { hm, READINESS_TEXT, readiness } from '../lib/activity.js';
import { eveningDone, eveningOn } from '../lib/evening.js';
import { firstName, partOfDay, watchTiles } from '../lib/home.js';
import { mealDayFor, mealStart } from '../lib/meals.js';
import * as P from '../lib/planEdit.js';
import { doneKeys, questsOn } from '../lib/quests.js';
import { isChangedOn, programDayFor } from '../lib/schedule.js';
import { t } from '../lib/i18n.js';
import { activePlan } from '../lib/plan.js';
import { dayMuscles } from '../lib/muscles.js';
import { backupDue } from '../lib/durable.js';
import { hardWeeksInARow, isRecoveryWeek, recoveryDue, setRecoveryWeek } from '../lib/recovery.js';
import { APP } from '../lib/version.js';
import { markSeen, unseenNotes } from '../lib/whatsNew.js';
import { WHATS_NEW } from '../lib/whatsNewNotes.js';
import { starterProgress } from '../lib/starter.js';
import { feedback } from '../store/feedback.js';
import { content, useData } from '../store/useData.js';
import { hasScreenLock } from '../store/native.js';
import { SESSIONS } from './Session.jsx';
import { useToday } from '../store/today.js';
import { markClearanceSeen, showClearance } from '../lib/safety.js';

const QUICK = { home: ['dumbbell', 'accent'], recovery: ['heart', 'accent'], cardio: ['chart', 'accent'], padel: ['racket', 'accent'] };

export default function Today() {
  const { data, update } = useData();
  const navigate = useNavigate();
  const today = useToday();
  const T = activePlan(data, content);
  const times = effectiveTimes(data, content, today);
  const moves = data.session_moves || [];
  const next = programDayFor(today, T, moves);
  const nextDay = next ? P.effectiveDay(next.key, T, data) : null;
  const tonight = eveningOn(data, today);
  const nextHits = dayMuscles(nextDay?.exercises, T);
  const nextGroups = dayGroups(data, nextHits.unknown);
  const todays = D.workoutOn(data, today);
  const mealSlots = content.nutrition.meal_slots.length;
  const mealsDone = content.nutrition.meal_slots.filter((s) => D.mealLog(data, today, s)?.completed).length;
  const water = D.waterOn(data, today);
  const weeks = weekStreaks(data, today);
  const streak = weeks.current;
  const mealDay = mealDayFor(today, content.nutrition, mealStart(data, content.nutrition));
  const dailyQuests = content.quests.bonus_tasks.filter((q) => q.frequency === 'daily');
  const questsDone = dailyQuests.filter((q) => doneKeys(data, today, content.quests).has(q.key)).length;
  const otherToday = data.workouts.filter((w) => w.log_date === today && w.workout_type !== 'gym');
  const healthOn = data.settings?.health?.enabled;
  const ready = healthOn ? readiness(data.health_daily, today) : null;
  const moved = healthOn ? data.health_daily?.[today] : null;
  const tiles = watchTiles({ steps: moved?.steps ?? null, kcal: moved?.active_kcal ?? null, sleepMin: moved?.sleep_min ?? null });
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
  const clearanceSeen = () => update(markClearanceSeen);
  // What's new, once per version (E1-S6). A new install skips straight to "seen".
  const news = unseenNotes(data, APP.version, WHATS_NEW);
  const seenVersion = data.settings?.whats_new_seen;
  useEffect(() => {
    if (!news.length && seenVersion !== APP.version) update((d) => markSeen(d, APP.version));
  }, [news.length, seenVersion, update]);
  const name = firstName(data.profile);
  const greet = t(`home.greet.${partOfDay(new Date().getHours())}`);
  const addWater = (ml) => { update((d) => D.addWater(d, today, ml)); feedback('water'); };

  return (
    <div className="page home">
      <header className="home-head">
        <div className="row between">
          <div className="wordmark" aria-hidden="true">{t('home.wordmark')} <span>{t('home.wordmarkOs')}</span></div>
          <Link to="/settings" className="icon-btn round" aria-label={t('home.settings')}><Icon name="gear" /></Link>
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

      {showClearance(data, today) ? (
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
        hits={nextHits}
        groups={nextGroups}
        time={times.session_time}
        todays={todays}
        changed={isChangedOn(today, moves)}
        ready={readyLevel}
        readyText={readyText}
        starter={starterProgress(data)}
        onChange={() => setPicking(true)}
        onStart={() => navigate('/workout')}
      />
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

      {/* Today's session and Start come first (UX-01); weight is next, one tap to log (UX-03). */}
      {D.moduleOn(data, 'weight') && !data.safety?.hide_weight ? <WeightCard data={data} today={today} onLog={() => setWeighing(true)} /> : null}
      {news.length ? <WhatsNewSheet notes={news} onClose={() => update((d) => markSeen(d, APP.version))} /> : null}
      {weighing ? <WeighInSheet data={data} update={update} today={today} onClose={() => setWeighing(false)} /> : null}
      <MetricStrip tiles={tiles} />
      {/* One thin line, not a card (UX-02). */}
      {backup ? (
        <div className="backup-line" role="status">
          <Link className="grow backup-link" to="/settings/data">
            <Icon name="download" className="icon tone-accent" />
            <span><strong>{t(backup.auto ? 'home.backupAutoTitle' : 'home.backupTitle')}</strong> <span className="muted">{backup.days == null ? t('home.backupNeverShort') : t('home.backupDaysShort', { days: backup.days })}{backup.noLock ? ` ${t('home.backupNoLockShort')}` : ''}</span></span>
          </Link>
          <button type="button" className="icon-btn" aria-label={t('home.later')} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, backup_snoozed_at: Date.now() } }))}><Icon name="x" /></button>
        </div>
      ) : null}

      {/* The week strip lives on Plan only (UX-04). */}
      {isRecoveryWeek(data, today) ? (
        <div className="pill-row warn">
          <Icon name="calendar" />
          <div className="grow small"><strong>{t('recovery.chip')}</strong> <span className="muted">{t('recovery.short')}</span></div>
          <button type="button" className="btn ghost small" onClick={() => update((d) => setRecoveryWeek(d, today, false))}>{t('recovery.off')}</button>
        </div>
      ) : null}
      {recoveryDue(data, today) ? (
        <button type="button" className="pill-row" onClick={() => update((d) => setRecoveryWeek(d, today, true))}>
          <Icon name="calendar" />
          <span className="grow">{t('recovery.due', { n: hardWeeksInARow(data, today) })}</span>
          <Icon name="chev" className="icon chev" />
        </button>
      ) : null}

      <div className="section-head">
        <h2 className="section-title">{t('home.quickStats')}</h2>
        {streak > 0 ? <span className="chip accent" aria-label={t('home.streakAria', { n: streak, done: weeks.week.done, need: weeks.week.need })}><Icon name="bolt" className="icon" /> {t('home.streak', { n: streak })}</span> : null}
      </div>
      <div className="tile-grid">
        {D.moduleOn(data, 'water') ? (
          <StatTile wide icon="drop" tone="water" value={water} of={`${D.waterGoal(data)} ml`} label={t('home.water')}>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="mini-btn" aria-label={t('home.addWater', { ml: 250 })} onClick={() => addWater(250)}>{t('home.add250')}</button>
              <button type="button" className="mini-btn" aria-label={t('home.addWater', { ml: 500 })} onClick={() => addWater(500)}>{t('home.add500')}</button>
              <button type="button" className="mini-btn" aria-label={t('home.undoWater')} disabled={!water} onClick={() => update((d) => D.addWater(d, today, -250))}><Icon name="undo" className="icon" /></button>
            </div>
          </StatTile>
        ) : null}
        {D.moduleOn(data, 'meals') ? (
          <StatTile to="/meals" icon="meals" tone="meals" value={mealsDone} of={mealSlots} label={`${t('home.meals')} · ${mealDay.label}`} />
        ) : null}
        {questsOn(data) ? <StatTile to="/quests" icon="star" tone="quests" value={questsDone} of={dailyQuests.length} label={t('home.quests')} /> : null}
      </div>

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
                to={logged ? `/history/${logged.id}` : `/session/${key}`}
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
    </div>
  );
}
