// Shown when the app couldn't load the data at start (TL-03, QA-08):
// never a black screen, and never Setup as if the phone were new. Nothing
// is written until the person restores a snapshot.
import { useEffect, useState } from 'react';

import { formatDate, todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { currentReport } from '../store/errors.js';
import { shareText, shareTextFile } from '../store/share.js';
import { listSnapshots, readSnapshot } from '../store/snapshots.js';
import { useData } from '../store/useData.js';

export default function RecoveryScreen({ kind }) {
  const rawCopies = useData((s) => s.rawCopies);
  const recoverFrom = useData((s) => s.recoverFrom);
  const [snaps, setSnaps] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { listSnapshots().then((s) => setSnaps(s.slice(0, 3))).catch(() => {}); }, []);
  const copy = rawCopies.reduce((a, b) => (b.length > a.length ? b : a), '');
  const save = async () => {
    try {
      const r = await shareTextFile(t('recover.copyTitle'), `fitness-os-recovery-${todayISO()}.json`, copy);
      setMsg(r === 'shared' ? t('recover.copyShared') : t('recover.copyDownloaded'));
    } catch {
      setMsg(t('recover.copyFailed'));
    }
  };
  const restore = async (name) => {
    const text = await readSnapshot(name);
    if (!text) { setMsg(t('recover.snapBad')); return; }
    try {
      await recoverFrom(text);
      // Start again from the top, so reminders, the widget and the rest of
      // the start-up run on the restored data. localStorage is already
      // written (with a newer saved_at than the unreadable copy).
      window.location.reload();
    } catch {
      setMsg(t('recover.snapBad'));
    }
  };
  return (
    <div className="page" role="alert">
      <h1 className="page-title">{t('recover.title')}</h1>
      <p className="page-sub">{t(kind === 'unreadable' ? 'recover.unreadable' : 'recover.failed')}</p>
      {msg ? <div className="card small" role="status">{msg}</div> : null}
      <div className="stack">
        {copy ? <button type="button" className="btn" onClick={save}>{t('recover.copy')}</button> : null}
        {snaps.length ? <div className="section-label">{t('recover.snapsLabel')}</div> : null}
        {snaps.length ? (
          <div className="list">
            {snaps.map((s) => (
              <button key={s.name} type="button" className="list-row" onClick={() => restore(s.name)}>
                <div className="grow"><div>{s.label} · {formatDate(todayISO(new Date(s.at)))}</div><div className="meta small">{t('recover.snapNote')}</div></div>
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="btn secondary" onClick={() => shareText(t('recover.reportTitle'), currentReport())}>{t('crash.report')}</button>
        <button type="button" className="btn ghost" onClick={() => window.location.reload()}>{t('crash.reload')}</button>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>{t('recover.note')}</p>
    </div>
  );
}
