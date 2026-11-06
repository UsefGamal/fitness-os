import { useEffect, useRef, useState } from 'react';

import { pushOverlay } from '../lib/overlays.js';

/** A bottom sheet: slides up over the page, closes on the backdrop, the
 * Done button, or a drag down on the handle. */
export default function Sheet({ title, onClose, children }) {
  const [dy, setDy] = useState(0);
  const start = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Android back closes the sheet, not the page (E6-S7).
  useEffect(() => pushOverlay(() => closeRef.current()), []);
  const down = (e) => { start.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const moveP = (e) => { if (start.current != null) setDy(Math.max(0, e.clientY - start.current)); };
  const up = () => {
    if (dy > 80) onClose();
    start.current = null;
    setDy(0);
  };
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}>
        <div className="sheet-handle" onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}><span /></div>
        <div className="row between" style={{ margin: '0 4px 10px' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn ghost small" style={{ width: 'auto' }} onClick={onClose}>Done</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
