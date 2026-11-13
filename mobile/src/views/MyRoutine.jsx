import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import ConfirmSheet from '../components/ConfirmSheet.jsx';
import Icon from '../components/Icon.jsx';
import Sheet from '../components/Sheet.jsx';
import Stepper from '../components/Stepper.jsx';
import { entryFor, filterCatalogue, groupOf } from '../lib/catalogue.js';
import { ownedKinds } from '../lib/equipment.js';
import { t } from '../lib/i18n.js';
import { dayGroups } from '../lib/insights.js';
import { isAdvanced, swapOptions } from '../lib/levels.js';
import { musclesIn } from '../lib/muscles.js';
import * as M from '../lib/myRoutine.js';
import { activePlan } from '../lib/plan.js';
import { trainingSettings } from '../lib/training.js';
import { useCatalogue } from '../store/catalogue.js';
import { content, useData } from '../store/useData.js';

const SHORT = { sunday: 'my.sun', monday: 'my.mon', tuesday: 'my.tue', wednesday: 'my.wed', thursday: 'my.thu', friday: 'my.fri', saturday: 'my.sat' };

/** Make my own routine (E4-S17): the list of sessions someone made, and
 * the editor for one (/plan/mine/:key). */
export default function MyRoutine() {
  const { key } = useParams();
  return key ? <Editor sessionKey={key} /> : <MyList />;
}

function Back({ to }) {
  const navigate = useNavigate();
  return <button type="button" className="btn ghost small" style={{ paddingInlineStart: 0 }} onClick={() => navigate(to)}><Icon name="back" /> {t(to === '/plan' ? 'my.backPlan' : 'my.backList')}</button>;
}

function MyList() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const mine = M.mySessions(data);
  const create = () => {
    let made = null;
    update((d) => {
      const r = M.createSession(d, name);
      made = r.key;
      return r.data;
    });
    if (made) navigate(`/plan/mine/${made}`);
  };
  return (
    <div className="page">
      <Back to="/plan" />
      <h1 className="page-title">{t('my.title')}</h1>
      <p className="page-sub">{t('my.sub')}</p>
      {mine.length ? (
        <div className="list">
          {mine.map((s) => (
            <button key={s.key} type="button" className="list-row" onClick={() => navigate(`/plan/mine/${s.key}`)}>
              <div className="grow">
                <div>{s.label}</div>
                <div className="meta small">{t('my.rowMeta', { n: s.exercises.length, days: M.daysOf(data, s.key).map((d) => t(SHORT[d])).join(' · ') || t('my.noDays') })}</div>
              </div>
              <Icon name="chev" className="icon chev" />
            </button>
          ))}
        </div>
      ) : null}
      <section className="card">
        <label className="field" style={{ margin: 0 }}>
          <span>{t('my.newName')}</span>
          <input type="text" value={name} maxLength={M.MAX_NAME} placeholder={t('my.namePlaceholder')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
        </label>
        <button type="button" className="btn" style={{ marginTop: 10 }} disabled={!name.trim()} onClick={create}><Icon name="plus" /> {t('my.create')}</button>
      </section>
    </div>
  );
}

