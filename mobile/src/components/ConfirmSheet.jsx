import Sheet from './Sheet.jsx';
import { t } from '../lib/i18n.js';

/** A confirm step as a bottom sheet instead of the browser's confirm()
 * (E6-S4): a plain sentence on what is lost, a red action, and Cancel. */
export default function ConfirmSheet({ title, body, action, onConfirm, onClose, danger = true }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p style={{ margin: '0 4px 16px' }}>{body}</p>
      <div className="stack">
        <button type="button" className={danger ? 'btn danger-fill' : 'btn'} onClick={() => { onConfirm(); onClose(); }}>{action}</button>
        <button type="button" className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Sheet>
  );
}
