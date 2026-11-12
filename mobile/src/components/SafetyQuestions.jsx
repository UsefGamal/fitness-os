import { t } from '../lib/i18n.js';
import { QUESTIONS } from '../lib/safety.js';

/** The safety check's yes/no questions (SAFE-1). `answers` is
 * { key: true | false }; it lives in the caller's memory only and is never
 * saved. */
export default function SafetyQuestions({ answers, onChange }) {
  const pick = (key, value) => () => onChange({ ...answers, [key]: value });
  return (
    <div className="safety-list">
      {QUESTIONS.map((q) => (
        <div key={q.key} className="safety-q" role="group" aria-label={t(`safety.q.${q.key}`)}>
          <div className="safety-text">{t(`safety.q.${q.key}`)}</div>
          <div className="seg safety-seg">
            <button type="button" className={answers[q.key] === true ? 'on' : ''} aria-pressed={answers[q.key] === true} onClick={pick(q.key, true)}>{t('safety.yes')}</button>
            <button type="button" className={answers[q.key] === false ? 'on' : ''} aria-pressed={answers[q.key] === false} onClick={pick(q.key, false)}>{t('safety.no')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
