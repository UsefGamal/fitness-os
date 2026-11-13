import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import DayPicker from '../components/DayPicker.jsx';
import Icon from '../components/Icon.jsx';
import ExerciseRow from '../components/ExerciseRow.jsx';
import MoreMenu from '../components/MoreMenu.jsx';
import MyWeek from '../components/MyWeek.jsx';
import Sheet from '../components/Sheet.jsx';
import WeekStrip from '../components/WeekStrip.jsx';
import { entryFor, groupOf, photoSrc, thumbOf } from '../lib/catalogue.js';
import * as D from '../lib/data.js';
import { longWeekday, todayISO, weekdayName } from '../lib/dates.js';
import { EVENING_OPTIONS, eveningOn, setEvening } from '../lib/evening.js';
import { weekHtml, weekText } from '../lib/planShare.js';
import { dayGroups } from '../lib/insights.js';
import { effectiveTimes } from '../lib/ramadan.js';
import { sessionAt } from '../lib/times.js';
import { t } from '../lib/i18n.js';
import * as P from '../lib/planEdit.js';
import { activeBlock, activePlan } from '../lib/plan.js';
import { isRecoveryWeek, setRecoveryWeek } from '../lib/recovery.js';
import { sessionIcs, sessionMinutes } from '../lib/calendar.js';
import { MUSCLE, dayMuscles, targetFor } from '../lib/muscles.js';
import { moveSession, moveTargets, undoMove, weekView } from '../lib/schedule.js';
import { alternatives } from '../lib/similar.js';
import { useCatalogue } from '../store/catalogue.js';
import { saveExport } from '../store/mirror.js';
import { dataUrlOf, shareFile, shareText, shareTextFile } from '../store/share.js';
import { content, useData } from '../store/useData.js';
import { gentleDay } from '../lib/safety.js';
import { useToday } from '../store/today.js';

