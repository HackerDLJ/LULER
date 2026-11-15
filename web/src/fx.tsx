import Topography from './rb/Topography.jsx';
/* LULER effects — written for this project in the spirit of React Bits Pro (Depth Image, Depth Ribbon, Dolly Gallery,
   Passage Gallery, Pixel Sculpt, Parallax Pills, Drafting Cursor, Animated List, Orbital Type + Preloader). No dependencies. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './fx.css';

const BASE = import.meta.env.BASE_URL;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });

/* ---------- Moon thumbnails cropped from the LROC mosaic at a site's coordinates ---------- */
let moonImg: Promise<HTMLImageElement> | null = null;
const thumbCache = new Map<string, string>();
export async function siteThumb(lat: number, lon: number, spanDeg = 14, px = 320): Promise<string> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${spanDeg}`;
  if (thumbCache.has(key)) return thumbCache.get(key)!;
  moonImg ??= loadImg(BASE + 'map/moon_8k.jpg').catch(() => loadImg(BASE + 'map/moon.jpg'));
  const im = await moonImg;
  const W = im.width, H = im.height;
  const x = ((((lon + 540) % 360) / 360) * W), y = ((90 - lat) / 180) * H;
  const sw = (spanDeg / 360) * W / Math.max(0.25, Math.cos((lat * Math.PI) / 180)), sh = (spanDeg / 180) * H * 0.5;
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * 0.68);
  const g = c.getContext('2d')!; g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(im, x - sw / 2, clamp(y - sh / 2, 0, H - sh), sw, sh, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.82); thumbCache.set(key, url); return url;
}

/* ---------- 1. Depth Image: a photo relit by a light that follows the cursor (WebGL, normal map) ---------- */
export function DepthImage({ src, normal, height = 340, label }: { src: string; normal: string; height?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const gl = cv.getContext('webgl', { premultipliedAlpha: false }); if (!gl) return;
    const vs = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0,1);}';
    const fs = `precision mediump float;varying vec2 v;uniform sampler2D c,n;uniform vec2 m,s;uniform float a;
      void main(){vec2 uv=vec2(v.x*s.x+(1.-s.x)*.5,v.y);vec3 col=texture2D(c,uv).rgb;vec3 N=normalize(texture2D(n,uv).rgb*2.-1.);
      vec3 L=normalize(vec3((m-v)*vec2(1.6,1.),.35));float d=max(dot(N,L),0.);float spot=exp(-dot(m-v,m-v)*4.);
      vec3 o=col*(.32+1.5*d*(.55+.75*spot))+vec3(1.,.55,.25)*pow(d,24.)*.12*spot;gl_FragColor=vec4(o*a,1.);}`;
    const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram()!; gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit: number, im: HTMLImageElement) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); };
    const U = (n: string) => gl.getUniformLocation(pr, n);
    let raf = 0, alive = true, ready = false, mx = 0.3, my = 0.35, tx = 0.3, ty = 0.35, fade = 0;
    const draw = () => {
      raf = 0; if (!alive || !ready) return;
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); gl.viewport(0, 0, cv.width, cv.height); }
      mx += (tx - mx) * 0.12; my += (ty - my) * 0.12; fade = Math.min(1, fade + 0.04);
      gl.uniform2f(U('m'), mx, my); gl.uniform2f(U('s'), clamp((r.width / r.height) / 2, 0.05, 1), 1); gl.uniform1f(U('a'), fade);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (Math.abs(tx - mx) + Math.abs(ty - my) > 0.001 || fade < 1) raf = requestAnimationFrame(draw);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const mv = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = (e.clientY - r.top) / r.height; kick(); };
    let idle = 0; const drift = () => { if (!alive) return; idle += 0.004; if (!cv.matches(':hover')) { tx = 0.5 + Math.cos(idle) * 0.32; ty = 0.45 + Math.sin(idle * 1.3) * 0.25; kick(); } if (!reduced()) setTimeout(drift, 40); };
    Promise.all([loadImg(src), loadImg(normal)]).then(([c, n]) => { if (!alive) return; tex(0, c); tex(1, n); gl.uniform1i(U('c'), 0); gl.uniform1i(U('n'), 1); ready = true; kick(); drift(); }).catch(() => {});
    cv.addEventListener('pointermove', mv); window.addEventListener('resize', kick);
    return () => { alive = false; cancelAnimationFrame(raf); cv.removeEventListener('pointermove', mv); window.removeEventListener('resize', kick); };
  }, [src, normal]);
  return <figure className="fx-depthimg" style={{ height }}><canvas ref={ref} />{label && <figcaption>{label}</figcaption>}</figure>;
}

/* ---------- 2. Depth Ribbon: cards winding through 3D space (missions timeline) ---------- */
export interface RibbonItem { id: string; img?: string; title: string; sub: string; tag?: string; color?: string }
export function DepthRibbon({ items, onPick }: { items: RibbonItem[]; onPick?: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null); const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  useEffect(() => {
    const el = host.current; if (!el) return;
    let pos = 0, target = 0, raf = 0, alive = true, dragX: number | null = null, lastF = -1;
    const n = items.length;
    const lay = () => {
      raf = 0; if (!alive) return;
      pos += (target - pos) * 0.09;
      const w = el.clientWidth;
      cards.current.forEach((c, i) => {
        if (!c) return; const d = i - pos;
        const x = d * Math.min(260, w * 0.3), z = -Math.abs(d) * 220 + Math.cos(d * 0.9) * 60, y = Math.sin(d * 0.8) * 46;
        const ry = clamp(-d * 28, -70, 70), op = clamp(1.25 - Math.abs(d) * 0.22, 0, 1);
        c.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg)`;
        c.style.opacity = op.toFixed(3); c.style.zIndex = String(1000 - Math.round(Math.abs(d) * 10)); c.style.pointerEvents = op < 0.15 ? 'none' : 'auto';
      });
      const f = clamp(Math.round(pos), 0, n - 1); if (f !== lastF) { lastF = f; setFocus(f); }
      if (Math.abs(target - pos) > 0.001) raf = requestAnimationFrame(lay);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(lay); };
    const go = (v: number) => { target = clamp(v, 0, n - 1); kick(); };
    const wh = (e: WheelEvent) => { e.preventDefault(); go(target + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / 160); };
    const pd = (e: PointerEvent) => { dragX = e.clientX; };
    const pm = (e: PointerEvent) => { if (dragX === null) return; go(target - (e.clientX - dragX) / 180); dragX = e.clientX; };
    const pu = () => { dragX = null; go(Math.round(target)); };
    const kd = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(Math.round(target) + 1); if (e.key === 'ArrowLeft') go(Math.round(target) - 1); };
    el.addEventListener('wheel', wh, { passive: false }); el.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu); el.addEventListener('keydown', kd);
    (el as any).__go = go; kick();
    return () => { alive = false; cancelAnimationFrame(raf); el.removeEventListener('wheel', wh); el.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu); el.removeEventListener('keydown', kd); };
  }, [items]);
  const go = (i: number) => (host.current as any)?.__go?.(i);
  return (
    <div className="fx-ribbon" ref={host} tabIndex={0} aria-label="Mission timeline. Scroll, drag or use the arrow keys.">
      <div className="fx-ribbon-stage">
        {items.map((it, i) => (
          <button key={it.id} type="button" ref={(r) => { cards.current[i] = r; }} className={`fx-rcard${i === focus ? ' on' : ''}`} onClick={() => (i === focus ? onPick?.(it.id) : go(i))}>
            <span className="fx-rimg" style={{ backgroundImage: it.img ? `url(${it.img})` : undefined }} />
            <span className="fx-rmeta"><i style={{ background: it.color }} />{it.tag}</span>
            <b>{it.title}</b><em>{it.sub}</em>
            {i === focus && onPick && <span className="fx-rgo">Open site ▸</span>}
          </button>
        ))}
      </div>
      <div className="fx-ribbon-axis">{items.map((it, i) => <button key={it.id} type="button" className={i === focus ? 'on' : ''} onClick={() => go(i)} title={it.title}><span>{it.tag}</span></button>)}</div>
    </div>
  );
}

