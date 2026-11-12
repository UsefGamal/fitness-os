import { t } from '../lib/i18n.js';
import Icon from './Icon.jsx';
import Sheet, { useCloseSheet } from './Sheet.jsx';

function Body({ notes }) {
  const close = useCloseSheet();
  return (
    <div className="stack">
      {notes.map((n) => (
        <div key={n.version}>
          {notes.length > 1 ? <div className="section-label" style={{ marginTop: 0 }}>{t('whatsNew.version', { v: n.version })}</div> : null}
          <ul className="whats-new">
            {n.items.map((it) => (
              <li key={it.text}><Icon name={it.icon} className="icon tone-accent" /><span>{it.text}</span></li>
            ))}
          </ul>
        </div>
      ))}
      <button type="button" className="btn" onClick={close}>{t('whatsNew.ok')}</button>
    </div>
  );
}

/** What changed since this phone last looked (E1-S6). `notes` is newest
 * first; with one version its number goes in the title. */
export default function WhatsNewSheet({ notes, onClose }) {
  const title = notes.length === 1 ? t('whatsNew.titleV', { v: notes[0].version }) : t('whatsNew.title');
  return (
    <Sheet title={title} onClose={onClose}>
      <Body notes={notes} />
    </Sheet>
  );
}
