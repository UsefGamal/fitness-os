import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import BodyMap from '../components/BodyMap.jsx';
import DayPicker from '../components/DayPicker.jsx';
import Icon from '../components/Icon.jsx';
import MyWeek from '../components/MyWeek.jsx';
import WeekStrip from '../components/WeekStrip.jsx';
import { entryFor, groupOf, photoSrc, thumbOf } from '../lib/catalogue.js';
import * as D from '../lib/data.js';
import { longWeekday, todayISO, weekdayName } from '../lib/dates.js';
import { EVENING_OPTIONS, eveningOn, setEvening } from '../lib/evening.js';
import { weekHtml, weekText } from '../lib/planShare.js';
import { dayGroups } from '../lib/insights.js';
import { timesOf } from '../lib/times.js';
import { t } from '../lib/i18n.js';
import * as P from '../lib/planEdit.js';
import { activePlan } from '../lib/plan.js';
import { MUSCLE, dayMuscles, targetFor, targetLabel } from '../lib/muscles.js';
import { moveSession, moveTargets, undoMove, weekView } from '../lib/schedule.js';
import { alternatives } from '../lib/similar.js';
import { useCatalogue } from '../store/catalogue.js';
import { saveExport } from '../store/mirror.js';
import { dataUrlOf, shareFile, shareText } from '../store/share.js';
import { content, useData } from '../store/useData.js';

function ExerciseList({ day, training }) {
  return day.exercises.map((ex, i) => (
    <div key={`${ex.name}-${i}`} className="ex-card">
      <div className="row between">
        <div className="grow">
          <div className="ex-name">{ex.pair ? <span className="pair">{ex.pair}</span> : null}{ex.name}</div>
          {targetFor(ex.name, training) ? <div className="ex-target">{targetLabel(targetFor(ex.name, training))}</div> : null}
          <div className="ex-meta">
            {ex.sets} × {ex.reps}{ex.rir ? ` · leave ${ex.rir} in the tank` : ''}{ex.rest ? ` · rest ${ex.rest}` : ''}
          </div>
        </div>
        {ex.video ? <a className="icon-btn" href={ex.video} target="_blank" rel="noreferrer" aria-label={`${ex.name} form video`}><Icon name="video" /></a> : null}
      </div>
      {ex.swapped_from ? <div className="ex-meta">Instead of {ex.swapped_from}</div> : null}
      {ex.note ? <div className="ex-note">{ex.note}</div> : null}
      {ex.film_form ? <div className="ex-meta">Film your form on this one.</div> : null}
      {ex.alternative ? <div className="ex-meta">Machine taken? {ex.alternative}</div> : null}
    </div>
  ));
}

