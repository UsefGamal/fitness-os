// Catches errors anywhere in the app into the ring (lib/errors.js), and
// builds the bug report. The ring lives in localStorage only.
import { Capacitor } from '@capacitor/core';

import { bugReport, deviceFromUA, errorEntry, pushError } from '../lib/errors.js';
import { APP } from '../lib/version.js';
import { useData } from './useData.js';

const KEY = 'fitness-os-errors';

export function readErrors() {
  try {
    const ring = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(ring) ? ring : [];
  } catch {
    return [];
  }
}

export function recordError(err) {
  try {
    const route = typeof window !== 'undefined' ? window.location.hash.split('?')[0].replace(/\/\d+/g, '/:id') || '#/' : null;
    localStorage.setItem(KEY, JSON.stringify(pushError(readErrors(), errorEntry(err, { route }))));
  } catch {
    // Storage blocked: nothing else to do.
  }
}

let installed = false;
export function catchErrors() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => recordError(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => recordError(e.reason));
}

export function currentReport() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const device = {
    platform: Capacitor.getPlatform(),
    ...deviceFromUA(ua),
    screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x` : null,
  };
  return bugReport({ app: APP, data: useData.getState().data, errors: readErrors(), device });
}
