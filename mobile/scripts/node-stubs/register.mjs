// node --import ./scripts/node-stubs/register.mjs: what store/ code needs
// from a browser, in memory. See hooks.mjs.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);

class MemoryStorage {
  #m = new Map();
  get length() { return this.#m.size; }
  key(i) { return [...this.#m.keys()][i] ?? null; }
  getItem(k) { return this.#m.has(String(k)) ? this.#m.get(String(k)) : null; }
  setItem(k, v) { this.#m.set(String(k), String(v)); }
  removeItem(k) { this.#m.delete(String(k)); }
  clear() { this.#m.clear(); }
}
if (typeof globalThis.localStorage === 'undefined') globalThis.localStorage = new MemoryStorage();
