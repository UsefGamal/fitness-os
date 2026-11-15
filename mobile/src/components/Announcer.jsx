import { useEffect, useRef, useState } from 'react';

import { onAnnounce } from '../lib/announce.js';

/** The app's one live region (A11Y-1). It stays mounted, so TalkBack is
 * already watching it when the words arrive. Two slots take turns so the
 * same line said twice in a row (two sets of 8) is still spoken. */
export default function Announcer() {
  const [lines, setLines] = useState(['', '']);
  const turn = useRef(0);
  useEffect(() => onAnnounce((text) => {
    turn.current = 1 - turn.current;
    const next = ['', ''];
    next[turn.current] = text;
    setLines(next);
  }), []);
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{lines[0]}</div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{lines[1]}</div>
    </>
  );
}
