import { Link } from 'react-router';

import { t } from '../lib/i18n.js';
import Icon from './Icon.jsx';

/** One exercise in a plan day: photo, name, target muscle, sets x reps and
 * RIR (rest times show in the workout). Taps open the exercise (Library first, then the catalogue). */
export default function ExerciseRow({ ex, target, photo, to }) {
  const meta = [t('plan.meta', { sets: ex.sets, reps: ex.reps }), ex.rir ? t('plan.tank', { rir: ex.rir }) : null].filter(Boolean).join(' · ');
  const body = (
    <>
      <div className="ex-thumb" aria-hidden="true">{photo ? <img src={photo} alt="" loading="lazy" /> : <Icon name="dumbbell" />}</div>
      <div className="grow">
        <div className="ex-name">{ex.pair ? <span className="pair">{ex.pair}</span> : null}{ex.name}</div>
        {target ? <div className="ex-target">{target}</div> : null}
        <div className="ex-meta">{meta}</div>
        {ex.swapped_from ? <div className="ex-meta">{t('plan.instead', { name: ex.swapped_from })}</div> : null}
        {ex.note ? <div className="ex-note">{ex.note}</div> : null}
        {ex.film_form ? <div className="ex-meta"><Icon name="video" className="icon inline" /> {t('plan.film')}</div> : null}
      </div>
      {to ? <Icon name="chev" className="icon chev" /> : null}
    </>
  );
  return to ? <Link to={to} className="ex-row">{body}</Link> : <div className="ex-row">{body}</div>;
}
