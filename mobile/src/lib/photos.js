// Progress photos: the list kept in data.progress_photos = [{ id, date,
// pose, file }]. The images themselves stay in the app's private storage on
// the phone (store/photos.js), never in backups or anywhere else. Pure
// helpers, tested in photos.test.js.
import { nextId } from './data.js';

export const POSES = [['front', 'Front'], ['side', 'Side'], ['back', 'Back']];

export function photoList(data) {
  return data.progress_photos || [];
}

export function addPhoto(data, { date, pose, file }) {
  const list = photoList(data);
  return { ...data, progress_photos: [...list, { id: nextId(list), date, pose, file }] };
}

export function removePhoto(data, id) {
  return { ...data, progress_photos: photoList(data).filter((p) => p.id !== id) };
}

/** Photos grouped by date, newest first: [{ date, photos: { pose: photo } }]. */
export function timeline(data) {
  const byDate = new Map();
  for (const p of photoList(data)) {
    if (!byDate.has(p.date)) byDate.set(p.date, {});
    byDate.get(p.date)[p.pose] = p; // the latest of a pose that day wins
  }
  return [...byDate].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, photos]) => ({ date, photos }));
}

/** The first and latest photo of a pose, for before/after, or null. */
export function beforeAfter(data, pose) {
  const list = photoList(data).filter((p) => p.pose === pose).sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
  return list.length >= 2 ? { before: list[0], after: list[list.length - 1] } : null;
}

/** Size to scale an image to so its long side is at most `max`. */
export function fitSize(w, h, max = 1280) {
  const s = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * s), height: Math.round(h * s) };
}
