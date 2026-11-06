// The error ring and the bug report (E1-S4). The last RING_SIZE errors
// are kept in localStorage (never in the data file, so never in a backup)
// and go into a plain-text bug report the person chooses to send. The
// report holds versions, counts and errors only: no weights, notes,
// names, photos, health or screening data.

export const RING_SIZE = 20;
const MAX_STACK = 600;

export function errorEntry(err, { route = null, now = Date.now() } = {}) {
  const message = String(err?.message || err || 'Unknown error').slice(0, 300);
  const stack = typeof err?.stack === 'string' ? err.stack.slice(0, MAX_STACK) : null;
  return { at: now, message, stack, route };
}

/** Add an error, keeping only the newest RING_SIZE. */
export function pushError(ring, entry) {
  return [...(Array.isArray(ring) ? ring : []), entry].slice(-RING_SIZE);
}

/** Counts only: how much data there is, not what it says. */
export function dataCounts(data) {
  if (!data) return {};
  const len = (v) => (Array.isArray(v) ? v.length : 0);
  return {
    workouts: len(data.workouts),
    sets: (data.workouts || []).reduce((n, w) => n + len(w.sets), 0),
    weigh_ins: len(data.body_logs),
    meal_logs: len(data.meal_logs),
    photos: len(data.progress_photos),
    plan_edits: Object.keys(data.program?.blocks?.find((b) => b.id === data.program.active_block)?.overrides || data.plan_overrides || {}).length,
    modules_off: Object.entries(data.settings?.modules || {}).filter(([, on]) => on === false).map(([k]) => k).join(',') || 'none',
    health_connect: data.settings?.health?.enabled ? 'on' : 'off',
  };
}

export function bugReport({ app, data, errors, device = {}, now = new Date() }) {
  const lines = [
    'Fitness OS bug report',
    `Time: ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `App: ${app.version} (${app.build})${app.flavor ? ` ${app.flavor} build` : ''}, data schema ${data?.schemaVersion ?? '?'}`,
    `Device: ${device.platform || 'web'}${device.model ? `, ${device.model}` : ''}${device.osVersion ? `, Android ${device.osVersion}` : ''}`,
    `Screen: ${device.screen || '?'}`,
    `WebView: ${device.webview ? `Chrome ${device.webview}` : '?'}`,
    '',
    'Counts:',
    ...Object.entries(dataCounts(data)).map(([k, v]) => `  ${k}: ${v}`),
    '',
    `Last errors (${errors.length}):`,
    ...(errors.length ? errors.slice().reverse().flatMap((e) => [
      `- ${new Date(e.at).toISOString().slice(0, 16).replace('T', ' ')} ${e.route || ''} ${e.message}`,
      ...(e.stack ? e.stack.split('\n').slice(0, 4).map((l) => `    ${l.trim()}`) : []),
    ]) : ['  none']),
    '',
    'What were you doing when it happened?',
    '',
  ];
  return lines.join('\n');
}

/** Phone model and Android version from the WebView's user agent, e.g.
 * "Mozilla/5.0 (Linux; Android 14; 23021RAA2Y Build/UKQ1...)". */
export function deviceFromUA(ua = '') {
  const m = /Android ([\d.]+);\s*([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/.exec(ua);
  if (!m) return {};
  // The WebView's Chrome version: the app needs 111+ (TL-05).
  const chrome = /Chrome\/(\d+)/.exec(ua);
  return { osVersion: m[1], model: m[2].trim() === 'K' ? null : m[2].trim(), ...(chrome ? { webview: chrome[1] } : {}) };
}
