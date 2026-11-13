import { useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import { betterRoutine, checkInExercises, finishCheckIn } from '../lib/checkIn.js';
import * as D from '../lib/data.js';
import { t } from '../lib/i18n.js';
import { activePlan } from '../lib/plan.js';
import * as P from '../lib/planEdit.js';
import { routineById, startRoutine } from '../lib/routines.js';
import { content, useData } from '../store/useData.js';
import { useToday } from '../store/today.js';
import { SwapSheet } from './MyRoutine.jsx';

/** The 8-week plan check-in (/plan/checkin): a better plan if one fits,
 * then each exercise to keep or swap. */
export default function CheckIn() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  const navigate = useNavigate();
  const [better] = useState(() => betterRoutine(data, content));
  const [step, setStep] = useState(better ? 'plan' : 0);
  const [swapping, setSwapping] = useState(false);
  const list = checkInExercises(data, content);
  const done = () => { update((d) => finishCheckIn(d)); navigate('/plan'); };
  const back = <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0, width: 'auto' }} onClick={() => navigate('/plan')}><Icon name="back" /> {t('checkin.back')}</button>;

  if (step === 'plan') {
    const r = routineById(content, better);
    return (
      <div className="page">
        {back}
        <h1 className="page-title">{t('checkin.title')}</h1>
        <p className="page-sub">{t('checkin.planSub')}</p>
        <div className="card stack">
          <strong>{r.name}</strong>
          <div className="small">{t(`why.${r.id}`)}</div>
          <div className="muted small">{t('setup.daysAWeek', { n: r.days })}</div>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => { update((d) => finishCheckIn(startRoutine(d, content, r.id, today))); navigate('/plan'); }}>{t('checkin.switch', { name: r.name })}</button>
          <button type="button" className="btn secondary" onClick={() => setStep(0)}>{t('checkin.keepPlan')}</button>
        </div>
      </div>
    );
  }

  const item = list[step];
  if (!item) {
    return (
      <div className="page">
        {back}
        <h1 className="page-title">{t('checkin.doneTitle')}</h1>
        <p className="page-sub">{t('checkin.doneSub')}</p>
        <button type="button" className="btn" onClick={done}>{t('checkin.finish')}</button>
      </div>
    );
  }
  const T = activePlan(data, content);
  const pick = (p) => {
    update((d) => P.swapExercise(D.exerciseByName(d, p.name) ? d : D.addCustomExercise(d, { name: p.name, muscle_group: p.group || 'Other', equipment: p.equipment ?? null }), item.key, T, item.index, p.name));
    setSwapping(false);
    setStep(step + 1);
  };
  return (
    <div className="page">
      {back}
      <h1 className="page-title">{t('checkin.title')}</h1>
      <p className="page-sub">{t('checkin.exSub')}</p>
      <div className="muted small" role="status">{t('checkin.count', { n: step + 1, of: list.length })} · {item.label}</div>
      <div className="card" style={{ marginTop: 8 }}><div className="session-name">{item.name}</div></div>
      <div className="row" style={{ gap: 10, marginTop: 12 }}>
        <button type="button" className="btn secondary grow" onClick={() => setStep(step + 1)}><Icon name="check" /> {t('checkin.keep')}</button>
        <button type="button" className="btn grow" onClick={() => setSwapping(true)}><Icon name="dumbbell" /> {t('checkin.swap')}</button>
      </div>
      <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={done}>{t('checkin.finishNow')}</button>
      {swapping ? <SwapSheet data={data} name={item.name} others={list.filter((x) => x.key === item.key).map((x) => x.name)} onPick={pick} onClose={() => setSwapping(false)} /> : null}
    </div>
  );
}

