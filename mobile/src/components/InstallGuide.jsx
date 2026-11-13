import { useState } from 'react';

import { guideFor, INSTALL_GUIDE } from '../lib/installGuide.js';
import { t } from '../lib/i18n.js';

/** A small drawn phone with the thing to tap picked out. Our own CSS, no
 * image files and no copies of another company's screens. */
function StepCard({ card, label }) {
  return (
    <div className={`guide-card ${card}`} aria-hidden="true">
      <div className="guide-phone">
        {card === 'file' ? <><span className="guide-line" /><span className="guide-pick">{label}</span><span className="guide-line" /></> : null}
        {card === 'switch' ? <><span className="guide-line" /><span className="guide-pick guide-switch"><span>{label}</span><i /></span></> : null}
        {card === 'button' ? <><span className="guide-line" /><span className="guide-line short" /><span className="guide-pick">{label}</span></> : null}
        {card === 'over' ? <><span className="guide-old" /><span className="guide-pick">{label}</span></> : null}
      </div>
    </div>
  );
}

/** Install and update help (UPD-1): pick the phone, read 3 to 5 steps. */
export default function InstallGuide() {
  const [brand, setBrand] = useState(INSTALL_GUIDE[0].key);
  const guide = guideFor(brand);
  return (
    <div className="guide">
      <div className="seg" role="tablist" aria-label={t('install.pick')}>
        {INSTALL_GUIDE.map((b) => (
          <button key={b.key} type="button" role="tab" aria-selected={b.key === guide.key} className={b.key === guide.key ? 'on' : ''} onClick={() => setBrand(b.key)}>{t(b.title)}</button>
        ))}
      </div>
      <ol className="guide-steps">
        {guide.steps.map((s, i) => (
          <li key={s.key}>
            <span className="guide-n" aria-hidden="true">{i + 1}</span>
            <div className="grow">{t(s.key)}</div>
            <StepCard card={s.card} label={t(s.label)} />
          </li>
        ))}
      </ol>
      <p className="muted small" style={{ margin: '10px 4px 0' }}>{t('install.note')}</p>
    </div>
  );
}
