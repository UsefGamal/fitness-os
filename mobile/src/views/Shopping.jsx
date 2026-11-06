import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { addDays, formatDate, weekStart } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { shoppingList } from '../lib/shopping.js';
import { content, useData } from '../store/useData.js';
import { useToday } from '../store/today.js';

export default function Shopping() {
  const { data, update } = useData();
  const navigate = useNavigate();
  const today = useToday();
  const week = weekStart(today);
  const groups = useMemo(() => shoppingList(today, content.nutrition), [today]);
  const checked = D.shoppingChecked(data, week);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const got = groups.reduce((n, g) => n + g.items.filter((i) => checked.has(i.key)).length, 0);

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Shopping list</h1>
      <p className="page-sub">{formatDate(today)} to {formatDate(addDays(today, 6))}, both options of every meal</p>
      <section className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <strong>{got} of {total} in the basket</strong>
          {got ? <button type="button" className="btn ghost small" onClick={() => update((d) => ({ ...d, shopping: { week, checked: [] } }))}>Clear</button> : null}
        </div>
        <div className="progress"><span style={{ width: `${total ? (got / total) * 100 : 0}%` }} /></div>
      </section>
      {groups.map((g) => (
        <div key={g.name}>
          <div className="section-label">{g.name}</div>
          <div className="list">
            {g.items.map((i) => {
              const on = checked.has(i.key);
              return (
                <button key={i.key} type="button" className="list-row" aria-pressed={on} onClick={() => update((d) => D.toggleShopping(d, week, i.key))}>
                  <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
                  <div className="grow" style={on ? { color: 'var(--muted)', textDecoration: 'line-through' } : null}>{i.name}</div>
                  <span className="meta">{i.qty}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="muted small" style={{ margin: '0 16px' }}>Ticks reset every Sunday.</p>
    </div>
  );
}
