import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Globe, Site } from './data';
import { DraftingCursor, type DraftProbe } from './fx';
import SpecularButton from './rb/SpecularButton.jsx';
const R_MOON = 1737400;
const hav = (a: DraftProbe, b: DraftProbe) => { const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R_MOON * Math.asin(Math.min(1, Math.sqrt(h))); };

interface Props {
  sites: Site[];
  selected: number;
  t: number;
  globe: Globe;
  mapUrl: string;
  busy: boolean;
  onPickSite: (i: number) => void;
  onCustom: (lat: number, lon: number) => void;
  chrome?: ReactNode;
  children?: ReactNode;
}

const W = 1800, H = 900, S = 2, Z = 3;
const TREK = (z: number, r: number, c: number) => `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/${z}/${r}/${c}.jpg`;
const GROUP_COLOR: Record<string, string> = { Apollo: '#ffc857', 'CLPS / commercial': '#7ee0a1', 'Other agencies': '#ff8a80', 'Polar candidate regions': '#4cc9f0', 'Your coordinates': '#ffffff' };
const xy = (lat: number, lon: number): [number, number] => [((((lon + 540) % 360) / 360) * W), ((90 - lat) / 180) * H];

export default function MapView({ sites, selected, t, globe, mapUrl, busy, onPickSite, onCustom, chrome, children }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [lat, setLat] = useState(sites[selected].lat.toFixed(3));
  const [lon, setLon] = useState((((sites[selected].lon + 540) % 360) - 180).toFixed(3));
  const [hover, setHover] = useState('');
  const [hi, setHi] = useState<HTMLCanvasElement | null>(null);
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState('');
  const mapProbe = useCallback((x: number, y: number): DraftProbe | null => { const c = cv.current; if (!c) return null; const w = c.clientWidth, h = c.clientHeight; if (x < 0 || y < 0 || x > w || y > h) return null; return { lat: 90 - (y / h) * 180, lon: (x / w) * 360 - 180, extra: 'LROC WAC mosaic' }; }, []);

  useEffect(() => {
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = mapUrl;
  }, [mapUrl]);
  useEffect(() => { // NASA Trek LRO WAC tiles into a 4096x2048 mosaic, shown as tiles arrive
    const m = document.createElement('canvas'); m.width = 256 * 2 ** (Z + 1); m.height = 256 * 2 ** Z; const mg = m.getContext('2d')!;
    let dead = false, n = 0; const tot = 2 ** (2 * Z + 1); const q: [number, number, number][] = [];
    for (let r = 0; r < 2 ** Z; r++) for (let c = 0; c < 2 ** (Z + 1); c++) q.push([r, c, 0]);
    const next = () => {
      const j = q.shift(); if (!j || dead) return; const [r, c, k] = j;
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { if (dead) return; mg.drawImage(im, c * 256, r * 256, 256, 256); n++; setProg(n / tot); if (n % 12 === 0 || n === tot) setHi(m); next(); };
      im.onerror = () => { if (k < 3) q.push([r, c, k + 1]); else { n++; setProg(n / tot); } setTimeout(next, 150); };
      im.src = TREK(Z, r, c) + (k ? `?r=${k}` : '');
    };
    for (let i = 0; i < 8; i++) next();
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    setLat(sites[selected].lat.toFixed(3));
    setLon((((sites[selected].lon + 540) % 360) - 180).toFixed(3));
  }, [sites, selected]);

  useEffect(() => {
    const c = cv.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#222';
    g.fillRect(0, 0, W * S, H * S);
    if (img) g.drawImage(img, 0, 0, W * S, H * S);
    if (hi) g.drawImage(hi, 0, 0, W * S, H * S);
    g.setTransform(S, 0, 0, S, 0, 0);
    // night side for the selected time (true sub-solar point)
    const nw = 360, nh = 180;
    const off = document.createElement('canvas');
    off.width = nw; off.height = nh;
    const og = off.getContext('2d');
    if (og) {
      const id = og.createImageData(nw, nh);
      const sl = (globe.sunLat[t] * Math.PI) / 180, so = (globe.sunLon[t] * Math.PI) / 180;
      for (let y = 0; y < nh; y++) {
        const la = ((90 - (y + 0.5)) * Math.PI) / 180;
        for (let x = 0; x < nw; x++) {
          const lo = ((x + 0.5 - 180) * Math.PI) / 180;
          const cz = Math.sin(la) * Math.sin(sl) + Math.cos(la) * Math.cos(sl) * Math.cos(lo - so);
          id.data[4 * (y * nw + x) + 3] = Math.round(Math.min(1, Math.max(0, (0.03 - cz) / 0.1)) * 175);
        }
      }
      og.putImageData(id, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(off, 0, 0, W, H);
    }
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1;
    g.font = '18px system-ui, sans-serif';
    for (let lo = -150; lo <= 150; lo += 30) {
      const x = ((lo + 180) / 360) * W;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      g.fillText(`${Math.abs(lo)}°${lo < 0 ? 'W' : lo > 0 ? 'E' : ''}`, x + 5, H - 8);
    }
    for (let la = -60; la <= 60; la += 30) {
      const y = ((90 - la) / 180) * H;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      g.fillText(`${Math.abs(la)}°${la < 0 ? 'S' : la > 0 ? 'N' : ''}`, 6, y - 6);
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText('FAR SIDE', 60, 30); g.fillText('NEAR SIDE (faces Earth)', W / 2 - 110, 30); g.fillText('FAR SIDE', W - 150, 30);
    const mark = (la: number, lo: number, glyph: string) => { const [x, y] = xy(la, lo); g.font = '30px system-ui, sans-serif'; g.fillText(glyph, x - 15, y + 10); };
    g.fillStyle = '#fff';
    mark(globe.sunLat[t], globe.sunLon[t], '☀');
    mark(globe.earthLat[t], globe.earthLon[t], '🌍');
    sites.forEach((s, i) => {
      const [x, y] = xy(s.lat, s.lon);
      g.beginPath();
      g.arc(x, y, i === selected ? 11 : 6, 0, 2 * Math.PI);
      g.fillStyle = GROUP_COLOR[s.group] ?? '#fff';
      g.fill();
      g.lineWidth = i === selected ? 4 : 1.5;
      g.strokeStyle = i === selected ? '#fff' : '#000';
      g.stroke();
      if (i === selected) {
        g.font = 'bold 22px system-ui, sans-serif';
        const tw = g.measureText(s.name).width;
        const tx = Math.min(x + 16, W - tw - 12);
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.fillRect(tx - 6, y - 34, tw + 12, 30);
        g.fillStyle = '#fff';
        g.fillText(s.name, tx, y - 12);
      }
    });
  }, [img, hi, sites, selected, t, globe]);

  const toLL = (e: React.MouseEvent<HTMLCanvasElement>): [number, number, number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    return [90 - (py / H) * 180, (px / W) * 360 - 180, px, py];
  };
  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const [la, lo, px, py] = toLL(e);
    let best = -1, bd = 14 * 14;
    sites.forEach((s, i) => { const [x, y] = xy(s.lat, s.lon); const d = (x - px) ** 2 + (y - py) ** 2; if (d < bd && s.id !== 'custom') { bd = d; best = i; } });
    if (best >= 0) onPickSite(best);
    else { setErr(''); onCustom(Math.max(-89.9, Math.min(89.9, la)), lo); }
  };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 360) { setErr('Latitude must be between -90 and 90, longitude between -180 and 180 (east positive).'); return; }
    setErr('');
    onCustom(Math.max(-89.9, Math.min(89.9, la)), lo);
  };

  return (
    <div className="stage mapstage">
      {chrome}
      <div className="mapwrap">
        <form className="coords" onSubmit={submit}>
          <label>Latitude (°N)<input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude in degrees north" /></label>
          <label>Longitude (°E)<input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitude in degrees east" /></label>
          <SpecularButton type="submit" size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.4} glow={1} proximity={220} className="cta-spec" disabled={busy}>{busy ? 'Computing…' : 'Analyse this point'}</SpecularButton>
          <span className="maphint">{err || hover || (prog < 1 ? `Loading NASA LRO WAC 4K imagery… ${Math.round(prog * 100)}%` : '') || 'Click anywhere on the map, or type coordinates. South and west are negative. ☀ marks where the Sun is overhead, 🌍 where Earth is overhead; the shaded half is night.'}</span>
        </form>
        <div className="mapcv">
        <DraftingCursor probe={mapProbe} distance={hav} hint="Click to analyse · shift-drag to measure" />
        <canvas ref={cv} width={W * S} height={H * S} onClick={click}
          onMouseMove={(e) => { const [la, lo] = toLL(e); setHover(`${Math.abs(la).toFixed(2)}°${la < 0 ? 'S' : 'N'}, ${Math.abs(lo).toFixed(2)}°${lo < 0 ? 'W' : 'E'}  (click to analyse)`); }}
          onMouseLeave={() => setHover('')} aria-label="Map of the Moon. Click to choose a landing point." />
        </div>
      </div>
      <div className="hud-bottom">{children}</div>
    </div>
  );
}
