// Photo lock (P14-13): when Photos needs the phone's lock again. Pure; the
// native side is PhotoLockPlugin.java and the screen is views/Photos.jsx.
//
// Leaving (the Photos screen, or the app while on it) starts a 60 s grace.
// Coming back inside it keeps Photos open; after it, Photos is locked again.
// A trip the app starts itself (its own camera or file picker, or the lock
// screen) never counts as leaving.

export const RELOCK_MS = 60 * 1000;
export const LOCKED = { unlocked: false, leftAt: null, external: false };

/** Is the photo lock on? On by default; the person can switch it off. */
export function photoLockOn(data) {
  return data?.settings?.photo_lock !== false;
}

export function setPhotoLock(data, on) {
  return { ...data, settings: { ...data.settings, photo_lock: on } };
}

/** An imported backup or restored snapshot never switches the lock off
 * (pentest AND-01): someone holding the unlocked phone could otherwise
 * export, edit photo_lock to false and import. The lock is only switched
 * off from inside Photos, after the phone's lock was asked for. */
export function keepPhotoLock(current, incoming) {
  if (!incoming || !photoLockOn(current) || photoLockOn(incoming)) return incoming;
  return setPhotoLock(incoming, true);
}

/** The next lock state after an event: 'unlock' | 'lock' | 'external'
 * (the app is about to open its own picker) | 'leave' | 'return'. */
export function photoLockStep(state, event, now = Date.now()) {
  const s = { ...LOCKED, ...state };
  switch (event) {
    case 'unlock': return { unlocked: true, leftAt: null, external: false };
    case 'lock': return { ...LOCKED };
    case 'external': return { ...s, external: true };
    case 'leave': return s.external ? s : { ...s, leftAt: s.leftAt ?? now };
    case 'return':
      if (s.external) return { ...s, external: false, leftAt: null };
      if (s.unlocked && s.leftAt != null && now - s.leftAt >= RELOCK_MS) return { ...LOCKED };
      return { ...s, leftAt: null };
    default: return s;
  }
}

/** Can Photos be shown now? */
export function photosOpen(state, now = Date.now()) {
  return Boolean(state?.unlocked) && (state.leftAt == null || now - state.leftAt < RELOCK_MS);
}
