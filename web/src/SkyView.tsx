import { useMemo, useState } from 'react';
import type { Common, Manifest, Site } from './data';
import { maskAt } from './metrics';
import { fmtDateTime, fmtHours } from './format';

interface Props {
  label: string;
  site: Site;
  common: Common;
  manifest: Manifest;
  mastIdx: number;
  start: number;
  end: number;
  scrub: number; // absolute hour index
  earthMin: number;
}

const W = 900;
const H = 290;
const ML = 46;
const MR = 14;
const MT = 14;
const MB = 30;
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
const SUN = '#ffc857';
const EARTH = '#4cc9f0';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Pt = { x: number; y: number; vis: boolean; i: number };

export default function SkyView({ label, site, manifest, mastIdx, start, end, scrub, earthMin }: Props) {
  const [hov, setHov] = useState<{ x: number; y: number; az: number; el: number; ridge: number; hit?: { body: 'Sun' | 'Earth'; i: number } } | null>(null);
  const nAz = manifest.n_az;
  const base = mastIdx * manifest.offsets_m.length * nAz; // centre position (offset 0)

  // Real data range: terrain horizon (NASA LOLA) + Sun/Earth elevations over the window (NAIF SPICE DE440)
  const [ymin, ymax] = useMemo(() => {
    let hi = 0, lo = 0;
    for (let k = 0; k < nAz; k++) { const h = site.hz[base + k] / 100; hi = Math.max(hi, h); lo = Math.min(lo, h); }
    for (let i = start; i < end; i++) { hi = Math.max(hi, site.sunEl[i], site.earthEl[i]); lo = Math.min(lo, site.sunEl[i], site.earthEl[i]); }
    return [Math.max(-15, Math.min(-2, Math.floor(lo) - 1)), Math.min(40, Math.max(4, Math.ceil(hi) + 1))];
  }, [site, base, nAz, start, end]);

  const px = (W - ML - MR) / 360;
  const py = (H - MT - MB) / (ymax - ymin);
  const xs = (az: number) => ML + (((az % 360) + 360) % 360) * px;
  const ys = (el: number) => MT + (ymax - Math.max(ymin, Math.min(ymax, el))) * py;
  const inY = (el: number) => el >= ymin && el <= ymax;

  const terrain = useMemo(() => {
    let d = `M ${ML} ${ys(ymin)}`;
    for (let k = 0; k <= nAz; k++) d += ` L ${(ML + ((k * 360) / nAz) * px).toFixed(1)} ${ys(site.hz[base + (k % nAz)] / 100).toFixed(1)}`;
    return d + ` L ${ML + 360 * px} ${ys(ymin)} Z`;
  }, [site, base, nAz, ymin, ymax]);

  /** Hourly track of one body, split into runs of equal visibility; broken where it wraps through north or leaves the chart. */
  const track = (body: 'Sun' | 'Earth') => {
    const az = body === 'Sun' ? site.sunAz : site.earthAz, el = body === 'Sun' ? site.sunEl : site.earthEl;
    const pts: Pt[] = [];
    for (let i = start; i < end; i++) {
      const m = maskAt(site.hz, base, nAz, az[i]);
      pts.push({ x: xs(az[i]), y: ys(el[i]), i, vis: inY(el[i]) && (body === 'Sun' ? el[i] > m : el[i] > Math.max(m, 0) + earthMin) });
    }
    const runs: { d: string; vis: boolean }[] = []; let cur: Pt[] = [];
    const flush = () => { if (cur.length > 1) runs.push({ d: 'M ' + cur.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L '), vis: cur[cur.length - 1].vis }); cur = []; };
    pts.forEach((p, k) => {
      const prev = pts[k - 1]; const e = el[p.i];
      if (!inY(e)) { flush(); return; }
      if (prev && (Math.abs(p.x - prev.x) > 180 * px || !inY(el[prev.i]))) flush();
      if (cur.length && cur[cur.length - 1].vis !== p.vis) { const last = cur[cur.length - 1]; flush(); cur.push(last); }
      cur.push(p);
    });
    flush();
    return { pts, runs };
  };
  const sun = useMemo(() => track('Sun'), [site, base, nAz, start, end, ymin, ymax, earthMin]);
  const earth = useMemo(() => track('Earth'), [site, base, nAz, start, end, ymin, ymax, earthMin]);

  // one tick per day (00:00 UTC) on each track, date label every few days
  const days = useMemo(() => {
    const out: { body: 'Sun' | 'Earth'; x: number; y: number; label: string }[] = [];
    const every = Math.max(1, Math.round((end - start) / 24 / 7));
    for (let i = Math.ceil(start / 24) * 24, n = 0; i < end; i += 24, n++) {
      const d = new Date(Date.UTC(2027, 0, 1) + i * 3600e3); const lab = n % every === 0 ? `${MON[d.getUTCMonth()]} ${d.getUTCDate()}` : '';
      if (inY(site.sunEl[i])) out.push({ body: 'Sun', x: xs(site.sunAz[i]), y: ys(site.sunEl[i]), label: lab });
      if (inY(site.earthEl[i])) out.push({ body: 'Earth', x: xs(site.earthAz[i]), y: ys(site.earthEl[i]), label: '' });
    }
    return out;
  }, [site, start, end, ymin, ymax]);
  const t = Math.min(Math.max(scrub, start), end - 1);
  const sunMask = maskAt(site.hz, base, nAz, site.sunAz[t]);
  const earthMask = maskAt(site.hz, base, nAz, site.earthAz[t]);
  const sunVisible = site.sunEl[t] > sunMask;
  const earthVisible = site.earthEl[t] > Math.max(earthMask, 0) + earthMin;

  /** Hours until the Sun / Earth next drops below (or returns above) the terrain edge, scanning up to 45 days ahead. */
  const countdown = (el: Float32Array, azs: Float32Array, isEarth: boolean, now: boolean) => {
    const lim = Math.min(el.length - 1, t + 45 * 24);
    for (let i = t + 1; i <= lim; i++) {
      const m = maskAt(site.hz, base, nAz, azs[i]);
      const vis = isEarth ? el[i] > Math.max(m, 0) + earthMin : el[i] > m;
      if (vis !== now) return i - t;
    }
    return -1;
  };
  const sunNext = countdown(site.sunEl, site.sunAz, false, sunVisible);
  const earthNext = countdown(site.earthEl, site.earthAz, true, earthVisible);
  const fmtNext = (name: string, vis: boolean, h: number) =>
    h < 0 ? `${name} stays ${vis ? 'in view' : 'hidden'} for 45+ days` : `${name} ${vis ? (name === 'Sun' ? 'sets' : 'sets') : 'rises'} in about ${fmtHours(h)}`;

  const yTicks: number[] = [];
  const span = ymax - ymin; const stepY = span > 30 ? 5 : span > 14 ? 2 : 1;
  for (let v = Math.ceil(ymin / stepY) * stepY; v <= ymax; v += stepY) yTicks.push(v);

  const marker = (body: 'Sun' | 'Earth', az: number, el: number, vis: boolean) => {
    const c = body === 'Sun' ? SUN : EARTH; const x = xs(az); const off = !inY(el); const y = ys(el);
    const lx = Math.min(Math.max(x + 12, ML + 4), W - MR - 120);
    return (
      <g key={body} className={`now ${vis ? 'vis' : 'blk'}`}>
        <circle cx={x} cy={y} r={11} fill={c} opacity={0.18} />
        <circle cx={x} cy={y} r={6} fill={vis ? c : '#0a0a0b'} stroke={c} strokeWidth={2} />
        <text x={lx} y={y + (y < MT + 20 ? 16 : -10)} fill={c}>{body} {el.toFixed(1)}°{off ? (el > ymax ? ' ↑' : ' ↓') : ''}</text>
      </g>
    );
  };
  const nearest = (x: number, y: number) => {
    let best: { body: 'Sun' | 'Earth'; i: number; d: number } | null = null;
    for (const [body, tr] of [['Sun', sun], ['Earth', earth]] as const) for (const p of tr.pts) {
      const el = body === 'Sun' ? site.sunEl[p.i] : site.earthEl[p.i]; if (!inY(el)) continue;
      const d = Math.hypot(p.x - x, p.y - y); if (d < 10 && (!best || d < best.d)) best = { body, i: p.i, d };
    }
    return best ? { body: best.body, i: best.i } : undefined;
  };

  return (
    <figure className="sky">
      <figcaption>
        <strong>{label}: {site.name}</strong>
        <span className="sky-src">Sky all around the site, {fmtDateTime(start).slice(0, 10)} to {fmtDateTime(end - 1).slice(0, 10)} · horizon: NASA LOLA terrain at {manifest.masts_m[mastIdx]} m · Sun &amp; Earth: NAIF SPICE DE440 · hover any point</span>
      </figcaption>
      <div className="sky-legend">
        <span><i className="lg sun" />Sun path · in view</span><span><i className="lg sun dash" />behind terrain</span>
        <span><i className="lg earth" />Earth path · radio link</span><span><i className="lg earth dash" />blocked</span>
        <span><i className="lg ridge" />Real horizon (NASA LOLA)</span><span><i className="lg zero" />Flat horizon 0°</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sun and Earth tracks over the terrain horizon at ${site.name}`}>
        <rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} className="plot" />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={ML} x2={W - MR} y1={ys(v)} y2={ys(v)} className={v === 0 ? 'zero' : 'grid'} />
            <text x={ML - 6} y={ys(v) + 4} textAnchor="end" className="tick">{v}°</text>
          </g>
        ))}
        {DIRS.map((d, i) => (
          <g key={i}>
            <line x1={ML + i * 45 * px} x2={ML + i * 45 * px} y1={MT} y2={H - MB} className="grid" />
            <text x={ML + i * 45 * px} y={H - 10} textAnchor="middle" className="tick">{d}</text>
          </g>
        ))}
        <path d={terrain} className="terrain" />
        {[...sun.runs.map((r, k) => ({ ...r, k: 's' + k, c: 'sun' })), ...earth.runs.map((r, k) => ({ ...r, k: 'e' + k, c: 'earth' }))].map((r) => (
          <path key={r.k} d={r.d} className={`trk ${r.c} ${r.vis ? 'vis' : 'blk'}`} />
        ))}
        {days.map((d, k) => (
          <g key={k} className={`day ${d.body === 'Sun' ? 'sun' : 'earth'}`}>
            <circle cx={d.x} cy={d.y} r={2.4} />
            {d.label && <text x={d.x} y={d.y - 7} textAnchor="middle">{d.label}</text>}
          </g>
        ))}
        {marker('Earth', site.earthAz[t], site.earthEl[t], earthVisible)}
        {marker('Sun', site.sunAz[t], site.sunEl[t], sunVisible)}
        {hov && (() => {
          const h = hov.hit; const body = h?.body; const i = h?.i ?? 0;
          const el = body === 'Sun' ? site.sunEl[i] : body === 'Earth' ? site.earthEl[i] : 0; const az = body === 'Sun' ? site.sunAz[i] : body === 'Earth' ? site.earthAz[i] : 0;
          const txt = body ? `${body} · ${fmtDateTime(i)} · Az ${az.toFixed(1)}° · El ${el.toFixed(2)}° · ridge ${maskAt(site.hz, base, nAz, az).toFixed(2)}°` : `Az ${hov.az.toFixed(1)}° · El ${hov.el.toFixed(2)}° · real horizon ${hov.ridge.toFixed(2)}°`;
          return <g className="probe">{body ? <circle cx={xs(az)} cy={ys(el)} r={5} className={body === 'Sun' ? 'hs' : 'he'} /> : <><line x1={hov.x} x2={hov.x} y1={MT} y2={H - MB} /><circle cx={xs(hov.az)} cy={ys(hov.ridge)} r={3.5} /></>}<text x={Math.min(Math.max(hov.x + 10, ML + 4), W - MR - txt.length * 6.3)} y={MT + 14}>{txt}</text></g>;
        })()}
        <rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} fill="transparent" onMouseLeave={() => setHov(null)} onMouseMove={(ev) => { const r = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width) * W, y = ((ev.clientY - r.top) / r.height) * H; const az = Math.min(359.99, Math.max(0, (x - ML) / px)); setHov({ x, y, az, el: ymax - (y - MT) / py, ridge: maskAt(site.hz, base, nAz, az), hit: nearest(x, y) }); }} />
      </svg>
      <div className="readout" aria-live="polite">
        <span className="stamp">{fmtDateTime(t)}</span>
        <span className={sunVisible ? 'ok' : 'no'}>
          Sun at {site.sunEl[t].toFixed(2)}° elevation, terrain edge {sunMask.toFixed(2)}° → {sunVisible ? 'in view' : 'blocked'}
        </span>
        <span className={earthVisible ? 'ok' : 'no'}>
          Earth at {site.earthEl[t].toFixed(2)}° elevation, terrain edge {earthMask.toFixed(2)}° → {earthVisible ? 'in view' : 'blocked'}
        </span>
      </div>
      <div className="readout countdown">
        <span className={sunVisible ? 'ok' : 'no'}>{fmtNext('Sun', sunVisible, sunNext)}</span>
        <span className={earthVisible ? 'ok' : 'no'}>{fmtNext('Earth', earthVisible, earthNext)}</span>
      </div>
    </figure>
  );
}
