import type { Site } from './data';
import { fmtDateTime } from './format';

interface Props { site: Site; t: number; view: string }
const NAMES: Record<string, string> = { globe: 'GLOBE', map: 'MAP', orbit: 'TERRAIN', descent: 'LANDING', mission: 'MISSION', craft: 'SPACECRAFT', cesium: 'REAL TERRAIN', lander: 'SURFACE', calendar: 'DATES' };
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export default function HudFrame({ site, t, view }: Props) {
  const az = site.sunAz[t] ?? 0, el = site.sunEl[t] ?? 0, eel = site.earthEl[t] ?? 0;
  const lon = (((site.lon + 540) % 360) - 180);
  const ticks = [];
  for (let d = -180; d <= 540; d += 15) {
    const deg = ((d % 360) + 360) % 360;
    ticks.push(<span key={d} className={deg % 45 === 0 ? 'mj' : ''} style={{ left: `${(d / 360) * 1200}px` }}>{deg % 45 === 0 ? DIRS[deg / 45] : ''}</span>);
  }
  return (
    <div className="hudf" aria-hidden="true">
      <i className="hc tl" /><i className="hc tr" /><i className="hc bl" /><i className="hc br" />
      <div className="hcomp"><div className="hcomp-in" style={{ transform: `translateX(${-(az / 360) * 1200}px)` }}>{ticks}</div><b className="hcomp-n" /><em>SUN {az.toFixed(0)}°</em></div>
      <div className="htele">
        <p><i>LAT</i>{Math.abs(site.lat).toFixed(4)}°{site.lat < 0 ? 'S' : 'N'}</p>
        <p><i>LON</i>{Math.abs(lon).toFixed(4)}°{lon < 0 ? 'W' : 'E'}</p>
        <p><i>SUN EL</i>{el.toFixed(1)}°</p>
        <p><i>EARTH EL</i>{eel.toFixed(1)}°</p>
      </div>
      <div className="hscale">{Array.from({ length: 11 }, (_, i) => <span key={i} className={i % 5 === 0 ? 'mj' : ''} />)}<em>SUN</em><b style={{ bottom: `${Math.max(0, Math.min(100, (el + 10) / 100 * 100))}%` }} /></div>
      <div className="hstat"><b className={el > 0 ? 'ok' : 'warn'} />SYSTEM STATUS: {el > 0 ? 'SUNLIT' : 'NIGHT'} · {NAMES[view] ?? view.toUpperCase()} · {fmtDateTime(t)}</div>
      <div key={view} className="hsweep" />
    </div>
  );
}