function EditList({ day, sessionKey }) {
  const { data, update } = useData();
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
  const { data, update } = useData();
  const today = todayISO();
  const T = activePlan(data, content);
  const times = timesOf(data, content);
  const week = weekView(today, T, data.session_moves || []);
  const firstTraining = week.find((d) => d.isToday && d.key !== 'rest') || week.find((d) => d.key !== 'rest' && d.date >= today) || week.find((d) => d.key !== 'rest');
  const [pickedRaw, setPicked] = useState(firstTraining);
  const picked = week.find((d) => d.date === pickedRaw.date) || pickedRaw;
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const day = picked.key === 'rest' ? null : P.effectiveDay(picked.key, T, data);
  const dayHits = dayMuscles(day?.exercises, T);
  const moves = data.session_moves || [];
  const movedHere = moves.find((m) => m.to === picked.date && m.from);
  const pick = (date) => setPicked(weekView(today, T, data.session_moves || []).find((d) => d.date === date) || picked);
  const move = (to) => {
    if (!to) return;
    update((d) => moveSession(d, T, picked.date, to));
    setPicked({ ...picked, date: to });
  };
  const { catalogue } = useCatalogue();
  const [shareMsg, setShareMsg] = useState('');
  const night = eveningOn(data, picked.date);
  const weekDays = () => week.map((w) => ({ date: w.date, day: w.key === 'rest' ? null : P.effectiveDay(w.key, T, data), evening: eveningOn(data, w.date) }));
  const shareWeek = async () => {
    const r = await shareText('My training week', weekText(weekDays(), { time: times.session_time, eveningTime: times.evening_time }));
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
    const html = weekHtml(days, { time: times.session_time, eveningTime: times.evening_time, tempo: T.trainer_plan.tempo, photoOf: (n) => photos.get(n) || null });
    try {
      const uri = await saveExport(`training-week-${week[0].date}.html`, html, 'text/html');
      if (uri) await shareFile('My training week', uri);
      setShareMsg(uri ? 'Saved to Documents. Open it in a browser and choose Print to make a PDF.' : 'Downloaded. Open it and choose Print to make a PDF.');
    } catch {
      setShareMsg('Could not save the page. Check storage permission and try again.');
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Plan</h1>
      <p className="page-sub">{T.trainer_plan.name}, {times.session_time} sessions, tempo {T.trainer_plan.tempo}.</p>
      <section className="card"><WeekStrip week={week} onPick={(d) => { setPicked(d); setEditing(false); }} /></section>

      {day ? (
        <>
          <div className="row between" style={{ margin: '18px 4px 6px' }}>
            <div className="section-label" style={{ margin: 0 }}>{longWeekday(picked.date)} · {day.label}{day.edited ? ' · edited' : ''}</div>
            <button type="button" className="btn ghost small" style={{ minHeight: 32 }} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit'}</button>
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 10, margin: '0 4px 10px' }}>
            <p className="muted small grow" style={{ margin: 0 }}>{day.focus}</p>
            <div style={{ width: 96, flex: 'none' }}><BodyMap primary={dayHits.muscles} hit={dayGroups(data, dayHits.unknown)} size={96} label={`${day.label} works ${[...dayHits.muscles.map((m) => MUSCLE[m]?.label || m), ...dayGroups(data, dayHits.unknown)].join(', ')}`} /></div>
          </div>
          {editing ? (
            <EditList day={day} sessionKey={picked.key} />
          ) : (
            <>
              <details className="card more">
                <summary>Warm-up: {day.pre_cardio}, then {day.warmup_items.length} drills</summary>
                <div className="stack" style={{ marginTop: 8 }}>{day.warmup.slice(1).map((line) => <div key={line} className="muted small">{line}</div>)}</div>
                <Link to={`/follow?src=warmup:${day.key}`} className="btn ghost small" style={{ marginTop: 6 }}><Icon name="play" /> Follow along</Link>
              </details>
              <ExerciseList day={day} training={T} />
              {day.cardio_after ? <div className="card muted small">After: {day.cooldown[0]}</div> : null}
              <div className="row" style={{ gap: 8, alignItems: 'center', margin: '0 0 10px' }}>
                {movedHere ? (
                  <button type="button" className="btn ghost small grow" onClick={() => { update((d) => undoMove(d, picked.date)); pick(movedHere.from); }}>Moved from {longWeekday(movedHere.from)} · put it back</button>
                ) : null}
                {today <= picked.date ? <button type="button" className="btn secondary small" style={{ width: 'auto' }} onClick={() => setChoosing(true)}>{t('week.change')}</button> : null}
                {picked.date >= today ? (
                  <label className="field grow" style={{ margin: 0 }}>
                    <select value="" aria-label={`Move ${day.label} to another day`} onChange={(e) => move(e.target.value)}>
                      <option value="">Move {day.label} to…</option>
                      {moveTargets(picked.date, T, moves).filter((d) => d >= today).map((d) => <option key={d} value={d}>{longWeekday(d)}{d === today ? ' (today)' : ''}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
              {picked.date === today ? (
                <button type="button" className="btn" onClick={() => navigate('/workout')}><Icon name="play" /> Start {day.label}</button>
              ) : (
                <button type="button" className="btn secondary" onClick={() => navigate(`/workout?session=${day.key}`)}><Icon name="play" /> Do {day.label} today instead</button>
              )}
            </>
          )}
        </>
      ) : (
        <div className="card empty">
          {t('week.rest')}. {t('week.restNote')}
          {today <= picked.date ? <button type="button" className="btn secondary small" style={{ marginTop: 10 }} onClick={() => setChoosing(true)}>{t('week.changeDay')}</button> : null}
        </div>
      )}
      {choosing ? <DayPicker date={picked.date} dayName={longWeekday(picked.date)} training={T} data={data} update={update} onClose={() => setChoosing(false)} /> : null}
      <MyWeek data={data} update={update} content={content} training={T} />

      <label className="field" style={{ marginTop: 12 }}>
        <span>{longWeekday(picked.date)} at {times.evening_time} (every week)</span>
        <select value={night?.key || ''} onChange={(e) => update((d) => setEvening(d, weekdayName(picked.date), e.target.value || null))}>
          <option value="">Nothing at {times.evening_time}</option>
          {EVENING_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      {night && picked.date === today ? <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={() => navigate(night.route)}><Icon name="play" /> {night.label} now</button> : null}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button type="button" className="btn secondary small grow" onClick={shareWeek}><Icon name="upload" /> Share the week</button>
        <button type="button" className="btn secondary small grow" onClick={printWeek}><Icon name="download" /> Printable page</button>
      </div>
      {shareMsg ? <p className="muted small" role="status" style={{ margin: '8px 4px 0' }}>{shareMsg}</p> : null}

      <div className="list" style={{ marginTop: 12 }}>
        <Link to="/plan/mine" className="list-row"><Icon name="plus" /><div className="grow"><div>{t('my.open')}</div><div className="meta small">{t('my.openNote')}</div></div><Icon name="chev" className="icon chev" /></Link>
        <Link to="/library" className="list-row"><Icon name="book" /><div className="grow">Exercise library</div><Icon name="chev" className="icon chev" /></Link>
      </div>
      <details className="card more">
        <summary>What the plan's terms mean</summary>
        <div className="stack small" style={{ marginTop: 8 }}>
          {Object.entries(T.trainer_plan.glossary).map(([k, v]) => <div key={k}><strong>{k.replace(/_/g, ' ')}:</strong> <span className="muted">{v}</span></div>)}
          <div className="muted">{T.progression_note}</div>
        </div>
      </details>
    </div>
  );
}
