import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { recall, remember } from '../lib/viewMemory.js';

/**
 * useState that the screen gets back when it is opened again in this run
 * of the app (lib/viewMemory.js): the tab, filter or search it showed.
 * Kept per page path and `name`. With `day`, the value only comes back on
 * that same day. `prefer`, when given, wins over what was kept (a link
 * that asks for a day or tab).
 * @template T
 * @param {string} name
 * @param {T | (() => T)} initial
 * @param {{ day?: string, prefer?: T }} [opts]
 * @returns {[T, import('react').Dispatch<import('react').SetStateAction<T>>]}
 */
export default function useViewState(name, initial, { day, prefer } = {}) {
  const { pathname } = useLocation();
  const key = `${pathname}#${name}`;
  const [value, setValue] = useState(() => (prefer !== undefined ? prefer : recall(key, typeof initial === 'function' ? /** @type {() => T} */ (initial)() : initial, day)));
  useEffect(() => { remember(key, value, day); }, [key, value, day]);
  return [value, setValue];
}
