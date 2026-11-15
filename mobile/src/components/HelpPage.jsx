import { t } from '../lib/i18n.js';
import { HELP_KEYS } from '../lib/privacy.js';
import Icon from './Icon.jsx';

/** Settings > Help (HELP-1, BIZ-5): ten short answers, one open at a time. */
export default function HelpPage() {
  return (
    <>
      <p className="page-sub">{t('help.intro')}</p>
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
