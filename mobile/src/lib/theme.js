// Light theme (THEME-1). settings.theme is 'dark' (the default), 'light'
// or 'system' (match the phone). Pure; theme.test.js.
export const THEMES = ['dark', 'light', 'system'];
/** The page colour per theme, for the browser bar and the status bar. */
export const THEME_BG = { dark: '#000000', light: '#eef1ee' };

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

// Text size (UIUX-2): 100, 115 or 130 percent, in Settings > Look. Every
// font size up to 34 px is `calc(Npx * var(--ts))`; the big timer digits
// stay as they are, they are display sizes already.
export const TEXT_SIZES = [100, 115, 130];

// The WebView ignores Android's own font size (MainActivity sets its text
// zoom to 100), so the two never multiply (design laws #12: system 130% x
// app 130% was about 170%). Until someone picks a size here, the app starts
// from the phone's size, capped at the largest step.
export function sizeForSystem(fontScale) {
  const f = Number(fontScale);
  if (!Number.isFinite(f) || f < 1.08) return 100;
  return f < 1.22 ? 115 : 130;
}

export function textSize(data, fontScale = 1) {
  const v = data?.settings?.text_size;
  return TEXT_SIZES.includes(v) ? v : sizeForSystem(fontScale);
}

/** The --ts value for a size: 1, 1.15 or 1.3. */
export function textScale(size) {
  return (TEXT_SIZES.includes(size) ? size : 100) / 100;
}

export function setTextSize(data, size) {
  return TEXT_SIZES.includes(size) ? { ...data, settings: { ...data.settings, text_size: size } } : data;
}

// Reduce motion (MOVE-2): an in-app switch in Settings > Look, for phones
// where Android's own "Remove animations" is hard to find. On, the app acts
// as if the phone asked for reduced motion (store/motionFx.js reducedMotion,
// and the :root[data-motion="reduce"] rules in styles.css).
export function reduceMotion(data) {
  return data?.settings?.reduce_motion === true;
}

export function setReduceMotion(data, on) {
  return { ...data, settings: { ...data.settings, reduce_motion: Boolean(on) } };
}
