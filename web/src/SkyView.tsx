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
const H = 250;
const ML = 46;
const MR = 12;
const MT = 10;
const MB = 26;
const YMIN = -4;
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];

export default function SkyView({ label, site, common, manifest, mastIdx, start, end, scrub, earthMin }: Props) {
  const [hov, setHov] = useState<{ x: number; y: number; az: number; el: number; ridge: number } | null>(null);
  const nAz = manifest.n_az;
  const base = mastIdx * manifest.offsets_m.length * nAz; // centre position (offset 0)

  const ymax = useMemo(() => {
    let m = 0;
    for (let k = 0; k < nAz; k++) m = Math.max(m, site.hz[base + k] / 100);
    for (let i = start; i < end; i++) m = Math.max(m, site.sunEl[i], site.earthEl[i]);
    return Math.min(35, Math.max(6, Math.ceil(m) + 1));
  }, [site, base, nAz, start, end]);

  const px = (W - ML - MR) / 360;
  const py = (H - MT - MB) / (ymax - YMIN);
  const xs = (az: number) => ML + az * px;
  const ys = (el: number) => MT + (ymax - el) * py;

  const terrain = useMemo(() => {
    let d = `M ${xs(0)} ${ys(YMIN)}`;
    for (let k = 0; k <= nAz; k++) {
      const h = Math.max(site.hz[base + (k % nAz)] / 100, YMIN);
      d += ` L ${xs((k * 360) / nAz)} ${ys(h)}`;
    }
    return d + ` L ${xs(360)} ${ys(YMIN)} Z`;
  }, [site, base, nAz, ymax]);

  const step = Math.max(1, Math.ceil((end - start) / 600));
  const dots = useMemo(() => {
    const out: { x: number; y: number; vis: boolean; earth: boolean; k: number }[] = [];
    for (let i = start; i < end; i += step) {
      const sm = maskAt(site.hz, base, nAz, site.sunAz[i]);
      const em = maskAt(site.hz, base, nAz, site.earthAz[i]);
      if (site.sunEl[i] >= YMIN && site.sunEl[i] <= ymax)
        out.push({ x: xs(site.sunAz[i]), y: ys(site.sunEl[i]), vis: site.sunEl[i] > sm, earth: false, k: i });
      if (site.earthEl[i] >= YMIN && site.earthEl[i] <= ymax)
        out.push({ x: xs(site.earthAz[i]), y: ys(site.earthEl[i]), vis: site.earthEl[i] > Math.max(em, 0) + earthMin, earth: true, k: i });
    }
    return out;
  }, [site, base, nAz, start, end, ymax, earthMin]);

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
  const stepY = ymax > 20 ? 5 : ymax > 10 ? 2 : 1;
  for (let v = Math.ceil(YMIN / stepY) * stepY; v <= ymax; v += stepY) yTicks.push(v);

  const disc = (az: number, el: number, r: number, color: string, key: string) => (
    <ellipse key={key} cx={xs(az)} cy={ys(el)} rx={r * px} ry={r * py} fill={color} stroke="#fff" strokeWidth={1.2} />
  );

  return (
    <figure className="sky">
      <figcaption>
        <strong>{label}: {site.name}</strong>
        <span className="muted"> sky as seen from the site, looking all around (azimuth) and up (elevation)</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sun and Earth tracks over the terrain horizon at ${site.name}`}>
        <defs>
          <linearGradient id={`sky-${site.id}-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#050506" />
            <stop offset="1" stopColor="#121216" />
          </linearGradient>
        </defs>
        <rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} fill={`url(#sky-${site.id}-${label})`} />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={ML} x2={W - MR} y1={ys(v)} y2={ys(v)} className={v === 0 ? 'zero' : 'grid'} />
            <text x={ML - 6} y={ys(v) + 4} textAnchor="end" className="tick">{v}°</text>
          </g>
        ))}
        {DIRS.map((d, i) => (
          <g key={i}>
            <line x1={xs(i * 45)} x2={xs(i * 45)} y1={MT} y2={H - MB} className="grid" />
            <text x={xs(i * 45)} y={H - 8} textAnchor="middle" className="tick">{d}</text>
          </g>
        ))}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.vis ? 2.1 : 1.6} className={(d.earth ? 'earth' : 'sun') + (d.vis ? ' on' : ' off')} />
        ))}
        <path d={terrain} className="terrain" />
        {site.sunEl[t] >= YMIN && site.sunEl[t] <= ymax && disc(site.sunAz[t], site.sunEl[t], common.sunR[t], '#ffc857', 'sun')}
        {site.earthEl[t] >= YMIN && site.earthEl[t] <= ymax && disc(site.earthAz[t], site.earthEl[t], common.earthR[t], '#4cc9f0', 'earth')}
        {[['Sun', site.sunAz[t], site.sunEl[t], '#ffc857'], ['Earth', site.earthAz[t], site.earthEl[t], '#4cc9f0']].map(([n, az, el, c]) => {
          const a = az as number, e = el as number; if (e >= YMIN && e <= ymax) return null; const up = e > ymax; const y = up ? MT + 4 : H - MB - 4;
          return <g key={n as string} className="offchart"><path d={up ? `M ${xs(a) - 6} ${y + 9} L ${xs(a)} ${y} L ${xs(a) + 6} ${y + 9} Z` : `M ${xs(a) - 6} ${y - 9} L ${xs(a)} ${y} L ${xs(a) + 6} ${y - 9} Z`} fill={c as string} /><text x={xs(a) + 10} y={up ? y + 10 : y - 3} fill={c as string}>{n as string} {e.toFixed(1)}° (off chart)</text></g>;
        })}
        {hov && <g className="probe"><line x1={hov.x} x2={hov.x} y1={MT} y2={H - MB} /><line x1={ML} x2={W - MR} y1={hov.y} y2={hov.y} /><circle cx={xs(hov.az)} cy={ys(hov.ridge)} r={3.5} /><text x={Math.min(hov.x + 8, W - MR - 170)} y={MT + 14}>Az {hov.az.toFixed(1)}° · El {hov.el.toFixed(2)}° · ridge {hov.ridge.toFixed(2)}°</text></g>}
        <rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} fill="transparent" onMouseMove={(ev) => { const r = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width) * W, y = ((ev.clientY - r.top) / r.height) * H; const az = Math.min(359.99, Math.max(0, (x - ML) / px)); setHov({ x, y, az, el: ymax - (y - MT) / py, ridge: site.hz[base + (Math.round((az / 360) * nAz) % nAz)] / 100 }); }} onMouseLeave={() => setHov(null)} style={{ cursor: 'crosshair' }} />
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
