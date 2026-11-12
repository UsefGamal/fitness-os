import { Link } from 'react-router';

import { longWeekday } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { MUSCLE } from '../lib/muscles.js';
import BodyMap from './BodyMap.jsx';
import Icon from './Icon.jsx';

const READY = { good: 'home.ready', easy: 'home.easy', caution: 'home.steady' };

/** Home's main card: today's session (or the next one on a rest day), the
 * muscles it works, the warm-up and the one button that starts it. */
export default function WorkoutCard({ next, day, hits, groups, time, todays, changed, ready, readyText, starter, onChange, onStart }) {
  const head = () => (
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <h2 className="section-title" style={{ margin: 0 }}>{t('home.planTitle')}</h2>
      <Link to="/plan" className="see-all">{t('home.viewPlan')} <Icon name="chev" className="icon" /></Link>
    </div>
  );
  const readyChip = ready && READY[ready] ? (
    <span className={`chip${ready === 'good' ? ' accent' : ' warn'}`}><Icon name={ready === 'good' ? 'check' : 'heart'} className="icon" /> {t(READY[ready])}</span>
  ) : null;

  if (!next) {
    return (
      <section className="card workout-card">
        {head()}
        <div className="session-row">
          <div className="session-icon rest"><Icon name="moon" /></div>
          <div className="grow"><div className="session-name">{t('week.noSession')}</div><div className="session-sub">{t('week.noSessionNote')}</div></div>
        </div>
        <button type="button" className="btn secondary" onClick={onChange}>{t('home.trainToday')}</button>
      </section>
    );
  }
  if (next.isRestToday) {
    return (
      <section className="card workout-card">
        {head()}
        <div className="session-row">
          <div className="session-icon rest"><Icon name="moon" /></div>
          <div className="grow">
            <div className="session-name">{t('home.restToday')}</div>
            <div className="session-sub">{t('home.restNext', { label: next.label })} · {t('home.nextOn', { day: longWeekday(next.onDate), time })}</div>
          </div>
          {readyChip}
        </div>
        {readyText ? <div className="muted small" style={{ marginBottom: 12 }}>{readyText}</div> : null}
        <button type="button" className="btn secondary" onClick={onChange}>{t('home.trainToday')}</button>
      </section>
    );
  }
  const label = `${next.label} works ${[...hits.muscles.map((m) => MUSCLE[m]?.label || m), ...groups].join(', ')}`;
  return (
    <section className="card workout-card">
      {head()}
      <div className="session-row">
        <div className="session-icon"><Icon name="dumbbell" /></div>
        <div className="grow">
          <div className="session-name">{next.label}</div>
          <div className="session-sub">{t('home.todayAt', { time })}{changed ? ` · ${t('week.changed')}` : ''}</div>
          {starter && !todays?.finished_at ? <div className="starter-line">{t('starter.session', { n: starter.next, all: starter.total })}</div> : null}
        </div>
        {!todays ? <button type="button" className="btn ghost small" onClick={onChange}>{t('home.change')}</button> : null}
      </div>
      <div className="session-detail">
        <div style={{ width: 64, flex: 'none' }}><BodyMap primary={hits.muscles} hit={groups} size={64} label={label} /></div>
        <div className="grow">
          {day?.pre_cardio ? <div className="session-warm">{t('home.warmup', { what: day.pre_cardio })}</div> : null}
          <div className="session-sub">{day?.warmup_items?.length ? t('home.warmupDrills', { n: day.warmup_items.length }) : next.focus}</div>
        </div>
        {readyChip}
      </div>
      {readyText ? <div className="muted small" style={{ marginBottom: 12 }}>{readyText}</div> : null}
      {todays?.finished_at ? (
        <Link className="btn secondary" to={`/history/${todays.id}`}><Icon name="check" /> {t('home.doneSets', { n: todays.sets.length })}</Link>
      ) : (
        <button type="button" className="btn" onClick={onStart}><Icon name="play" /> {t(todays ? 'home.resume' : 'home.start')}</button>
      )}
    </section>
  );
}
