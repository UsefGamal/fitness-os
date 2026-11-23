import { Link } from 'react-router';

import { formatDate, longWeekday } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import Icon from './Icon.jsx';

const READY = { good: 'home.ready', easy: 'home.easy', caution: 'home.steady' };

/** formatDate without the weekday: "12 Nov". */
const shortDate = (d) => formatDate(d).replace(/^\S+\s/, '');

/** Home's main card (Home and Plan simplify, Nov 2026): one purpose, one
 * action. Today's session with its size and time and the Start button; on a
 * rest day, the next session and "Train today instead". The muscles and
 * the warm-up live on Plan; last time folds away under the session. */
export default function WorkoutCard({ next, day, time, todays, changed, ready, readyText, starter, last, minutes, onChange, onStart }) {
  const readyChip = ready && READY[ready] ? (
    <span className={`chip${ready === 'good' ? ' accent' : ' warn'}`}><Icon name={ready === 'good' ? 'check' : 'heart'} className="icon" /> {t(READY[ready])}</span>
  ) : null;
  // The quiet links under the button: the plan always, Change while the day is open.
  const links = (change, changeKey = 'home.changeWorkout') => (
    <div className="card-links">
      <Link to="/plan" className="card-link">{t('home.viewPlan')}</Link>
      {change ? <button type="button" className="card-link" onClick={onChange}>{t(changeKey)}</button> : null}
    </div>
  );

  if (!next || next.isRestToday) {
    return (
      <section className="card workout-card" data-tour="workout">
        <div className="card-head">
          <h2 className="card-title">{t(next ? 'home.today' : 'home.planNext')}</h2>
          {readyChip}
        </div>
        <div className="session-row">
          <div className="session-icon rest"><Icon name="moon" /></div>
          <div className="grow">
            <div className="session-name">{t(next ? 'home.restDay' : 'week.noSession')}</div>
            <div className="session-sub">{next ? <>{t('home.restNext', { label: next.label })} · <span className="nowrap">{time ? t('home.nextOn', { day: longWeekday(next.onDate), time }) : longWeekday(next.onDate)}</span></> : t('week.noSessionNote')}</div>
          </div>
        </div>
        {readyText ? <div className="muted small ready-text">{readyText}</div> : null}
        {/* Rest is the plan today: training is a quiet link, not the biggest button. */}
        {links(true, 'home.trainToday')}
      </section>
    );
  }
  const count = day?.exercises?.length || 0;
  const size = [count ? t(count === 1 ? 'home.exOne' : 'home.exN', { n: count }) : null, minutes ? t('home.aboutMin', { min: minutes }) : null, time].filter(Boolean).join(' · ');
  return (
    <section className="card workout-card" data-tour="workout">
      <div className="card-head">
        <h2 className="card-title">{t('home.planToday')}</h2>
        {readyChip || (changed ? <span className="chip">{t('week.changed')}</span> : null)}
      </div>
      <div className="session-row">
        <div className="session-icon"><Icon name="dumbbell" /></div>
        <div className="grow">
          <div className="session-name">{next.label}</div>
          {size ? <div className="session-sub">{size}</div> : null}
          {starter && !todays?.finished_at ? <div className="starter-line">{t('starter.session', { n: starter.next, all: starter.total })}</div> : null}
        </div>
      </div>
      {readyText ? <div className="muted small ready-text">{readyText}</div> : null}
      {last && !todays ? (
        // Last time, set by set (charts step 2), folded: one tap to see what to beat.
        <details className="last-time">
          <summary className="last-head"><span className="grow"><strong>{t('last.title', { label: next.label, date: shortDate(last.date) })}</strong> <span className="muted">· {t(last.sets === 1 ? (last.minutes ? 'last.metaMinOne' : 'last.metaOne') : (last.minutes ? 'last.metaMin' : 'last.meta'), { sets: last.sets, min: last.minutes })}</span></span><Icon name="chev" className="icon chev" /></summary>
          {last.lifts.map((l) => <div key={l.exercise_id} className="last-lift"><span className="grow">{l.name}</span><span className="num">{l.text}</span></div>)}
        </details>
      ) : null}
      {todays?.finished_at ? (
        <Link className="btn secondary" to={`/history/${todays.id}`}><Icon name="check" /> {t(todays.sets.length === 1 ? 'home.doneSetOne' : 'home.doneSets', { n: todays.sets.length })}</Link>
      ) : (
        <button type="button" className="btn hero" onClick={onStart}><Icon name="play" /> {t(todays ? 'home.resume' : 'home.start')}</button>
      )}
      {links(!todays)}
    </section>
  );
}
