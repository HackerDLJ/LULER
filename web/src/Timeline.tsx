import type { HourSeries } from './metrics';
import { fmtDay } from './format';

const W = 900, LEFT = 160, RIGHT = 12, BAR = 12, GAP = 6, ROW = 2 * BAR + GAP + 16;

function spans(on: ArrayLike<number | boolean>, start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let h = start; h < end; h++) {
    if (on[h] && s < 0) s = h;
    if (!on[h] && s >= 0) { out.push([s, h]); s = -1; }
  }
  if (s >= 0) out.push([s, end]);
  return out;
}

export default function Timeline({ rows, start, end, scrub, startDay }: { rows: { label: string; series: HourSeries }[]; start: number; end: number; scrub: number; startDay: number }) {
  const span = end - start;
  const x = (h: number) => LEFT + ((h - start) / span) * (W - LEFT - RIGHT);
  const H = rows.length * ROW + 28;
  const days = span / 24;
  const step = Math.max(1, Math.ceil(days / 8));
  const ticks: number[] = [];
  for (let d = 0; d <= days; d += step) ticks.push(d);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline of when the Sun and Earth are above the horizon">
      {rows.map((r, i) => {
        const y = i * ROW + 6;
        return (
          <g key={i}>
            <text x={LEFT - 10} y={y + BAR - 2} textAnchor="end" className="rowlabel">{r.label}</text>
            <text x={LEFT - 10} y={y + 2 * BAR + GAP - 2} textAnchor="end" className="tick">Sun / Earth</text>
            <rect x={LEFT} y={y} width={W - LEFT - RIGHT} height={BAR} className="track" />
            <rect x={LEFT} y={y + BAR + GAP} width={W - LEFT - RIGHT} height={BAR} className="track" />
            {spans(r.series.sunUp, start, end).map(([a, b], k) => <rect key={'s' + k} x={x(a)} y={y} width={Math.max(1, x(b) - x(a))} height={BAR} className="sunbar" />)}
            {spans(r.series.earthUp, start, end).map(([a, b], k) => <rect key={'e' + k} x={x(a)} y={y + BAR + GAP} width={Math.max(1, x(b) - x(a))} height={BAR} className="earthbar" />)}
          </g>
        );
      })}
      {ticks.map((d) => (
        <g key={d}>
          <line x1={x(start + d * 24)} x2={x(start + d * 24)} y1={0} y2={rows.length * ROW} className="grid" />
          <text x={x(start + d * 24)} y={H - 8} textAnchor="middle" className="tick">{fmtDay(startDay + d).slice(5)}</text>
        </g>
      ))}
      <line x1={x(Math.min(scrub, end - 1))} x2={x(Math.min(scrub, end - 1))} y1={0} y2={rows.length * ROW} className="cursor" />
    </svg>
  );
}
