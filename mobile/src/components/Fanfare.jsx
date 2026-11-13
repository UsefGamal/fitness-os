import { useEffect, useState } from 'react';

import { newBadges, recordBadges } from '../lib/achievements.js';
import { todayISO } from '../lib/dates.js';
import { feedback } from '../store/feedback.js';
import { useData } from '../store/useData.js';
import Icon from './Icon.jsx';

const BADGE_CHECK_DELAY_MS = 600;

/** Watches for newly earned badges, records them, and shows a card with a
 * fanfare. The very first check (data from before badges existed) records
 * what's already earned quietly. During a workout the card waits until it
 * is finished or discarded, so it never covers the rest timer (E6-S1). */
export default function Fanfare() {
  const data = useData((s) => s.data);
  const update = useData((s) => s.update);
  const activeWorkoutId = useData((s) => s.activeWorkoutId);
  const [queued, setQueued] = useState([]);
  const [shown, setShown] = useState(null);

  // Checking every badge reads the whole history, so it waits until saves
  // pause (FEEL-1): logging a set stays one short task, and a run of quick
  // saves is checked once.
  useEffect(() => {
    const id = setTimeout(() => {
      const now = useData.getState().data;
      const today = todayISO();
      const fresh = newBadges(now, today);
      const first = !now.achievements;
      if (!fresh.length && !first) return;
      update((d) => recordBadges({ ...d, achievements: d.achievements || {} }, fresh.map((b) => b.id), today));
      if (first || !fresh.length) return;
      setQueued((q) => [...q, ...fresh]);
    }, BADGE_CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, [data, update]);

  useEffect(() => {
    if (activeWorkoutId || !queued.length) return;
    setShown(queued);
    setQueued([]);
    feedback('pr');
  }, [activeWorkoutId, queued]);

  // A workout starting while a card shows: put the card away until the
  // workout is over, so it never covers the first exercise (UX-04).
  useEffect(() => {
    if (!activeWorkoutId || !shown) return;
    setQueued((q) => [...shown, ...q]);
    setShown(null);
  }, [activeWorkoutId, shown]);

  useEffect(() => {
    if (!shown) return undefined;
    const id = setTimeout(() => setShown(null), 5000);
    return () => clearTimeout(id);
  }, [shown]);

  if (!shown) return null;
  const top = shown[shown.length - 1];
  return (
    <div role="status">
    <button type="button" className="fanfare" onClick={() => setShown(null)}>
      <span className="medal"><Icon name="trophy" /></span>
      <span className="grow" style={{ textAlign: 'start' }}>
        <strong>{shown.length > 1 ? `${shown.length} new badges` : 'New badge'}: {top.label}</strong>
        <div className="muted small">{top.note}</div>
      </span>
    </button>
    </div>
  );
}
