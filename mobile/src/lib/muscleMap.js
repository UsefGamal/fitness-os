// Which outlines of the body map light up. The catalogue (free-exercise-db)
// names 17 muscles; the drawing (components/muscleShapes.js) has its own
// outline names; the app's Library filters by six groups. Pure helpers.

// Catalogue muscle -> outlines in the drawing.
export const SHAPES_OF = {
  chest: ['chest'],
  lats: ['lats'],
  'middle back': ['upper-back', 'trapezius-mid'],
  'lower back': ['lower-back'],
  traps: ['trapezius', 'trapezius-mid'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  'front delts': ['front-deltoids'],
  'side delts': ['front-deltoids', 'back-deltoids'],
  'rear delts': ['back-deltoids'],
  shins: ['calves'],
  neck: ['neck'],
  biceps: ['biceps-long', 'biceps-short'],
  triceps: ['triceps-lateral', 'triceps-long'],
  forearms: ['forearm'],
  abdominals: ['abs', 'obliques'],
  quadriceps: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves', 'left-soleus', 'right-soleus'],
  adductors: ['adductor', 'abductors'],
  abductors: ['abductors', 'gluteal'],
};

// Outline -> the app's muscle group (Library filter, plan exercises).
export const GROUP_OF_SHAPE = {
  chest: 'Chest',
  'upper-back': 'Back', lats: 'Back', 'lower-back': 'Back', trapezius: 'Back', 'trapezius-mid': 'Back',
  'front-deltoids': 'Shoulders', 'back-deltoids': 'Shoulders', neck: 'Shoulders',
  'biceps-long': 'Arms', 'biceps-short': 'Arms', 'triceps-lateral': 'Arms', 'triceps-long': 'Arms', forearm: 'Arms',
  abs: 'Core', obliques: 'Core',
  quadriceps: 'Legs', hamstring: 'Legs', gluteal: 'Legs', calves: 'Legs', 'left-soleus': 'Legs', 'right-soleus': 'Legs', adductor: 'Legs', abductors: 'Legs',
};

/** Map outline -> 'primary' | 'secondary'. Main muscles win over helpers;
 * `groups` (a Set of app groups) lights every outline in those groups. */
export function shading({ primary = [], secondary = [], groups = null } = {}) {
  const out = new Map();
  if (groups) for (const [shape, g] of Object.entries(GROUP_OF_SHAPE)) if (groups.has(g)) out.set(shape, 'primary');
  for (const m of secondary) for (const s of SHAPES_OF[m] || []) if (!out.has(s)) out.set(s, 'secondary');
  for (const m of primary) for (const s of SHAPES_OF[m] || []) out.set(s, 'primary');
  return out;
}

// The two figures sit side by side: the back one starts this far right.
export const BACK_DX = 110;

/** The square part of the map to show in a small thumbnail (UX-09), so
 * the worked muscle fills it instead of two whole bodies in 68 px. Picks
 * the figure (front or back) where more of the main muscles are drawn and
 * returns { x, y, size } in the map's own units, or null with nothing lit.
 * `lit` is shading()'s Map; `front` / `back` are the drawing's rows. */
export function zoomBox(lit, front, back, { pad = 7, min = 46 } = {}) {
  const main = [...lit].filter(([, tone]) => tone === 'primary').map(([shape]) => shape);
  const wanted = new Set(main.length ? main : lit.keys());
  if (!wanted.size) return null;
  const boxOf = (shapes) => {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; let area = 0;
    for (const [shape, polys] of shapes) {
      if (!wanted.has(shape)) continue;
      for (const points of polys) {
        const n = String(points).trim().split(/[\s,]+/).map(Number);
        const xs = n.filter((_, i) => i % 2 === 0);
        const ys = n.filter((_, i) => i % 2 === 1);
        const bx0 = Math.min(...xs); const bx1 = Math.max(...xs);
        const by0 = Math.min(...ys); const by1 = Math.max(...ys);
        area += (bx1 - bx0) * (by1 - by0);
        x0 = Math.min(x0, bx0); x1 = Math.max(x1, bx1); y0 = Math.min(y0, by0); y1 = Math.max(y1, by1);
      }
    }
    return area ? { x0, y0, x1, y1, area } : null;
  };
  const f = boxOf(front);
  const b = boxOf(back);
  if (!f && !b) return null;
  const useBack = b && (!f || b.area > f.area);
  const box = useBack ? b : f;
  const size = Math.max(min, Math.max(box.x1 - box.x0, box.y1 - box.y0) + 2 * pad);
  const round = (v) => Math.round(v * 10) / 10;
  return {
    x: round((useBack ? BACK_DX : 0) + (box.x0 + box.x1) / 2 - size / 2),
    y: round(Math.max(0, (box.y0 + box.y1) / 2 - size / 2)),
    size: round(size),
  };
}
