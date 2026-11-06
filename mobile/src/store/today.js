import { useEffect, useState } from 'react';

import { msUntilMidnight, todayISO } from '../lib/dates.js';

/** Today's local date that moves on by itself: at midnight while the app is
 * open, and when the app comes back to the front (a phone asleep past
 * midnight). A tap at 00:01 then logs to the new day (QA-03). */
export function useToday() {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    let id = 0;
    const check = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()));
    const arm = () => {
      clearTimeout(id);
      id = setTimeout(() => { check(); arm(); }, msUntilMidnight());
    };
    const onShow = () => { if (document.visibilityState === 'visible') { check(); arm(); } };
    arm();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, []);
  return today;
}
