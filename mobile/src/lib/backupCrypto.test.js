import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BackupCryptoError, decryptWithKey, decryptWithPassphrase, encryptBackup, ENC_FORMAT, fromB64, isEncrypted, KDF_ROUNDS,
  keyFromPassphrase, kidOf, makeRecovery, MIN_PASSPHRASE, newDataKey, passphraseProblem, readEncrypted, toB64,
} from './backupCrypto.js';
import { parseDataFile, toDataFile } from './dataFile.js';
import { emptyData } from './data.js';
import { content } from './testContent.js';

const PASS = 'correct horse battery';
// The real 600,000 rounds once (below); the other tests use a small count
// so the suite stays fast. The code path is the same.
const FAST = { rounds: 1000 };

async function kit(pass = PASS) {
  const { key, kid } = newDataKey();
  const recovery = await makeRecovery(key, pass, FAST);
  return { key, kid, recovery };
}

const code = (c) => (err) => err instanceof BackupCryptoError && err.code === c;

test('base64 round trip, and junk is refused', () => {
  const b = new Uint8Array([0, 1, 2, 250, 255, 128]);
  assert.deepEqual(fromB64(toB64(b)), b);
  assert.deepEqual(fromB64(toB64(new Uint8Array(100000))).length, 100000);
  assert.throws(() => fromB64('not base64!'), code('damaged'));
  assert.throws(() => fromB64(7), code('damaged'));
});

test('a new key: 32 bytes and an id, different each time', () => {
  const a = newDataKey();
  const b = newDataKey();
  assert.equal(a.key.length, 32);
  assert.notEqual(a.kid, b.kid);
  assert.notDeepEqual(a.key, b.key);
});

test('passphrase rules: long enough and typed twice the same', () => {
  assert.equal(passphraseProblem('short', 'short'), 'short');
  assert.equal(passphraseProblem('          x', '          x'), 'short');
  assert.equal(passphraseProblem(null, null), 'short');
  assert.equal(passphraseProblem('a'.repeat(MIN_PASSPHRASE), 'b'.repeat(MIN_PASSPHRASE)), 'mismatch');
  assert.equal(passphraseProblem(PASS, PASS), null);
});

test('encrypted round trip with the key and with the passphrase', async () => {
  const k = await kit();
  const text = toDataFile(emptyData(content), new Date(2026, 10, 13), { compact: true });
  const file = await encryptBackup(text, k.key, k);
  assert.ok(isEncrypted(file));
  assert.ok(!isEncrypted(text));
  assert.ok(!file.includes('"workouts"'));
  assert.equal(JSON.parse(file).format, ENC_FORMAT);
  assert.equal(kidOf(file), k.kid);
  assert.equal(kidOf(text), null);
  assert.equal(await decryptWithKey(file, k.key), text);
  assert.equal(await decryptWithPassphrase(file, PASS), text);
  assert.deepEqual(await keyFromPassphrase(file, PASS), k.key);
  // And it restores through the normal import.
  assert.deepEqual(parseDataFile(await decryptWithPassphrase(file, PASS), content).workouts, []);
  // The same text twice gives two different files (fresh nonce).
  assert.notEqual(await encryptBackup(text, k.key, k), file);
});

test('wrong passphrase is refused, and says so', async () => {
  const k = await kit();
  const file = await encryptBackup('{"a":1}', k.key, k);
  await assert.rejects(decryptWithPassphrase(file, 'correct horse batterY'), code('wrong_passphrase'));
  await assert.rejects(decryptWithPassphrase(file, ''), code('wrong_passphrase'));
});

test('another key, a swapped header, a changed byte or a truncated file are refused', async () => {
  const a = await kit();
  const b = await kit();
  const fa = await encryptBackup('{"from":"a"}', a.key, a);
  const fb = await encryptBackup('{"from":"b"}', b.key, b);
  await assert.rejects(decryptWithKey(fa, b.key), code('damaged'));
  // b's data under a's header (both decrypt fine on their own).
  const ja = JSON.parse(fa);
  const jb = JSON.parse(fb);
  await assert.rejects(decryptWithKey(JSON.stringify({ ...ja, iv: jb.iv, data: jb.data }), a.key), code('damaged'));
  // A header field changed (the key id) with the data left alone.
  await assert.rejects(decryptWithKey(JSON.stringify({ ...ja, kid: b.kid }), a.key), code('damaged'));
  // One byte of the data changed.
  const bytes = fromB64(ja.data);
  bytes[3] ^= 1;
  await assert.rejects(decryptWithKey(JSON.stringify({ ...ja, data: toB64(bytes) }), a.key), code('damaged'));
  // Cut short: no longer JSON.
  await assert.rejects(decryptWithKey(fa.slice(0, fa.length - 20), a.key), code('damaged'));
  // Cut short but still JSON: the data is shorter, the tag fails.
  await assert.rejects(decryptWithKey(JSON.stringify({ ...ja, data: toB64(fromB64(ja.data).slice(0, 10)) }), a.key), code('damaged'));
  // Odd headers.
  for (const bad of [{ ...ja, v: 2 }, { ...ja, recovery: { ...ja.recovery, rounds: 5 } }, { ...ja, recovery: null }, { ...ja, kid: 4 }]) {
    assert.throws(() => readEncrypted(JSON.stringify(bad)), code('damaged'));
  }
  assert.throws(() => readEncrypted('{"workouts":[]}'), code('not_encrypted'));
  assert.throws(() => readEncrypted(`{"format":"${ENC_FORMAT}",`), code('damaged'));
});

test('the real 600,000 rounds: derivation time, measured', async () => {
  const { key } = newDataKey();
  const t0 = performance.now();
  const r = await makeRecovery(key, PASS);
  const ms = performance.now() - t0;
  assert.equal(r.rounds, KDF_ROUNDS);
  console.log(`# PBKDF2-SHA256 x${KDF_ROUNDS}: ${Math.round(ms)} ms on this machine`);
  // A slow CI box is fine; this only notices a 10x regression.
  assert.ok(ms < 10000, `${ms} ms`);
});
