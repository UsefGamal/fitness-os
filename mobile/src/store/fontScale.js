// The phone's font size, read once at start (store/native.js), for the
// text-size default (lib/theme.js textSize). 1 until it is known.
import { create } from 'zustand';

import { systemFontScale } from './native.js';

export const useFontScale = create(() => ({ scale: 1 }));

let asked = false;
export function loadFontScale() {
  if (asked) return;
  asked = true;
  systemFontScale().then((scale) => useFontScale.setState({ scale }));
}
