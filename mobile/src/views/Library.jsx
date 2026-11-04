import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import Icon from '../components/Icon.jsx';
import * as D from '../lib/data.js';
import { useData } from '../store/useData.js';

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];

export default function Library() {
  const { data, update } = useData();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('Chest');
  const bests = useMemo(() => D.personalBests(data), [data]);
  const list = data.exercises
    .filter((e) => (!muscle || e.muscle_group === muscle) && e.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const add = (e) => {
    e.preventDefault();
    update((d) => D.addCustomExercise(d, { name: newName, muscle_group: newMuscle }));
    setNewName('');
  };

  return (
    <div className="page">
      <h1 className="page-title">Library</h1>
      <input type="text" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" style={{ marginBottom: 12 }} />
      <section className="card">
        <BodyMap hit={muscle ? new Set([muscle]) : new Set()} onPick={(g) => setMuscle(muscle === g ? null : g)} label="Tap a muscle group to filter" />
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <button type="button" className={`chip${!muscle ? ' accent' : ''}`} style={{ border: 0, minHeight: 32 }} onClick={() => setMuscle(null)}>All</button>
          {MUSCLES.map((m) => (
            <button key={m} type="button" className={`chip${muscle === m ? ' accent' : ''}`} style={{ border: 0, minHeight: 32 }} onClick={() => setMuscle(muscle === m ? null : m)}>{m}</button>
          ))}
        </div>
      </section>
      <div className="section-label">{list.length} exercises</div>
      <div className="list">
        {list.map((e) => {
          const b = bests.get(e.id);
          return (
            <Link key={e.id} to={`/library/${e.id}`} className="list-row">
              <div className="grow"><div>{e.name}</div><div className="meta">{e.muscle_group}{e.equipment ? ` · ${e.equipment}` : ''}</div></div>
              {b ? <span className="meta">{b.weight_kg} × {b.reps}</span> : null}
              <Icon name="chev" className="icon chev" />
            </Link>
          );
        })}
        {!list.length ? <div className="empty">No exercise matches.</div> : null}
      </div>
      <form className="card stack" onSubmit={add}>
        <strong>Add your own exercise</strong>
        <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New exercise name" />
        <select value={newMuscle} onChange={(e) => setNewMuscle(e.target.value)} aria-label="Muscle group">{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select>
        <button type="submit" className="btn secondary" disabled={!newName.trim()}>Add</button>
      </form>
    </div>
  );
}
