import { Link } from 'react-router';

import Icon from '../components/Icon.jsx';
import { formatDate, monthLabel } from '../lib/dates.js';
import { useData } from '../store/useData.js';

const TYPE = { gym: 'Gym', home: 'Home session', recovery: 'Recovery', cardio: 'Cardio', padel: 'Padel' };

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
                  <div>{w.notes || TYPE[w.workout_type] || w.workout_type}</div>
                  <div className="meta">{formatDate(w.log_date)} · {w.sets.length ? `${w.sets.length} set${w.sets.length === 1 ? '' : 's'}` : TYPE[w.workout_type]}{w.duration_min ? ` · ${w.duration_min} min` : ''}</div>
                </div>
                {w.started_at && !w.finished_at ? <span className="chip accent">In progress</span> : null}
                <Icon name="chev" className="icon chev" />
              </Link>
            ))}
          </div>
        </div>
      )) : <div className="card empty">No workouts yet. Start one from the Start tab.</div>}
    </div>
  );
}
