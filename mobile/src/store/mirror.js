// File mirror of the data on the phone (Capacitor Filesystem, app-private
// Data directory). Written atomically (tmp + rename, lib/durable.js). In a
// plain browser (dev, tests) these are no-ops.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

import { parseCopy, serialWriter } from '../lib/durable.js';
import { alternateName } from '../lib/fileNames.js';
import { privateFs } from './fs.js';

const PATH = 'fitness-os-data.json';
let pending = null;
let timer = null;
let onResult = () => {};
let lastMs = null;

/** How long the last mirror write took, in ms (null before the first). PROOF-1. */
export const lastSaveMs = () => lastMs;

/** Told after every mirror write: true when it landed, false when it failed. */
export function onMirrorResult(fn) {
  onResult = fn;
}

export const hasMirror = Boolean(privateFs);

/** The mirror's raw text and parsed copy. Falls back to the .tmp file if
 * a write was cut off between deleting the old file and the rename. */
export async function readMirror() {
  if (!privateFs) return null;
  for (const path of [PATH, `${PATH}.tmp`]) {
    const text = await privateFs.read(path);
    const data = parseCopy(text);
    if (data) return { text, data };
  }
  return null;
}

/** Drop a write still waiting (Delete everything). */
export function cancelMirror() {
  clearTimeout(timer);
  pending = null;
}

/** Coalesces bursts (tapping + on a stepper) into one write. `now`: write
 * at once (the app is going to the background and may be killed, TL-09). */
export function writeMirror(data, now = false) {
  if (!privateFs) return;
  pending = data;
  clearTimeout(timer);
  if (now) flush();
  else timer = setTimeout(flush, 300);
}

// Writes run one at a time (audit DATA-1).
const writer = privateFs ? serialWriter(privateFs, PATH, (ok, ms, err) => {
  if (ok) lastMs = Math.round(ms);
  else console.error('Could not write the data mirror', err);
  onResult(ok);
}, () => performance.now()) : null;

function flush() {
  const data = pending;
  pending = null;
  if (!data || !writer) return Promise.resolve();
  return writer.write(JSON.stringify(data));
}

/** Write anything still waiting now, and resolve once every mirror write
 * has landed (a restore before it reloads, Delete everything before it
 * empties the folder: audit DATA-3, DATA-7). */
export function mirrorIdle() {
  clearTimeout(timer);
  if (pending) flush();
  return writer ? writer.idle() : Promise.resolve();
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