function EditList({ day, sessionKey }) {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const T = activePlan(data, content);
  const [adding, setAdding] = useState('');
  const { catalogue } = useCatalogue();
  // Up to 8 catalogue exercises that work the same muscles, best first.
  const recommended = (name) => {
    const entry = catalogue ? entryFor(name, T, catalogue.byId) : null;
    return entry ? alternatives(entry, catalogue.exercises, { limit: 8 }).map((r) => r.entry) : [];
  };
  const swap = (i, value) => {
    if (!value) return;
    if (!value.startsWith('cat:')) return update((d) => P.swapExercise(d, sessionKey, T, i, value));
    const e = catalogue.byId.get(value.slice(4));
    // Catalogue exercises join the Library first so sets can be logged against them.
    return update((d) => P.swapExercise(D.addCustomExercise(d, { name: e.name, muscle_group: groupOf(e), equipment: e.equipment }), sessionKey, T, i, e.name));
  };
  const byMuscle = (name) => data.exercises.find((e) => e.name === name)?.muscle_group;
  const options = (current) => {
    const m = byMuscle(current);
    const sorted = [...data.exercises].sort((a, b) => (b.muscle_group === m) - (a.muscle_group === m) || a.name.localeCompare(b.name));
    return sorted.filter((e) => e.name !== current);
  };
  return (
    <>
      {day.exercises.map((ex, i) => (
        <div key={`${ex.name}-${i}`} className="ex-card stack">
          <div className="row between">
            <div className="ex-name grow">{ex.pair ? <span className="pair">{ex.pair}</span> : null}{ex.name}</div>
            <button type="button" className="icon-btn" aria-label={`Move ${ex.name} up`} disabled={i === 0} onClick={() => update((d) => P.moveExercise(d, sessionKey, T, i, -1))}><span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="back" className="icon" /></span></button>
            <button type="button" className="icon-btn" aria-label={`Move ${ex.name} down`} disabled={i === day.exercises.length - 1} onClick={() => update((d) => P.moveExercise(d, sessionKey, T, i, 1))}><span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chev" className="icon" /></span></button>
            <button type="button" className="icon-btn" aria-label={`Remove ${ex.name}`} onClick={() => update((d) => P.removeExercise(d, sessionKey, T, i))}><Icon name="trash" /></button>
          </div>
          <div className="row">
            <label className="field" style={{ width: 80 }}><span>Sets</span><input type="number" inputMode="numeric" min="1" max="10" value={ex.sets} onChange={(e) => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= 10) update((d) => P.editExercise(d, sessionKey, T, i, { sets: v })); }} /></label>
            <label className="field grow"><span>Reps</span><input type="text" value={ex.reps} onChange={(e) => update((d) => P.editExercise(d, sessionKey, T, i, { reps: e.target.value }))} /></label>
            <label className="field grow"><span>Rest</span><input type="text" value={ex.rest || ''} placeholder="2m" onChange={(e) => update((d) => P.editExercise(d, sessionKey, T, i, { rest: e.target.value }))} /></label>
          </div>
          <label className="field">
            <span>Swap for</span>
            <select value="" onChange={(e) => swap(i, e.target.value)}>
              <option value="">Keep {ex.name}</option>
              {recommended(ex.name).length ? (
                <optgroup label="Same muscles (recommended)">
                  {recommended(ex.name).map((o) => <option key={o.id} value={`cat:${o.id}`}>{o.name} · {o.equipment || 'body only'}</option>)}
                </optgroup>
              ) : null}
              <optgroup label="Your Library">
                {options(ex.name).map((o) => <option key={o.id} value={o.name}>{o.name} · {o.muscle_group}</option>)}
              </optgroup>
            </select>
          </label>
        </div>
      ))}
      <div className="card stack">
        <label className="field">
          <span>Add an exercise</span>
          <select value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choose…</option>
            {[...data.exercises].sort((a, b) => a.name.localeCompare(b.name)).map((o) => <option key={o.id} value={o.name}>{o.name} · {o.muscle_group}</option>)}
          </select>
        </label>
        <button type="button" className="btn secondary" disabled={!adding} onClick={() => { update((d) => P.addExercise(d, sessionKey, T, adding)); setAdding(''); }}><Icon name="plus" /> Add to {day.label}</button>
      </div>
      {day.edited ? (
        <button type="button" className="btn danger" onClick={() => window.confirm(`Put ${day.label} back to the original plan?`) && update((d) => P.resetDay(d, sessionKey))}>Reset {day.label} to the original plan</button>
      ) : null}
    </>
  );
}

