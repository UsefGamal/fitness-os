// Draws the app in the chosen theme (lib/theme.js): data-theme on <html>,
// the browser bar colour and, on the phone, the status bar icons.
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { resolveTheme, THEME_BG } from '../lib/theme.js';

const phoneQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null);

export function applyTheme(choice) {
  const theme = resolveTheme(choice, Boolean(phoneQuery()?.matches));
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[theme]);
  if (Capacitor.isNativePlatform()) {
    // Dark icons on the light page, light icons on the dark one.
    StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: THEME_BG[theme] }).catch(() => {});
  }
  return theme;
}

/** Follow the phone while the choice is 'system'; returns a stop function. */
export function followPhone(choice) {
  const q = phoneQuery();
  if (!q || choice !== 'system') return () => {};
  const on = () => applyTheme(choice);
  q.addEventListener?.('change', on);
  return () => q.removeEventListener?.('change', on);
}
