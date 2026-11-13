import { Link, useNavigate, useParams } from 'react-router';

import Alternatives from '../components/Alternatives.jsx';
import BodyMap from '../components/BodyMap.jsx';
import ExercisePhotos from '../components/ExercisePhotos.jsx';
import Icon from '../components/Icon.jsx';
import { capitalize, groupOf } from '../lib/catalogue.js';
import { t } from '../lib/i18n.js';
import { ANGLES, MUSCLE, angleOf, helpersOf, musclesOf } from '../lib/muscles.js';

export const labels = (keys) => keys.map((m) => MUSCLE[m]?.label || capitalize(m)).join(', ');
import * as D from '../lib/data.js';
import { useCatalogue } from '../store/catalogue.js';
import { isAdvanced } from '../lib/levels.js';
import { trainingSettings } from '../lib/training.js';
import { useData } from '../store/useData.js';

export function HowTo({ entry, target = null }) {
  const main = target ? target.main : musclesOf(entry);
  const helpers = target ? target.helpers : helpersOf(entry);
  const angle = target ? target.angle : angleOf(entry);
  const data = useData((s) => s.data);
  const advanced = isAdvanced(entry.level, trainingSettings(data).level);
  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, margin: '0 0 12px' }}>
        {entry.level ? <span className="chip">{capitalize(entry.level)}</span> : null}
        {advanced ? <span className="chip warn">{t('levels.advanced')}</span> : null}
        {entry.equipment ? <span className="chip">{capitalize(entry.equipment)}</span> : null}
        {entry.mechanic ? <span className="chip">{capitalize(entry.mechanic)}</span> : null}
        {entry.force ? <span className="chip">{capitalize(entry.force)}</span> : null}
      </div>
      <div className="card small">
        <div><span className="muted">{t('muscles.works')}</span> {labels(main)}</div>
        {angle ? <div><span className="muted">{t('muscles.focus')}</span> {ANGLES[angle].label}</div> : null}
        {helpers.length ? <div><span className="muted">{t('muscles.also')}</span> {labels(helpers)}</div> : null}
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
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
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
      <section className="card"><BodyMap primary={musclesOf(entry)} secondary={helpersOf(entry)} focus={angleOf(entry)} label={t('muscles.mapLabel', { muscles: labels(musclesOf(entry)) })} /></section>
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
