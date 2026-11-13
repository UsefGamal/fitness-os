// Front and back muscle map. Outlines from react-body-highlighter (MIT, see
// muscleShapes.js); which ones light up comes from lib/muscleMap.js.
//   hit:       Set of app groups to light (Library filter, plan exercises)
//   primary:   catalogue muscles the exercise mainly works (bright)
//   secondary: helper muscles (dim)
//   groupFill: { group: color } to colour whole groups (Stats modes)
//   size:      max width in px (small for the mini maps on cards)
//   onPick:    called with the app group of a tapped outline
//   bare:      no FRONT/BACK labels or key (tiny maps in list rows)
//   zoom:      show only the area of the lit main muscle (thumbnails)
//   focus:     an angle key (lib/muscles.js ANGLES): that part of the
//              muscle is bright and the rest of it dim
import { useId } from 'react';

import { BACK_DX, GROUP_OF_SHAPE, SHAPES_OF, shading, zoomBox } from '../lib/muscleMap.js';
import { ANGLES, REGION_OF, partBox, pickOutlines } from '../lib/muscles.js';
import { BACK, FRONT } from './muscleShapes.js';

const FILL = { primary: 'color-mix(in srgb, var(--accent) 85%, transparent)', secondary: 'color-mix(in srgb, var(--accent) 35%, transparent)' };
const BODY = 'var(--body)';
const HEAD = 'var(--body-head)';

function Figure({ shapes, dx, lit, groupFill, onPick, region, uid }) {
  const focused = region ? shapes.filter(([m]) => m === region.shape) : [];
  return (
    <g transform={`translate(${dx} 0)`}>
      {focused.length ? (
        <defs>
          {focused.flatMap(([m, polys]) => pickOutlines(polys, region.pick).map((i) => {
            const b = partBox(polys[i], region.part);
            return <clipPath key={`${m}-${i}`} id={`${uid}-${dx}-${i}`}><rect x={b.x} y={b.y} width={b.width} height={b.height} /></clipPath>;
          }))}
        </defs>
      ) : null}
      {shapes.map(([muscle, polys]) => polys.map((points, i) => {
        const tone = lit.get(muscle);
        const group = GROUP_OF_SHAPE[muscle];
        const own = groupFill && group ? groupFill[group] : null;
        const pickable = onPick && group;
        return (
          <polygon
            key={`${muscle}-${i}`}
            points={points}
            fill={own || (tone ? FILL[tone] : muscle === 'head' ? HEAD : BODY)}
            stroke="var(--body-line)"
            strokeWidth={0.4}
            style={pickable ? { cursor: 'pointer' } : undefined}
            onClick={pickable ? () => onPick(group) : undefined}
          >
            {group ? <title>{group}</title> : null}
          </polygon>
        );
      }))}
      {focused.flatMap(([m, polys]) => pickOutlines(polys, region.pick).map((i) => (
        <polygon key={`focus-${m}-${i}`} points={polys[i]} fill={FILL.primary} stroke="var(--body-line)" strokeWidth={0.4} clipPath={`url(#${uid}-${dx}-${i})`} pointerEvents="none" />
      )))}
    </g>
  );
}

export default function BodyMap({ hit = null, primary = [], secondary = [], groupFill = null, size = 320, onPick, focus = null, label = 'Muscle map', bare = false, zoom = false }) {
  const uid = useId().replace(/:/g, '');
  const region = focus ? REGION_OF[focus] || null : null;
  const lit = shading({ primary, secondary, groups: hit });
  // The focused muscle shows dim, with its angle drawn bright on top.
  if (region) for (const shape of SHAPES_OF[ANGLES[focus].muscle] || [region.shape]) if (lit.has(shape)) lit.set(shape, 'secondary');
  const showKey = !bare && (secondary.length > 0 || Boolean(region));
  const box = zoom ? zoomBox(lit, FRONT, BACK) : null;
  const viewBox = box ? `${box.x} ${box.y} ${box.size} ${box.size}` : bare ? '0 0 210 200' : '0 0 210 212';
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={viewBox} style={{ width: '100%', maxWidth: size, display: 'block', margin: '0 auto' }} role="img" aria-label={label}>
        <Figure shapes={FRONT} dx={0} lit={lit} groupFill={groupFill} onPick={onPick} region={region} uid={uid} />
        <Figure shapes={BACK} dx={BACK_DX} lit={lit} groupFill={groupFill} onPick={onPick} region={region} uid={uid} />
        {bare ? null : <text x={50} y={210} textAnchor="middle" fill="var(--chart-label)" fontSize="7" letterSpacing="1">FRONT</text>}
        {bare ? null : <text x={160} y={210} textAnchor="middle" fill="var(--chart-label)" fontSize="7" letterSpacing="1">BACK</text>}
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
