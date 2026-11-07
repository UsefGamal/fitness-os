import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { pushOverlay } from '../lib/overlays.js';
import { SHEET_CLOSE_MS } from '../lib/sheet.js';

const CloseContext = createContext(null);

/** Inside a sheet: close it with the closing animation (P14-16). Outside
 * one, `fallback` is called as is. */
export function useCloseSheet(fallback) {
  const close = useContext(CloseContext);
  return close || fallback;
}

/** A bottom sheet: slides up over the page, closes on the backdrop, the
 * Done button, Android back, or a drag down on the handle (P14-16: it
 * slides down and the scrim fades out, in SHEET_CLOSE_MS; with reduced
 * motion both only fade). Focus moves into the sheet and back to what had
 * it when the sheet closes. */
export default function Sheet({ title, onClose, children }) {
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);
  const start = useRef(null);
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const timer = useRef(null);

  const close = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => closeRef.current(), SHEET_CLOSE_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Android back closes the sheet, not the page (E6-S7).
  useEffect(() => pushOverlay(close), [close]);

  // Focus in, and back out to where it was.
  useEffect(() => {
    const before = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    return () => { if (before && typeof before.focus === 'function' && document.contains(before)) before.focus({ preventScroll: true }); };
  }, []);

  const down = (e) => { start.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const moveP = (e) => { if (start.current != null) setDy(Math.max(0, e.clientY - start.current)); };
  const up = () => {
    if (dy > 80) close();
    start.current = null;
    setDy(0);
  };
  return (
    <CloseContext.Provider value={close}>
      <div className={`sheet-wrap${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="sheet-backdrop" aria-label="Close" onClick={close} />
        <div ref={panel} tabIndex={-1} className="sheet" style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}>
          <div className="sheet-handle" onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}><span /></div>
          <div className="row between" style={{ margin: '0 4px 10px' }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <button type="button" className="btn ghost small" style={{ width: 'auto' }} onClick={close}>Done</button>
          </div>
          <div className="sheet-body">{children}</div>
        </div>
      </div>
    </CloseContext.Provider>
  );
}
