import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import SafetyQuestions from '../components/SafetyQuestions.jsx';
import { todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { isTime } from '../lib/times.js';
import { macroTargets } from '../lib/macros.js';
import { routineById } from '../lib/routines.js';
import { DAY_CHOICES, GOALS, bodyComplete, bodyErrors, finishSetup, isMinor, pickRoutine, skipSetup } from '../lib/setup.js';
import { pushOverlay } from '../lib/overlays.js';
import { answeredAll, screeningResult } from '../lib/safety.js';
import { content, useData } from '../store/useData.js';

const STEPS = 6;

/** First-time setup (E5-S2): five short screens, each one skippable.
 * Shown full screen before the app on a fresh install only. */
export default function Setup({ onDone }) {
  const update = useData((s) => s.update);
  const data = useData((s) => s.data);
  const today = todayISO();
  const [step, setStep] = useState(0);
  const [a, setA] = useState({ where: 'gym', days: 3, experience: 'new' });
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const num = (k) => (e) => set(k, e.target.value === '' ? null : Number(e.target.value));
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  // Android Back goes one step back and keeps the answers (TL-04). On the
  // first step it leaves the app as before. Answers stay in memory only.
  useEffect(() => (0 < step ? pushOverlay(back) : undefined), [step]);
  const errors = bodyErrors(a, today);
  const minor = isMinor(a, today);
  // The safety check can hold calories at maintenance (skipped counts as
  // gated); the goal is still remembered.
  const noCut = minor || screeningResult(a.screening || {}).gates.no_deficit;
  function err(k) {
    if (!errors[k]) return null;
    return <span className="field-error" role="alert">{t(errors[k])}</span>;
  }
  const finish = () => { update((d) => finishSetup(d, content, a, today)); onDone(); };
  const skipAll = () => { update((d) => skipSetup(d, today)); onDone(); };
  const restore = () => { update((d) => skipSetup(d, today)); window.location.hash = '#/settings/data'; onDone(); };
  const choice = (k, v, label, note) => (
    <button key={String(v)} type="button" className={`list-row${a[k] === v ? ' on' : ''}`} aria-pressed={a[k] === v} onClick={() => set(k, v)}>
      <div className="grow"><div>{label}</div>{note ? <div className="meta small">{note}</div> : null}</div>
      {a[k] === v ? <Icon name="check" /> : null}
    </button>
  );
  const routine = routineById(content, pickRoutine(a));
  const preview = step === 5 ? macroTargets(finishSetup(data, content, a, today), content.nutrition, today) : null;

  return (
    <div className="page setup">
      <div className="row between" style={{ alignItems: 'center' }}>
        {step > 0 ? <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0, width: 'auto' }} onClick={back}><Icon name="back" /> {t('setup.back')}</button> : <span />}
        <span className="muted small">{t('setup.step', { n: step + 1, of: STEPS })}</span>
      </div>

      {step === 0 ? (
        <>
          <h1 className="page-title">{t('setup.welcome')}</h1>
          <p className="page-sub">{t('setup.welcomeSub')}</p>
          <div className="stack">
            <button type="button" className="btn" onClick={next}>{t('setup.start')}</button>
            <button type="button" className="btn secondary" onClick={restore}><Icon name="download" /> {t('setup.restore')}</button>
            <button type="button" className="btn ghost" onClick={skipAll}>{t('setup.skipAll')}</button>
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>{t('setup.private')}</p>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h1 className="page-title">{t('setup.aboutTitle')}</h1>
          <p className="page-sub">{t('setup.aboutSub')}</p>
          <label className="field"><span>{t('setup.name')}</span><input type="text" autoComplete="given-name" maxLength={30} value={a.name ?? ''} onChange={(e) => set('name', e.target.value)} /></label>
          <div className="seg" style={{ marginBottom: 12 }} role="group" aria-label={t('setup.sex')}>
            {['male', 'female'].map((g) => <button key={g} type="button" className={a.gender === g ? 'on' : ''} aria-pressed={a.gender === g} onClick={() => set('gender', g)}>{t(`setup.${g}`)}</button>)}
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <label className="field grow"><span>{t('setup.birthYear')}</span><input type="number" inputMode="numeric" value={a.birth_year ?? ''} onChange={num('birth_year')} aria-invalid={Boolean(errors.birth_year)} />{err('birth_year')}</label>
            <label className="field grow"><span>{t('setup.height')}</span><input type="number" inputMode="decimal" value={a.height_cm ?? ''} onChange={num('height_cm')} aria-invalid={Boolean(errors.height_cm)} />{err('height_cm')}</label>
          </div>
          <label className="field"><span>{t('setup.weight')}</span><input type="number" inputMode="decimal" step="0.1" value={a.weight_kg ?? ''} onChange={num('weight_kg')} aria-invalid={Boolean(errors.weight_kg)} />{err('weight_kg')}</label>
          {minor && !errors.birth_year ? <p className="muted small">{t('setup.minorNote')}</p> : null}
          <div className="stack" style={{ marginTop: 12 }}>
            <button type="button" className="btn" disabled={!bodyComplete(a, today)} onClick={next}>{t('setup.next')}</button>
            <button type="button" className="btn ghost" onClick={() => { setA((x) => ({ ...x, gender: null, birth_year: null, height_cm: null, weight_kg: null })); next(); }}>{t('setup.skipStep')}</button>
          </div>
          <p className="muted small">{t('setup.aboutSkipNote')}</p>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h1 className="page-title">{t('safety.title')}</h1>
          <p className="page-sub">{t('safety.sub')}</p>
          <SafetyQuestions answers={a.screening || {}} onChange={(v) => set('screening', v)} />
          <div className="stack" style={{ marginTop: 16 }}>
            <button type="button" className="btn" disabled={!answeredAll(a.screening)} onClick={next}>{t('setup.next')}</button>
            <button type="button" className="btn ghost" onClick={() => { set('screening', null); next(); }}>{t('safety.skip')}</button>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>{t('safety.skipNote')}</p>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h1 className="page-title">{t('setup.goalTitle')}</h1>
          <div className="list">{GOALS.filter((g) => !minor || (g !== 'lose' && g !== 'recomp')).map((g) => choice('goal', g, t(`setup.goal.${g}`), t(`setup.goalNote.${g}`)))}</div>
          {minor ? <p className="muted small">{t('setup.minorGoal')}</p> : noCut && (a.goal === 'lose' || a.goal === 'recomp') ? <p className="muted small">{t('safety.noCutGoal')}</p> : null}
          {(a.goal === 'lose' || a.goal === 'recomp') && a.weight_kg ? (
            <label className="field"><span>{t('setup.goalWeight')}</span><input type="number" inputMode="decimal" step="0.5" value={a.goal_kg ?? ''} onChange={num('goal_kg')} aria-invalid={Boolean(errors.goal_kg)} />{err('goal_kg')}</label>
          ) : null}
          <div className="stack" style={{ marginTop: 12 }}>
            <button type="button" className="btn" disabled={!a.goal || Boolean(errors.goal_kg)} onClick={next}>{t('setup.next')}</button>
            <button type="button" className="btn ghost" onClick={() => { set('goal', null); next(); }}>{t('setup.skipStep')}</button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <h1 className="page-title">{t('setup.trainTitle')}</h1>
          <div className="seg" style={{ marginBottom: 12 }} role="group" aria-label={t('setup.where')}>
            {['gym', 'home'].map((w) => <button key={w} type="button" className={a.where === w ? 'on' : ''} aria-pressed={a.where === w} onClick={() => set('where', w)}>{t(`setup.${w}`)}</button>)}
          </div>
          <div className="section-label">{t('setup.days')}</div>
          <div className="seg" style={{ marginBottom: 12 }} role="group" aria-label={t('setup.days')}>
            {DAY_CHOICES.map((n) => <button key={n} type="button" className={a.days === n ? 'on' : ''} aria-pressed={a.days === n} onClick={() => set('days', n)}>{n === 5 ? '5+' : n}</button>)}
          </div>
          <label className="field"><span>{t('setup.time')}</span><input type="time" step="300" value={a.session_time ?? content.training.session_time} onChange={(e) => isTime(e.target.value) && set('session_time', e.target.value)} /><span className="muted small">{t('setup.timeNote')}</span></label>
          <div className="section-label">{t('setup.experience')}</div>
          <div className="list">
            {choice('experience', 'new', t('setup.expNew'), t('setup.expNewNote'))}
            {choice('experience', 'some', t('setup.expSome'), t('setup.expSomeNote'))}
          </div>
          <section className="card">
            <div className="muted small">{t('setup.yourPlan')}</div>
            <strong>{routine?.name}</strong>
            {routine?.about ? <div className="small" style={{ marginTop: 4 }}>{routine.about}</div> : null}
            <div className="muted small" style={{ marginTop: 6 }}>{t('setup.planNote')}</div>
          </section>
          <button type="button" className="btn" onClick={next}>{t('setup.next')}</button>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <h1 className="page-title">{t('setup.doneTitle')}</h1>
          <div className="list">
            <div className="list-row"><Icon name="dumbbell" /><div className="grow"><div>{routine?.name}</div><div className="meta small">{t('setup.daysAWeek', { n: routine?.days })}</div></div></div>
            {preview && bodyComplete(a, today) ? (
              <div className="list-row"><Icon name="meals" /><div className="grow"><div>{t('setup.protein', { g: preview.protein })}</div><div className="meta small">{t('setup.kcal', { kcal: preview.kcal })}</div></div></div>
            ) : (
              <div className="list-row"><Icon name="user" /><div className="grow"><div>{t('setup.noBody')}</div><div className="meta small">{t('setup.noBodyNote')}</div></div></div>
            )}
          </div>
          <button type="button" className="btn" onClick={finish}>{t('setup.go')}</button>
          <p className="muted small" style={{ marginTop: 12 }}>{t('setup.changeLater')}</p>
        </>
      ) : null}
    </div>
  );
}
