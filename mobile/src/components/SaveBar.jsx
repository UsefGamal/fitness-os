import { t } from '../lib/i18n.js';
import { useData } from '../store/useData.js';

/** Shown while nothing could be written to the phone (storage full): the
 * data is only in memory and a kill would lose it (QA-07). Amber, at the
 * bottom, never blocks logging; it goes away on the next good write. */
export default function SaveBar() {
  const { saveFailing: failing, retrySave: retry } = useData();
  if (!failing) return null;
  return (
    <div className="save-bar" role="alert">
      <div className="grow">
        <strong>{t('save.failedTitle')}</strong>
        <div className="small">{t('save.failedNote')}</div>
      </div>
      <button type="button" className="btn small" style={{ width: 'auto' }} onClick={retry}>{t('save.retry')}</button>
    </div>
  );
}
