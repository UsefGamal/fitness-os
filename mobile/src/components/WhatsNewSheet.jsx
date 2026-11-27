import { t } from '../lib/i18n.js';
import Icon from './Icon.jsx';
import Sheet, { useCloseSheet } from './Sheet.jsx';

// A phone many versions behind sees the newest few here; the rest are in
// Help and about (audit REL-1: a 1.0.9 phone would get 45 at once).
export const SHEET_MAX = 5;

function Body({ notes, max }) {
  const close = useCloseSheet();
  const shown = notes.slice(0, max);
  const more = notes.length - shown.length;
  return (
    <div className="stack">
      {shown.map((n) => (
        <div key={n.version}>
          {shown.length > 1 ? <div className="section-label" style={{ marginTop: 0 }}>{t('whatsNew.version', { v: n.version })}</div> : null}
          <ul className="whats-new">
            {n.items.map((it) => (
              <li key={it.text}><Icon name={it.icon} className="icon tone-accent" /><span>{it.text}</span></li>
            ))}
          </ul>
        </div>
      ))}
      {more ? <p className="muted small">{t('whatsNew.more', { n: more })}</p> : null}
      <button type="button" className="btn" onClick={close}>{t('whatsNew.ok')}</button>
    </div>
  );
}

/** What changed since this phone last looked (E1-S6). `notes` is newest
 * first; with one version its number goes in the title. */
export default function WhatsNewSheet({ notes, onClose, max = SHEET_MAX }) {
  const title = notes.length === 1 ? t('whatsNew.titleV', { v: notes[0].version }) : t('whatsNew.title');
  return (
    <Sheet title={title} onClose={onClose}>
      <Body notes={notes} max={max} />
    </Sheet>
  );
}
