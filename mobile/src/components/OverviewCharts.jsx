import { dateScale } from '../lib/chartScale.js';
import { dayMonth } from '../lib/dates.js';
import { t } from '../lib/i18n.js';

const W = 340;
const OUTCOME_TONE = { up: 'var(--accent-stroke)', held: 'var(--muted)', down: 'var(--orange)' };
// Each lift has its own line style, so two lifts with the same outcome
// (same colour) still tell apart; the end label names them.
const LIFT_DASH = [null, '7 4', '2 3'];

/** Training days a week for 12 weeks (BI-16). Full bar = the week's need
 * met; the tick is the need; recovery weeks are striped blue; this week is
 * an outline, still filling. Numbers sit on each bar, so no colour is the
 * only cue. */
export function WeeksChart({ weeks }) {
  const H = 132;
  const top = 16;
  const base = H - 20;
  const max = 7;
  const gap = 6;
  const bw = (W - gap * (weeks.length - 1)) / weeks.length;
  const y = (v) => base - (v / max) * (base - top);
  const met = weeks.filter((w) => !w.current && w.days >= w.need).length;
  const done = weeks.filter((w) => !w.current).length;
  return (
    <>
      <svg className="chart weeks-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('ov.weeksAria', { met, n: done })}>
        <defs>
          <pattern id="deload-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="color-mix(in srgb, var(--blue) 25%, transparent)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--blue)" strokeWidth="2.5" />
          </pattern>
        </defs>
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--surface3)" />
        {weeks.map((w, i) => {
          const x = i * (bw + gap);
          const h = base - y(w.days);
          const ok = !(w.days < w.need);
          const fill = w.deload ? 'url(#deload-hatch)' : w.current ? 'none' : ok ? 'var(--accent-stroke)' : 'color-mix(in srgb, var(--accent) 40%, transparent)';
          return (
            <g key={w.week}>
              {w.days ? <rect x={x} y={y(w.days)} width={bw} height={h} rx="4" fill={fill} stroke={w.current ? 'var(--accent-stroke)' : 'none'} strokeWidth="1.5" strokeDasharray={w.current ? '3 2' : undefined} /> : null}
              <line x1={x - 1} x2={x + bw + 1} y1={y(w.need)} y2={y(w.need)} stroke="var(--text)" strokeWidth="1.5" opacity="0.6" />
              <text x={x + bw / 2} y={(w.days ? y(w.days) : base) - 4} textAnchor="middle" fontSize="10" fill="var(--chart-label)">{w.days}</text>
              {i % 4 === 0 || w.current ? <text x={i === 0 ? x : x + bw / 2} y={H - 5} textAnchor={i === 0 ? 'start' : 'middle'} fontSize="10" fill="var(--chart-label)">{w.current ? t('ov.now') : dayMonth(w.week)}</text> : null}
            </g>
          );
        })}
      </svg>
      <div className="chart-key">
        <span><i className="key-bar" aria-hidden="true" />{t('ov.keyMet')}</span>
        <span><i className="key-bar faint" aria-hidden="true" />{t('ov.keyShort')}</span>
        <span><i className="key-tick" aria-hidden="true" />{t('ov.keyNeed')}</span>
        {weeks.some((w) => w.deload) ? <span><i className="key-bar hatch" aria-hidden="true" />{t('ov.keyDeload')}</span> : null}
      </div>
    </>
  );
}

/** Strength kept while cutting (DV-20): weight trend on top, lifts below,
 * one date axis. Each lift is labelled at its end with its change, and
 * up / held / down differ by line style as well as colour. */
export function KeptChart({ kept }) {
  const L = 4;
  const R = 104; // room for the lift labels
  const at = dateScale([kept.from, kept.to], L, W - R);
  const wTop = 18;
  const wH = 54;
  const kgs = kept.weight.points.map((p) => p.kg);
  const kLo = Math.min(...kgs);
  const kHi = Math.max(...kgs);
  const ky = (v) => wTop + (kHi === kLo ? wH / 2 : ((kHi - v) / (kHi - kLo)) * wH);
  const lTop = wTop + wH + 34;
  const lH = 92;
  const pcts = kept.lifts.flatMap((l) => l.points.map((p) => p.pct));
  const pHi = Math.max(5, ...pcts);
  const pLo = Math.min(-5, ...pcts);
  const py = (v) => lTop + ((pHi - v) / (pHi - pLo)) * lH;
  const H = lTop + lH + 20;
  const path = (pts, fx, fy) => pts.map((p, i) => `${i ? 'L' : 'M'}${at(p.date).toFixed(1)},${fy(fx(p)).toFixed(1)}`).join(' ');
  const wLast = kept.weight.points[kept.weight.points.length - 1];
  // End labels, nudged apart so two lifts ending close don't overlap.
  const ends = kept.lifts.map((l, i) => ({ l, i, y: py(l.points[l.points.length - 1].pct) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 26) ends[i].y = ends[i - 1].y + 26;
  const sign = (v) => `${v > 0 ? '+' : ''}${v}`;
  return (
    <svg className="chart kept-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={t('ov.keptAria', { kg: sign(kept.weight.change), up: kept.counts.up, held: kept.counts.held, down: kept.counts.down })}>
      <text x={L} y={wTop - 8} fontSize="10" fill="var(--chart-label)">{t('ov.weightTrend')}</text>
      <path d={path(kept.weight.points, (p) => p.kg, ky)} fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x={W - R + 8} y={ky(wLast.kg) + 4} fontSize="11" fontWeight="600" fill="var(--text)">{t('wchart.kg', { kg: sign(kept.weight.change) })}</text>
      <text x={L} y={lTop - 14} fontSize="10" fill="var(--chart-label)">{t('ov.liftsTrend')}</text>
      <line x1={L} x2={W - R} y1={py(0)} y2={py(0)} stroke="var(--surface3)" strokeDasharray="3 3" />
      <text x={L} y={py(0) + 11} fontSize="9" fill="var(--chart-label)">{t('ov.start')}</text>
      {kept.lifts.map((l, i) => (
        <path key={l.exercise_id} d={path(l.points, (p) => p.pct, py)} fill="none" stroke={OUTCOME_TONE[l.outcome]} strokeWidth="2.2" strokeDasharray={LIFT_DASH[i] || undefined} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {ends.map(({ l, i, y }) => (
        <g key={l.exercise_id}>
          <line x1={W - R + 6} x2={W - R + 22} y1={y - 4} y2={y - 4} stroke={OUTCOME_TONE[l.outcome]} strokeWidth="2" strokeDasharray={LIFT_DASH[i] || undefined} />
          <text x={W - R + 26} y={y} fontSize="11" fontWeight="600" fill={OUTCOME_TONE[l.outcome]}>{t('ov.liftEnd', { pct: sign(l.pct) })}</text>
          <text x={W - R + 6} y={y + 11} fontSize="9.5" fill="var(--chart-label)">{l.name.length > 17 ? `${l.name.slice(0, 16)}…` : l.name}</text>
        </g>
      ))}
      <text x={L} y={H - 4} fontSize="10" fill="var(--chart-label)">{dayMonth(kept.from)}</text>
      <text x={W - R} y={H - 4} textAnchor="end" fontSize="10" fill="var(--chart-label)">{t('ov.now')}</text>
    </svg>
  );
}