/* scroll progress of an element through the viewport, works inside any scroll container */
function useScrollProgress(ref: React.RefObject<HTMLElement>, cb: (p: number) => void) {
  useEffect(() => {
    let raf = 0;
    const run = () => { raf = 0; const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); const span = r.height - innerHeight; cb(clamp(-r.top / Math.max(1, span), 0, 1)); };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    document.addEventListener('scroll', on, { capture: true, passive: true }); window.addEventListener('resize', on); on();
    return () => { cancelAnimationFrame(raf); document.removeEventListener('scroll', on, { capture: true } as any); window.removeEventListener('resize', on); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---------- 3. Dolly Gallery: images stacked in depth that you fly through on scroll ---------- */
export function DollyGallery({ items, title }: { items: RibbonItem[]; title?: ReactNode }) {
  const sec = useRef<HTMLElement>(null); const layers = useRef<(HTMLDivElement | null)[]>([]); const cap = useRef<HTMLDivElement>(null);
  useScrollProgress(sec, (p) => {
    const n = items.length, z = p * (n - 0.4) * 900;
    layers.current.forEach((l, i) => {
      if (!l) return; const dz = z - i * 900; const side = i % 2 ? 1 : -1;
      l.style.transform = `translate3d(${side * (14 + (i % 3) * 6)}vw, ${((i % 3) - 1) * 6}vh, ${dz.toFixed(0)}px)`;
      l.style.opacity = dz > 500 ? String(clamp(1 - (dz - 500) / 300, 0, 1)) : String(clamp(1 + dz / 2600, 0, 1));
    });
    const k = clamp(Math.round(p * (n - 0.4) - 0.3), 0, n - 1); if (cap.current) cap.current.textContent = `${items[k]?.title ?? ''} · ${items[k]?.sub ?? ''}`;
  });
  return (
    <section className="fx-dolly" ref={sec} style={{ height: `${Math.max(2, items.length) * 70}vh` }}>
      <div className="fx-dolly-pin">
        {title && <div className="fx-dolly-title">{title}</div>}
        <div className="fx-dolly-space">{items.map((it, i) => <div key={it.id} ref={(r) => { layers.current[i] = r; }} className="fx-dolly-card"><span style={{ backgroundImage: `url(${it.img})` }} /><b>{it.title}</b></div>)}</div>
        <div className="fx-dolly-cap" ref={cap} />
      </div>
    </section>
  );
}

/* ---------- 4. Passage Gallery: a tunnel of photos you glide through ---------- */
export function PassageGallery({ images, children, speed = 1 }: { images: string[]; children?: ReactNode; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !images.length) return;
    const tiles = [...el.querySelectorAll<HTMLDivElement>('.fx-pt')]; const N = tiles.length, DEPTH = 3600;
    let raf = 0, t = 0, last = performance.now(), mx = 0, my = 0, vis = true;
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(tick); }); io.observe(el);
    const mv = (e: PointerEvent) => { const r = el.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; };
    function tick(now: number) {
      raf = 0; if (!vis) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!reduced()) t += dt * 140 * speed;
      const W = el!.clientWidth, H = el!.clientHeight;
      tiles.forEach((tile, i) => {
        const wall = i % 4, row = Math.floor(i / 4); const z = ((row * (DEPTH / (N / 4)) + t) % DEPTH) - DEPTH + 300;
        const off = ((row * 37) % 3 - 1) * 0.18;
        const tf = wall === 0 ? `translate3d(${-W / 2}px,${off * H}px,${z}px) rotateY(90deg)` : wall === 1 ? `translate3d(${W / 2}px,${-off * H}px,${z}px) rotateY(-90deg)`
          : wall === 2 ? `translate3d(${off * W}px,${-H / 2}px,${z}px) rotateX(-90deg)` : `translate3d(${-off * W}px,${H / 2}px,${z}px) rotateX(90deg)`;
        tile.style.transform = tf; tile.style.opacity = String(clamp((z + DEPTH) / 900, 0, 1) * clamp((300 - z) / 260, 0, 1));
      });
      (el!.firstElementChild as HTMLElement).style.transform = `rotateY(${mx * 8}deg) rotateX(${-my * 6}deg)`;
      raf = requestAnimationFrame(tick);
    }
    el.addEventListener('pointermove', mv); raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); el.removeEventListener('pointermove', mv); };
  }, [images, speed]);
  const tiles = Array.from({ length: 24 }, (_, i) => images[i % Math.max(1, images.length)]);
  return (
    <div className="fx-passage" ref={ref}>
      <div className="fx-passage-world">{tiles.map((src, i) => <div key={i} className="fx-pt" style={{ backgroundImage: `url(${src})` }} />)}</div>
      <div className="fx-passage-in">{children}</div>
    </div>
  );
}