function Editor({ sessionKey }) {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [swapping, setSwapping] = useState(null); // index of the exercise being swapped
  const session = M.mySession(data, sessionKey);
  const [name, setName] = useState(session?.label || '');
  if (!session) {
    return (
      <div className="page">
        <Back to="/plan/mine" />
        <div className="card empty">{t('my.gone')}</div>
      </div>
    );
  }
  const days = new Set(M.daysOf(data, sessionKey));
  const toggleDay = (d) => update((x) => M.setDays(x, sessionKey, days.has(d) ? [...days].filter((y) => y !== d) : [...days, d]));
  const groups = dayGroups(data, session.exercises);
  const sets = M.setsByGroup(data, session.exercises);
  function edit(i, patch) { update((x) => M.setExercise(x, sessionKey, i, patch)); }

  return (
    <div className="page">
      <Back to="/plan/mine" />
      <label className="field" style={{ marginTop: 6 }}>
        <span>{t('my.name')}</span>
        <input type="text" value={name} maxLength={M.MAX_NAME} onChange={(e) => setName(e.target.value)} onBlur={() => update((x) => M.renameSession(x, sessionKey, name))} />
      </label>

      <div className="section-label">{t('my.days')}</div>
      <div className="chip-row" role="group" aria-label={t('my.days')} style={{ flexWrap: 'wrap' }}>
        {M.WEEK.map((d) => (
          <button key={d} type="button" className={`chip-btn${days.has(d) ? ' on' : ''}`} aria-pressed={days.has(d)} onClick={() => toggleDay(d)}>{t(SHORT[d])}</button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '6px 4px 0' }}>{t('my.daysNote')}</p>

      <div className="row" style={{ alignItems: 'center', gap: 12, margin: '14px 4px 8px' }}>
        <div style={{ width: 96, flex: 'none' }}><BodyMap hit={groups} size={96} label={t('my.hits', { list: [...groups].join(', ') || '-' })} /></div>
        <p className="small grow" style={{ margin: 0 }}>
          {sets.length ? sets.map(([g, n]) => t('my.setsOf', { n, group: g })).join(' · ') : t('my.empty')}
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {session.exercises.map((x, i) => (
          <section key={`${x.name}-${i}`} className="card">
            <div className="row between" style={{ alignItems: 'center' }}>
              <strong className="grow">{x.name}</strong>
              <button type="button" className="btn ghost small" style={{ width: 'auto' }} aria-label={t('my.swapAria', { name: x.name })} onClick={() => setSwapping(i)}>{t('my.swap')}</button>
              <button type="button" className="icon-btn" aria-label={t('my.up', { name: x.name })} disabled={i === 0} onClick={() => update((d) => M.moveExercise(d, sessionKey, i, -1))}><span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="back" /></span></button>
              <button type="button" className="icon-btn" aria-label={t('my.down', { name: x.name })} disabled={i === session.exercises.length - 1} onClick={() => update((d) => M.moveExercise(d, sessionKey, i, 1))}><span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Icon name="back" /></span></button>
              <button type="button" className="icon-btn" aria-label={t('my.remove', { name: x.name })} onClick={() => update((d) => M.removeExercise(d, sessionKey, i))}><Icon name="trash" /></button>
            </div>
            <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 0 }}><Stepper label={t('my.sets')} value={x.sets} min={1} max={10} onChange={(v) => edit(i, { sets: v })} /></div>
              <label className="field" style={{ flex: 1, minWidth: 0 }}>
                <span>{t('my.reps')}</span>
                <input type="text" defaultValue={x.reps} maxLength={20} onBlur={(e) => edit(i, { reps: e.target.value })} />
              </label>
            </div>
            <label className="field" style={{ margin: 0 }}>
              <span>{t('my.rest')}</span>
              <select value={x.rest_sec} onChange={(e) => edit(i, { restSec: Number(e.target.value) })}>
                {[...new Set([...M.REST_CHOICES, x.rest_sec])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>{s < 60 ? t('my.secs', { n: s }) : t('my.mins', { n: s / 60 })}</option>)}
              </select>
            </label>
          </section>
        ))}
      </div>
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setAdding(true)}><Icon name="plus" /> {t('my.add')}</button>
      {session.exercises.length && days.size ? <p className="muted small" style={{ margin: '10px 4px 0' }}>{t('my.ready')}</p> : null}
      <button type="button" className="btn ghost" style={{ marginTop: 18, color: 'var(--danger)' }} onClick={() => setDeleting(true)}><Icon name="trash" /> {t('my.delete')}</button>

      {adding ? <AddSheet data={data} onPick={(p) => update((d) => M.addExercise(d, sessionKey, p))} onClose={() => setAdding(false)} /> : null}
      {swapping != null && session.exercises[swapping] ? (
        <SwapSheet data={data} name={session.exercises[swapping].name} others={session.exercises.map((x) => x.name)}
          onPick={(p) => { update((d) => M.swapExercise(d, sessionKey, swapping, p)); setSwapping(null); }} onClose={() => setSwapping(null)} />
      ) : null}
      {deleting ? (
        <ConfirmSheet
          title={t('my.deleteTitle', { name: session.label })}
          body={t('my.deleteBody')}
          action={t('my.delete')}
          onConfirm={() => { update((d) => M.deleteSession(d, sessionKey)); navigate('/plan/mine'); }}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </div>
  );
}

/** Same-muscle replacements for one exercise of the session: what the
 * person's equipment allows first, then their level, then the best match. */
