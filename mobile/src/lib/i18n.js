// The translation layer (E9-S1). t(key, vars) looks a string up in the
// current locale, falls back to English, and fills {placeholders}. A
// missing key returns the key itself so it shows up in testing instead of
// crashing. dirOf() gives the text direction for a locale; App.jsx puts
// lang and dir on <html> so RTL CSS (phase 12) can follow.
//
// New screens use t() from the start; scripts/i18n-lint.mjs stops the
// number of hard-coded strings in views/ and components/ from growing.
import en from '../i18n/en.js';

const CATALOGUES = { en };
const RTL = new Set(['ar', 'fa', 'he', 'ur']);
let current = 'en';

export function setLocale(locale) {
  current = CATALOGUES[locale] ? locale : 'en';
  return current;
}

export function locale() {
  return current;
}

export function addCatalogue(locale, strings) {
  CATALOGUES[locale] = { ...(CATALOGUES[locale] || {}), ...strings };
}

export function t(key, vars = {}) {
  const raw = CATALOGUES[current]?.[key] ?? CATALOGUES.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

export function dirOf(loc) {
  return RTL.has(String(loc).split('-')[0]) ? 'rtl' : 'ltr';
}

/** The locale a person's data asks for (profile.locale, v2), else English. */
export function localeOf(data) {
  return data?.profile?.locale || 'en';
}