/* ---------- 5. Pixel Sculpt: an image rebuilt as 3D tiles that ripple under the cursor ---------- */
export function PixelSculpt({ src, cols = 72, height = 360, label }: { src: string; cols?: number; height?: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const g = cv.getContext('2d')!;
    let lum: Float32Array | null = null, rows = 0, raf = 0, alive = true, mx = -9, my = -9, t = 0, vis = true;
    const ripples: { x: number; y: number; t: number }[] = [];
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(draw); }); io.observe(cv);
    loadImg(src).then((im) => {
      const r = cv.getBoundingClientRect(); rows = Math.round(cols * (r.height / r.width));
      const k = document.createElement('canvas'); k.width = cols; k.height = rows; const kg = k.getContext('2d')!;
      const ar = im.width / im.height, want = cols / rows; let sw = im.width, sh = im.height; if (ar > want) sw = sh * want; else sh = sw / want;
      kg.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, cols, rows);
      const d = kg.getImageData(0, 0, cols, rows).data; lum = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) lum[i] = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255;
      if (alive) raf = requestAnimationFrame(draw);
    }).catch(() => {});
    function draw() {
      raf = 0; if (!alive || !lum || !vis) return; t += 0.016;
      const dpr = Math.min(devicePixelRatio, 2), W = cv!.clientWidth * dpr, H = cv!.clientHeight * dpr;
      if (cv!.width !== W) { cv!.width = W; cv!.height = H; }
      g.fillStyle = '#0a0a0b'; g.fillRect(0, 0, W, H);
      const cw = W / cols, ch = H / rows;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const l = lum[y * cols + x]; let h = l * 0.6;
        const dx = x - mx, dy = y - my, dd = Math.sqrt(dx * dx + dy * dy); h += Math.exp(-dd * dd / 30) * 0.9 * (0.6 + 0.4 * Math.sin(t * 6 - dd * 0.8));
        for (const r of ripples) { const rr = (t - r.t) * 22, dist = Math.hypot(x - r.x, y - r.y); h += Math.exp(-((dist - rr) ** 2) / 4) * 0.8 * Math.max(0, 1 - (t - r.t) / 1.6); }
        const s = 0.55 + h * 0.5, lift = h * ch * 0.9, px = x * cw + cw / 2, py = y * ch + ch / 2 - lift;
        const v = Math.round(clamp(l * 235 + h * 40, 0, 255));
        g.fillStyle = `rgb(${Math.round(v * 0.55)},${Math.round(v * 0.52)},${Math.round(v * 0.48)})`; g.fillRect(px - cw * s / 2, py - ch * s / 2 + lift * 0.35, cw * s, ch * s);
        g.fillStyle = `rgb(${v},${Math.round(v * 0.97)},${Math.round(v * 0.9)})`; g.fillRect(px - cw * s / 2, py - ch * s / 2, cw * s, ch * s * 0.86);
      }
      while (ripples.length && t - ripples[0].t > 1.6) ripples.shift();
      raf = requestAnimationFrame(draw);
    }
    const loc = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cols, ((e.clientY - r.top) / r.height) * rows]; };
    const mv = (e: PointerEvent) => { [mx, my] = loc(e); };
    const lv = () => { mx = my = -99; };
    const dn = (e: PointerEvent) => { const [x, y] = loc(e); ripples.push({ x, y, t }); };
    cv.addEventListener('pointermove', mv); cv.addEventListener('pointerleave', lv); cv.addEventListener('pointerdown', dn);
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerleave', lv); cv.removeEventListener('pointerdown', dn); };
  }, [src, cols]);
  return <figure className="fx-sculpt" style={{ height }}><canvas ref={ref} />{label && <figcaption>{label}</figcaption>}</figure>;
}

