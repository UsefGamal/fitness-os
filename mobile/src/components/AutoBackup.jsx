import { useState } from 'react';

import { autoState, backupStatus } from '../lib/autoBackup.js';
import { t } from '../lib/i18n.js';
import { backupNow, canAutoBackup, pickBackupFolder, readNewestBackup, turnOffBackup } from '../store/autoBackup.js';
import { useData } from '../store/useData.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

/** Settings > Your data: automatic backup (BAK-1). onRestore gets the
 * newest backup's text and shows the usual import preview; onMsg shows a
 * line at the top of Settings. */
export default function AutoBackup({ onRestore, onMsg }) {
  const data = useData((s) => s.data);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  if (!canAutoBackup()) return null;
  const state = autoState(data);
  const status = backupStatus(state, new Date());

  const run = async (fn, done) => {
    if (busy) return;
    setBusy(true);
    onMsg('');
    try {
      const out = await fn();
      if (out && !out.last_error && done) onMsg(done);
    } finally {
      setBusy(false);
    }
  };
  const pick = () => run(pickBackupFolder, t('autoBackup.done'));
  const now = () => run(backupNow, t('autoBackup.done'));
  const restore = async () => {
    try {
      const text = await readNewestBackup();
      if (text == null) onMsg(t('autoBackup.restoreNone'));
      else onRestore(text);
    } catch {
      onMsg(t('autoBackup.restoreBad'));
    }
  };
  const off = async (keepFiles) => {
    setAsking(false);
    await turnOffBackup({ keepFiles });
  };

  return (
    <>
      <div className="section-label">{t('autoBackup.title')}</div>
      <div className="list" data-testid="auto-backup">
        {!state.on ? (
          <button type="button" className="list-row" onClick={pick} disabled={busy}><Icon name="download" /><div className="grow"><div>{t('autoBackup.turnOn')}</div><div className="meta">{t('autoBackup.turnOnNote')}</div></div><Icon name="chev" className="icon chev" /></button>
        ) : (
          <>
            <div className="list-row" role="status">
              <Icon name={status.tone === 'ok' ? 'check' : 'alert'} className="icon" style={{ color: status.tone === 'ok' ? 'var(--accent)' : 'var(--warn)' }} />
              <div className="grow">
                <div className={status.tone === 'ok' ? 'tone-accent' : ''}>{busy ? t('autoBackup.working') : t(status.key, status.vars)}</div>
                {state.folder ? <div className="meta">{t('autoBackup.folder', { name: state.folder })}</div> : null}
              </div>
            </div>
            {status.fix === 'pick' ? <button type="button" className="list-row" onClick={pick} disabled={busy}><Icon name="undo" /><div className="grow tone-accent">{t('autoBackup.pickAgain')}</div><Icon name="chev" className="icon chev" /></button> : null}
            {status.fix === 'retry' ? <button type="button" className="list-row" onClick={now} disabled={busy}><Icon name="undo" /><div className="grow tone-accent">{t('autoBackup.retry')}</div><Icon name="chev" className="icon chev" /></button> : null}
            {status.fix == null ? <button type="button" className="list-row" onClick={now} disabled={busy}><Icon name="download" /><div className="grow"><div>{t('autoBackup.now')}</div><div className="meta">{t('autoBackup.nowNote')}</div></div><Icon name="chev" className="icon chev" /></button> : null}
            <button type="button" className="list-row" onClick={restore} disabled={busy}><Icon name="upload" /><div className="grow"><div>{t('autoBackup.restore')}</div><div className="meta">{t('autoBackup.restoreNote')}</div></div><Icon name="chev" className="icon chev" /></button>
            {status.fix !== 'pick' ? <button type="button" className="list-row" onClick={pick} disabled={busy}><Icon name="book" /><div className="grow">{t('autoBackup.other')}</div><Icon name="chev" className="icon chev" /></button> : null}
            <button type="button" className="list-row danger" onClick={() => setAsking(true)} disabled={busy}><Icon name="x" /><div className="grow">{t('autoBackup.turnOff')}</div></button>
          </>
        )}
      </div>
      <p className="muted small" style={{ margin: '-4px 16px 12px' }}>{t('autoBackup.note')}</p>
      {asking ? (
        <Sheet title={t('autoBackup.offTitle')} onClose={() => setAsking(false)}>
          <p className="muted" style={{ marginTop: 0 }}>{t('autoBackup.offBody')}</p>
          <div className="stack">
            <button type="button" className="btn" onClick={() => off(true)}>{t('autoBackup.offKeep')}</button>
            <button type="button" className="btn secondary" onClick={() => off(false)}>{t('autoBackup.offDelete')}</button>
            <button type="button" className="btn ghost" onClick={() => setAsking(false)}>{t('autoBackup.cancel')}</button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
