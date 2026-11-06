// Progress photo files: re-encoded through a canvas (which drops EXIF,
// including the location) and scaled to 1280 px, then written to the app's
// private Data directory. On the web, Filesystem keeps them in IndexedDB.
// They are not part of backups.
import { Directory, Filesystem } from '@capacitor/filesystem';

import { isPhotoFile } from '../lib/dataFile.js';

import { fitSize } from '../lib/photos.js';

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

/** Clean and store a picked image; returns its file name. */
export async function storePhoto(file, name) {
  const img = await loadImage(file);
  const { width, height } = fitSize(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const path = `${DIR}/${name}.jpg`;
  await Filesystem.writeFile({ path, directory: Directory.Data, data: dataUrl.split(',')[1], recursive: true });
  return path;
}

const cache = new Map();

/** A data: URL for a stored photo (cached while the app runs). */
export async function photoUrl(path) {
  if (!isPhotoFile(path)) throw new Error('Not a photo file');
  if (cache.has(path)) return cache.get(path);
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
  const url = typeof data === 'string' ? `data:image/jpeg;base64,${data}` : await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(data);
  });
  cache.set(path, url);
  return url;
}

export async function deletePhoto(path) {
  // P14-10: only ever a file in the photos folder, never the data file.
  if (!isPhotoFile(path)) return;
  cache.delete(path);
  await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => {});
}
