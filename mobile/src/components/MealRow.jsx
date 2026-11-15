import { Link } from 'react-router';

import { t } from '../lib/i18n.js';
import { fitOption } from '../lib/portions.js';
import { content } from '../store/useData.js';
import Icon from './Icon.jsx';

const N = content.nutrition;

/** A recommendation's first reason, as a short line. */
function reasonText(reasons) {
  const r = reasons?.[0];
  if (!r) return null;
  if (r.kind === 'goal') return t(`lib.why.goal.${r.goal}`);
  if (r.kind === 'like') return t('lib.why.like', { name: r.name });
  if (r.kind === 'list') return t('lib.why.list', { items: r.items.map((k) => N.food_names?.[k] || k).join(', ') });
  return t(`lib.why.${r.kind}`);
}

/** One meal-library row: name, numbers fitted to the person (FIT-1), time,
 * and why it is recommended when it is. */
export default function MealRow({ meal, fit, hideKcal, to, reasons }) {
  const shown = fitOption(meal, fit, N);
  const why = reasonText(reasons);
  return (
    <Link to={to} className="list-row">
      {meal.photo ? <img className="thumb" src={meal.photo.file} alt="" loading="lazy" decoding="async" /> : <span className="thumb blank meal-thumb" aria-hidden="true"><Icon name="meals" /></span>}
      <div className="grow">
        <div>{meal.name}</div>
        <div className="meta">{t(hideKcal ? 'lib.metaNoKcal' : 'lib.meta', { kcal: Math.round(shown.kcal), protein: Math.round(shown.protein), min: meal.minutes })}</div>
        {why ? <div className="meta accent-line">{why}</div> : null}
      </div>
      <Icon name="chev" className="icon chev" />
    </Link>
  );
}
