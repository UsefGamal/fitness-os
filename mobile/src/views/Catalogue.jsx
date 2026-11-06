import { useState } from 'react';
import { Link } from 'react-router';

import Icon from '../components/Icon.jsx';
import { capitalize, filterCatalogue, thumbOf } from '../lib/catalogue.js';
import { t } from '../lib/i18n.js';
import { MUSCLE, anglesOf, musclesIn, targetText } from '../lib/muscles.js';
import { useCatalogue } from '../store/catalogue.js';

const PAGE = 40;

/** The whole bundled catalogue, with photos. Rendered inside Library. */
export default function Catalogue({ q, muscle }) {
  const { catalogue, error } = useCatalogue();
  const [equipment, setEquipment] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [pickedMuscle, setPickedMuscle] = useState(null);
  const [pickedAngle, setPickedAngle] = useState(null);
  if (error) return <div className="card empty">The exercise photos aren't in this build.</div>;
  if (!catalogue) return <div className="card empty">Loading exercises…</div>;
  const kinds = [...new Set(catalogue.exercises.map((e) => e.equipment || 'other'))].sort();
  // A finer muscle only counts while its group is the one picked on the map.
  // A group with one muscle (Chest, Core) goes straight to its angles.
  const inGroup = muscle ? musclesIn(muscle) : [];
  const only = inGroup.length === 1 ? inGroup[0].key : null;
  const fine = only || (pickedMuscle && MUSCLE[pickedMuscle]?.group === muscle ? pickedMuscle : null);
  const angles = fine ? anglesOf(fine) : [];
  const angle = angles.some((a) => a.key === pickedAngle) ? pickedAngle : null;
  const list = filterCatalogue(catalogue.exercises, { q, group: muscle, equipment: equipment || null, muscle: fine, angle });
  const chip = (on, label, onClick) => (
    <button key={label} type="button" className={`chip-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => { onClick(); setLimit(PAGE); }}>{label}</button>
  );
  return (
    <>
      <select value={equipment} onChange={(e) => { setEquipment(e.target.value); setLimit(PAGE); }} aria-label="Equipment" style={{ marginBottom: 12 }}>
        <option value="">Any equipment</option>
        {kinds.map((k) => <option key={k} value={k}>{capitalize(k)}</option>)}
      </select>
      {inGroup.length > 1 ? (
        <div className="chip-row" role="group" aria-label={t('muscles.pick')}>
          {chip(!fine, t('muscles.all', { group: muscle }), () => setPickedMuscle(null))}
          {inGroup.map((m) => chip(fine === m.key, m.label, () => { setPickedMuscle(m.key); setPickedAngle(null); }))}
        </div>
      ) : null}
      {angles.length ? (
        <div className="chip-row" role="group" aria-label={t('muscles.angle')}>
          {chip(!angle, t('muscles.anyAngle'), () => setPickedAngle(null))}
          {angles.map((a) => chip(angle === a.key, a.label, () => setPickedAngle(a.key)))}
        </div>
      ) : null}
      <div className="section-label">{t('muscles.count', { n: list.length })}</div>
      <div className="list">
        {list.slice(0, limit).map((e) => (
          <Link key={e.id} to={`/catalogue/${encodeURIComponent(e.id)}`} className="list-row">
            {thumbOf(e) ? <img className="thumb" src={`exercise-db/${thumbOf(e)}`} alt="" loading="lazy" decoding="async" /> : <span className="thumb blank" />}
            <div className="grow"><div>{e.name}</div><div className="meta">{[targetText(e), e.equipment].filter(Boolean).join(' · ')}</div></div>
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
