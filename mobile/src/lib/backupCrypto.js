// Encrypted backups for cloud folders (BAK-1 part 2). A folder on the
// phone gets the plain export; a folder that syncs off the phone (Google
// Drive and the like) gets this instead, so health data never leaves the
// phone readable.
//
// - One data key per person: 32 random bytes, made once. On the phone it is
//   kept wrapped by the Android Keystore (the native plugin), so backups
//   need no passphrase day to day.
// - A Keystore key does not move to a new phone, so the same data key is
//   also wrapped with a key derived from a recovery passphrase (PBKDF2-
//   SHA256, 600,000 rounds, random salt). That wrapped copy rides in every
//   backup's header. Derived once at set-up, never on each backup.
// - Each file: AES-256-GCM, a fresh 12-byte nonce, and the header as
//   additional data, so a swapped header, a truncated file or a changed
//   byte is refused rather than half-read.
//
// WebCrypto only (crypto.subtle: in the WebView, in browsers and in Node);
// no dependency.

export const ENC_FORMAT = 'fitness-os-backup-enc';
export const ENC_VERSION = 1;
export const KDF_ROUNDS = 600000;
/** Long enough to resist guessing at 600,000 rounds; a few words is best. */
export const MIN_PASSPHRASE = 10;

export class BackupCryptoError extends Error {
  /** @param {'not_encrypted'|'damaged'|'wrong_passphrase'|'no_key'} code */
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes) {
  let s = '';
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new BackupCryptoError('damaged');
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

const random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** A new data key and its short id: { key (32 bytes), kid }. */
export function newDataKey() {
  return { key: random(32), kid: toB64(random(9)) };
}

const aesKey = (raw, usage) => subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, usage);

async function passKey(passphrase, salt, rounds) {
  const base = await subtle().importKey('raw', enc.encode(String(passphrase).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Why a new passphrase can't be used yet, or null. */
export function passphraseProblem(pass, again) {
  if (typeof pass !== 'string' || pass.normalize('NFKC').trim().length < MIN_PASSPHRASE) return 'short';
  if (pass !== again) return 'mismatch';
  return null;
}

/** The data key wrapped with the recovery passphrase, for every header:
 * { kdf, rounds, salt, iv, key }. Takes the slow derivation once. */
export async function makeRecovery(dataKey, passphrase, { rounds = KDF_ROUNDS } = {}) {
  const salt = random(16);
  const iv = random(12);
  const k = await passKey(passphrase, salt, rounds);
  const wrapped = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, k, dataKey));
  return { kdf: 'PBKDF2-SHA256', rounds, salt: toB64(salt), iv: toB64(iv), key: toB64(wrapped) };
}

/** Is this text an encrypted backup (whatever its state)? */
export function isEncrypted(text) {
  return typeof text === 'string' && text.trimStart().startsWith('{') && text.includes(`"format":"${ENC_FORMAT}"`);
}

// The header in a fixed key order: these exact bytes are the GCM
// additional data, so nothing in it can change unnoticed.
const headerOf = (h) => ({ format: ENC_FORMAT, v: ENC_VERSION, kid: h.kid, recovery: { kdf: h.recovery.kdf, rounds: h.recovery.rounds, salt: h.recovery.salt, iv: h.recovery.iv, key: h.recovery.key } });
const aad = (h) => enc.encode(JSON.stringify(headerOf(h)));

/** Encrypt a backup's text: one line of JSON, the header then the data. */
export async function encryptBackup(text, dataKey, { kid, recovery }) {
  const header = headerOf({ kid, recovery });
  const iv = random(12);
  const k = await aesKey(dataKey, ['encrypt']);
  const data = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(header) }, k, enc.encode(text)));
  return JSON.stringify({ ...header, iv: toB64(iv), data: toB64(data) });
}

/** The parsed file: { header, iv, data }. Throws not_encrypted or damaged. */
export function readEncrypted(text) {
  if (!isEncrypted(text)) throw new BackupCryptoError('not_encrypted');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupCryptoError('damaged');
  }
  const r = raw?.recovery;
  const ok = raw && raw.format === ENC_FORMAT && raw.v === ENC_VERSION && typeof raw.kid === 'string'
    && r && r.kdf === 'PBKDF2-SHA256' && Number.isInteger(r.rounds) && r.rounds >= 1000 && r.rounds <= 10000000
    && ['salt', 'iv', 'key'].every((k) => typeof r[k] === 'string') && typeof raw.iv === 'string' && typeof raw.data === 'string';
  if (!ok) throw new BackupCryptoError('damaged');
  return { header: headerOf(raw), iv: fromB64(raw.iv), data: fromB64(raw.data) };
}

/** Decrypt with the data key itself. Throws damaged (also for a file made
 * with another key: GCM can't tell the two apart). */
export async function decryptWithKey(text, dataKey) {
  const { header, iv, data } = readEncrypted(text);
  try {
    const k = await aesKey(dataKey, ['decrypt']);
    return dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: aad(header) }, k, data));
  } catch {
    throw new BackupCryptoError('damaged');
  }
}

/** The data key from a file's header and the recovery passphrase. Throws
 * wrong_passphrase. */
export async function keyFromPassphrase(text, passphrase) {
  const { header } = readEncrypted(text);
  const r = header.recovery;
  try {
    const k = await passKey(passphrase, fromB64(r.salt), r.rounds);
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(r.iv) }, k, fromB64(r.key)));
  } catch {
    throw new BackupCryptoError('wrong_passphrase');
  }
}

/** Decrypt with the recovery passphrase (a new phone, or no Keystore key). */
export async function decryptWithPassphrase(text, passphrase) {
  return decryptWithKey(text, await keyFromPassphrase(text, passphrase));
}

/** The key id a file was made with, or null when it isn't one of ours. */
export function kidOf(text) {
  try {
    return readEncrypted(text).header.kid;
  } catch {
    return null;
  }
}
