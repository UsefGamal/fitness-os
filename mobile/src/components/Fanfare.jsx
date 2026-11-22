import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { newBadges, recordBadges } from '../lib/achievements.js';
import { todayISO } from '../lib/dates.js';
import { feedback } from '../store/feedback.js';
import { useFinishBadges } from '../store/finishBadges.js';
import { t } from '../lib/i18n.js';
import { useData } from '../store/useData.js';
import Icon from './Icon.jsx';

const BADGE_CHECK_DELAY_MS = 600;

/** Watches for newly earned badges, records them, and shows a card with a
 * fanfare. The very first check (data from before badges existed) records
 * what's already earned quietly. During a workout the card waits until it
 * is finished or discarded, so it never covers the rest timer (E6-S1).
 * On the finish card the badges join that card instead of covering it, and
 * elsewhere the card sits at the top with no dim layer, away from Start and
 * the thumb (design laws plan #4, #5). */
export default function Fanfare() {
  const location = useLocation();
  const onFinish = location.pathname.startsWith('/history/') && Boolean(location.state?.finished);
  const addFinish = useFinishBadges((s) => s.add);
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
    if (onFinish) {
      addFinish(queued);
      setQueued([]);
      feedback('pr');
      return;
    }
    setShown(queued);
    setQueued([]);
    feedback('pr');
  }, [activeWorkoutId, queued, onFinish, addFinish]);

  // A workout starting while a card shows: put the card away until the
  // workout is over, so it never covers the first exercise (UX-04).
  useEffect(() => {
    if (!activeWorkoutId || !shown) return;
    setQueued((q) => [...shown, ...q]);
    setShown(null);
  }, [activeWorkoutId, shown]);

  // One interrupt at a time (design laws plan #4): while a sheet is open
  // (What's new, a weigh-in) the card waits, and its 5 seconds start after.
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!shown) return undefined;
    const tick = () => setBlocked(Boolean(document.querySelector('.sheet')));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [shown]);

  useEffect(() => {
    if (!shown || blocked) return undefined;
    const id = setTimeout(() => setShown(null), 5000);
    return () => clearTimeout(id);
  }, [shown, blocked]);

  if (!shown || blocked) return null;
  const top = shown[shown.length - 1];
  return (
    <div role="status">
    <button type="button" className="fanfare" onClick={() => setShown(null)}>
      <span className="medal"><Icon name="trophy" /></span>
      <span className="grow" style={{ textAlign: 'start' }}>
        <strong><bdi>{shown.length > 1 ? t('fanfare.many', { n: shown.length }) : t('fanfare.one')}</bdi>: <bdi>{top.label}</bdi></strong>
        <div className="muted small">{top.note}</div>
      </span>
    </button>
    </div>
  );
}
