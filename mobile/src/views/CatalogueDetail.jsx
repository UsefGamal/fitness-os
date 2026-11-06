import { Link, useNavigate, useParams } from 'react-router';

import Alternatives from '../components/Alternatives.jsx';
import BodyMap from '../components/BodyMap.jsx';
import ExercisePhotos from '../components/ExercisePhotos.jsx';
import Icon from '../components/Icon.jsx';
import { capitalize, groupOf } from '../lib/catalogue.js';
import * as D from '../lib/data.js';
import { useCatalogue } from '../store/catalogue.js';
import { useData } from '../store/useData.js';

export function HowTo({ entry }) {
  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, margin: '0 0 12px' }}>
        {entry.level ? <span className="chip">{capitalize(entry.level)}</span> : null}
        {entry.equipment ? <span className="chip">{capitalize(entry.equipment)}</span> : null}
        {entry.mechanic ? <span className="chip">{capitalize(entry.mechanic)}</span> : null}
        {entry.force ? <span className="chip">{capitalize(entry.force)}</span> : null}
      </div>
      <div className="card small">
        <div><span className="muted">Works:</span> {capitalize(entry.primary.join(', '))}</div>
        {entry.secondary.length ? <div><span className="muted">Also:</span> {entry.secondary.join(', ')}</div> : null}
      </div>
      {entry.instructions.length ? (
        <>
          <div className="section-label">How to do it</div>
          <ol className="card steps">{entry.instructions.map((s, i) => <li key={i}>{s.replace(/^\d+\.\s*/, '')}</li>)}</ol>
        </>
      ) : null}
    </>
  );
}

export default function CatalogueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, update } = useData();
  const { catalogue, error } = useCatalogue();
  const back = <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>;
  if (error) return <div className="page">{back}<div className="card empty">The exercise photos aren't in this build.</div></div>;
  if (!catalogue) return <div className="page">{back}<div className="card empty">Loading…</div></div>;
  const entry = catalogue.byId.get(id);
  if (!entry) return <div className="page">{back}<div className="card empty">Exercise not found.</div></div>;
  const mine = D.exerciseByName(data, entry.name);

  return (
    <div className="page">
      {back}
      <h1 className="page-title" style={{ marginTop: 4 }}>{entry.name}</h1>
      <ExercisePhotos entry={entry} />
      <HowTo entry={entry} />
      <section className="card"><BodyMap primary={entry.primary} secondary={entry.secondary} label={`Works ${entry.primary.join(', ')}`} /></section>
      {mine ? (
        <Link to={`/library/${mine.id}`} className="btn secondary"><Icon name="book" /> In your Library</Link>
      ) : (
        <button type="button" className="btn secondary" onClick={() => update((d) => D.addCustomExercise(d, { name: entry.name, muscle_group: groupOf(entry), equipment: entry.equipment }))}>
          <Icon name="plus" /> Add to your Library
        </button>
      )}
      <Alternatives key={entry.id} entry={entry} catalogue={catalogue} />
    </div>
  );
}
