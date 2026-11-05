// The app-private folder (Capacitor Filesystem, Directory.Data) behind the
// small interface lib/durable.js expects. Null in a plain browser.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

const D = Directory.Data;

export const privateFs = Capacitor.isNativePlatform()
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
