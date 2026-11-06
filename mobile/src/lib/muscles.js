// Muscles finer than the six groups, and the angle an exercise works
// (E4-S16). free-exercise-db names 17 muscles and has one "shoulders" and
// no angles, so the deltoid heads and angles come from rules on the
// exercise name. Pure helpers; muscles.test.js holds the cases.

// group: the app's six groups (Library, Plan). shapes: body-map outlines.
export const MUSCLES = [
  { key: 'chest', label: 'Chest', group: 'Chest', shapes: ['chest'] },
  { key: 'lats', label: 'Lats', group: 'Back', shapes: ['upper-back'] },
  { key: 'middle back', label: 'Middle back', group: 'Back', shapes: ['upper-back', 'trapezius'] },
  { key: 'lower back', label: 'Lower back', group: 'Back', shapes: ['lower-back'] },
  { key: 'traps', label: 'Traps', group: 'Back', shapes: ['trapezius'] },
  { key: 'front delts', label: 'Front delts', group: 'Shoulders', shapes: ['front-deltoids'] },
  { key: 'side delts', label: 'Side delts', group: 'Shoulders', shapes: ['front-deltoids', 'back-deltoids'] },
  { key: 'rear delts', label: 'Rear delts', group: 'Shoulders', shapes: ['back-deltoids'] },
  { key: 'neck', label: 'Neck', group: 'Shoulders', shapes: ['neck'] },
  { key: 'biceps', label: 'Biceps', group: 'Arms', shapes: ['biceps'] },
  { key: 'triceps', label: 'Triceps', group: 'Arms', shapes: ['triceps'] },
  { key: 'forearms', label: 'Forearms', group: 'Arms', shapes: ['forearm'] },
  { key: 'abdominals', label: 'Abs', group: 'Core', shapes: ['abs', 'obliques'] },
  { key: 'quadriceps', label: 'Quads', group: 'Legs', shapes: ['quadriceps'] },
  { key: 'hamstrings', label: 'Hamstrings', group: 'Legs', shapes: ['hamstring'] },
  { key: 'glutes', label: 'Glutes', group: 'Legs', shapes: ['gluteal'] },
  { key: 'calves', label: 'Calves', group: 'Legs', shapes: ['calves', 'left-soleus', 'right-soleus'] },
  { key: 'adductors', label: 'Inner thighs', group: 'Legs', shapes: ['adductor'] },
  { key: 'abductors', label: 'Outer thighs', group: 'Legs', shapes: ['abductors', 'gluteal'] },
];

export const MUSCLE = Object.fromEntries(MUSCLES.map((m) => [m.key, m]));

export const ANGLES = {
  upper_chest: { label: 'Upper chest', muscle: 'chest' },
  mid_chest: { label: 'Middle chest', muscle: 'chest' },
  lower_chest: { label: 'Lower chest', muscle: 'chest' },
  biceps_long: { label: 'Biceps long head (outer)', muscle: 'biceps' },
  biceps_short: { label: 'Biceps short head (inner)', muscle: 'biceps' },
  brachialis: { label: 'Brachialis (arm thickness)', muscle: 'biceps' },
  triceps_long: { label: 'Triceps long head (overhead)', muscle: 'triceps' },
  triceps_lateral: { label: 'Triceps outer heads (pushdowns)', muscle: 'triceps' },
  triceps_all: { label: 'All triceps heads (close presses, dips)', muscle: 'triceps' },
  lats_width: { label: 'Back width (pull from above)', muscle: 'lats' },
  back_thickness: { label: 'Back thickness (rows)', muscle: 'middle back' },
};

const name = (entry) => String(entry?.name || '').toLowerCase();

/** Which deltoid head a shoulder exercise mainly works. */
export function deltOf(entry) {
  const n = name(entry);
  if (/rear|back fl|pull apart|reverse fl|reverse pec|reverse machine|face pull|bent[- ]over.*(raise|fly|lateral)|bent[- ]over.*delt|seated.*bent.*raise/.test(n)) return 'rear delts';
  if (/lateral|side raise|upright.*row|y[- ]raise|lu raise/.test(n)) return 'side delts';
  return 'front delts';
}

const fine = (m, entry) => (m === 'shoulders' ? deltOf(entry) : m);

/** The entry's main muscles, finer than the catalogue's. */
export function musclesOf(entry) {
  return [...new Set((entry?.primary || []).map((m) => fine(m, entry)))];
}

/** Helper muscles; a deltoid that is already a main muscle is left out. */
export function helpersOf(entry) {
  const main = new Set(musclesOf(entry));
  const out = (entry?.secondary || []).map((m) => (m === 'shoulders' ? (main.has('triceps') || main.has('chest') ? 'front delts' : deltOf(entry)) : m));
  return [...new Set(out)].filter((m) => !main.has(m));
}

/** The angle a strength move works, or null when the name doesn't say. */
export function angleOf(entry) {
  const n = name(entry);
  const main = musclesOf(entry);
  const first = main[0];
  if (first === 'chest') {
    if (/incline/.test(n)) return 'upper_chest';
    if (/decline|dip/.test(n)) return 'lower_chest';
    if (/press|fly|flye|push[- ]?up|crossover|pec deck|squeeze/.test(n)) return 'mid_chest';
    return null;
  }
  if (first === 'biceps') {
    if (/hammer|reverse.*curl|zottman|cross[- ]body|pinwheel/.test(n)) return 'brachialis';
    if (/incline.*curl|curls? lying against an incline|curl over incline|drag curl|behind/.test(n)) return 'biceps_long';
    if (/preacher|concentration|spider|wide[- ]grip|scott|inner[- ]biceps|overhead cable curl|high cable curl/.test(n)) return 'biceps_short';
    return null;
  }
  if (first === 'triceps') {
    if (/push ?down|press ?down|kickback|kick back|bent[- ]over/.test(n)) return 'triceps_lateral';
    if (/overhead|french|skull|lying.*(extension|press)|jm press|tate|behind.*(head|neck)|(standing|seated|kneeling).*(extension|triceps press)|incline.*extension|decline.*extension/.test(n)) return 'triceps_long';
    if (/close[- ]grip|close triceps|dip|floor press|board press|pin press|bench press|body[- ]up/.test(n)) return 'triceps_all';
    return null;
  }
  if (first === 'lats' && /pull[- ]?up|chin|pulldown|pull down|pullover/.test(n)) return 'lats_width';
  if ((first === 'middle back' || first === 'lats') && /row/.test(n)) return 'back_thickness';
  return null;
}

/** Muscles in one of the app's six groups, in list order. */
export function musclesIn(group) {
  return MUSCLES.filter((m) => m.group === group);
}

/** Angles that belong to one muscle. */
export function anglesOf(muscle) {
  return Object.entries(ANGLES).filter(([, a]) => a.muscle === muscle).map(([key, a]) => ({ key, ...a }));
}

/** Short text for a list row: "Upper chest" or "Side delts, Triceps". */
export function targetText(entry) {
  const a = angleOf(entry);
  if (a) return ANGLES[a].label;
  return musclesOf(entry).map((m) => MUSCLE[m]?.label || m).join(', ');
}
