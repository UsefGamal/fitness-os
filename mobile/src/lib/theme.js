// Light theme (THEME-1). settings.theme is 'dark' (the default), 'light'
// or 'system' (match the phone). Pure; theme.test.js.
export const THEMES = ['dark', 'light', 'system'];
/** The page colour per theme, for the browser bar and the status bar. */
export const THEME_BG = { dark: '#000000', light: '#f2f2f7' };

export function themeChoice(data) {
  const v = data?.settings?.theme;
  return THEMES.includes(v) ? v : 'dark';
}

/** 'dark' or 'light' to draw with. `phoneLight`: the phone asks for light. */
export function resolveTheme(choice, phoneLight = false) {
  if (choice === 'light') return 'light';
  if (choice === 'system') return phoneLight ? 'light' : 'dark';
  return 'dark';
}

export function setTheme(data, choice) {
  return THEMES.includes(choice) ? { ...data, settings: { ...data.settings, theme: choice } } : data;
}
