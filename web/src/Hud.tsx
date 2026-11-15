import GradientText from './rb/GradientText.jsx';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Manifest, Site } from './data';
import { maskAt, nextChange } from './metrics';
import { fmtDateTime, fmtHours } from './format';

interface Props {
  site: Site;
  manifest: Manifest;
  mastIdx: number;
  earthMin: number;
  t: number;
  start: number;
  end: number;
  scrub: number;
  onScrub: (v: number) => void;
  action?: ReactNode;
}

export default function Hud({ site, manifest, mastIdx, earthMin, t, start, end, scrub, onScrub, action }: Props) {
  const nAz = manifest.n_az;
  const base = mastIdx * manifest.offsets_m.length * nAz;
  const sm = maskAt(site.hz, base, nAz, site.sunAz[t]);
  const em = maskAt(site.hz, base, nAz, site.earthAz[t]);
  const sunVis = site.sunEl[t] > sm;
  const earthVis = site.earthEl[t] > Math.max(em, 0) + earthMin;
  const sn = nextChange(site.hz, base, nAz, site.sunEl, site.sunAz, t, false, earthMin, sunVis);
  const en = nextChange(site.hz, base, nAz, site.earthEl, site.earthAz, t, true, earthMin, earthVis);
  const next = (vis: boolean, h: number, up: string, down: string) =>
    h < 0 ? (vis ? `${up} for the next 45+ days` : `${down} for the next 45+ days`) : `${vis ? 'sets' : 'rises'} in ${fmtHours(h)}`;

  const [play, setPlay] = useState(false);
  const sc = useRef(scrub);
  sc.current = scrub;
  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => {
      const nx = sc.current + 2;
      if (nx >= end - start - 1) { setPlay(false); onScrub(end - start - 1); } else onScrub(nx);
    }, 60);
    return () => window.clearInterval(id);
  }, [play, end, start, onScrub]);
  const jumpLit = () => {
    for (let i = t + 1; i < end; i++) if (site.sunEl[i] > maskAt(site.hz, base, nAz, site.sunAz[i])) { onScrub(i - start); return; }
    for (let i = start; i < t; i++) if (site.sunEl[i] > maskAt(site.hz, base, nAz, site.sunAz[i])) { onScrub(i - start); return; }
  };
  const lat = `${Math.abs(site.lat).toFixed(2)}°${site.lat < 0 ? 'S' : 'N'}`;
  const lonN = ((site.lon + 540) % 360) - 180;
  const lon = `${Math.abs(lonN).toFixed(2)}°${lonN < 0 ? 'W' : 'E'}`;
  const deg = (x: number) => `${Math.abs(x).toFixed(1)}° ${x >= 0 ? 'above' : 'below'} the horizon`;

  return (
    <div className="hud2">
      <div className="hud-name"><h2><GradientText colors={['#ffffff', '#d6e6ff', '#6fa8ff', '#ffffff']} animationSpeed={9} variant="linear" scale={2.4}>{site.name}</GradientText></h2>{action}</div>
      <p className="meta">{site.mission} · {lat}, {lon}{site.accuracy !== 'LRO-refined' ? ' · position approximate' : ''}</p>
      <p className="stat">
        <i className={'dot ' + (sunVis ? 'ok' : 'no')} />
        <b>{sunVis ? 'Sunlit: solar power available' : 'In shadow: no solar power'}</b>
        <span>Sun {deg(site.sunEl[t])} · {next(sunVis, sn, 'stays up', 'stays dark')}</span>
      </p>
      <p className="stat">
        <i className={'dot ' + (earthVis ? 'ok' : 'no')} />
        <b>{earthVis ? 'Earth in view: direct radio link' : 'Earth hidden: no direct link'}</b>
        <span>Earth {deg(site.earthEl[t])} · {next(earthVis, en, 'stays in view', 'stays hidden')}</span>
      </p>
      <div className="timebar">
        <button type="button" className="iconbtn" onClick={() => setPlay((p) => !p)} aria-label={play ? 'Pause time' : 'Play time'} aria-pressed={play}>{play ? '❚❚' : '▶'}</button>
        <button type="button" className="pill" onClick={jumpLit}>Next sunrise</button>
        <span className="clock">{fmtDateTime(t)}</span>
        <input type="range" min={0} max={end - start - 1} value={scrub} onChange={(e) => onScrub(Number(e.target.value))} aria-label="Time in window" />
      </div>
    </div>
  );
}
