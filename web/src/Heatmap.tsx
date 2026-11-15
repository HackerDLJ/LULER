import { useEffect, useRef } from 'react';
import type { HeatMetric } from './heat';
import { fmtDay } from './format';

interface Props {
  names: string[];
  values: number[][];
  metric: HeatMetric;
  lenDays: number;
  startDay: number;
  selected: number[]; // site indices to outline
  onPick: (siteIdx: number, day: number) => void;
}

const CSS_W = 900;
const ML = 150;
const ROW = 28;
const TOP = 6;
const AXIS = 24;
const STOPS: [number, [number, number, number]][] = [
  [0, [15, 22, 38]],
  [0.25, [29, 59, 100]],
  [0.5, [31, 138, 138]],
  [0.75, [156, 207, 90]],
  [1, [255, 210, 63]],
];

function ramp(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = (x - t0) / (t1 - t0);
      return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * f)).join(',')})`;
    }
  }
  return 'rgb(255,210,63)';
}

export default function Heatmap({ names, values, metric, lenDays, startDay, selected, onPick }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const nDays = values[0]?.length ?? 0;
  const cssH = TOP + values.length * ROW + AXIS;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = CSS_W * dpr;
    c.height = cssH * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, CSS_W, cssH);
    let lo = Infinity;
    let hi = -Infinity;
    values.forEach((r) => r.forEach((v) => { if (!Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    const span = hi - lo || 1;
    const cw = (CSS_W - ML - 8) / nDays;
    g.font = '12px system-ui, sans-serif';
    values.forEach((row, r) => {
      g.fillStyle = '#c9d2e3';
      g.textAlign = 'right';
      g.fillText(names[r], ML - 8, TOP + r * ROW + ROW / 2 + 4);
      row.forEach((v, d) => {
        g.fillStyle = Number.isNaN(v) ? '#161b27' : ramp(metric === 'night' ? 1 - (v - lo) / span : (v - lo) / span);
        g.fillRect(ML + d * cw, TOP + r * ROW + 2, Math.ceil(cw) + 0.5, ROW - 4);
      });
    });
    // month ticks
    g.fillStyle = '#8b97ad';
    g.textAlign = 'left';
    for (let d = 0; d < nDays; d++) {
      const dt = fmtDay(d);
      if (dt.endsWith('-01') && Number(dt.slice(5, 7)) % 3 === 1) {
        g.fillRect(ML + d * cw, TOP + values.length * ROW, 1, 5);
        g.fillText(dt.slice(0, 7), ML + d * cw + 3, TOP + values.length * ROW + 18);
      }
    }
    // selected window
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.strokeRect(ML + startDay * cw, TOP, Math.max(2, lenDays * cw), values.length * ROW);
    g.setLineDash([4, 3]);
    selected.forEach((si) => g.strokeRect(ML + startDay * cw, TOP + si * ROW + 1, Math.max(2, lenDays * cw), ROW - 2));
  }, [values, metric, lenDays, startDay, selected, names, nDays, cssH]);

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = CSS_W / r.width;
    const x = (e.clientX - r.left) * sx;
    const y = (e.clientY - r.top) * sx;
    const cw = (CSS_W - ML - 8) / nDays;
    const d = Math.floor((x - ML) / cw);
    const s = Math.floor((y - TOP) / ROW);
    if (d >= 0 && d < nDays && s >= 0 && s < values.length) onPick(s, Math.min(d, Math.max(0, nDays - lenDays)));
  };

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', aspectRatio: `${CSS_W} / ${cssH}`, cursor: 'pointer' }}
      onClick={click}
      role="img"
      aria-label={`Heatmap of the best start dates for a ${lenDays}-day stay at each site. Click to choose a start date.`}
    />
  );
}
