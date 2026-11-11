import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import Icon from '../components/Icon.jsx';
import { entryFor, thumbOf } from '../lib/catalogue.js';
import * as D from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { useCatalogue } from '../store/catalogue.js';
import { content, useData } from '../store/useData.js';
import Catalogue from './Catalogue.jsx';

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];

export default function Library() {
  const { data, update } = useData();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState(null);
  const query = useDeferredValue(q); // typing stays instant while the list catches up
  const [tab, setTab] = useState('mine');
  const [showMap, setShowMap] = useState(false);
  const { catalogue } = useCatalogue();
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState('Chest');
  const bests = useMemo(() => D.personalBests(data), [data]);
  const list = data.exercises
    .filter((e) => (!muscle || e.muscle_group === muscle) && e.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const add = (e) => {
    e.preventDefault();
    update((d) => D.addCustomExercise(d, { name: newName, muscle_group: newMuscle }));
    setNewName('');
  };

  return (
    <div className="page">
      <h1 className="page-title">Library</h1>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button type="button" className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Your exercises</button>
        <button type="button" className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All with photos</button>
      </div>
      <input type="text" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" style={{ marginBottom: 12 }} />
      {/* Search and muscle chips first; the body map opens on request so the list starts on the first screen (UX-25). */}
      <div className="chip-row" role="group" aria-label={t('library.filter')}>
        <button type="button" className={`chip-btn${!muscle ? ' on' : ''}`} aria-pressed={!muscle} onClick={() => setMuscle(null)}>{t('library.all')}</button>
        {MUSCLES.map((m) => (
          <button key={m} type="button" className={`chip-btn${muscle === m ? ' on' : ''}`} aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{m}</button>
        ))}
      </div>
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 4, marginBottom: 8 }} aria-expanded={showMap} onClick={() => setShowMap(!showMap)}><Icon name="person" /> {t(showMap ? 'library.hideMap' : 'library.showMap')}</button>
      {showMap ? (
        <section className="card">
          <BodyMap hit={muscle ? new Set([muscle]) : new Set()} onPick={(g) => setMuscle(muscle === g ? null : g)} label={t('library.mapLabel')} />
        </section>
      ) : null}
      {tab === 'all' ? <Catalogue q={query} muscle={muscle} /> : (
      <>
      <div className="section-label">{list.length} exercises</div>
      <div className="list">
        {list.map((e) => {
          const b = bests.get(e.id);
          return (
            <Link key={e.id} to={`/library/${e.id}`} className="list-row">
              {catalogue ? (() => { const c = entryFor(e.name, content.training, catalogue.byId); return thumbOf(c) ? <img className="thumb" src={`exercise-db/${thumbOf(c)}`} alt="" loading="lazy" decoding="async" /> : <span className="thumb blank" />; })() : null}
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
      </>
      )}
    </div>
  );
}
