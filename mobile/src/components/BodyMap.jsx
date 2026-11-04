// Front and back body outline with the six muscle groups the app uses.
// Same drawing as the old site's templates/_body_map.html (our own SVG).
const R = (x, y, w, h, rx, g) => ({ t: 'rect', x, y, width: w, height: h, rx, g });
const C = (cx, cy, r, g) => ({ t: 'circle', cx, cy, r, g });

function half(dx, back) {
  return [
    C(26 + dx, 39, 10, 'Shoulders'),
    C(74 + dx, 39, 10, 'Shoulders'),
    back ? R(30 + dx, 33, 40, 42, 14, 'Back') : R(32 + dx, 33, 36, 28, 12, 'Chest'),
    R(14 + dx, 40, 12, 34, 6, 'Arms'),
    R(74 + dx, 40, 12, 34, 6, 'Arms'),
    R(15 + dx, 74, 10, 32, 5, 'Arms'),
    R(75 + dx, 74, 10, 32, 5, 'Arms'),
    ...(back ? [] : [R(35 + dx, 61, 30, 34, 10, 'Core')]),
    R(30 + dx, 96, 15, 42, 7.5, 'Legs'),
    R(55 + dx, 96, 15, 42, 7.5, 'Legs'),
    R(32 + dx, 142, 11, 42, 5.5, 'Legs'),
    R(57 + dx, 142, 11, 42, 5.5, 'Legs'),
  ];
}

const SHAPES = [...half(0, false), ...half(100, true)];

export default function BodyMap({ hit = new Set(), onPick, label = 'Muscle map' }) {
  return (
    <svg viewBox="0 0 200 236" style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }} role="img" aria-label={label}>
      {[0, 100].map((dx) => (
        <g key={dx}>
          <ellipse cx={50 + dx} cy={16} rx={12} ry={13} fill="#2c2c2e" />
          <rect x={44 + dx} y={27} width={12} height={7} fill="#2c2c2e" />
          <text x={50 + dx} y={228} textAnchor="middle" fill="#8e8e93" fontSize="8" letterSpacing="1">{dx ? 'BACK' : 'FRONT'}</text>
        </g>
      ))}
      {SHAPES.map((s, i) => {
        const on = hit.has(s.g);
        const props = {
          fill: on ? 'rgba(48,209,88,0.55)' : '#3a3a3c',
          stroke: on ? '#30d158' : 'none',
          strokeWidth: 1.5,
          style: onPick ? { cursor: 'pointer' } : undefined,
          onClick: onPick ? () => onPick(s.g) : undefined,
        };
        const { t, g, ...geo } = s;
        return t === 'rect' ? <rect key={i} {...geo} {...props}><title>{g}</title></rect> : <circle key={i} {...geo} {...props}><title>{g}</title></circle>;
      })}
    </svg>
  );
}
