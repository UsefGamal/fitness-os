import { useState } from 'react';

import SafetyQuestions from '../components/SafetyQuestions.jsx';
import { todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { answeredAll, applyScreening, skipScreening } from '../lib/safety.js';
import { useData } from '../store/useData.js';

/** The safety check on its own screen (SAFE-1): for a phone that was set up
 * before the check existed, a restored older backup, and "Answer again" in
 * Settings. "Not now" keeps every limit on. */
export default function Screening({ onDone, onCancel }) {
  const update = useData((s) => s.update);
  const [answers, setAnswers] = useState({});
  const ready = answeredAll(answers);
  const save = () => { update((d) => applyScreening(d, answers, todayISO())); onDone?.(); };
  const skip = () => { update((d) => skipScreening(d, todayISO())); onDone?.(); };
  return (
    <div className="page setup screening">
      <h1 className="page-title">{t('safety.title')}</h1>
      <p className="page-sub">{t('safety.sub')}</p>
      <SafetyQuestions answers={answers} onChange={setAnswers} />
      <div className="stack" style={{ marginTop: 16 }}>
        <button type="button" className="btn" disabled={!ready} onClick={save}>{t('safety.save')}</button>
        {onCancel
          ? <button type="button" className="btn ghost" onClick={onCancel}>{t('safety.cancel')}</button>
          : <button type="button" className="btn ghost" onClick={skip}>{t('safety.skip')}</button>}
      </div>
      {!onCancel ? <p className="muted small" style={{ marginTop: 12 }}>{t('safety.skipNote')}</p> : null}
    </div>
  );
}
