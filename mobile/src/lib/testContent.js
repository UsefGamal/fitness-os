// Test helper: the generated content file (npm test runs `npm run content` first).
import { readFileSync } from 'node:fs';

export const content = JSON.parse(readFileSync(new URL('../content.json', import.meta.url), 'utf8'));
