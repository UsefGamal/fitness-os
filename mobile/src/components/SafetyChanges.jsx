import { t } from '../lib/i18n.js';
import Icon from './Icon.jsx';

/** What the safety check changed in this day (SAFE-2): swapped moves and
 * the ones left out, each with why. Nothing when nothing changed. */
export default function SafetyChanges({ changes }) {
  if (!changes?.length) return null;
  return (
    <div className="card small safety-changes" role="note">
      <div className="row" style={{ gap: 8, alignItems: 'center' }}><Icon name="heart" className="icon tone-accent" /><strong>{t('safety.changed')}</strong></div>
      <ul>
        {changes.map((c) => (
          <li key={c.from}>
            {c.to ? t('safety.swapLine', { from: c.from, to: c.to }) : t('safety.leftOut', { from: c.from })}
            <span className="muted">{` · ${t(`safety.why.${c.why}`)}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
