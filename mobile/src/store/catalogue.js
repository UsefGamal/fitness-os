// Loads the bundled exercise catalogue once, on first use (about 1 MB of
// JSON, so it isn't part of the app's start-up bundle).
import { useEffect, useState } from 'react';

let cache = null;
let pending = null;

export function loadCatalogue() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch('exercise-db/index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((index) => {
        cache = { ...index, byId: new Map(index.exercises.map((e) => [e.id, e])) };
        return cache;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

/** { catalogue, error }: catalogue is null until loaded. */
export function useCatalogue() {
  const [state, setState] = useState({ catalogue: cache, error: null });
  useEffect(() => {
    if (cache) return undefined;
    let live = true;
    loadCatalogue().then(
      (catalogue) => live && setState({ catalogue, error: null }),
      (error) => live && setState({ catalogue: null, error }),
    );
    return () => { live = false; };
  }, []);
  return state;
}
