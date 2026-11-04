// Front and back muscle map. Outlines from react-body-highlighter (MIT, see
// muscleShapes.js); which ones light up comes from lib/muscleMap.js.
//   hit:       Set of app groups to light (Library filter, plan exercises)
//   primary:   catalogue muscles the exercise mainly works (bright)
//   secondary: helper muscles (dim)
//   onPick:    called with the app group of a tapped outline
import { GROUP_OF_SHAPE, shading } from '../lib/muscleMap.js';
import { BACK, FRONT } from './muscleShapes.js';

const FILL = { primary: 'rgba(48,209,88,0.85)', secondary: 'rgba(48,209,88,0.35)' };
const BODY = '#3a3a3c';
const HEAD = '#2c2c2e';

function Figure({ shapes, dx, lit, onPick }) {
  return (
    <g transform={`translate(${dx} 0)`}>
      {shapes.map(([muscle, polys]) => polys.map((points, i) => {
        const tone = lit.get(muscle);
        const group = GROUP_OF_SHAPE[muscle];
        const pickable = onPick && group;
        return (
          <polygon
            key={`${muscle}-${i}`}
            points={points}
            fill={tone ? FILL[tone] : muscle === 'head' ? HEAD : BODY}
            stroke="#000"
            strokeWidth={0.4}
            style={pickable ? { cursor: 'pointer' } : undefined}
            onClick={pickable ? () => onPick(group) : undefined}
          >
            {group ? <title>{group}</title> : null}
          </polygon>
        );
      }))}
    </g>
  );
}

export default function BodyMap({ hit = null, primary = [], secondary = [], onPick, label = 'Muscle map' }) {
  const lit = shading({ primary, secondary, groups: hit });
  const showKey = secondary.length > 0;
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox="0 0 210 212" style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }} role="img" aria-label={label}>
        <Figure shapes={FRONT} dx={0} lit={lit} onPick={onPick} />
        <Figure shapes={BACK} dx={110} lit={lit} onPick={onPick} />
        <text x={50} y={210} textAnchor="middle" fill="#8e8e93" fontSize="7" letterSpacing="1">FRONT</text>
        <text x={160} y={210} textAnchor="middle" fill="#8e8e93" fontSize="7" letterSpacing="1">BACK</text>
      </svg>
      {showKey ? (
        <figcaption className="row muted small" style={{ justifyContent: 'center', gap: 14, marginTop: 6 }}>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: FILL.primary }} />Main</span>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: FILL.secondary }} />Helps</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
