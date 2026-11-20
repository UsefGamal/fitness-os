import { todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { replayTour } from '../lib/tour.js';
import { useData } from '../store/useData.js';
import { HELP_KEYS } from '../lib/privacy.js';
import Icon from './Icon.jsx';

/** Settings > Help (HELP-1, BIZ-5): ten short answers, one open at a time. */
export default function HelpPage() {
  const update = useData((s) => s.update);
  return (
    <>
      <p className="page-sub">{t('help.intro')}</p>
      <div className="list">
        <button type="button" className="list-row" onClick={() => update((d) => replayTour(d, todayISO()))}><Icon name="play" /><div className="grow"><div>{t('tour.replay')}</div><div className="meta">{t('tour.replayNote')}</div></div><Icon name="chev" className="icon chev" /></button>
      </div>
      <div className="list help-list">
        {HELP_KEYS.map((k) => (
          <details key={k} className="help-item">
            <summary className="list-row"><div className="grow">{t(`help.${k}.q`)}</div><Icon name="chev" className="icon chev" /></summary>
            <p className="help-answer">{t(`help.${k}.a`)}</p>
          </details>
        ))}
      </div>
      <p className="muted small" style={{ margin: '8px 16px' }}>{t('help.more')}</p>
    </>
  );
}
