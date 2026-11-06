import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { badgeProgress, doneKeys, syncQuests, toggleDaily, totalPoints } from '../lib/quests.js';
import { content, useData } from '../store/useData.js';
import { useToday } from '../store/today.js';

const Q = content.quests;
const GROUPS = [
  { key: 'daily', label: "Today's habits", note: 'Tick these yourself. They reset every day.' },
  { key: 'weekly', label: 'This week', note: 'Earned from what you log. They reset every Sunday.' },
  { key: 'once', label: 'Milestones', note: 'Earned once, from what you log.' },
];

export default function Quests() {
  const { data, update } = useData();
  const navigate = useNavigate();
  const today = useToday();
  useEffect(() => {
    if (syncQuests(data, today, Q) !== data) update((d) => syncQuests(d, today, Q));
  }, [data, today, update]);
  const done = doneKeys(data, today, Q);
  const points = totalPoints(data);
  const badge = badgeProgress(points, Q);

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>Quests</h1>
      <section className="card">
        <div className="row between">
          <div>
            <div className="muted small">Level {badge.level}{badge.current ? ` · ${badge.current.name}` : ''}</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{points} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>points</span></div>
          </div>
          <Icon name="star" className="icon" />
        </div>
        {badge.next ? (
          <>
            <div className="progress" style={{ margin: '10px 0 6px' }}><span style={{ width: `${badge.pct}%` }} /></div>
            <div className="muted small">{badge.next.threshold - points} to {badge.next.name}</div>
          </>
        ) : <div className="muted small">Every badge earned.</div>}
      </section>
      {GROUPS.map((g) => (
        <div key={g.key}>
          <div className="section-label">{g.label}</div>
          <div className="list">
            {Q.bonus_tasks.filter((t) => t.frequency === g.key).map((t) => {
              const on = done.has(t.key);
              const inner = (
                <>
                  <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
                  <div className="grow">{t.label}</div>
                  <span className="meta">+{t.points}</span>
                </>
              );
              return g.key === 'daily' ? (
                <button key={t.key} type="button" className="list-row" aria-pressed={on} onClick={() => update((d) => toggleDaily(d, today, t.key, Q))}>{inner}</button>
              ) : <div key={t.key} className="list-row">{inner}</div>;
            })}
          </div>
          <p className="muted small" style={{ margin: '-4px 16px 12px' }}>{g.note}</p>
        </div>
      ))}
    </div>
  );
}
