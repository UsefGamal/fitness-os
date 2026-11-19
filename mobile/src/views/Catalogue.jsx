import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import { capitalize, filterCatalogue, thumbOf } from '../lib/catalogue.js';
import { t } from '../lib/i18n.js';
import { countByGroup, GROUP16, GROUPS16, musclesOfGroup } from '../lib/muscleGroups.js';
import { MUSCLE, anglesOf, musclesOf, targetText } from '../lib/muscles.js';
import { useCatalogue } from '../store/catalogue.js';

const PAGE = 40;

/** The 16 groups as rows, each with its muscles lit on a small map and
 * how many exercises work it (BeFit items 10 and 17). */
export function ByMuscle({ counts, onPick }) {
  return (
    <div className="list by-muscle">
      {GROUPS16.map((g) => (
        <button key={g.key} type="button" className="list-row" onClick={() => onPick(g.key)}>
          <span className="muscle-thumb" aria-hidden="true"><BodyMap bare zoom primary={g.muscles} size={56} label="" /></span>
          <div className="grow"><div>{g.label}</div>{counts ? <div className="meta">{t('mg.count', { n: counts[g.key] })}</div> : null}</div>
          <Icon name="chev" className="icon chev" />
        </button>
      ))}
    </div>
  );
}

/** The whole bundled catalogue, with photos. Rendered inside Library.
 * `muscle` is one of the 16 groups; with none picked and nothing typed,
 * the groups come first. */
export default function Catalogue({ q, muscle, onPick }) {
  const { catalogue, error } = useCatalogue();
  const [equipment, setEquipment] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [pickedMuscle, setPickedMuscle] = useState(null);
  const [pickedAngle, setPickedAngle] = useState(null);
  const counts = useMemo(() => (catalogue ? countByGroup(catalogue.exercises.map((e) => ({ main: musclesOf(e) }))) : null), [catalogue]);
  if (error) return <div className="card empty">The exercise photos aren't in this build.</div>;
  if (!catalogue) return <div className="card empty">Loading exercises…</div>;
  if (!muscle && !q.trim() && onPick) return <ByMuscle counts={counts} onPick={onPick} />;
  const kinds = [...new Set(catalogue.exercises.map((e) => e.equipment || 'other'))].sort();
  // A finer muscle only counts while its group is the one picked. A group
  // with one muscle (Chest, Biceps) goes straight to its angles.
  const inGroup = muscle ? musclesOfGroup(muscle).map((k) => MUSCLE[k]) : [];
  const only = inGroup.length === 1 ? inGroup[0].key : null;
  const fine = only || (pickedMuscle && inGroup.some((m) => m.key === pickedMuscle) ? pickedMuscle : null);
  const angles = fine ? anglesOf(fine) : [];
  const angle = angles.some((a) => a.key === pickedAngle) ? pickedAngle : null;
  const list = filterCatalogue(catalogue.exercises, { q, group16: muscle, equipment: equipment || null, muscle: fine, angle });
  const chip = (on, label, onClick) => (
    <button key={label} type="button" className={`chip-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => { onClick(); setLimit(PAGE); }}>{label}</button>
  );
  return (
    <>
      <select value={equipment} onChange={(e) => { setEquipment(e.target.value); setLimit(PAGE); }} aria-label={t('aria.equipment')} style={{ marginBottom: 12 }}>
        <option value="">Any equipment</option>
        {kinds.map((k) => <option key={k} value={k}>{capitalize(k)}</option>)}
      </select>
      {inGroup.length > 1 ? (
        <div className="chip-row" role="group" aria-label={t('muscles.pick')}>
          {chip(!fine, t('muscles.all', { group: GROUP16[muscle].label }), () => setPickedMuscle(null))}
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
        {!list.length ? <EmptyState art="search" className="in-list" note={t('empty.search')} /> : null}
      </div>
      {list.length > limit ? <button type="button" className="btn secondary" onClick={() => setLimit(limit + PAGE)}>Show more ({list.length - limit} left)</button> : null}
      <p className="muted small" style={{ margin: '12px 16px' }}>Photos and instructions: free-exercise-db, public domain.</p>
    </>
  );
}
