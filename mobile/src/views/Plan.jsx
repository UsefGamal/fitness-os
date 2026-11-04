import { useState } from 'react';
import { useNavigate } from 'react-router';

import Icon from '../components/Icon.jsx';
import WeekStrip from '../components/WeekStrip.jsx';
import { longWeekday, todayISO } from '../lib/dates.js';
import { programDay, weekView } from '../lib/schedule.js';
import { content } from '../store/useData.js';

export function ExerciseList({ day }) {
  return (
    <>
      {day.exercises.map((ex, i) => (
        <div key={`${ex.name}-${i}`} className="ex-card">
          <div className="row between">
            <div className="grow">
              <div className="ex-name">{ex.pair ? <span className="pair">{ex.pair}</span> : null}{ex.name}</div>
              <div className="ex-meta">
                {ex.sets} × {ex.reps}{ex.rir ? ` · leave ${ex.rir} in the tank` : ''}{ex.rest ? ` · rest ${ex.rest}` : ''}
              </div>
            </div>
            {ex.video ? <a className="icon-btn" href={ex.video} target="_blank" rel="noreferrer" aria-label={`${ex.name} form video`}><Icon name="video" /></a> : null}
          </div>
          {ex.note ? <div className="ex-note">{ex.note}</div> : null}
          {ex.film_form ? <div className="ex-meta">Film your form on this one.</div> : null}
          {ex.alternative ? <div className="ex-meta">Machine taken? {ex.alternative}</div> : null}
        </div>
      ))}
    </>
  );
}

export default function Plan() {
  const today = todayISO();
  const T = content.training;
  const week = weekView(today, T);
  const firstTraining = week.find((d) => d.isToday && d.key !== 'rest') || week.find((d) => d.key !== 'rest' && d.date >= today) || week.find((d) => d.key !== 'rest');
  const [picked, setPicked] = useState(firstTraining);
  const navigate = useNavigate();
  const day = picked.key === 'rest' ? null : programDay(picked.key, T);

  return (
    <div className="page">
      <h1 className="page-title">Plan</h1>
      <p className="page-sub">Your trainer's Upper / Lower / Push / Pull / Leg week, {T.session_time} sessions, tempo {T.trainer_plan.tempo}.</p>
      <section className="card"><WeekStrip week={week} onPick={setPicked} /></section>

      {day ? (
        <>
          <div className="section-label">{longWeekday(picked.date)} · {day.label}</div>
          <p className="muted small" style={{ margin: '0 4px 10px' }}>{day.focus}</p>
          <details className="card more">
            <summary>Warm-up: {day.pre_cardio}, then {day.warmup_items.length} drills</summary>
            <div className="stack" style={{ marginTop: 8 }}>
              {day.warmup.slice(1).map((line) => <div key={line} className="muted small">{line}</div>)}
            </div>
          </details>
          <ExerciseList day={day} />
          {day.cardio_after ? <div className="card muted small">After: {day.cooldown[0]}</div> : null}
          {picked.date === today ? (
            <button type="button" className="btn" onClick={() => navigate('/workout')}><Icon name="play" /> Start {day.label}</button>
          ) : (
            <button type="button" className="btn secondary" onClick={() => navigate(`/workout?session=${day.key}`)}><Icon name="play" /> Do {day.label} today instead</button>
          )}
        </>
      ) : (
        <div className="card empty">Rest day. Walk, stretch, sleep well.</div>
      )}

      <details className="card more" style={{ marginTop: 12 }}>
        <summary>What the plan's terms mean</summary>
        <div className="stack small" style={{ marginTop: 8 }}>
          {Object.entries(T.trainer_plan.glossary).map(([k, v]) => <div key={k}><strong>{k.replace(/_/g, ' ')}:</strong> <span className="muted">{v}</span></div>)}
          <div className="muted">{T.progression_note}</div>
        </div>
      </details>
    </div>
  );
}
