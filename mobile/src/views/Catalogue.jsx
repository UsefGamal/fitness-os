import { useState } from 'react';
import { Link } from 'react-router';

import Icon from '../components/Icon.jsx';
import { capitalize, filterCatalogue } from '../lib/catalogue.js';
import { useCatalogue } from '../store/catalogue.js';

const PAGE = 40;

/** The whole bundled catalogue, with photos. Rendered inside Library. */
export default function Catalogue({ q, muscle }) {
  const { catalogue, error } = useCatalogue();
  const [equipment, setEquipment] = useState('');
  const [limit, setLimit] = useState(PAGE);
  if (error) return <div className="card empty">The exercise photos aren't in this build.</div>;
  if (!catalogue) return <div className="card empty">Loading exercises…</div>;
  const kinds = [...new Set(catalogue.exercises.map((e) => e.equipment || 'other'))].sort();
  const list = filterCatalogue(catalogue.exercises, { q, group: muscle, equipment: equipment || null });
  return (
    <>
      <select value={equipment} onChange={(e) => { setEquipment(e.target.value); setLimit(PAGE); }} aria-label="Equipment" style={{ marginBottom: 12 }}>
        <option value="">Any equipment</option>
        {kinds.map((k) => <option key={k} value={k}>{capitalize(k)}</option>)}
      </select>
      <div className="section-label">{list.length} exercises with photos</div>
      <div className="list">
        {list.slice(0, limit).map((e) => (
          <Link key={e.id} to={`/catalogue/${encodeURIComponent(e.id)}`} className="list-row">
            {e.photos[0] ? <img className="thumb" src={`exercise-db/${e.photos[0]}`} alt="" loading="lazy" decoding="async" /> : <span className="thumb blank" />}
            <div className="grow"><div>{e.name}</div><div className="meta">{capitalize(e.primary.join(', '))}{e.equipment ? ` · ${e.equipment}` : ''}</div></div>
            <Icon name="chev" className="icon chev" />
          </Link>
        ))}
        {!list.length ? <div className="empty">No exercise matches.</div> : null}
      </div>
      {list.length > limit ? <button type="button" className="btn secondary" onClick={() => setLimit(limit + PAGE)}>Show more ({list.length - limit} left)</button> : null}
      <p className="muted small" style={{ margin: '12px 16px' }}>Photos and instructions: free-exercise-db, public domain.</p>
    </>
  );
}
