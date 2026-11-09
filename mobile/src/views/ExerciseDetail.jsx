import { Link, useNavigate, useParams } from 'react-router';

import Alternatives from '../components/Alternatives.jsx';
import BodyMap from '../components/BodyMap.jsx';
import ExercisePhotos from '../components/ExercisePhotos.jsx';
import Icon from '../components/Icon.jsx';
import LineChart from '../components/LineChart.jsx';
import { formatDate } from '../lib/dates.js';
import { safeVideo } from '../lib/links.js';
import { entryFor } from '../lib/catalogue.js';
import * as D from '../lib/data.js';
import { e1rmSeries } from '../lib/insights.js';
import { records } from '../lib/records.js';
import { effectiveDay } from '../lib/planEdit.js';
import { activePlan } from '../lib/plan.js';
import { useCatalogue } from '../store/catalogue.js';
import { content, useData } from '../store/useData.js';
import { t } from '../lib/i18n.js';
import { targetFor } from '../lib/muscles.js';
import { HowTo, labels } from './CatalogueDetail.jsx';

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
  const target = targetFor(ex.name, plan, photo);
  const video = inPlan.map((r) => safeVideo(r.x.video)).find(Boolean);

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(-1)}><Icon name="back" /> Back</button>
      <h1 className="page-title" style={{ marginTop: 4 }}>{ex.name}</h1>
      <p className="page-sub">{ex.muscle_group}{ex.equipment ? ` · ${ex.equipment}` : ''}</p>
      {photo ? (
        <>
          <ExercisePhotos entry={photo} />
          {photo.name.toLowerCase() !== ex.name.toLowerCase() ? <p className="muted small" style={{ margin: '-6px 4px 12px' }}>Photos show {photo.name}, the closest match.</p> : null}
        </>
      ) : null}
      <section className="card">{target ? <BodyMap primary={target.main} secondary={target.helpers} focus={target.angle} label={t('muscles.mapLabel', { muscles: labels(target.main) })} /> : <BodyMap hit={new Set([ex.muscle_group])} label={t('muscles.mapLabel', { muscles: ex.muscle_group })} />}</section>
      <div className="stat-grid">
        <div className="stat"><div className="label">Best set</div><div className="value">{best ? `${best.weight_kg}×${best.reps}` : '–'}</div></div>
        <div className="stat"><div className="label">Est. 1RM</div><div className="value">{best ? Math.round(best.score) : '–'}<span className="unit">kg</span></div></div>
      </div>
      <Records rec={records(data, ex.id)} />
      {history.length > 1 ? <section className="card stack"><strong>Estimated 1RM</strong><LineChart points={e1rmSeries(data, ex.id)} label={`${ex.name} estimated one-rep max`} /></section> : null}
      {inPlan.length ? (
        <div className="card small">
          <div className="muted">In your plan</div>
          {inPlan.map(({ d, x }) => <div key={d.key}>{d.label}: {x.sets} × {x.reps}{x.rir ? `, RIR ${x.rir}` : ''}</div>)}
          {video ? <a href={video} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8 }}><Icon name="video" className="icon" /> Form video</a> : null}
        </div>
      ) : null}
      {photo ? <HowTo entry={photo} target={target} /> : null}
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

/** The Records card (F-03): this exercise's bests, from work sets only. */
function Records({ rec }) {
  if (!rec) return null;
  const rows = [
    [t('records.heaviest'), `${rec.heaviest.kg} kg × ${rec.heaviest.reps}`, rec.heaviest.date],
    rec.e1rm ? [t('records.e1rm'), `${rec.e1rm.kg} kg`, rec.e1rm.date, `${rec.e1rm.from.kg} × ${rec.e1rm.from.reps}`] : null,
    [t('records.bestSet'), `${rec.setVolume.kg} kg`, rec.setVolume.date, `${rec.setVolume.from.kg} × ${rec.setVolume.from.reps}`],
    [t('records.bestSession'), `${rec.session.kg} kg`, rec.session.date],
  ].filter(Boolean);
  return (
    <>
      <div className="section-label">{t('records.title')}</div>
      <div className="list">
        {rows.map(([label, value, date, from]) => (
          <div key={label} className="list-row">
            <div className="grow"><div>{label}</div><div className="meta">{formatDate(date)}{from ? ` · ${from}` : ''}</div></div>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
          </div>
        ))}
      </div>
      <details className="card small records-table">
        <summary>{t('records.repMax')}</summary>
        <table>
          <thead><tr><th>{t('records.reps')}</th><th>{t('records.done')}</th><th>{t('records.estimated')}</th></tr></thead>
          <tbody>
            {rec.repMax.map((r) => (
              <tr key={r.reps}><td>{r.reps}</td><td>{r.actual ? `${r.actual.kg} kg` : '–'}</td><td className="muted">{r.estimated != null ? `${r.estimated} kg` : '–'}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ margin: '8px 0 0' }}>{t('records.note')}</p>
      </details>
    </>
  );
}
