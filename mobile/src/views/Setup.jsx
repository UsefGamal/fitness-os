import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import InstallGuide from '../components/InstallGuide.jsx';
import { MARK } from '../lib/brand.js';
import RulerPicker from '../components/RulerPicker.jsx';
import Sheet from '../components/Sheet.jsx';
import WheelPicker from '../components/WheelPicker.jsx';
import { formatDate, todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { APP } from '../lib/version.js';
import { markSeen } from '../lib/whatsNew.js';
import { isTime } from '../lib/times.js';
import { macroTargets } from '../lib/macros.js';
import { routineById } from '../lib/routines.js';
import { DAY_CHOICES, GOALS, JOBS, LIMITS, bodyComplete, finishSetup, isMinor, pickRoutine, setupGoalDate, skipSetup } from '../lib/setup.js';
import {
  afterSafety, ageChoices, ageFor, birthYearFor, goalChange, goalStart, nextStep, pickerStart, prevStep, progressOf,
  projectionPoints, setupSteps,
} from '../lib/setupSteps.js';
import { pushOverlay } from '../lib/overlays.js';
import { finishTour } from '../lib/tour.js';
import { screeningResult } from '../lib/safety.js';
import { content, useData } from '../store/useData.js';

const AGES = ageChoices();
const GOAL_ICON = { lose: 'flame', recomp: 'bolt', maintain: 'heart', gain: 'dumbbell' };
const JOB_ICON = { desk: 'user', feet: 'steps', manual: 'kettlebell' };
// How long a picked card stays lit before the next screen slides in.
const PICK_MS = 180;

/** First-time setup (E5-S2, ONB-2): one question per screen, like a story.
 * A segmented bar on top, Back on every screen, big cards that move on
 * when tapped, a wheel for age and rulers for height and weight, and the
 * goal drawn as a line at the end. Every screen can be skipped. Shown full
 * screen before the app on a fresh install only. Which screens come, in
 * what order, is lib/setupSteps.js. */
export default function Setup({ onDone }) {
  const update = useData((s) => s.update);
  const data = useData((s) => s.data);
  const today = todayISO();
  const [id, setId] = useState('welcome');
  const [dir, setDir] = useState('fwd');
  const [help, setHelp] = useState(false);
  const [a, setA] = useState({ where: 'gym', days: 3, experience: 'new' });
  // The screen a tapped card moves on to, after a short light-up.
  const [pending, setPending] = useState(null);
  useEffect(() => {
    if (!pending) return undefined;
    const id2 = setTimeout(() => { setPending(null); setDir('fwd'); setId(pending); window.scrollTo?.(0, 0); }, PICK_MS);
    return () => clearTimeout(id2);
  }, [pending]);
  const steps = setupSteps(a, today);
  const start = pickerStart(a);

  const go = (to, d = 'fwd') => { setPending(null); setDir(d); setId(to); window.scrollTo?.(0, 0); };
  // Next works out the screens from the answers as they are after this one.
  const next = (patch = {}) => {
    const after = { ...a, ...patch };
    setA(after);
    go(nextStep(setupSteps(after, today), id));
  };
  const back = () => go(prevStep(steps, id), 'back');
  // Android Back goes one screen back and keeps the answers (TL-04). On the
  // first screen it leaves the app as before. Answers stay in memory only.
  useEffect(() => (id !== 'welcome' ? pushOverlay(back) : undefined), [id]);
  // A card lights up, then the next screen comes.
  const pick = (patch) => {
    const after = { ...a, ...patch };
    setA(after);
    setPending(nextStep(setupSteps(after, today), id));
  };
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));

  const minor = isMinor(a, today);
  const noCut = minor || screeningResult(a.screening || {}, a.gender ?? null).gates.no_deficit;
  // A new person has seen nothing older, so there is no "What's new" to
  // show them (the weight given here would otherwise count as history).
  const finish = () => { update((d) => markSeen(finishSetup(d, content, a, today), APP.version)); onDone(); };
  const skipAll = () => { update((d) => markSeen(skipSetup(d, today), APP.version)); onDone(); };
  // Restoring goes straight to the backup page, so no tour on top of it.
  const restore = () => { update((d) => finishTour(skipSetup(d, today), today, { skipped: true })); window.location.hash = '#/settings/data'; onDone(); };

  const routine = routineById(content, pickRoutine(a));
  const goalDate = (a.goal === 'lose' || a.goal === 'recomp') && !noCut ? setupGoalDate(a.weight_kg, a.goal_kg, today) : null;
  const preview = id === 'done' && bodyComplete(a, today) ? macroTargets(finishSetup(data, content, a, today), content.nutrition, today) : null;
  const { at, of } = progressOf(steps, id);
  const safetyKey = id.startsWith('safety:') ? id.slice(7) : null;
  const safetyKeys = steps.filter((s) => s.startsWith('safety:'));

  // Skip on a screen: forget that answer and go on.
  const SKIP = {
    name: () => next({ name: '' }),
    sex: () => next({ gender: null }),
    age: () => next({ birth_year: null }),
    height: () => next({ height_cm: null }),
    weight: () => next({ weight_kg: null, goal_kg: null }),
    goal: () => next({ goal: null, goal_kg: null }),
    goal_weight: () => next({ goal_kg: null }),
    job: () => next({ job: null }),
  };
  const skipSafety = () => { const after = { ...a, screening: null }; setA(after); go(afterSafety(steps)); };
  const onSkip = safetyKey ? skipSafety : SKIP[id];

  const cards = (options, value, onPick) => (
    <div className="story-cards">
      {options.map((o) => (
        <button key={String(o.v)} type="button" className={`story-card${value === o.v ? ' on' : ''}`} aria-pressed={value === o.v} onClick={() => onPick(o.v)}>
          <span className="story-card-icon" aria-hidden="true">{o.glyph ? <span className="story-glyph">{o.glyph}</span> : <Icon name={o.icon} />}</span>
          <span className="grow"><span className="story-card-title">{o.label}</span>{o.note ? <span className="story-card-note">{o.note}</span> : null}</span>
          <Icon name={value === o.v ? 'check' : 'chev'} className={value === o.v ? 'icon' : 'icon chev'} />
        </button>
      ))}
    </div>
  );
  const title = (text, sub) => (
    <>
      <h1 className="story-title">{text}</h1>
      {sub ? <p className="story-sub">{sub}</p> : null}
    </>
  );
  const nextBtn = (onClick, disabled = false, label = t('setup.next')) => (
    <div className="story-foot"><button type="button" className="btn story-next" disabled={disabled} onClick={onClick}>{label}</button></div>
  );

  let body = null;
  if (id === 'welcome') {
    body = (
      <div className="story-welcome">
        <svg className="story-mark" viewBox="0 0 24 24" aria-hidden="true"><path d={MARK} fillRule="evenodd" /></svg>
        {title(t('setup.welcome'), t('setup.welcomeSub'))}
        <div className="stack" style={{ marginTop: 'auto' }}>
          <button type="button" className="btn story-next" onClick={() => next()}>{t('setup.start')}</button>
          <button type="button" className="btn secondary" onClick={restore}><Icon name="download" /> {t('setup.restore')}</button>
          <button type="button" className="btn ghost" onClick={skipAll}>{t('setup.skipAll')}</button>
          <p className="muted small" style={{ margin: '6px 4px 0' }}>{t('setup.private')}</p>
          <button type="button" className="btn ghost small" onClick={() => setHelp(true)}>{t('setup.installHelp')}</button>
        </div>
        {help ? <Sheet title={t('settings.install')} onClose={() => setHelp(false)}><InstallGuide /></Sheet> : null}
      </div>
    );
  } else if (id === 'name') {
    body = (
      <>
        {title(t('story.nameTitle'), t('story.nameSub'))}
        <input className="story-input" type="text" autoComplete="given-name" maxLength={30} aria-label={t('setup.name')} placeholder={t('story.namePlaceholder')} value={a.name ?? ''} onChange={(e) => set('name', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') next(); }} />
        {nextBtn(() => next())}
      </>
    );
  } else if (id === 'sex') {
    body = (
      <>
        {title(t('story.sexTitle'), t('story.sexSub'))}
        {cards([
          { v: 'male', label: t('setup.male'), glyph: '♂' },
          { v: 'female', label: t('setup.female'), glyph: '♀' },
        ], a.gender, (v) => pick({ gender: v }))}
      </>
    );
  } else if (id === 'age') {
    const age = ageFor(a.birth_year, today) ?? start.age;
    body = (
      <>
        {title(t('story.ageTitle'), t('story.ageSub'))}
        <WheelPicker value={age} options={AGES} unit={t('story.years')} label={t('story.ageTitle')} onChange={(v) => set('birth_year', birthYearFor(v, today))} />
        {age < 18 ? <p className="story-note">{t('setup.minorNote')}</p> : null}
        {nextBtn(() => next({ birth_year: birthYearFor(age, today) }))}
      </>
    );
  } else if (id === 'height') {
    const h = a.height_cm ?? start.height_cm;
    body = (
      <>
        {title(t('story.heightTitle'))}
        <RulerPicker value={h} min={LIMITS.height_cm[0]} max={LIMITS.height_cm[1]} step={1} major={10} unit={t('story.cm')} label={t('setup.height')} onChange={(v) => set('height_cm', v)} />
        {nextBtn(() => next({ height_cm: h }))}
      </>
    );
  } else if (id === 'weight') {
    const w = a.weight_kg ?? start.weight_kg;
    body = (
      <>
        {title(t('story.weightTitle'), t('story.weightSub'))}
        <RulerPicker value={w} min={LIMITS.weight_kg[0]} max={LIMITS.weight_kg[1]} step={0.1} major={1} nudge={0.5} decimals={1} unit={t('story.kg')} label={t('setup.weight')} onChange={(v) => set('weight_kg', v)} />
        {nextBtn(() => next({ weight_kg: w, goal_kg: a.goal_kg != null && a.goal_kg >= w ? null : a.goal_kg }))}
      </>
    );
  } else if (safetyKey) {
    const n = safetyKeys.indexOf(id) + 1;
    const answers = a.screening || {};
    body = (
      <>
        <div className="story-eyebrow">{t('story.safetyCount', { n, of: safetyKeys.length })}</div>
        {title(t(`safety.q.${safetyKey}`), n === 1 ? t('story.safetySub') : null)}
        {cards([
          { v: false, label: t('safety.no'), icon: 'check' },
          { v: true, label: t('safety.yes'), icon: 'alert' },
        ], answers[safetyKey], (v) => pick({ screening: { ...answers, [safetyKey]: v } }))}
      </>
    );
  } else if (id === 'goal') {
    const goalNote = minor ? 'setup.minorGoal' : noCut ? 'safety.noCutGoal' : null;
    const goals = GOALS.filter((g) => !minor || (g !== 'lose' && g !== 'recomp'));
    body = (
      <>
        {title(t('story.goalTitle'))}
        {cards(goals.map((g) => ({ v: g, label: t(`setup.goal.${g}`), note: t(`setup.goalNote.${g}`), icon: GOAL_ICON[g] })), a.goal, (v) => pick({ goal: v, goal_kg: v === 'lose' || v === 'recomp' ? a.goal_kg : null }))}
        {goalNote ? <p className="story-note">{t(goalNote)}</p> : null}
      </>
    );
  } else if (id === 'goal_weight') {
    const top = Math.round((a.weight_kg - 0.5) * 10) / 10;
    const g = Math.min(a.goal_kg ?? goalStart(a.weight_kg), top);
    const change = goalChange(a.weight_kg, g);
    body = (
      <>
        {title(t('story.goalWeightTitle'), t('story.goalWeightSub'))}
        <RulerPicker value={g} min={LIMITS.weight_kg[0]} max={top} step={0.5} major={5} nudge={0.5} decimals={1} unit={t('story.kg')} label={t('setup.goalWeight')} onChange={(v) => set('goal_kg', v)} />
        {change ? (
          <div className="story-info"><Icon name="trend" /><div>{t('story.goalChange', change)}{change.pct > 20 ? ` ${t('story.goalBig')}` : ''}</div></div>
        ) : null}
        {nextBtn(() => next({ goal_kg: g }))}
      </>
    );
  } else if (id === 'projection') {
    body = (
      <>
        <h1 className="story-title center">{t('story.projTitle', { kg: a.goal_kg, date: formatDate(goalDate) })}</h1>
        <p className="story-sub center">{t('story.projSub')}</p>
        <GoalChart from={a.weight_kg} to={a.goal_kg} date={goalDate} />
        <div className="story-info"><Icon name="info" /><div>{t('story.projNote')}</div></div>
        {nextBtn(() => next())}
      </>
    );
  } else if (id === 'where') {
    body = (
      <>
        {title(t('story.whereTitle'))}
        {cards([
          { v: 'gym', label: t('setup.gym'), note: t('story.gymNote'), icon: 'barbell' },
          { v: 'home', label: t('setup.home'), note: t('story.homeNote'), icon: 'home' },
        ], a.where, (v) => pick({ where: v }))}
      </>
    );
  } else if (id === 'experience') {
    body = (
      <>
        {title(t('story.expTitle'))}
        {cards([
          { v: 'new', label: t('setup.expNew'), note: t('setup.expNewNote'), icon: 'sunrise' },
          { v: 'some', label: t('setup.expSome'), note: t('setup.expSomeNote'), icon: 'medal' },
        ], a.experience, (v) => pick({ experience: v }))}
      </>
    );
  } else if (id === 'days') {
    const i = DAY_CHOICES.indexOf(a.days);
    const step = (d) => () => set('days', DAY_CHOICES[Math.min(DAY_CHOICES.length - 1, Math.max(0, i + d))]);
    body = (
      <>
        {title(t('story.daysTitle'), t('story.daysSub'))}
        <div className="story-days" role="group" aria-label={t('setup.days')}>
          <button type="button" className="story-round" aria-label={t('aria.less', { label: t('setup.days') })} disabled={i <= 0} onClick={step(-1)}><Icon name="minus" /></button>
          <div className="story-big" aria-live="polite">{a.days === 5 ? '5+' : a.days}</div>
          <button type="button" className="story-round" aria-label={t('aria.more', { label: t('setup.days') })} disabled={i >= DAY_CHOICES.length - 1} onClick={step(1)}><Icon name="plus" /></button>
        </div>
        <div className="story-days-label">{t('story.daysLabel')}</div>
        {routine ? (
          <div className="story-info"><Icon name="dumbbell" /><div><div className="muted small">{t('setup.yourPlan')}</div><strong>{routine.name}</strong><div className="small" style={{ marginTop: 2 }}>{t(`why.${routine.id}`)}</div></div></div>
        ) : null}
        {nextBtn(() => next())}
      </>
    );
  } else if (id === 'job') {
    body = (
      <>
        {title(t('setup.job'), t('setup.jobNote'))}
        {cards(JOBS.map((j) => ({ v: j, label: t(`job.${j}`), note: t(`story.jobNote.${j}`), icon: JOB_ICON[j] })), a.job, (v) => pick({ job: v }))}
      </>
    );
  } else if (id === 'time') {
    body = (
      <>
        {title(t('setup.time'), t('setup.timeNote'))}
        {a.session_varies ? null : (
          <input className="story-input story-time" type="time" step="300" aria-label={t('setup.time')} value={a.session_time ?? content.training.session_time} onChange={(e) => isTime(e.target.value) && set('session_time', e.target.value)} />
        )}
        <label className="story-check">
          <input type="checkbox" checked={Boolean(a.session_varies)} onChange={(e) => set('session_varies', e.target.checked)} />
          <span>{t('setup.varies')}</span>
        </label>
        {nextBtn(() => next())}
      </>
    );
  } else if (id === 'done') {
    body = (
      <>
        {title(a.name?.trim() ? t('story.doneTitleName', { name: a.name.trim() }) : t('setup.doneTitle'), t('story.doneSub'))}
        <div className="list">
          <div className="list-row"><Icon name="dumbbell" /><div className="grow"><div>{routine?.name}</div><div className="meta small">{t('setup.daysAWeek', { n: routine?.days })}</div></div></div>
          {preview ? (
            <div className="list-row"><Icon name="meals" /><div className="grow"><div>{t('setup.protein', { g: preview.protein })}</div><div className="meta small">{t('setup.kcal', { kcal: preview.kcal })}</div></div></div>
          ) : (
            <div className="list-row"><Icon name="user" /><div className="grow"><div>{t('setup.noBody')}</div><div className="meta small">{t('setup.noBodyNote')}</div></div></div>
          )}
          {goalDate ? (
            <div className="list-row"><Icon name="trend" /><div className="grow"><div>{t('story.doneGoal', { kg: a.goal_kg })}</div><div className="meta small">{t('story.doneGoalDate', { date: formatDate(goalDate) })}</div></div></div>
          ) : null}
          {a.screening === null ? (
            <div className="list-row"><Icon name="lock" /><div className="grow"><div>{t('story.doneSafetySkipped')}</div><div className="meta small">{t('safety.skipNote')}</div></div></div>
          ) : null}
        </div>
        <p className="muted small" style={{ margin: '12px 4px 0' }}>{t('setup.changeLater')}</p>
        {nextBtn(finish, false, t('setup.go'))}
      </>
    );
  }

  return (
    <div className="page setup story">
      {id !== 'welcome' ? (
        <div className="story-top">
          <div className="story-bar" role="progressbar" aria-label={t('setup.step', { n: at + 1, of })} aria-valuemin={1} aria-valuemax={of} aria-valuenow={at + 1}>
            {steps.filter((s) => s !== 'welcome').map((s, i) => <span key={s} className={i < at ? 'done' : i === at ? 'now' : ''} />)}
          </div>
          <div className="story-nav">
            <button type="button" className="story-round" aria-label={t('setup.back')} onClick={back}><Icon name="back" /></button>
            {onSkip ? <button type="button" className="btn ghost small story-skip" onClick={onSkip}>{safetyKey ? t('story.skipSafety') : t('story.skip')}</button> : null}
          </div>
        </div>
      ) : null}
      <div key={id} className={`story-step ${dir}`}>{body}</div>
    </div>
  );
}

/** The goal line: weight now on the left, goal and its date on the right. */
function GoalChart({ from, to, date }) {
  const W = 320;
  const H = 170;
  const pad = { l: 12, r: 12, t: 34, b: 26 };
  const pts = projectionPoints(from, to);
  const x = (p) => pad.l + p.x * (W - pad.l - pad.r);
  const y = (kg) => pad.t + ((from - kg) / (from - to || 1)) * (H - pad.t - pad.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.at(-1)).toFixed(1)} ${H - pad.b} L${pad.l} ${H - pad.b} Z`;
  return (
    <figure className="story-chart" aria-label={t('story.projAria', { from, to, date: formatDate(date) })}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id="story-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#story-fill)" />
        <path className="story-chart-line" d={line} pathLength="100" />
        <circle cx={x(pts[0])} cy={y(from)} r="5" className="story-dot start" />
        <circle cx={x(pts.at(-1))} cy={y(to)} r="6" className="story-dot end" />
        <text x={x(pts[0]) + 2} y={y(from) - 12} className="story-tag">{`${from} ${t('story.kg')}`}</text>
        <text x={x(pts.at(-1)) - 2} y={y(to) - 14} className="story-tag end" textAnchor="end">{`${to} ${t('story.kg')}`}</text>
        <text x={pad.l} y={H - 6} className="story-axis">{t('story.today')}</text>
        <text x={W - pad.r} y={H - 6} className="story-axis" textAnchor="end">{formatDate(date)}</text>
      </svg>
    </figure>
  );
}
