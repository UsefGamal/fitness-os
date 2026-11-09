// Sharing out of the app: the phone's share sheet (@capacitor/share), the
// browser's Web Share, or the clipboard as a last resort.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/** Share text; returns 'shared' | 'copied' | 'cancelled'. */
export async function shareText(title, text) {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch {
    return 'cancelled';
  }
  await navigator.clipboard?.writeText(text);
  return 'copied';
}

/** Offer a saved file (a file:// uri from saveExport) through the share sheet. */
export async function shareFile(title, uri) {
  if (!Capacitor.isNativePlatform() || !uri) return false;
  try {
    await Share.share({ title, url: uri, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

// Files this app handed to the share sheet before (backups, copies, CSVs).
const SHARED = /^fitness-os-[\w.-]+\.(json|csv|txt)$/;

/** Delete earlier shared files from the cache (pentest JS-03). The newest
 * is kept until the next share, because the app it went to may still be
 * reading it. */
async function clearSharedCopies(Filesystem, Directory, keep) {
  try {
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache });
    for (const f of files || []) {
      const name = typeof f === 'string' ? f : f.name;
      if (name !== keep && SHARED.test(name)) await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => {});
    }
  } catch {
    // An empty or unreadable cache: nothing to clear.
  }
}

/** Hand a text file to the share sheet without leaving a copy in shared
 * Documents (it is written to the app's cache). In a browser: a download. */
export async function shareTextFile(title, filename, text) {
  if (Capacitor.isNativePlatform()) {
    const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem');
    await clearSharedCopies(Filesystem, Directory, filename);
    const { uri } = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, encoding: Encoding.UTF8, data: text });
    await Share.share({ title, url: uri, dialogTitle: title });
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** An image as a data: URL, for files that must stand on their own. */
export async function dataUrlOf(src) {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    // A missing file can come back as the app's own page: only keep images.
    if (!res.ok || !blob.type.startsWith('image/')) return null;
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
