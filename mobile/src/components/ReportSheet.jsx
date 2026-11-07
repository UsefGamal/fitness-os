// The bug report, shown before it's sent (P14-15): the person reads it,
// can edit or cut anything, and adds what they were doing. Capped in
// length so it fits in a chat message.
import { useState } from 'react';

import { capReport, REPORT_MAX } from '../lib/errors.js';
import { t } from '../lib/i18n.js';
import { currentReport } from '../store/errors.js';
import { shareText } from '../store/share.js';
import Sheet from './Sheet.jsx';

/** Room for the person's own words on top of the capped report. */
const EDIT_MAX = REPORT_MAX + 2000;

export default function ReportSheet({ onClose }) {
  const [text, setText] = useState(() => currentReport());
  const [msg, setMsg] = useState('');
  const send = async () => {
    const r = await shareText(t('report.title'), capReport(text, EDIT_MAX));
    if (r === 'copied') setMsg(t('report.copied'));
  };
  return (
    <Sheet title={t('report.title')} onClose={onClose}>
      <p className="muted small" style={{ margin: '0 4px 10px' }}>{t('report.note')}</p>
      <textarea
        aria-label={t('report.title')}
        value={text}
        maxLength={EDIT_MAX}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        spellCheck={false}
        style={{ width: '100%', fontSize: 16, fontFamily: 'ui-monospace, monospace', lineHeight: 1.35 }}
      />
      <p className="muted small" style={{ margin: '6px 4px 10px', textAlign: 'end' }}>{t('report.length', { n: text.length, max: EDIT_MAX })}</p>
      {msg ? <div className="card small" role="status">{msg}</div> : null}
      <button type="button" className="btn" onClick={send}>{t('report.send')}</button>
    </Sheet>
  );
}
