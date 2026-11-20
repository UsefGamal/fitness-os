// Test helper: the generated content file (npm test runs `npm run content` first).
import { readFileSync } from 'node:fs';

export const content = JSON.parse(readFileSync(new URL('../content.json', import.meta.url), 'utf8'));

/** The content with the Upper / Lower / Push / Pull / Leg routine (id
 * ul-ppl) as the starting plan, the way many tests were written before the
 * app's default became the full-body starter plan (one app, Nov 2026). */
export function withRoutine(base, id) {
  const r = base.training.routines.find((x) => x.id === id);
  if (!r) throw new Error(`no routine ${id}`);
  return {
    ...base,
    training: {
      ...base.training,
      trainer_plan: { ...base.training.trainer_plan, id: r.id, name: r.name, schedule: r.schedule },
      program: r.program,
    },
  };
}

export const ulPplContent = withRoutine(content, 'ul-ppl');
