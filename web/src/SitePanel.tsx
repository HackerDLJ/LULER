import { useEffect, useState } from 'react';
import type { Site } from './data';
import SpecularButton from './rb/SpecularButton.jsx';

interface Ill { sun: number; earth: number; dark: number }
interface Props {
  sites: Site[];
  a: number;
  b: number;
  onB: (i: number) => void;
  onCustom: (lat: number, lon: number) => void;
  busy: boolean;
  ill: { a: Ill; b: Ill; label: string };
}
const f = (x: number | undefined, d = 0, u = '') => (x === undefined || Number.isNaN(x) ? 'n/a' : `${x.toFixed(d)}${u}`);
const coord = (s: Site) => { const lo = ((s.lon + 540) % 360) - 180; return `${Math.abs(s.lat).toFixed(3)}°${s.lat < 0 ? 'S' : 'N'} ${Math.abs(lo).toFixed(3)}°${lo < 0 ? 'W' : 'E'}`; };

export default function SitePanel({ sites, a, b, onB, onCustom, busy, ill }: Props) {
  const A = sites[a], B = sites[b];
  const [lat, setLat] = useState(A.lat.toFixed(4));
  const [lon, setLon] = useState((((A.lon + 540) % 360) - 180).toFixed(4));
  const [err, setErr] = useState('');
  useEffect(() => { setLat(A.lat.toFixed(4)); setLon((((A.lon + 540) % 360) - 180).toFixed(4)); }, [A]);
  const go = (ev: React.FormEvent) => {
    ev.preventDefault();
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 360) { setErr('Latitude -90 to 90, longitude -180 to 180 (east positive).'); return; }
    setErr('');
    onCustom(Math.max(-89.9, Math.min(89.9, la)), lo);
  };
  const row = (label: string, va: string, vb: string, hint?: string) => (
    <tr><th>{label}{hint && <small>{hint}</small>}</th><td>{va}</td><td>{vb}</td></tr>
  );
  const ia = A.info, ib = B.info;
  return (
    <div className="sp">
      <p className="sp-h">Go to coordinates</p>
      <form className="sp-go" onSubmit={go}>
        <label>Lat °N<input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude, degrees north" /></label>
        <label>Lon °E<input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitude, degrees east" /></label>
        <SpecularButton type="submit" size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.4} glow={1} proximity={220} className="cta-spec" disabled={busy}>{busy ? '…' : 'Go'}</SpecularButton>
      </form>
      {err && <p className="sp-err">{err}</p>}
      <p className="sp-h">Terrain and comparison</p>
      <table className="sp-t">
        <thead>
          <tr>
            <th />
            <td><b>{A.name}</b></td>
            <td>
              <select value={b} onChange={(e) => onB(Number(e.target.value))} aria-label="Compare with">
                {sites.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}
              </select>
            </td>
          </tr>
        </thead>
        <tbody>
          {row('Coordinates', coord(A), coord(B))}
          {row('Elevation', f(ia?.elev_m, 0, ' m'), f(ib?.elev_m, 0, ' m'), 'above the 1737.4 km sphere')}
          {row('Slope at centre', `${f(ia?.slope_deg, 1, '°')} / ${f(ia?.slope_baseline_m, 0, ' m')}`, `${f(ib?.slope_deg, 1, '°')} / ${f(ib?.slope_baseline_m, 0, ' m')}`, 'angle / baseline it is measured over')}
          {(ia?.fine || ib?.fine) && row('Slope from 5 m data', ia?.fine ? `${f(ia.fine.slope_center_deg, 1, '°')} (max ${f(ia.fine.slope_max_50m_deg, 1, '°')} within 50 m)` : 'no 5 m data', ib?.fine ? `${f(ib.fine.slope_center_deg, 1, '°')} (max ${f(ib.fine.slope_max_50m_deg, 1, '°')} within 50 m)` : 'no 5 m data')}
          {(ia?.fine || ib?.fine) && row('Height uncertainty', ia?.fine ? `±${f(ia.fine.z_err_m, 2, ' m')}` : 'n/a', ib?.fine ? `±${f(ib.fine.z_err_m, 2, ' m')}` : 'n/a', 'NASA PGDA error map')}
          {row('Steepest nearby', f(ia?.slope_max_deg, 1, '°'), f(ib?.slope_max_deg, 1, '°'), `within ${f(ia?.area_km, 1)} km / ${f(ib?.area_km, 1)} km`)}
          {row('Relief nearby', f(ia?.relief_m, 0, ' m'), f(ib?.relief_m, 0, ' m'), 'highest minus lowest')}
          {row('Sunlight', f(ill.a.sun, 0, '%'), f(ill.b.sun, 0, '%'), ill.label)}
          {row('Earth in view', f(ill.a.earth, 0, '%'), f(ill.b.earth, 0, '%'))}
          {row('Longest darkness', f(ill.a.dark / 24, 1, ' d'), f(ill.b.dark / 24, 1, ' d'))}
          {row('Grid resolution', f(ia?.resolution_m, 0, ' m'), f(ib?.resolution_m, 0, ' m'))}
        </tbody>
      </table>
      <p className="sp-src"><b>Terrain data for {A.name}:</b> {ia?.source ?? 'unknown'}. {ia?.mesh}.{ia?.fine ? ` ${ia.fine.src}: ${ia.fine.patch}.` : ''}</p>
    </div>
  );
}
