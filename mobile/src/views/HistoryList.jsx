import { Link } from 'react-router';

import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import { t } from '../lib/i18n.js';
import { formatDate, monthLabel } from '../lib/dates.js';
import { useData } from '../store/useData.js';

const TYPE = { gym: 'Gym', home: 'Home session', recovery: 'Recovery', cardio: 'Cardio', padel: 'Padel' };

/** A row's title: its label, else the plan session it came from ("Pull"),
 * else its type (CHART-1: an unlabelled plan session no longer reads "Gym"). */
function titleOf(w) {
  if (w.notes) return w.notes;
  if (w.session_key && w.workout_type === 'gym') return w.session_key[0].toUpperCase() + w.session_key.slice(1).replace(/_/g, ' ');
  return TYPE[w.workout_type] || w.workout_type;
}

export default function HistoryList() {
  const data = useData((s) => s.data);
  const workouts = [...data.workouts].sort((a, b) => (a.log_date === b.log_date ? b.id - a.id : a.log_date < b.log_date ? 1 : -1));
  const months = [];
  for (const w of workouts) {
    const key = w.log_date.slice(0, 7);
    let m = months.find((x) => x.key === key);
    if (!m) months.push((m = { key, label: monthLabel(key), items: [] }));
    m.items.push(w);
  }
  return (
    <div className="page">
      <h1 className="page-title">History</h1>
      <p className="page-sub">{data.workouts.length} workout{data.workouts.length === 1 ? '' : 's'}. Open one to change its date or fix a set.</p>
      {months.length ? months.map((m) => (
        <div key={m.key}>
          <div className="section-label">{m.label} · {m.items.length}</div>
          <div className="list">
            {m.items.map((w) => (
              <Link key={w.id} to={`/history/${w.id}`} className="list-row">
                <div className="grow">
                  <div>{titleOf(w)}</div>
                  {/* The type only when the title isn't already it (rule 2: "Padel · Padel"). */}
                  <div className="meta">{[formatDate(w.log_date), w.sets.length ? `${w.sets.length} set${w.sets.length === 1 ? '' : 's'}` : (titleOf(w) !== TYPE[w.workout_type] ? TYPE[w.workout_type] : null), w.duration_min ? `${w.duration_min} min` : null].filter(Boolean).join(' · ')}</div>
                </div>
                {w.started_at && !w.finished_at ? <span className="chip accent">In progress</span> : null}
                <Icon name="chev" className="icon chev" />
              </Link>
            ))}
          </div>
        </div>
      )) : (
        <EmptyState art="history" title={t('empty.historyTitle')} note={t('empty.historyNote')}>
          <Link to="/workout" className="btn"><Icon name="play" /> {t('empty.historyCta')}</Link>
        </EmptyState>
      )}
    </div>
  );
}