/* ---------- 6. Parallax Pills: bouncy labelled pills that drift with the cursor ---------- */
export function ParallaxPills({ pills }: { pills: { text: string; x: number; y: number; depth?: number; hot?: boolean }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return; const ps = [...el.querySelectorAll<HTMLSpanElement>('.fx-pill')];
    const st = ps.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })); let tx = 0, ty = 0, raf = 0, alive = true;
    const mv = (e: PointerEvent) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; if (!raf) raf = requestAnimationFrame(tick); };
    function tick() {
      raf = 0; if (!alive) return; let moving = false;
      ps.forEach((p, i) => { const d = Number(p.dataset.d) || 1, s = st[i]; const gx = -tx * 60 * d, gy = -ty * 40 * d;
        s.vx += (gx - s.x) * 0.06; s.vy += (gy - s.y) * 0.06; s.vx *= 0.82; s.vy *= 0.82; s.x += s.vx; s.y += s.vy;
        if (Math.abs(s.vx) + Math.abs(s.vy) > 0.02) moving = true; p.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) rotate(${(s.vx * 0.6).toFixed(2)}deg)`; });
      if (moving) raf = requestAnimationFrame(tick);
    }
    window.addEventListener('pointermove', mv);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', mv); };
  }, [pills]);
  return <div className="fx-pills" ref={ref} aria-hidden="true">{pills.map((p, i) => <span key={i} className={`fx-pill${p.hot ? ' hot' : ''}`} data-d={p.depth ?? 1} style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${i * 0.07}s` }}>{p.text}</span>)}</div>;
}

