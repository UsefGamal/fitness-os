// Delete everything (HELP-1, SEC-21): every copy this app keeps on the
// phone, then a fresh start. Health Connect rows and the automatic backups
// in the person's folder go too when they ask for it. Exported files and
// share copies are wherever the person put them; the Privacy page says so.
import { Directory, Filesystem } from '@capacitor/filesystem';

import { healthIdsToDelete } from '../lib/privacy.js';
import { turnOffBackup } from './autoBackup.js';
import { isNative, Health, RestTimer } from './native.js';
import { scheduleReminders } from './notify.js';
import { content, stopSaving, useData } from './useData.js';
import { forgetViews } from '../lib/viewMemory.js';

/** Everything in one of the app's own folders, files and folders alike. */
async function emptyDir(directory) {
  const entries = await Filesystem.readdir({ path: '', directory }).then((r) => r.files || [], () => []);
  for (const e of entries) {
    const name = typeof e === 'string' ? e : e.name;
    const isDir = typeof e === 'object' && e.type === 'directory';
    if (isDir) await Filesystem.rmdir({ path: name, directory, recursive: true }).catch(() => {});
    else await Filesystem.deleteFile({ path: name, directory }).catch(() => {});
  }
}

/**
 * Delete it all, then reload into first-time setup. Each step is
 * best-effort: one that fails never stops the rest.
 * @param {{ health?: boolean, backups?: boolean }} [opts]
 */
export async function deleteEverything({ health = false, backups = true } = {}) {
  const data = useData.getState().data;
  // First what needs the data to know what to remove.
  if (isNative() && health && data.settings?.health?.enabled) {
    const ids = healthIdsToDelete(data);
    if (ids.length) await Health.deleteWorkouts({ ids }).catch(() => {});
  }
  if (data.settings?.auto_backup?.on) await turnOffBackup({ keepFiles: !backups }).catch(() => {});
  // Nothing may write a copy back from here on.
  stopSaving();
  await scheduleReminders(content, false).catch(() => {});
  if (isNative()) {
    await RestTimer.stop().catch(() => {});
    await RestTimer.takeLogs().catch(() => {}); // sets logged in the shade, not yet added
    await emptyDir(Directory.Data); // data file, mirror, snapshots, photos
    await emptyDir(Directory.Cache); // share and export copies waiting to be sent
  }
  forgetViews();
  try { localStorage.clear(); } catch { /* blocked: nothing kept there */ }
  try { sessionStorage.clear(); } catch { /* same */ }
  window.location.replace(`${window.location.pathname}#/`);
  window.location.reload();
}
