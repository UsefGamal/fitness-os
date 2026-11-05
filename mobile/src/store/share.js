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