export default function Plan() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const today = useToday();
  const T = activePlan(data, content);
  const times = effectiveTimes(data, content, todayISO());
  const week = weekView(today, T, data.session_moves || [], data);
  const firstTraining = week.find((d) => d.isToday && d.key !== 'rest') || week.find((d) => d.key !== 'rest' && d.date >= today) || week.find((d) => d.key !== 'rest') || week.find((d) => d.isToday);
  const [params] = useSearchParams();
  const [pickedRaw, setPicked] = useState(() => week.find((d) => d.date === params.get('day')) || firstTraining);
  const picked = week.find((d) => d.date === pickedRaw.date) || pickedRaw;
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState(false);
  // Which options sheet is open: 'move' | 'week' | 'evening' | 'terms'.
  const [opt, setOpt] = useState(null);
  const navigate = useNavigate();
  const day = picked.key === 'rest' ? null : gentleDay(data, P.effectiveDay(picked.key, T, data), today);
  const dayHits = dayMuscles(day?.exercises, T);
  const moves = data.session_moves || [];
  const movedHere = moves.find((m) => m.to === picked.date && m.from);
  const pick = (date) => setPicked(weekView(today, T, data.session_moves || [], data).find((d) => d.date === date) || picked);
  const move = (to) => {
    if (!to) return;
    update((d) => moveSession(d, T, picked.date, to));
    setPicked({ ...picked, date: to });
    setOpt(null);
  };
  const { catalogue } = useCatalogue();
  const [shareMsg, setShareMsg] = useState('');
  const night = eveningOn(data, picked.date);
  const trainingDays = T.trainer_plan.schedule.filter((e) => e.session !== 'rest').length;
  const typical = sessionMinutes(day || P.effectiveDay(firstTraining.key, T, data));
  const weekDays = () => week.map((w) => ({ date: w.date, day: w.key === 'rest' ? null : P.effectiveDay(w.key, T, data), evening: eveningOn(data, w.date) }));
  const shareWeek = async () => {
    const r = await shareText('My training week', weekText(weekDays(), { time: sessionAt(times) || '', eveningTime: times.evening_time }));
    setShareMsg(r === 'copied' ? 'Copied the week; paste it into a message.' : '');
  };
  const printWeek = async () => {
    setShareMsg('Making the page…');
    const days = weekDays();
    const photos = new Map();
    if (catalogue) {
      for (const name of new Set(days.flatMap((d) => d.day?.exercises.map((x) => x.name) || []))) {
        const e = entryFor(name, T, catalogue.byId);
        const src = e ? thumbOf(e) : null;
        if (src) photos.set(name, await dataUrlOf(photoSrc(src)));
      }
    }
    const html = weekHtml(days, { time: sessionAt(times) || '', eveningTime: times.evening_time, tempo: T.trainer_plan.tempo, photoOf: (n) => photos.get(n) || null });
    try {
      const uri = await saveExport(`training-week-${week[0].date}.html`, html, 'text/html');
      if (uri) await shareFile('My training week', uri);
      setShareMsg(uri ? 'Saved to Documents. Open it in a browser and choose Print to make a PDF.' : 'Downloaded. Open it and choose Print to make a PDF.');
    } catch {
      setShareMsg('Could not save the page. Check storage permission and try again.');
    }
  };
  const addToCalendar = async () => {
    const at = effectiveTimes(data, content, picked.date).session_time;
    try {
      const ics = sessionIcs({ date: picked.date, time: at, minutes: sessionMinutes(day), title: day.label, description: [day.focus, day.cardio_after ? t('plan.after', { text: day.cooldown[0] }) : null].filter(Boolean).join('\n') });
      const r = await shareTextFile(t('plan.calendarShare'), `fitness-os-${picked.date}-${picked.key}.ics`, ics);
      setShareMsg(t(r === 'shared' ? 'plan.calendarDone' : 'plan.calendarWeb'));
    } catch {
      setShareMsg(t('plan.calendarFail'));
    }
  };
  // Where a tap on an exercise goes: its Library page, else the catalogue.
  const exerciseLink = (name) => {
    const own = data.exercises.find((e) => e.name === name);
    if (own) return `/library/${own.id}`;
    const e = catalogue ? entryFor(name, T, catalogue.byId) : null;
    return e ? `/catalogue/${e.id}` : null;
  };
  // The muscles an exercise targets, for its row's small body map.
  const targetOf = (name) => targetFor(name, T, catalogue ? entryFor(name, T, catalogue.byId) : null);
  // With a routine running, choosing another and the recovery week live in the menu (UX-07, UX-05).
  const block = activeBlock(data);
  const resting = isRecoveryWeek(data, today);
  const options = [
    ...(block ? [{ key: 'routine', icon: 'dumbbell', label: t('routines.open'), note: t('routines.openNote'), onClick: () => navigate('/plan/routines') }] : []),
    ...(block ? [{ key: 'recovery', icon: 'calendar', label: t(resting ? 'recovery.off' : 'recovery.on'), note: t('recovery.short'), onClick: () => update((d) => setRecoveryWeek(d, today, !resting)) }] : []),
    ...(day && today <= picked.date ? [{ key: 'change', icon: 'calendar', label: t('plan.opt.change'), note: t('plan.opt.changeNote'), onClick: () => setChoosing(true) }] : []),
    ...(day && picked.date >= today ? [{ key: 'move', icon: 'undo', label: t('plan.opt.move'), note: t('plan.opt.moveNote'), onClick: () => setOpt('move') }] : []),
    ...(activeBlock(data) ? [{ key: 'week', icon: 'dumbbell', label: t('plan.opt.week'), note: t('plan.opt.weekNote'), onClick: () => setOpt('week') }] : []),
    { key: 'evening', icon: 'moon', label: t('plan.opt.evening'), note: t('plan.opt.eveningNote', { time: times.evening_time }), onClick: () => setOpt('evening') },
    { key: 'share', icon: 'upload', label: t('plan.opt.share'), note: t('plan.opt.shareNote'), onClick: shareWeek },
    { key: 'print', icon: 'download', label: t('plan.opt.print'), note: t('plan.opt.printNote'), onClick: printWeek },
    { key: 'terms', icon: 'info', label: t('plan.opt.terms'), onClick: () => setOpt('terms') },
  ];

  return (
    <div className="page">
      <div className="plan-head">
        <h1 className="page-title">{t('tab.plan')}</h1>
        {T.trainer_plan.tempo ? <span className="chip"><Icon name="timer" className="icon inline" /> {t('plan.tempo', { tempo: T.trainer_plan.tempo })}</span> : null}
        <MoreMenu title={t('plan.options')} actions={options} />
      </div>
      <p className="plan-sub">{t('plan.overview', { name: T.trainer_plan.name, days: trainingDays, min: typical })}{sessionAt(times) ? ` · ${times.session_time}` : ''}</p>

      {block ? null : (
        <Link to="/plan/routines" className="card route-card">
          <div className="session-icon"><Icon name="dumbbell" /></div>
          <div className="grow"><div className="session-name">{t('routines.open')}</div><div className="session-sub">{t('routines.openNote')}</div></div>
          <Icon name="chev" className="icon chev" />
        </Link>
      )}

      <WeekStrip week={week} onPick={(d) => { setPicked(d); setEditing(false); }} />

      {day ? (
        <>
          <div className="day-head">
            <h2 className="section-title">{t('plan.dayTitle', { day: longWeekday(picked.date), label: day.label })}{day.edited ? ` · ${t('plan.edited')}` : ''}</h2>
            <button type="button" className="btn ghost small" onClick={() => setEditing(!editing)}>{t(editing ? 'plan.doneEdit' : 'plan.edit')}</button>
          </div>
          <div className="day-focus">
            <p className="muted small grow" style={{ margin: 0 }}>{day.focus}</p>
            <div style={{ width: 64, flex: 'none' }}><BodyMap primary={dayHits.muscles} hit={dayGroups(data, dayHits.unknown)} size={64} label={`${day.label} works ${[...dayHits.muscles.map((m) => MUSCLE[m]?.label || m), ...dayGroups(data, dayHits.unknown)].join(', ')}`} /></div>
          </div>
          {movedHere ? (
            <button type="button" className="pill-row" style={{ margin: '0 0 12px' }} onClick={() => { update((d) => undoMove(d, picked.date)); pick(movedHere.from); }}>
              <Icon name="undo" /><span className="grow">{t('plan.putBack', { day: longWeekday(movedHere.from) })}</span>
            </button>
          ) : null}
          {editing ? (
            <EditList day={day} sessionKey={picked.key} />
          ) : (
            <>
              <details className="card more">
                <summary>{t('plan.warmup', { what: day.pre_cardio, n: day.warmup_items.length })}</summary>
                <div className="stack" style={{ marginTop: 8 }}>{day.warmup.slice(1).map((line) => <div key={line} className="muted small">{line}</div>)}</div>
                <Link to={`/follow?src=warmup:${day.key}`} className="btn ghost small" style={{ marginTop: 6 }}><Icon name="play" /> {t('plan.follow')}</Link>
              </details>
              {day.exercises.map((ex, i) => (
                <ExerciseRow key={`${ex.name}-${i}`} ex={ex} target={targetOf(ex.name)} to={exerciseLink(ex.name)} />
              ))}
              {day.cardio_after ? <div className="card tip-card small"><Icon name="bulb" /><div className="grow muted">{t('plan.after', { text: day.cooldown[0] })}</div></div> : null}
              {/* Today's Start stays pinned above the tab bar while the list scrolls (UX-08). */}
              {picked.date === today ? (
                <div className="start-bar"><button type="button" className="btn glow" onClick={() => navigate('/workout')}><Icon name="play" /> {t('plan.start')}</button></div>
              ) : null}
              <div className="action-stack">
                {picked.date === today ? null : (
                  <button type="button" className="btn secondary" onClick={() => navigate(`/workout?session=${day.key}`)}><Icon name="play" /> {t('plan.doToday', { label: day.label })}</button>
                )}
                {picked.date >= today ? <button type="button" className="btn outline" onClick={addToCalendar}><Icon name="calendar" /> {t('plan.calendar')}</button> : null}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="card empty" style={{ marginTop: 16 }}>
          {t('week.rest')}. {t('week.restNote')}
          {today <= picked.date ? <button type="button" className="btn secondary small" style={{ marginTop: 10 }} onClick={() => setChoosing(true)}>{t('week.changeDay')}</button> : null}
        </div>
      )}
      {night ? (
        <button type="button" className="pill-row" style={{ margin: '0 0 12px' }} onClick={() => (picked.date === today ? navigate(night.route) : setOpt('evening'))}>
          <Icon name="moon" /><span className="grow">{t('plan.tonight', { time: times.evening_time, label: night.label })}</span><Icon name="chev" className="icon chev" />
        </button>
      ) : null}
      {shareMsg ? <p className="muted small" role="status" style={{ margin: '0 4px 12px' }}>{shareMsg}</p> : null}
      {choosing ? <DayPicker date={picked.date} dayName={longWeekday(picked.date)} training={T} data={data} update={update} onClose={() => setChoosing(false)} /> : null}

      <div className="list" style={{ marginTop: 12 }}>
        <Link to="/library" className="list-row"><Icon name="book" /><div className="grow">{t('plan.library')}</div><Icon name="chev" className="icon chev" /></Link>
        <Link to="/plan/mine" className="list-row"><Icon name="plus" /><div className="grow"><div>{t('my.open')}</div><div className="meta small">{t('my.openNote')}</div></div><Icon name="chev" className="icon chev" /></Link>
      </div>

      {opt === 'move' && day ? (
        <Sheet title={t('plan.opt.move')} onClose={() => setOpt(null)}>
          <label className="field">
            <span>{t('plan.moveTo', { label: day.label })}</span>
            <select value="" aria-label={t('plan.moveAria', { label: day.label })} onChange={(e) => move(e.target.value)}>
              <option value="">{t('plan.moveTo', { label: day.label })}</option>
              {moveTargets(picked.date, T, moves).filter((d) => d >= today).map((d) => <option key={d} value={d}>{longWeekday(d)}{d === today ? t('plan.todayTag') : ''}</option>)}
            </select>
          </label>
        </Sheet>
      ) : null}
      {opt === 'week' ? (
        <Sheet title={t('plan.opt.week')} onClose={() => setOpt(null)}>
          <MyWeek data={data} update={update} content={content} training={T} open />
        </Sheet>
      ) : null}
      {opt === 'evening' ? (
        <Sheet title={t('plan.opt.evening')} onClose={() => setOpt(null)}>
          <label className="field">
            <span>{t('plan.evening', { day: longWeekday(picked.date), time: times.evening_time })}</span>
            <select value={night?.key || ''} onChange={(e) => update((d) => setEvening(d, weekdayName(picked.date), e.target.value || null))}>
              <option value="">{t('plan.nothingAt', { time: times.evening_time })}</option>
              {EVENING_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          {night && picked.date === today ? <button type="button" className="btn secondary" style={{ marginTop: 12 }} onClick={() => navigate(night.route)}><Icon name="play" /> {t('plan.eveningNow', { label: night.label })}</button> : null}
        </Sheet>
      ) : null}
      {opt === 'terms' ? (
        <Sheet title={t('plan.opt.terms')} onClose={() => setOpt(null)}>
          <div className="stack small">
            {Object.entries(T.trainer_plan.glossary).map(([k, v]) => <div key={k}><strong>{k.replace(/_/g, ' ')}:</strong> <span className="muted">{v}</span></div>)}
            <div className="muted">{T.progression_note}</div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
