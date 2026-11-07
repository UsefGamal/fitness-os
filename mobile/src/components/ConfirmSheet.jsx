import Sheet, { useCloseSheet } from './Sheet.jsx';
import { t } from '../lib/i18n.js';

/** A confirm step as a bottom sheet instead of the browser's confirm()
 * (E6-S4): a plain sentence on what is lost, a red action, and Cancel. */
export default function ConfirmSheet({ title, body, action, onConfirm, onClose, danger = true }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <ConfirmButtons body={body} action={action} onConfirm={onConfirm} onClose={onClose} danger={danger} />
    </Sheet>
  );
}

function ConfirmButtons({ body, action, onConfirm, onClose, danger }) {
  const close = useCloseSheet(onClose);
  return (
    <>
      <p style={{ margin: '0 4px 16px' }}>{body}</p>
      <div className="stack">
        <button type="button" className={danger ? 'btn danger-fill' : 'btn'} onClick={() => { onConfirm(); close(); }}>{action}</button>
        <button type="button" className="btn secondary" onClick={close}>{t('common.cancel')}</button>
      </div>
    </>
  );
}
