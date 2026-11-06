// Which outlines of the body map light up. The catalogue (free-exercise-db)
// names 17 muscles; the drawing (components/muscleShapes.js) has its own
// outline names; the app's Library filters by six groups. Pure helpers.

// Catalogue muscle -> outlines in the drawing.
export const SHAPES_OF = {
  chest: ['chest'],
  lats: ['upper-back'],
  'middle back': ['upper-back', 'trapezius'],
  'lower back': ['lower-back'],
  traps: ['trapezius'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  'front delts': ['front-deltoids'],
  'side delts': ['front-deltoids', 'back-deltoids'],
  'rear delts': ['back-deltoids'],
  shins: ['calves'],
  neck: ['neck'],
  biceps: ['biceps'],
  triceps: ['triceps'],
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
  'upper-back': 'Back', 'lower-back': 'Back', trapezius: 'Back',
  'front-deltoids': 'Shoulders', 'back-deltoids': 'Shoulders', neck: 'Shoulders',
  biceps: 'Arms', triceps: 'Arms', forearm: 'Arms',
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