export function SwapSheet({ data, name, others, onPick, onClose }) {
  const { catalogue } = useCatalogue();
  const settings = trainingSettings(data);
  const entry = catalogue ? entryFor(name, activePlan(data, content), catalogue.byId) : null;
  const options = entry ? swapOptions(entry, catalogue.exercises, { level: settings.level, owned: ownedKinds(settings), skip: others }) : [];
  // No catalogue match: other Library exercises for the same muscle group.
  const group = data.exercises.find((e) => e.name === name)?.muscle_group;
  const taken = new Set(others);
  const own = entry ? [] : data.exercises.filter((e) => group && e.muscle_group === group && !taken.has(e.name)).slice(0, LIMIT);
  return (
    <Sheet title={t('my.swapTitle', { name })} onClose={onClose}>
      <p className="muted small" style={{ margin: '0 4px 10px' }}>{t('my.swapNote')}</p>
      <div className="list">
        {options.map((r) => (
          <button key={r.entry.id} type="button" className="list-row" onClick={() => onPick({ name: r.entry.name, group: groupOf(r.entry), equipment: r.entry.equipment })}>
            <div className="grow">
              <div>{r.entry.name}</div>
              <div className="meta small">{[r.entry.equipment || t('my.bodyOnly'), t('my.match', { pct: Math.round(r.score * 100) }), r.doable ? null : t('my.needsKit')].filter(Boolean).join(' · ')}</div>
            </div>
            {r.advanced ? <span className="chip">{t('levels.advanced')}</span> : null}
          </button>
        ))}
        {own.map((e) => (
          <button key={e.id} type="button" className="list-row" onClick={() => onPick({ name: e.name, group: e.muscle_group, equipment: e.equipment })}>
            <div className="grow"><div>{e.name}</div><div className="meta small">{e.muscle_group}</div></div>
          </button>
        ))}
        {!options.length && !own.length ? <div className="empty">{t(catalogue ? 'my.swapNone' : 'my.swapLoading')}</div> : null}
      </div>
    </Sheet>
  );
}

const LIMIT = 30;

/** Tap a muscle on the map, then an exercise. Uses the bundled catalogue
 * when it's there, and always the person's own Library. */
function AddSheet({ data, onPick, onClose }) {
  const { catalogue } = useCatalogue();
  const [group, setGroup] = useState(null);
  const [muscle, setMuscle] = useState(null);
  const [q, setQ] = useState('');
  const [added, setAdded] = useState([]);
  const fine = group ? musclesIn(group) : [];
  const own = data.exercises
    .filter((e) => (!group || e.muscle_group === group) && e.name.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, LIMIT);
  const ownNames = new Set(own.map((e) => e.name.toLowerCase()));
  const more = catalogue && (group || q.trim())
    ? filterCatalogue(catalogue.exercises, { q, group, muscle: fine.some((m) => m.key === muscle) ? muscle : null }).filter((e) => !ownNames.has(e.name.toLowerCase())).slice(0, LIMIT)
    : [];
  const level = trainingSettings(data).level;
  const pick = (p) => { onPick(p); setAdded((a) => [...a, p.name]); };
  const row = (key, name, meta, p) => (
    <button key={key} type="button" className="list-row" onClick={() => pick(p)}>
      <div className="grow"><div>{name}</div>{meta ? <div className="meta small">{meta}</div> : null}</div>
      {added.includes(name) ? <Icon name="check" /> : <Icon name="plus" />}
    </button>
  );
  return (
    <Sheet title={t('my.addTitle')} onClose={onClose}>
      <BodyMap hit={group ? new Set([group]) : new Set()} onPick={(g) => { setGroup(group === g ? null : g); setMuscle(null); }} size={220} label={t('my.mapLabel')} />
      {fine.length > 1 ? (
        <div className="chip-row" role="group" aria-label={t('my.muscle')} style={{ marginTop: 8 }}>
          {fine.map((m) => (
            <button key={m.key} type="button" className={`chip-btn${muscle === m.key ? ' on' : ''}`} aria-pressed={muscle === m.key} onClick={() => setMuscle(muscle === m.key ? null : m.key)}>{m.label}</button>
          ))}
        </div>
      ) : null}
      <input type="search" value={q} placeholder={t('my.search')} aria-label={t('my.search')} onChange={(e) => setQ(e.target.value)} style={{ margin: '10px 0' }} />
      {!group && !q.trim() ? <p className="muted small" style={{ margin: '0 4px 10px' }}>{t('my.tapMap')}</p> : null}
      {own.length ? (
        <>
          <div className="section-label">{t('my.yourLibrary')}</div>
          <div className="list">{own.map((e) => row(`o${e.id}`, e.name, e.muscle_group, { name: e.name, group: e.muscle_group, equipment: e.equipment }))}</div>
        </>
      ) : null}
      {more.length ? (
        <>
          <div className="section-label">{t('my.more')}</div>
          <div className="list">{more.map((e) => row(`c${e.id}`, e.name, [e.equipment, isAdvanced(e.level, level) ? t('levels.advanced') : null].filter(Boolean).join(' · '), { name: e.name, group: groupOf(e), equipment: e.equipment }))}</div>
        </>
      ) : null}
    </Sheet>
  );
}