/* ---------- 7. Drafting Cursor: hairline crosshairs, edge rulers, coordinate readout, drag-to-measure ---------- */
export interface DraftProbe { lat: number; lon: number; extra?: string }
export function DraftingCursor({ probe, distance, hint = 'Drag to measure' }: { probe: (x: number, y: number) => DraftProbe | null; distance: (a: DraftProbe, b: DraftProbe) => number; hint?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; const host = el?.parentElement; if (!el || !host) return;
    const hx = el.querySelector<HTMLElement>('.fx-dc-h')!, vy = el.querySelector<HTMLElement>('.fx-dc-v')!, rd = el.querySelector<HTMLElement>('.fx-dc-read')!;
    const rt = el.querySelector<HTMLElement>('.fx-dc-rt')!, rl = el.querySelector<HTMLElement>('.fx-dc-rl')!, ln = el.querySelector<SVGLineElement>('line')!, ml = el.querySelector<HTMLElement>('.fx-dc-m')!;
    let start: { x: number; y: number; p: DraftProbe } | null = null, raf = 0, ev: PointerEvent | null = null;
    const f = (v: number, p: string, n: string) => `${Math.abs(v).toFixed(4)}°${v < 0 ? n : p}`;
    const fmtD = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`);
    const paint = () => {
      raf = 0; if (!ev) return; const r = host.getBoundingClientRect(); const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const tgt = ev.target as HTMLElement; const overUi = !!tgt.closest('button,input,select,aside,.hud-bottom,.modes,.subtabs,.pickers,.brand,a,label,form');
      el.style.opacity = overUi ? '0' : '1'; if (overUi) return;
      hx.style.transform = `translateY(${y}px)`; vy.style.transform = `translateX(${x}px)`; rt.style.backgroundPositionX = `${x}px`; rl.style.backgroundPositionY = `${y}px`;
      const p = probe(x, y);
      rd.style.transform = `translate(${Math.min(x + 16, r.width - 230)}px, ${Math.min(y + 16, r.height - 70)}px)`;
      rd.innerHTML = p ? `<b>${f(p.lat, 'N', 'S')}  ${f(((p.lon + 540) % 360) - 180, 'E', 'W')}</b>${p.extra ? `<i>${p.extra}</i>` : ''}<i>${start ? '' : hint}</i>` : '<i>off surface</i>';
      if (start) { ln.setAttribute('x1', String(start.x)); ln.setAttribute('y1', String(start.y)); ln.setAttribute('x2', String(x)); ln.setAttribute('y2', String(y)); ln.style.display = '';
        if (p) { ml.style.display = ''; ml.style.transform = `translate(${(start.x + x) / 2}px, ${(start.y + y) / 2 - 26}px)`; ml.textContent = fmtD(distance(start.p, p)); } }
    };
    const mv = (e: PointerEvent) => { ev = e; if (!raf) raf = requestAnimationFrame(paint); };
    const dn = (e: PointerEvent) => { if (!e.shiftKey && !e.altKey && e.button !== 0) return; if ((e.target as HTMLElement).closest('button,input,select,aside,.hud-bottom')) return;
      if (!e.shiftKey) return; const r = host.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const p = probe(x, y); if (p) { start = { x, y, p }; e.stopPropagation(); e.preventDefault(); } };
    const up = () => { if (!start) return; start = null; setTimeout(() => { ln.style.display = 'none'; ml.style.display = 'none'; }, 2200); };
    const lv = () => { el.style.opacity = '0'; };
    host.addEventListener('pointermove', mv); host.addEventListener('pointerdown', dn, true); window.addEventListener('pointerup', up); host.addEventListener('pointerleave', lv);
    return () => { cancelAnimationFrame(raf); host.removeEventListener('pointermove', mv); host.removeEventListener('pointerdown', dn, true); window.removeEventListener('pointerup', up); host.removeEventListener('pointerleave', lv); };
  }, [probe, distance, hint]);
  return (
    <div className="fx-dc" ref={ref} aria-hidden="true">
      <i className="fx-dc-h" /><i className="fx-dc-v" /><i className="fx-dc-rt" /><i className="fx-dc-rl" />
      <svg><line style={{ display: 'none' }} /></svg><span className="fx-dc-m" style={{ display: 'none' }} /><div className="fx-dc-read" />
    </div>
  );
}

/* ---------- 8. Animated List: a live feed where new items animate in ---------- */
export function AnimatedList({ items, max = 6 }: { items: { id: string; title: string; sub?: string; tone?: 'ok' | 'warn' | 'info' }[]; max?: number }) {
  const shown = items.slice(-max).reverse();
  return <ol className="fx-alist" aria-live="polite">{shown.map((it, i) => <li key={it.id} className={`fx-ai ${it.tone ?? 'info'}`} style={{ opacity: 1 - i * 0.13 }}><i /><b>{it.title}</b>{it.sub && <span>{it.sub}</span>}</li>)}</ol>;
}

/* ---------- 9. Orbital Type + Preloader: a turning globe wrapped in rings of text, glowing LULER ---------- */
export function OrbitalType({ rings, size = 300 }: { rings: string[]; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return; let ry = 0, rx = -16, v = 0.35, raf = 0, drag: number | null = null, alive = true;
    const tick = () => { if (!alive) return; if (drag === null) { v += (0.35 - v) * 0.02; } ry += v; el.style.setProperty('--ry', `${ry}deg`); el.style.setProperty('--rx', `${rx}deg`); raf = requestAnimationFrame(tick); };
    const pd = (e: PointerEvent) => { drag = e.clientX; el.setPointerCapture(e.pointerId); };
    const pm = (e: PointerEvent) => { if (drag === null) return; v = (e.clientX - drag) * 0.5; drag = e.clientX; rx = clamp(rx + e.movementY * -0.2, -40, 20); };
    const pu = () => { drag = null; };
    el.addEventListener('pointerdown', pd); el.addEventListener('pointermove', pm); el.addEventListener('pointerup', pu); raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); el.removeEventListener('pointerdown', pd); el.removeEventListener('pointermove', pm); el.removeEventListener('pointerup', pu); };
  }, []);
  return (
    <div className="fx-orbital" ref={ref} style={{ width: size, height: size }}>
      <div className="fx-orb-core" />
      {rings.map((txt, ri) => {
        const chars = [...txt]; const tilt = [0, 62, -58, 90][ri % 4]; const r = size * (0.5 - ri * 0.035);
        return <div key={ri} className="fx-orb-ring" style={{ transform: `rotateX(var(--rx)) rotateZ(${tilt}deg) rotateY(calc(var(--ry) * ${ri % 2 ? -1 : 1} * ${1 + ri * 0.2}))` }}>
          {chars.map((c, i) => <span key={i} style={{ transform: `rotateY(${(i / chars.length) * 360}deg) translateZ(${r}px)` }}>{c}</span>)}
        </div>;
      })}
    </div>
  );
}

export function Preloader({ done, progress }: { done: boolean; progress?: string }) {
  const [gone, setGone] = useState(false); const [min, setMin] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMin(true), 1800); return () => clearTimeout(t); }, []);
  const out = done && min;
  useEffect(() => { if (!out) return; const t = setTimeout(() => setGone(true), 900); return () => clearTimeout(t); }, [out]);
  if (gone) return null;
  return (
    <div className={`fx-preload${out ? ' out' : ''}`} role="status" aria-label="Loading LULER">
      <div className="fx-pl-topo"><Topography color="#ffffff" lineCount={22} lineWidth={1.1} elevation={1} foreground={0.2} tilt={32} speed={0.35} direction="forward" glow={1} depthOfField={0.3} fog={0.25} brightness={1.3} hoverEffect="lift" clickEffect="pulse" intro={false} dpr={1.25} /></div>
      <div className="fx-pl-logo"><b className="fx-pl-glow">LULER</b><span>by Team <em>JATABELS</em></span></div>
      <div className="fx-pl-bar"><i /></div>
      <p className="fx-pl-msg">{progress ?? 'Loading NASA terrain and ephemeris'}</p>
    </div>
  );
}
