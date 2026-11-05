import { Link, useNavigate, useParams } from 'react-router';

import Alternatives from '../components/Alternatives.jsx';
import BodyMap from '../components/BodyMap.jsx';
import ExercisePhotos from '../components/ExercisePhotos.jsx';
import Icon from '../components/Icon.jsx';
import LineChart from '../components/LineChart.jsx';
import { formatDate } from '../lib/dates.js';
import { entryFor } from '../lib/catalogue.js';
import * as D from '../lib/data.js';
import { e1rmSeries } from '../lib/insights.js';
import { effectiveDay } from '../lib/planEdit.js';
import { activePlan } from '../lib/plan.js';
import { useCatalogue } from '../store/catalogue.js';
import { content, useData } from '../store/useData.js';
import { HowTo } from './CatalogueDetail.jsx';

export default function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useData();
  const { catalogue } = useCatalogue();
  const ex = data.exercises.find((e) => e.id === Number(id));
  if (!ex) return <div className="page"><div className="card empty">Exercise not found.</div></div>;
  const history = D.exerciseHistory(data, ex.id);
  const best = D.personalBests(data).get(ex.id);
  const plan = activePlan(data, content);
  const inPlan = plan.program
    .map((d) => ({ d, x: effectiveDay(d.key, plan, data).exercises.find((e) => e.name === ex.name) }))
    .filter((r) => r.x);
  const photo = ex && catalogue ? entryFor(ex.name, content.training, catalogue.byId) : null;
  const video = inPlan.find((r) => r.x.video)?.x.video;

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{ex.name}</h1>
      <p className="page-sub">{ex.muscle_group}{ex.equipment ? ` · ${ex.equipment}` : ''}</p>
      {photo ? (
        <>
          <ExercisePhotos entry={photo} />
          {photo.name.toLowerCase() !== ex.name.toLowerCase() ? <p className="muted small" style={{ margin: '-6px 4px 12px' }}>Photos show {photo.name}, the closest match.</p> : null}
        </>
      ) : null}
      <section className="card">{photo ? <BodyMap primary={photo.primary} secondary={photo.secondary} label={`Works ${photo.primary.join(', ')}`} /> : <BodyMap hit={new Set([ex.muscle_group])} label={`Works ${ex.muscle_group}`} />}</section>
      <div className="stat-grid">
        <div className="stat"><div className="label">Best set</div><div className="value">{best ? `${best.weight_kg}×${best.reps}` : '–'}</div></div>
        <div className="stat"><div className="label">Est. 1RM</div><div className="value">{best ? Math.round(best.score) : '–'}<span className="unit">kg</span></div></div>
      </div>
      {history.length > 1 ? <section className="card stack"><strong>Estimated 1RM</strong><LineChart points={e1rmSeries(data, ex.id)} label={`${ex.name} estimated one-rep max`} /></section> : null}
      {inPlan.length ? (
        <div className="card small">
          <div className="muted">In your plan</div>
          {inPlan.map(({ d, x }) => <div key={d.key}>{d.label}: {x.sets} × {x.reps}{x.rir ? `, RIR ${x.rir}` : ''}</div>)}
          {video ? <a href={video} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8 }}><Icon name="video" className="icon" /> Form video</a> : null}
        </div>
      ) : null}
      {photo ? <HowTo entry={photo} /> : null}
      <Alternatives key={ex.id} entry={photo} group={ex.muscle_group} catalogue={catalogue} />
      <div className="section-label">History</div>
      {history.length ? (
        <div className="list">
          {history.map((h) => (
            <Link key={h.workoutId} to={`/history/${h.workoutId}`} className="list-row">
              <div className="grow"><div>{formatDate(h.log_date)}</div><div className="meta">{h.sets.map((s) => `${s.weight_kg}×${s.reps}`).join(' · ')}</div></div>
              <Icon name="chev" className="icon chev" />
            </Link>
          ))}
        </div>
      ) : <div className="card empty">Not logged yet.</div>}
    </div>
  );
}
