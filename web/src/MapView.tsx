import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import type { Globe, Site } from './data';
import { DraftingCursor, type DraftProbe } from './fx';
import SpecularButton from './rb/SpecularButton.jsx';
import FluidGlass from './rb/FluidGlass.jsx';
import './rb/FluidGlass.css';
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
  const pinsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { // pins drop in one after another
    const els = pinsRef.current?.querySelectorAll('.mpin'); if (!els?.length) return;
    const tw = gsap.from(els, { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2.5)', stagger: 0.03, delay: 0.2 });
    return () => { tw.kill(); };
  }, [sites.length]);
  useLayoutEffect(() => { // selected pin: pop + two expanding pulse rings
    const sel = pinsRef.current?.querySelector('.mpin.sel'); if (!sel) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(sel.querySelector('.pdot'), { scale: 0.4 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' });
      gsap.fromTo(sel.querySelectorAll('.pring'), { scale: 1, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 1.8, ease: 'power2.out', repeat: -1, stagger: 0.9 });
    });
    return () => ctx.revert();
  }, [selected]);
  const cv = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [lat, setLat] = useState(sites[selected].lat.toFixed(3));
  const [lon, setLon] = useState((((sites[selected].lon + 540) % 360) - 180).toFixed(3));
  const [hover, setHover] = useState('');
  const [hi, setHi] = useState<HTMLCanvasElement | null>(null);
  const [layer, setLayer] = useState<'wac' | 'colour'>('wac'); // one map at a time
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState('');
  // zoom and pan: z = magnification, (x0, y0) = top-left of the visible part in map pixels
  const [vw, setVw] = useState({ z: 1, x0: 0, y0: 0 });
  const vwRef = useRef(vw); vwRef.current = vw;
  const fit = (z: number, x0: number, y0: number) => { const zz = Math.min(32, Math.max(1, z)); return { z: zz, x0: Math.min(W - W / zz, Math.max(0, x0)), y0: Math.min(H - H / zz, Math.max(0, y0)) }; };
  const zoomAt = (f: number, fx = 0.5, fy = 0.5) => setVw((v) => { const mx = v.x0 + (fx * W) / v.z, my = v.y0 + (fy * H) / v.z, z = Math.min(32, Math.max(1, v.z * f)); return fit(z, mx - (fx * W) / z, my - (fy * H) / z); });
  const tiles = useRef(new Map<string, HTMLImageElement | null>());
  const [tick, setTick] = useState(0);
  const drag = useRef<{ x: number; y: number; x0: number; y0: number; moved: boolean } | null>(null);
  const noClick = useRef(false);
  const glass = useRef<{ refresh: () => void } | null>(null);
  const [mag, setMag] = useState(true);
  const glassSrc = useCallback(() => cv.current, []);
  const [glassTune, setGlassTune] = useState<Record<string, number>>({});
  useEffect(() => { (window as unknown as { luGlass: (o: Record<string, number>) => void }).luGlass = (o) => setGlassTune(o); }, []);
  const mapProbe = useCallback((x: number, y: number): DraftProbe | null => { const c = cv.current; if (!c) return null; const w = c.clientWidth, h = c.clientHeight; if (x < 0 || y < 0 || x > w || y > h) return null; const v = vwRef.current; const mx = v.x0 + ((x / w) * W) / v.z, my = v.y0 + ((y / h) * H) / v.z; return { lat: 90 - (my / H) * 180, lon: (mx / W) * 360 - 180, extra: v.z > 1 ? `LROC WAC mosaic · zoom ${v.z.toFixed(1)}×` : 'LROC WAC mosaic' }; }, []);

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
    const { z, x0, y0 } = vw;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#222';
    g.fillRect(0, 0, W * S, H * S);
    g.setTransform(S * z, 0, 0, S * z, -x0 * S * z, -y0 * S * z);
    if (layer === 'colour' || !hi || prog < 1) { if (img) g.drawImage(img, 0, 0, W, H); }
    if (layer === 'wac' && hi && prog >= 1) g.drawImage(hi, 0, 0, W, H);
    if (layer === 'wac' && z > 1.5) { // sharper NASA Trek LRO WAC tiles for the visible area only
      const L = Math.min(7, Z + Math.ceil(Math.log2(z))), cols = 2 ** (L + 1), rows = 2 ** L, tw = W / cols, th = H / rows;
      const c0 = Math.max(0, Math.floor(x0 / tw)), c1 = Math.min(cols - 1, Math.floor((x0 + W / z) / tw)), r0 = Math.max(0, Math.floor(y0 / th)), r1 = Math.min(rows - 1, Math.floor((y0 + H / z) / th));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const k = `${L}/${r}/${c}`; let im = tiles.current.get(k);
        if (im === undefined) { const n = new Image(); n.crossOrigin = 'anonymous'; tiles.current.set(k, null); n.onload = () => { tiles.current.set(k, n); setTick((x) => x + 1); }; n.src = TREK(L, r, c); }
        else if (im) g.drawImage(im, c * tw, r * th, tw + 0.3 / z, th + 0.3 / z);
      }
    }
    g.setTransform(S * z, 0, 0, S * z, -x0 * S * z, -y0 * S * z);
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
    g.lineWidth = 1 / z;
    g.font = `${18 / z}px system-ui, sans-serif`;
    for (let lo = -150; lo <= 150; lo += 30) {
      const x = ((lo + 180) / 360) * W;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      g.fillText(`${Math.abs(lo)}°${lo < 0 ? 'W' : lo > 0 ? 'E' : ''}`, x + 5 / z, y0 + H / z - 8 / z);
    }
    for (let la = -60; la <= 60; la += 30) {
      const y = ((90 - la) / 180) * H;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      g.fillText(`${Math.abs(la)}°${la < 0 ? 'S' : la > 0 ? 'N' : ''}`, x0 + 6 / z, y - 6 / z);
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';
    if (z < 1.5) { g.fillText('FAR SIDE', 60, 30); g.fillText('NEAR SIDE (faces Earth)', W / 2 - 110, 30); g.fillText('FAR SIDE', W - 150, 30); }
    const mark = (la: number, lo: number, glyph: string) => { const [x, y] = xy(la, lo); g.font = `${30 / z}px system-ui, sans-serif`; g.fillText(glyph, x - 15 / z, y + 10 / z); };
    g.fillStyle = '#fff';
    mark(globe.sunLat[t], globe.sunLon[t], '☀');
    mark(globe.earthLat[t], globe.earthLon[t], '🌍');
    glass.current?.refresh(); // keep the magnifier in step with this frame
    // site pins are HTML (animated with GSAP) — see .map-pins below
  }, [img, hi, sites, selected, t, globe, layer, prog, vw, tick]);

  const toLL = (e: React.MouseEvent<HTMLCanvasElement>): [number, number, number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    const v = vwRef.current; const px = v.x0 + (((e.clientX - r.left) / r.width) * W) / v.z, py = v.y0 + (((e.clientY - r.top) / r.height) * H) / v.z;
    return [90 - (py / H) * 180, (px / W) * 360 - 180, px, py];
  };
  useEffect(() => { // pinch on a trackpad (sent as ctrl+wheel) or ⌘/Ctrl + scroll zooms around the cursor; plain scroll keeps scrolling the page
    const c = cv.current; if (!c) return;
    const wh = (e: WheelEvent) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = c.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.01), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    c.addEventListener('wheel', wh, { passive: false });
    let p0 = 0; const ts = (e: TouchEvent) => { if (e.touches.length === 2) p0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
    const tm = (e: TouchEvent) => { if (e.touches.length !== 2 || !p0) return; e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const r = c.getBoundingClientRect(); zoomAt(d / p0, ((e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left) / r.width, ((e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top) / r.height); p0 = d; };
    c.addEventListener('touchstart', ts, { passive: true }); c.addEventListener('touchmove', tm, { passive: false });
    return () => { c.removeEventListener('wheel', wh); c.removeEventListener('touchstart', ts); c.removeEventListener('touchmove', tm); };
  }, []);
  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (noClick.current) { noClick.current = false; return; }
    const [la, lo, px, py] = toLL(e);
    let best = -1, bd = (14 / vwRef.current.z) ** 2;
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
        <div className="maplayers" role="tablist" aria-label="Map imagery">
          <button type="button" role="tab" aria-selected={layer === 'wac'} className={layer === 'wac' ? 'on' : ''} onClick={() => setLayer('wac')}>LRO camera map{prog < 1 ? ` · ${Math.round(prog * 100)}%` : ''}</button>
          <button type="button" role="tab" aria-selected={layer === 'colour'} className={layer === 'colour' ? 'on' : ''} onClick={() => setLayer('colour')}>3D Moon colour map</button>
        </div>
        <div className="mapcv">
        <DraftingCursor probe={mapProbe} distance={hav} hint="Click to analyse · shift-drag to measure" />
        {mag && <FluidGlass className="mapglass" source={glassSrc} apiRef={glass} onlyGlass hideOutside text="" shape="lens" size={230} refraction={1.25} dispersion={0.12} reflection={0.7} shadow={0} elevation={1.6} interaction="follow" smoothness={0} wobble={0.15} spin={0} idle={false} intro={false} morphOnClick={false} maxDevicePixelRatio={2} {...glassTune} />}
        <div className="map-pins" ref={pinsRef}>
          {sites.map((st, i) => { const [x, y] = xy(st.lat, st.lon); return (
            <button key={st.id} type="button" className={`mpin ${st.year !== null ? 'landed' : 'cand'}${i === selected ? ' sel' : ''}`} style={{ left: `${((x - vw.x0) * vw.z / W) * 100}%`, top: `${((y - vw.y0) * vw.z / H) * 100}%`, display: (x - vw.x0) * vw.z < 0 || (x - vw.x0) * vw.z > W || (y - vw.y0) * vw.z < 0 || (y - vw.y0) * vw.z > H ? 'none' : undefined, ['--c' as string]: GROUP_COLOR[st.group] ?? '#fff' }} onClick={() => onPickSite(i)} title={`${st.name} · ${st.mission}`} aria-label={st.name}>
              {i === selected && <><i className="pring" /><i className="pring" /></>}<i className="pdot" /><span>{st.name}</span>
            </button>); })}
          {(() => { // live preview of the typed coordinates, before "Analyse this point"
            const la = parseFloat(lat), lo = parseFloat(lon);
            if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 360) return null;
            const cur = sites[selected]; const lo180 = ((lo + 540) % 360) - 180;
            if (cur && Math.abs(cur.lat - la) < 0.0005 && Math.abs((((cur.lon + 540) % 360) - 180) - lo180) < 0.0005) return null;
            const [x, y] = xy(la, lo180);
            return <button type="button" className="mpin preview sel" style={{ left: `${((x - vw.x0) * vw.z / W) * 100}%`, top: `${((y - vw.y0) * vw.z / H) * 100}%`, display: (x - vw.x0) * vw.z < 0 || (x - vw.x0) * vw.z > W || (y - vw.y0) * vw.z < 0 || (y - vw.y0) * vw.z > H ? 'none' : undefined, ['--c' as string]: '#ffffff' }} onClick={() => onCustom(la, lo180)} title="Analyse this point">
              <i className="pring" /><i className="pdot" /><span>{Math.abs(la).toFixed(3)}°{la < 0 ? 'S' : 'N'}, {Math.abs(lo180).toFixed(3)}°{lo180 < 0 ? 'W' : 'E'} · click to analyse</span>
            </button>;
          })()}
        </div>
        <div className="mapzoom" aria-label="Map zoom">
          <button type="button" onClick={() => zoomAt(2)} title="Zoom in">+</button>
          <button type="button" onClick={() => zoomAt(0.5)} title="Zoom out">−</button>
          <button type="button" onClick={() => setVw({ z: 1, x0: 0, y0: 0 })} title="Show the whole Moon">⤢</button>
          <button type="button" className={mag ? 'on' : ''} onClick={() => setMag((m) => !m)} title={mag ? 'Turn the magnifying glass off' : 'Turn the magnifying glass on'} aria-pressed={mag}>🔍</button>
          <span>{vw.z > 1 ? `${vw.z.toFixed(1)}×` : 'Pinch or ⌘/Ctrl + scroll to zoom · drag to pan'}</span>
        </div>
        <canvas ref={cv} width={W * S} height={H * S} onClick={click}
          onPointerDown={(e) => { if (e.shiftKey || e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, x0: vw.x0, y0: vw.y0, moved: false }; }}
          onPointerMove={(e) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!d.moved && Math.hypot(dx, dy) < 5) return; if (!d.moved) { d.moved = true; e.currentTarget.setPointerCapture(e.pointerId); } const r = e.currentTarget.getBoundingClientRect(); setVw((v) => fit(v.z, d.x0 - (dx / r.width) * W / v.z, d.y0 - (dy / r.height) * H / v.z)); }}
          onPointerUp={() => { if (drag.current?.moved) noClick.current = true; drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onMouseMove={(e) => { const [la, lo] = toLL(e); setHover(`${Math.abs(la).toFixed(2)}°${la < 0 ? 'S' : 'N'}, ${Math.abs(lo).toFixed(2)}°${lo < 0 ? 'W' : 'E'}  (click to analyse)`); }}
          onMouseLeave={() => setHover('')} aria-label="Map of the Moon. Click to choose a landing point." />
        </div>
      </div>
      <div className="hud-bottom">{children}</div>
    </div>
  );
}
