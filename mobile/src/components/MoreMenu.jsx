// The "⋯" button and its sheet (E6-S3): rare and destructive actions live
// here, out of the thumb's path, instead of beside everyday buttons.
import { useState } from 'react';

import { t } from '../lib/i18n.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

/** actions: [{ key, label, note?, icon?, danger?, onClick }] */
export default function MoreMenu({ title, actions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="icon-btn more-btn" aria-label={t('more.label')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <div className="list">
            {actions.map((a) => (
              <button key={a.key} type="button" className={`list-row${a.danger ? ' danger' : ''}`} onClick={() => { setOpen(false); a.onClick(); }}>
                {a.icon ? <Icon name={a.icon} /> : null}
                <div className="grow"><div>{a.label}</div>{a.note ? <div className="meta">{a.note}</div> : null}</div>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
