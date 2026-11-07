// The one-time permissions step on the first open (Yusuf, 7 Nov 2026):
// notifications, exact alarms and battery, plus the maker's autostart steps,
// each with an Allow button. Answering it (Allow or Not now) is remembered,
// and Settings > Reminders keeps the same rows for later.
import { content, useData } from '../store/useData.js';
import { scheduleReminders } from '../store/notify.js';
import { markPermissionsAsked } from '../lib/reminderHealth.js';
import { t } from '../lib/i18n.js';
import ReminderCheck from './ReminderCheck.jsx';
import Sheet from './Sheet.jsx';

export default function PermissionsSheet({ onDone }) {
  const update = useData((s) => s.update);
  const close = () => { update(markPermissionsAsked); onDone(); };
  // Allowing notifications here also switches reminders on.
  const onFixed = (row, rows) => {
    if (row.fix !== 'notifications') return;
    if (!rows.some((r) => r.key === 'notifications' && r.ok === true)) return;
    update((d) => ({ ...d, settings: { ...d.settings, notifications: true } }));
    scheduleReminders(content, true).catch(() => {});
  };
  return (
    <Sheet title={t('perms.title')} onClose={close}>
      <p className="muted small" style={{ margin: '0 4px 12px' }}>{t('perms.intro')}</p>
      <div className="list">
        <ReminderCheck fixLabel="perms.allow" onFixed={onFixed} />
      </div>
      <p className="muted small" style={{ margin: '0 4px 12px' }}>{t('perms.later')}</p>
      <button type="button" className="btn" onClick={close}>{t('perms.continue')}</button>
    </Sheet>
  );
}
