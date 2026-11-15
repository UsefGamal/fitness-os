import { useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { t } from '../lib/i18n.js';
import { pinWidget } from '../store/native.js';

// Each step: its icon and where a tap takes you.
const STEP = {
  workout: { icon: 'dumbbell', to: '/workout' },
  meal: { icon: 'meals', to: '/meals' },
  weigh: { icon: 'scale' },
  backup: { icon: 'download', to: '/settings/data' },
  widget: { icon: 'home' },
};

/** The first-week card on Home (FIRST-1): the steps from lib/firstWeek.js,
 * a tap on one that's still to do goes and does it, ✕ hides the card. The
 * widget step asks the launcher to pin it; where the launcher can't, three
 * numbered steps explain the long-press way, with "I added it". */
export default function FirstWeekCard({ steps, onWeigh, onHide, onWidgetDone, onPinAsked }) {
  const navigate = useNavigate();
  const [widgetHelp, setWidgetHelp] = useState(false);
  const done = steps.filter((s) => s.done).length;
  const go = async (key) => {
    if (key === 'weigh') return onWeigh();
    if (key === 'widget') {
      if (await pinWidget()) onPinAsked();
      else setWidgetHelp(true);
      return undefined;
    }
    navigate(STEP[key].to);
    return undefined;
  };
  return (
    <section className="card first-week" aria-labelledby="first-week-title">
      <div className="row between">
        <div className="grow">
          <strong id="first-week-title">{t('first.title')}</strong>
          <div className="muted small">{t('first.count', { done, all: steps.length })}</div>
        </div>
        <button type="button" className="icon-btn" aria-label={t('first.hide')} onClick={onHide}><Icon name="x" /></button>
      </div>
      <div className="progress" style={{ margin: '10px 0 6px' }} aria-hidden="true"><span style={{ transform: `scaleX(${steps.length ? done / steps.length : 0})` }} /></div>
      <ul className="first-steps">
        {steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <div className="list-row first-step done">
                <span className="first-tick on" aria-hidden="true"><Icon name="check" /></span>
                <span className="grow">{t(`first.${s.key}`)}<span className="sr-only">{t('first.doneSr')}</span></span>
              </div>
            ) : (
              <button type="button" className="list-row first-step" onClick={() => go(s.key)}>
                <span className="first-tick" aria-hidden="true"><Icon name={STEP[s.key].icon} /></span>
                <span className="grow">{t(`first.${s.key}`)}</span>
                <Icon name="chev" className="icon chev" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {widgetHelp ? (
        <Sheet title={t('first.widgetTitle')} onClose={() => setWidgetHelp(false)}>
          <ol className="first-how">
            <li><span className="first-num" aria-hidden="true">1</span><span>{t('first.widgetStep1')}</span></li>
            <li><span className="first-num" aria-hidden="true">2</span><span>{t('first.widgetStep2')}</span></li>
            <li><span className="first-num" aria-hidden="true">3</span><span>{t('first.widgetStep3')}</span></li>
          </ol>
          <button type="button" className="btn" onClick={() => { onWidgetDone(); setWidgetHelp(false); }}><Icon name="check" /> {t('first.widgetDone')}</button>
        </Sheet>
      ) : null}
    </section>
  );
}
