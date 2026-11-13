// The fields a set gained in data version 3 (V3): what kind of set it is,
// its superset group, and what is tracked when it is not a plain load.
// The workout screen sets set_type (warm-up, drop set, to failure) on a
// logged set; the other fields are still written as defaults only.
//
//   set_type    'work' | 'warmup' | 'drop' | 'failure'
//   group       superset label within the workout ("A"), up to 8 chars
//   track       'load' | 'bodyweight' | 'time' | 'distance'
//   added_kg    signed load on a bodyweight move (negative = assisted)
//   distance_m  whole metres
//   duration_s  whole seconds
//
// is_warmup stays on every set: older readers and isWorkSet still use it.
//
// The fields are stored sparsely: a set holds one only when it differs
// from its default, and setFields() fills the rest in when reading.
// Writing all six on every set made a three-year backup grow from 2.6 MB
// to 4.2 MB, and the phone's main copy has to fit in about 5 MB.

export const SET_TYPES = ['work', 'warmup', 'drop', 'failure'];
export const TRACKS = ['load', 'bodyweight', 'time', 'distance'];

/** The six fields, in the order they are written. */
export const SET_FIELDS = ['set_type', 'group', 'track', 'added_kg', 'distance_m', 'duration_s'];

/** What a set without a field means. */
export const SET_DEFAULTS = Object.freeze({ set_type: 'work', group: null, track: 'load', added_kg: null, distance_m: null, duration_s: null });

const numberIn = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const integerIn = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** The default set_type of a set: a warm-up stays a warm-up. */
export function typeDefault(set) {
  return set?.is_warmup === true ? 'warmup' : 'work';
}

/** The six fields for `set`, each checked: a value of the wrong type or
 * out of range becomes its default, never trusted (an imported file can
 * hold anything). */
export function setFields(set) {
  const s = set || {};
  return {
    set_type: SET_TYPES.includes(s.set_type) ? s.set_type : typeDefault(s),
    group: typeof s.group === 'string' && s.group.length > 0 && s.group.length <= 8 ? s.group : null,
    track: TRACKS.includes(s.track) ? s.track : 'load',
    added_kg: numberIn(s.added_kg, -200, 300),
    distance_m: integerIn(s.distance_m, 0, 100000),
    duration_s: integerIn(s.duration_s, 0, 86400),
  };
}

/** `set` with the six fields checked and kept sparse: a field that is
 * missing, invalid or at its default is not stored. Returns the same
 * object when nothing needs to change. Every import goes through this. */
export function cleanSet(set) {
  if (!set || typeof set !== 'object') return set;
  const clean = setFields(set);
  let out = set;
  for (const k of SET_FIELDS) {
    if (!(k in set)) continue;
    const keep = set[k] === clean[k] && !isSetDefault(set, k);
    if (keep) continue;
    if (out === set) out = { ...set };
    delete out[k];
  }
  return out;
}

/** `set` with some of the six fields changed, checked and kept sparse.
 * The one way for a screen to write them. */
export function setWith(set, changes) {
  const next = { ...set };
  for (const k of SET_FIELDS) if (k in (changes || {})) next[k] = changes[k];
  return cleanSet(next);
}

/** Is this field at its default? The data check code leaves such fields
 * out, so writing a default out in full never changes the code
 * (lib/dataCheck.js). */
export function isSetDefault(set, key) {
  if (key === 'set_type') return set.set_type === typeDefault(set);
  return key in SET_DEFAULTS && set[key] === SET_DEFAULTS[key];
}

/** The letter a set shows in place of its number: W, D or F. */
export const TYPE_LETTER = { warmup: 'W', drop: 'D', failure: 'F' };

/** `set` as another kind of set. is_warmup follows, so isWorkSet, the
 * records and older readers agree that a warm-up is not a work set. */
export function withType(set, type) {
  if (!SET_TYPES.includes(type)) return set;
  return setWith({ ...set, is_warmup: type === 'warmup' }, { set_type: type });
}

/** The kinds someone may pick. "To failure" is left out while the safety
 * check asks for beginner-only training or a doctor's clearance. */
export function typeChoices({ gentle = false } = {}) {
  return SET_TYPES.filter((k) => !(gentle && k === 'failure'));
}
