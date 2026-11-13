// Progress photo files: re-encoded through a canvas (which drops EXIF,
// including the location) and scaled to 1280 px, then written to the app's
// private Data directory. On the web, Filesystem keeps them in IndexedDB.
// They are not part of backups.
import { Directory, Filesystem } from '@capacitor/filesystem';

import { isPhotoFile } from '../lib/dataFile.js';

import { cacheGet, cachePut, fitSize } from '../lib/photos.js';

const DIR = 'progress-photos';

// Read as a data: URL (the page's CSP allows data: images, not blob:).
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('Could not read that image.'));
    const reader = new FileReader();
    reader.onerror = fail;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = fail;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Decode straight to about 1080 px wide where the WebView can (FEEL-1), so
// a 12-megapixel photo is never held full size in memory; else the old way.
async function decode(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { resizeWidth: 1080, resizeQuality: 'high' });
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch { /* fall through to the image element */ }
  }
  const img = await loadImage(file);
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => {} };
}

/** Clean and store a picked image; returns its file name. */
export async function storePhoto(file, name) {
  const img = await decode(file);
  const { width, height } = fitSize(img.w, img.h);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img.src, 0, 0, width, height);
  img.done();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const path = `${DIR}/${name}.jpg`;
  await Filesystem.writeFile({ path, directory: Directory.Data, data: dataUrl.split(',')[1], recursive: true });
  return path;
}

const cache = new Map();

/** A data: URL for a stored photo (the last few are kept in memory). */
export async function photoUrl(path) {
  if (!isPhotoFile(path)) throw new Error('Not a photo file');
  const hit = cacheGet(cache, path);
  if (hit) return hit;
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
  const url = typeof data === 'string' ? `data:image/jpeg;base64,${data}` : await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(data);
  });
  cachePut(cache, path, url);
  return url;
}

export async function deletePhoto(path) {
  // P14-10: only ever a file in the photos folder, never the data file.
  if (!isPhotoFile(path)) return;
  cache.delete(path);
  await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => {});
}
