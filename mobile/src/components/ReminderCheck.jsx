// Settings > Reminders: are reminders able to arrive? (P14-12). One row per
// Android switch with a Fix button, and the maker's steps on phones that
// kill apps (Xiaomi, Infinix, Tecno...). Shown only here, never nagging in
// onboarding. Re-checks when the app comes back from a settings screen.
import { useCallback, useEffect, useState } from 'react';

import { t } from '../lib/i18n.js';
import { fixReminder, reminderHealth } from '../store/notify.js';
import Icon from './Icon.jsx';

export default function ReminderCheck({ fixLabel = 'remind.check.fix', onFixed } = {}) {
  const [rows, setRows] = useState(null);
  const check = useCallback(() => { reminderHealth().then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => {
    check();
    const again = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [check]);
  if (!rows || !rows.length) return null;
  const fix = async (row) => {
    await fixReminder(row.fix);
    const next = await reminderHealth().catch(() => []);
    setRows(next);
    onFixed?.(row, next);
  };
  return (
    <>
      {rows.map((row) => (
        <div key={row.key}>
          <div className="list-row">
            <Icon name={row.ok === false ? 'alert' : row.ok ? 'check' : 'info'} />
            <div className="grow">
              <div>{t(`remind.check.${row.key}`)}</div>
              <div className="meta">{row.ok === false ? t(`remind.check.${row.key}Off`) : row.ok ? t('remind.check.ok') : t(`remind.guide.${row.guide}`)}</div>
            </div>
            {row.ok === true ? null : <button type="button" className="btn small" onClick={() => fix(row)}>{t(row.fix === 'autostart' ? 'remind.check.how' : fixLabel)}</button>}
          </div>
        </div>
      ))}
    </>
  );
}
