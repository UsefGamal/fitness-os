// Run the lib tests with coverage and hold the line (E1-S2).
//
//   node scripts/coverage.mjs           check against coverage-baseline.json
//   node scripts/coverage.mjs --update  rewrite the baseline from this run
//
// A PR fails when overall line coverage, or any file's, drops more than
// TOLERANCE below the baseline, and when a file that holds core maths or
// data upgrades (STRICT) is below 95% lines. New files have no baseline
// until --update records one, but STRICT files are checked from day one.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASELINE = new URL('../coverage-baseline.json', import.meta.url);
const TOLERANCE = 0.5; // percentage points, so a refactor that moves a line isn't a failure
const STRICT = [/^src\/lib\/macros\.js$/, /^src\/lib\/migrate\.js$/, /^src\/lib\/metrics\//];
const STRICT_MIN = 95;

const update = process.argv.includes('--update');
const dir = mkdtempSync(join(tmpdir(), 'cov-'));
const lcov = join(dir, 'lcov.info');
const testsIn = (dir) => readdirSync(dir, { recursive: true })
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => join(dir, f));
// TEST-1 part C: store/ tests run with node stand-ins for Capacitor and
// Vite (scripts/node-stubs) and the device-test build's fake folder.
const tests = [...testsIn('src/lib'), ...testsIn('src/store')];
// The store files that have tests, and the thin ones they load.
const STORE_COVERED = ['autoBackup', 'errors', 'fs', 'mirror', 'snapshots', 'useData'];

const run = spawnSync(process.execPath, [
  '--import', './scripts/node-stubs/register.mjs',
  '--test',
  '--experimental-test-coverage',
  '--test-coverage-include=src/lib/**',
  ...STORE_COVERED.map((f) => `--test-coverage-include=src/store/${f}.js`),
  '--test-coverage-exclude=src/**/*.test.js',
  '--test-coverage-exclude=src/lib/testContent.js',
  '--test-reporter=dot', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', `--test-reporter-destination=${lcov}`,
  ...tests,
], { stdio: 'inherit', env: { ...process.env, VITE_FAKE_FS: '1' } });
if (run.status !== 0) process.exit(run.status ?? 1);

const files = {};
let file = null;
for (const line of readFileSync(lcov, 'utf8').split('\n')) {
  if (line.startsWith('SF:')) {
    const path = line.slice(3).replaceAll('\\', '/');
    file = path.slice(path.lastIndexOf('/src/') + 1);
    files[file] = { found: 0, hit: 0 };
  } else if (line.startsWith('LF:')) files[file].found = Number(line.slice(3));
  else if (line.startsWith('LH:')) files[file].hit = Number(line.slice(3));
}
const pct = ({ found, hit }) => (found ? Math.round((hit / found) * 10000) / 100 : 100);
const total = Object.values(files).reduce((a, f) => ({ found: a.found + f.found, hit: a.hit + f.hit }), { found: 0, hit: 0 });
const current = { lines: pct(total), files: Object.fromEntries(Object.entries(files).sort().map(([k, v]) => [k, pct(v)])) };

if (update) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log(`Baseline written: ${current.lines}% lines over ${Object.keys(current.files).length} files.`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const problems = [];
if (current.lines < base.lines - TOLERANCE) problems.push(`overall lines ${current.lines}% < baseline ${base.lines}%`);
for (const [name, value] of Object.entries(current.files)) {
  const was = base.files[name];
  if (was !== undefined && value < was - TOLERANCE) problems.push(`${name}: ${value}% < baseline ${was}%`);
  if (STRICT.some((re) => re.test(name)) && value < STRICT_MIN) problems.push(`${name}: ${value}% < ${STRICT_MIN}% (core maths/migration)`);
}
console.log(`\nLine coverage ${current.lines}% (baseline ${base.lines}%).`);
if (problems.length) {
  console.error('Coverage dropped:\n  ' + problems.join('\n  '));
  console.error('Add tests, or if the drop is intended, run `npm run coverage -- --update` and say why in the PR.');
  process.exit(1);
}
