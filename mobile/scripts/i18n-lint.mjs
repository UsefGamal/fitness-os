// Literal lint for i18n (E9-S1). Counts hard-coded user-facing strings in
// src/views and src/components: JSX text and the text attributes people
// see or hear (title, aria-label, placeholder, alt, label, note). The
// counts may only go down. A new screen starts at zero: its strings go in
// src/i18n/en.js and are read with t().
//
//   node scripts/i18n-lint.mjs           check against i18n-baseline.json
//   node scripts/i18n-lint.mjs --update  record the current counts
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASELINE = new URL('../i18n-baseline.json', import.meta.url);
const DIRS = ['src/views', 'src/components'];
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'label', 'note'];

export function countLiterals(source) {
  // Drop comments so prose in them doesn't count.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  let n = 0;
  // JSX text between tags: >Some words< (never the > of an arrow, =>)
  for (const m of code.matchAll(/(?<!=)>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
    if (/[A-Za-z]{2,}/.test(m[1]) && !/^\s*[)\]};,]/.test(m[1]) && !/=>|&&|\|\|/.test(m[1])) n += 1;
  }
  for (const a of ATTRS) {
    for (const m of code.matchAll(new RegExp(`\\s${a}="([^"]*)"`, 'g'))) if (/[A-Za-z]{2,}/.test(m[1])) n += 1;
  }
  return n;
}

function scan() {
  const out = {};
  for (const dir of DIRS) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsx')).sort()) {
      out[join(dir, f)] = countLiterals(readFileSync(join(dir, f), 'utf8'));
    }
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('i18n-lint.mjs')) {
  const now = scan();
  const total = Object.values(now).reduce((a, b) => a + b, 0);
  if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, JSON.stringify({ total, files: now }, null, 2) + '\n');
    console.log(`i18n baseline written: ${total} hard-coded strings.`);
    process.exit(0);
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const grew = Object.entries(now).filter(([f, c]) => c > (base.files[f] ?? 0)).map(([f, c]) => `${f}: ${c} (was ${base.files[f] ?? 0})`);
  console.log(`i18n: ${total} hard-coded strings in views/components (baseline ${base.total}).`);
  if (grew.length) {
    console.error('New hard-coded strings. Put them in src/i18n/en.js and use t():\n  ' + grew.join('\n  '));
    process.exit(1);
  }
}
