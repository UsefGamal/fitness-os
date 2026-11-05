// File mirror of the data on the phone (Capacitor Filesystem, app-private
// Data directory). In a plain browser (dev, tests) these are no-ops.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

import { alternateName } from '../lib/fileNames.js';

const PATH = 'fitness-os-data.json';
let pending = null;
let timer = null;

export async function readMirror() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { data } = await Filesystem.readFile({ path: PATH, directory: Directory.Data, encoding: Encoding.UTF8 });
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** Coalesces bursts (tapping + on a stepper) into one write. */
export function writeMirror(data) {
  if (!Capacitor.isNativePlatform()) return;
  pending = data;
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

async function flush() {
  const data = pending;
  pending = null;
  if (!data) return;
  try {
    await Filesystem.writeFile({ path: PATH, directory: Directory.Data, encoding: Encoding.UTF8, data: JSON.stringify(data) });
  } catch (err) {
    console.error('Could not write the data mirror', err);
  }
}

/** Save a file the person can find (Documents), or download it in a browser.
 * Android only lets an app overwrite files it created itself, and a
 * reinstalled app counts as another app, so a file left by an earlier
 * install can't be replaced: then it's saved under a new name instead. */
export async function saveExport(filename, text, type = 'application/json') {
  if (Capacitor.isNativePlatform()) {
    const write = (path) => Filesystem.writeFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8, data: text, recursive: true });
    try {
      return (await write(filename)).uri;
    } catch {
      return (await write(alternateName(filename, new Date()))).uri;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}
