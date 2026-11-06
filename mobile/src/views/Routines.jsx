import { useState } from 'react';
import { useNavigate } from 'react-router';

import ConfirmSheet from '../components/ConfirmSheet.jsx';
import Icon from '../components/Icon.jsx';
import { todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { activeBlock } from '../lib/plan.js';
import { routinesOf, startRoutine, trainingDays } from '../lib/routines.js';
import { content, useData } from '../store/useData.js';

const SHORT = { sunday: 'short.sun', monday: 'short.mon', tuesday: 'short.tue', wednesday: 'short.wed', thursday: 'short.thu', friday: 'short.fri', saturday: 'short.sat' };

/** Ready-made routines (E4-S18): pick a plan, see its week, switch to it. */
export default function Routines() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const running = activeBlock(data)?.template_id;
  const list = routinesOf(content);
  const use = (r) => {
    update((d) => startRoutine(d, content, r.id, todayISO()));
    navigate('/plan');
  };

  return (
    <div className="page">
      <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate('/plan')}><Icon name="back" /> {t('routines.back')}</button>
      <h1 className="page-title">{t('routines.title')}</h1>
      <p className="page-sub">{t('routines.sub')}</p>
      <div className="stack" style={{ gap: 10 }}>
        {list.map((r) => {
          const isOpen = open === r.id;
          const days = trainingDays(r);
          return (
            <section key={r.id} className="list" style={{ margin: 0 }}>
              <button type="button" className="list-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <div className="grow">
                  <div>{r.name}{r.id === running ? <span className="chip small" style={{ marginInlineStart: 8 }}>{t('routines.running')}</span> : null}</div>
                  <div className="meta small">
                    {t('routines.days', { n: r.days })}
                    {r.place === 'home' ? ` · ${t('routines.home')}` : ` · ${t('routines.gym')}`}
                    {r.level ? ` · ${t(`routines.level.${r.level}`)}` : ''}
                  </div>
                </div>
                <span className="chev" style={{ display: 'inline-flex', transform: isOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }}><Icon name="chev" /></span>
              </button>
              {isOpen ? (
                <div style={{ padding: '4px 16px 14px' }}>
                  {r.about ? <p className="small" style={{ margin: '0 0 8px' }}>{r.about}</p> : null}
                  <p className="muted small" style={{ margin: '0 0 8px' }}>{days.map((d) => t(SHORT[d])).join(' · ')}</p>
                  <ul className="small" style={{ margin: '0 0 12px', paddingInlineStart: 18 }}>
                    {r.program.map((s) => (
                      <li key={s.key}><strong>{s.label}</strong>: {s.focus} {t('routines.moves', { n: s.exercises.length })}</li>
                    ))}
                  </ul>
                  {r.id === running ? (
                    <p className="muted small" style={{ margin: 0 }}>{t('routines.isRunning')}</p>
                  ) : (
                    <button type="button" className="btn" onClick={() => setConfirm(r)}>{t('routines.use')}</button>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: '12px 4px' }}>{t('routines.swapNote')}</p>
      {confirm ? (
        <ConfirmSheet
          title={t('routines.confirmTitle', { name: confirm.name })}
          body={t('routines.confirmBody')}
          action={t('routines.use')}
          danger={false}
          onConfirm={() => use(confirm)}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
