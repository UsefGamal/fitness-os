// The app-private folder (Capacitor Filesystem, Directory.Data) behind the
// small interface lib/durable.js expects. Null in a plain browser.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

const D = Directory.Data;

/** P14-17: the device-test build (VITE_FAKE_FS=1, e2e/device.mjs) keeps the
 * "file" in localStorage so the mirror code runs in a browser. The normal
 * build drops this: Vite replaces the flag with undefined. */
function fakeFs() {
  const K = 'fitness-os-fake-fs';
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch { return {}; } };
  const save = (m) => localStorage.setItem(K, JSON.stringify(m));
  return {
    async read(path) { return load()[path] ?? null; },
    async write(path, data) { const m = load(); m[path] = data; save(m); },
    async rename(from, to) { const m = load(); m[to] = m[from]; delete m[from]; save(m); },
    async remove(path) { const m = load(); delete m[path]; save(m); },
    async list(dir) { return Object.keys(load()).filter((k) => k.startsWith(`${dir}/`)); },
  };
}

export const privateFs = import.meta.env.VITE_FAKE_FS ? fakeFs() : Capacitor.isNativePlatform()
  ? {
      async read(path) {
        try {
          return (await Filesystem.readFile({ path, directory: D, encoding: Encoding.UTF8 })).data;
        } catch {
          return null;
        }
      },
      write: (path, data) => Filesystem.writeFile({ path, directory: D, encoding: Encoding.UTF8, data, recursive: true }),
      // Android may refuse to rename over an existing file; then the old
      // one goes first. Readers fall back to the .tmp copy (readMirror).
      async rename(from, to) {
        try {
          await Filesystem.rename({ from, to, directory: D, toDirectory: D });
        } catch {
          await Filesystem.deleteFile({ path: to, directory: D }).catch(() => {});
          await Filesystem.rename({ from, to, directory: D, toDirectory: D });
        }
      },
      remove: (path) => Filesystem.deleteFile({ path, directory: D }).catch(() => {}),
      async list(dir) {
        try {
          const { files } = await Filesystem.readdir({ path: dir, directory: D });
          return files.map((f) => `${dir}/${typeof f === 'string' ? f : f.name}`);
        } catch {
          return [];
        }
      },
    }
  : null;
