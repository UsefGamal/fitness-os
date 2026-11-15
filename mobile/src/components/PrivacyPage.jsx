import { useState } from 'react';

import { t } from '../lib/i18n.js';
import { DELETE_WORD, deleteConfirmed, PRIVACY_KEYS, privacyState } from '../lib/privacy.js';
import { deleteEverything } from '../store/wipe.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

/** Settings > Privacy (HELP-1, SEC-23): where each copy of your data goes,
 * one line each, what is on now, and Delete everything (SEC-21). */
export default function PrivacyPage({ data, onExport }) {
  const st = privacyState(data);
  const [open, setOpen] = useState(false);
  // Counts go under the line; on and off go in a chip on the right.
  const count = (k) => {
    const r = st[k];
    if (k === 'phone') return t('privacy.phone.count', { workouts: r.workouts, weighIns: r.weighIns });
    if (k === 'photos') return t(r.count === 1 ? 'privacy.photos.one' : 'privacy.photos.count', { n: r.count, lock: t(r.locked ? 'privacy.on' : 'privacy.off').toLowerCase() });
    return '';
  };
  const chip = (k) => (k !== 'photos' && st[k].state ? t(`privacy.${st[k].state}`) : '');
  return (
    <>
      <p className="page-sub">{t('privacy.intro')}</p>
      <div className="list">
        {PRIVACY_KEYS.map((k) => (
          <div key={k} className="list-row privacy-row">
            <div className="grow"><div>{t(`privacy.${k}.title`)}</div><div className="meta">{t(`privacy.${k}.line`)}</div>{count(k) ? <div className="meta privacy-count">{count(k)}</div> : null}</div>
            {chip(k) ? <span className={`chip${st[k].state === 'on' ? ' accent' : ''}`}>{chip(k)}</span> : null}
          </div>
        ))}
      </div>
      <div className="list" style={{ marginTop: 16 }}>
        <button type="button" className="list-row danger" onClick={() => setOpen(true)}>
          <Icon name="trash" /><div className="grow"><div>{t('wipe.title')}</div><div className="meta">{t('wipe.note')}</div></div><Icon name="chev" className="icon chev" />
        </button>
      </div>
      {open ? <WipeSheet data={data} onExport={onExport} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function WipeSheet({ data, onExport, onClose }) {
  const [typed, setTyped] = useState('');
  const [health, setHealth] = useState(true);
  const [backups, setBackups] = useState(true);
  const [busy, setBusy] = useState(false);
  const hc = data.settings?.health?.enabled === true;
  const auto = data.settings?.auto_backup?.on === true;
  const ok = deleteConfirmed(typed) && !busy;
  const go = async () => {
    if (!ok) return;
    setBusy(true);
    await deleteEverything({ health: hc && health, backups: auto && backups });
  };
  return (
    <Sheet title={t('wipe.sheet')} onClose={onClose}>
      <div className="stack">
        <p className="muted">{t('wipe.explain')}</p>
        <button type="button" className="btn secondary" onClick={onExport}><Icon name="download" /> {t('wipe.export')}</button>
        {hc || auto ? (
          <div className="list">
            {hc ? <Choice on={health} onClick={() => setHealth(!health)} label={t('wipe.health')} /> : null}
            {auto ? <Choice on={backups} onClick={() => setBackups(!backups)} label={t('wipe.backups')} /> : null}
          </div>
        ) : null}
        <label className="field">
          <span>{t('wipe.type', { word: DELETE_WORD })}</span>
          <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        </label>
        <button type="button" className="btn danger-fill" disabled={!ok} onClick={go}><Icon name="trash" /> {t('wipe.go')}</button>
        <button type="button" className="btn ghost" onClick={onClose}>{t('wipe.cancel')}</button>
      </div>
    </Sheet>
  );
}

function Choice({ on, onClick, label }) {
  return (
    <button type="button" className="list-row" onClick={onClick} aria-pressed={on}>
      <div className="grow">{label}</div>
      <span className={`check${on ? ' on' : ''}`}>{on ? <Icon name="check" /> : null}</span>
    </button>
  );
}
