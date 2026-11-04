import { useRef, useState } from 'react';

const LIMIT = 90; // px past which a swipe counts

/** A row you can swipe: left runs onLeft (delete), right runs onRight (copy).
 * The buttons inside stay tappable; a short drag does nothing. */
export default function SwipeRow({ children, onLeft, onRight, leftLabel = 'Delete', rightLabel = 'Copy' }) {
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, locked: null };
  };
  const move = (e) => {
    const s = start.current;
    if (!s) return;
    const x = e.clientX - s.x;
    const y = e.clientY - s.y;
    if (s.locked === null && (Math.abs(x) > 8 || Math.abs(y) > 8)) {
      s.locked = Math.abs(x) > Math.abs(y) ? 'x' : 'y';
      if (s.locked === 'x') e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (s.locked === 'x') setDx(Math.max(onLeft ? -140 : 0, Math.min(onRight ? 140 : 0, x)));
  };
  const up = () => {
    if (dx <= -LIMIT && onLeft) onLeft();
    else if (dx >= LIMIT && onRight) onRight();
    start.current = null;
    setDx(0);
  };
  return (
    <div className="swipe">
      <div className="swipe-under" aria-hidden="true">
        <span className={`swipe-right${dx >= LIMIT ? ' on' : ''}`}>{dx > 0 ? rightLabel : ''}</span>
        <span className={`swipe-left${dx <= -LIMIT ? ' on' : ''}`}>{dx < 0 ? leftLabel : ''}</span>
      </div>
      <div className="swipe-top" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {children}
      </div>
    </div>
  );
}
