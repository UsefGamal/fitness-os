import { useEffect, useState } from 'react';

import { useTimer } from '../store/useTimer.js';
import Icon from './Icon.jsx';

function fmt(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function RestTimer() {
  const { endsAt, label, add, stop } = useTimer();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (endsAt && left === 0 && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }, [endsAt, left]);
  if (!endsAt) return null;
  return (
    <div className={`timer${left === 0 ? ' done' : ''}`} role="timer" aria-live="polite">
      <Icon name="timer" />
      <div className="grow">
        <div className="t">{left === 0 ? 'Go' : fmt(left)}</div>
        <div className="muted small">{left === 0 ? `Next set: ${label}` : `Rest · then ${label}`}</div>
      </div>
      <button type="button" className="btn small secondary" onClick={() => add(15)}>+15s</button>
      <button type="button" className="icon-btn" aria-label="Stop timer" onClick={stop}>
        <Icon name="x" />
      </button>
    </div>
  );
}
