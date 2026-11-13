import { useState } from 'react';

import { MIN_PASSPHRASE, passphraseProblem } from '../lib/backupCrypto.js';
import { t } from '../lib/i18n.js';
import { setRecoveryPassphrase, unlockBackup } from '../store/autoBackup.js';
import Sheet from './Sheet.jsx';

/** A passphrase box, with Show so a long phrase can be checked on a phone. */
function PassField({ label, value, onChange, show, autoComplete }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** BAK-1: set the recovery passphrase for a cloud folder. Saving makes the
 * first encrypted backup and opens it again with the passphrase alone;
 * only a match leaves backup on. */
export function SetPassphraseSheet({ onClose, onMsg }) {
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const problem = passphraseProblem(pass, again);
  const save = async () => {
    setTried(true);
    if (problem || busy) return;
    setBusy(true);
    try {
      const out = await setRecoveryPassphrase(pass);
      onMsg(t(out.ok ? 'pass.done' : 'pass.failed'));
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t('pass.title')} onClose={busy ? () => {} : onClose}>
      <p className="muted" style={{ marginTop: 0 }}>{t('pass.body')}</p>
      <p className="small warn" role="note">{t('pass.warn')}</p>
      <div className="stack">
        <PassField label={t('pass.label', { n: MIN_PASSPHRASE })} value={pass} onChange={setPass} show={show} autoComplete="new-password" />
        <PassField label={t('pass.again')} value={again} onChange={setAgain} show={show} autoComplete="new-password" />
        <label className="row small" style={{ gap: 8, minHeight: 44 }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {t('pass.show')}</label>
        <div className="muted small">{t('pass.hint')}</div>
        {tried && problem ? <div className="warn" role="alert">{t(`pass.${problem}`, { n: MIN_PASSPHRASE })}</div> : null}
        <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? t('pass.working') : t('pass.save')}</button>
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>{t('pass.cancel')}</button>
      </div>
    </Sheet>
  );
}

/** Open an encrypted backup with its recovery passphrase. */
export function UnlockSheet({ text, onOpen, onClose }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const open = async () => {
    if (busy || !pass) return;
    setBusy(true);
    setError(null);
    try {
      onOpen(await unlockBackup(text, pass));
    } catch (err) {
      setError(err?.code === 'wrong_passphrase' ? 'unlock.wrong' : 'unlock.damaged');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t('unlock.title')} onClose={busy ? () => {} : onClose}>
      <p className="muted" style={{ marginTop: 0 }}>{t('unlock.body')}</p>
      <div className="stack">
        <PassField label={t('unlock.label')} value={pass} onChange={setPass} show={false} autoComplete="current-password" />
        {error ? <div className="warn" role="alert">{t(error)}</div> : null}
        <button type="button" className="btn" onClick={open} disabled={busy || !pass}>{busy ? t('unlock.working') : t('unlock.open')}</button>
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>{t('pass.cancel')}</button>
      </div>
    </Sheet>
  );
}
