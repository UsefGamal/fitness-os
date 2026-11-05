// File mirror of the data on the phone (Capacitor Filesystem, app-private
// Data directory). Written atomically (tmp + rename, lib/durable.js). In a
// plain browser (dev, tests) these are no-ops.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

import { atomicWrite, parseCopy } from '../lib/durable.js';
import { alternateName } from '../lib/fileNames.js';
import { privateFs } from './fs.js';

const PATH = 'fitness-os-data.json';
let pending = null;
let timer = null;

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

/** Coalesces bursts (tapping + on a stepper) into one write. */
export function writeMirror(data) {
  if (!privateFs) return;
  pending = data;
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

async function flush() {
  const data = pending;
  pending = null;
  if (!data) return;
  try {
    await atomicWrite(privateFs, PATH, JSON.stringify(data));
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
