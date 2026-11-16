import { getSettings } from './settings';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Common, Site } from './data';
import { decodeB64 } from './data';
import { makePlan, traj, PHASES, phaseStart, type Plan } from './descent';
import { DraftingCursor, type DraftProbe } from './fx';
import { analyse, heightAt, isHazard, safeTarget, slopeAt as hzSlope, type HazardMap } from './hazards';
import { loadCesium, TOKEN, MOON_ASSET, NATURAL, SLOPE, ELEV, HAZARD } from './cesiumLib';
import SpecularButton from './rb/SpecularButton.jsx';

type View = 'orbit' | 'lander' | 'descent';
type Layer = 'natural' | 'hazard' | 'slope' | 'elev';
interface Props {
  site: Site; common: Common; t: number; mastM: number; base: string; textured?: boolean; modelsBase: string;
  view: View; onView: (v: View) => void; chrome?: ReactNode; panel?: ReactNode; children?: ReactNode; onFail?: () => void;
}
interface Pin { lat: number; lon: number; elev: number; slope: number; base: number; dist: number; brg: number }
const ll = (la: number, lo: number) => { const l = ((lo + 540) % 360) - 180; return `${Math.abs(la).toFixed(4)}°${la < 0 ? 'S' : 'N'}  ${Math.abs(l).toFixed(4)}°${l < 0 ? 'W' : 'E'}`; };
const compass = (d: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((d % 360) + 360) % 360) / 45) % 8];
const D2R = Math.PI / 180;

export default function CesiumTerrain({ site, common, t, modelsBase, view, onView, chrome, panel, children, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const teleRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setTime: (t: number) => void; setView: (v: View) => void; setExag: (x: number) => void; setSim: (ts: number, p: Plan) => void;
    setLayer: (l: Layer) => void; setSpeed: (v: number) => void; key: (k: string, on: boolean) => void; pinHere: () => void; goHome: () => void; clearPin: () => void;
  } | null>(null);
  const viewRef = useRef<View>(view); viewRef.current = view;
  const tRef = useRef(t); tRef.current = t;
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [simT, setSimT] = useState(0);
  const [simPlay, setSimPlay] = useState(false);
  const [rate, setRate] = useState(1);
  const [exag, setExag] = useState(1);
  const [layer, setLayer] = useState<Layer>('natural');
  const [pin, setPin] = useState<Pin | null>(null);
  const [speed, setSpeed] = useState(4);
  const [spOpen, setSpOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 980);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [verdict, setVerdict] = useState<{ max: number; at: number; td: number; moved: number; reason: string; craters: number } | null>(null);
  const [hz, setHz] = useState<{ n: number; big: number } | null>(null);
  const hzShowRef = useRef<(on: boolean) => void>(() => {});
  const verdictRef = useRef(setVerdict); verdictRef.current = setVerdict;
  const imagery = 'Cesium Moon Terrain (NASA LRO LOLA / LROC)';
  const probe = useCallback((x: number, y: number): DraftProbe | null => {
    const v = (window as any).__cv, C = (window as any).Cesium; if (!v || !C) return null;
    const p = v.scene.pickPosition(new C.Cartesian2(x, y)); if (!p) return null; const c = C.Cartographic.fromCartesian(p);
    return { lat: c.latitude * 180 / Math.PI, lon: c.longitude * 180 / Math.PI, extra: `ELEV ${c.height.toFixed(0)} M · DBL-CLICK = TOUCHDOWN` };
  }, []);
  const geo = useCallback((a: DraftProbe, b: DraftProbe) => { const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * 1737400 * Math.asin(Math.min(1, Math.sqrt(h))); }, []);

  useEffect(() => {
    let dead = false; let viewer: any = null; const cleanups: (() => void)[] = [];
    setReady(false); setErr(''); setPin(null);
    loadCesium().then(async (C) => {
      if (dead || !host.current) return;
      C.Ion.defaultAccessToken = TOKEN;
      C.Ellipsoid.default = C.Ellipsoid.MOON;
      viewer = new C.Viewer(host.current, {
        baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, shadows: false,
      });
      (window as any).__cv = viewer; viewer.shadows = getSettings().shadows; viewer.shadowMap.softShadows = true; viewer.shadowMap.size = 2048; viewer.shadowMap.darkness = 0.04; viewer.shadowMap.maximumDistance = 9000; Object.assign(viewer.shadowMap._primitiveBias, { normalOffsetScale: 30, depthBias: 0.002, polygonOffsetFactor: 4, polygonOffsetUnits: 8 });  const sc = viewer.scene; const cam = viewer.camera; const ctl = sc.screenSpaceCameraController;
      if (sc.globe) sc.globe.show = false; if (sc.skyAtmosphere) sc.skyAtmosphere.show = false; if (sc.fog) sc.fog.enabled = false;
      sc.backgroundColor = C.Color.BLACK; sc.highDynamicRange = false; sc.postProcessStages.fxaa.enabled = true;
      viewer.resolutionScale = getSettings().quality === 'low' ? 0.75 : getSettings().quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : 1;
      (viewer._cesiumWidget._creditContainer as HTMLElement).style.display = 'none';
      const ts = await C.Cesium3DTileset.fromIonAssetId(MOON_ASSET, { maximumScreenSpaceError: 3 });
      if (dead) return;
      const mkShader = (txt: string, lo = 0, hi = 1) => new C.CustomShader({ lightingModel: C.LightingModel.UNLIT, uniforms: { u_lo: { type: C.UniformType.FLOAT, value: lo }, u_hi: { type: C.UniformType.FLOAT, value: hi }, u_cam: { type: C.UniformType.VEC3, value: new C.Cartesian3() }, ...(txt === NATURAL ? { u_detail: { type: C.UniformType.FLOAT, value: 1 }, u_regN: { type: C.UniformType.SAMPLER_2D, value: new C.TextureUniform({ url: modelsBase.replace(/models\/$/, '') + 'tex/regolith_n.jpg', repeat: true, minificationFilter: C.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR, magnificationFilter: C.TextureMagnificationFilter.LINEAR }) }, u_regA: { type: C.UniformType.SAMPLER_2D, value: new C.TextureUniform({ url: modelsBase.replace(/models\/$/, '') + 'tex/regolith_a.jpg', repeat: true, minificationFilter: C.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR, magnificationFilter: C.TextureMagnificationFilter.LINEAR }) } } : {}) }, fragmentShaderText: txt });
      ts.customShader = mkShader(NATURAL);
      ts.imageBasedLighting.imageBasedLightingFactor = new C.Cartesian2(0.05, 0.05); ts.shadows = C.ShadowMode.ENABLED;
      sc.primitives.add(ts);
      let gh = 0;
      try { const hs: any = await Promise.race([sc.sampleHeightMostDetailed([C.Cartographic.fromDegrees(site.lon, site.lat)]), new Promise((r) => setTimeout(() => r(null), 3500))]); if (hs && Number.isFinite(hs[0]?.height)) gh = hs[0].height; else { const h2 = sc.sampleHeight?.(C.Cartographic.fromDegrees(site.lon, site.lat)); if (Number.isFinite(h2)) gh = h2; } } catch { /* keep 0 */ }
      if (dead) return;
      setRange([Math.round(gh - 700), Math.round(gh + 700)]);
      setHz(null);
      let hm: HazardMap | null = null; let divert: { e: number; n: number; moved: number; reason: string } | null = null;
      const craterEnts: any[] = [];
      let hzOn = false;
      const target = C.Cartesian3.fromDegrees(site.lon, site.lat, gh);
      const enu = C.Transforms.eastNorthUpToFixedFrame(target);
      const inv = C.Matrix4.inverse(enu, new C.Matrix4());
      const upV = C.Ellipsoid.default.geodeticSurfaceNormal(target, new C.Cartesian3());
      const eastV = C.Matrix4.multiplyByPointAsVector(enu, new C.Cartesian3(1, 0, 0), new C.Cartesian3());
      const northV = C.Matrix4.multiplyByPointAsVector(enu, new C.Cartesian3(0, 1, 0), new C.Cartesian3());
      const W = (e: number, n: number, u: number) => C.Matrix4.multiplyByPoint(enu, new C.Cartesian3(e, n, u), new C.Cartesian3());
      const toLocal = (wp: any) => C.Matrix4.multiplyByPoint(inv, wp, new C.Cartesian3());
      let lastH = gh;
      const groundAbs = (e: number, n: number) => { // absolute height (m) of the surface under local (e, n)
        const c = C.Cartographic.fromCartesian(W(e, n, 0));
        const h = sc.sampleHeight(c); if (Number.isFinite(h)) lastH = h; return lastH;
      };
      const worldAt = (e: number, n: number, up: number) => { const c = C.Cartographic.fromCartesian(W(e, n, 0)); return C.Cartesian3.fromRadians(c.longitude, c.latitude, groundAbs(e, n) + up); };
      const describe = (e: number, n: number) => {
        const c = C.Cartographic.fromCartesian(W(e, n, 0)); const base = 20;
        const z0 = groundAbs(e, n), zx = groundAbs(e + base, n) - groundAbs(e - base, n), zy = groundAbs(e, n + base) - groundAbs(e, n - base);
        const dist = Math.hypot(e, n) / 1000; const brg = (((Math.atan2(e, n) / D2R) % 360) + 360) % 360;
        return { lat: c.latitude / D2R, lon: c.longitude / D2R, elev: z0, slope: Math.atan(Math.hypot(zx, zy) / (2 * base)) / D2R, base, dist, brg };
      };

      /* --- Hazard analysis: sample the real terrain on a 81 x 81 grid (50 m) and detect craters --- */
      (async () => {
        const N = 41, D = 100, carts: any[] = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) carts.push(C.Cartographic.fromCartesian(W((c - (N - 1) / 2) * D, (r - (N - 1) / 2) * D, 0)));
        try {
          await new Promise((r) => setTimeout(r, 2500)); if (dead) return; // let the visible terrain load first
          const res: any = await Promise.race([sc.sampleHeightMostDetailed(carts), new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 20000))]); if (dead) return;
          const h = new Float32Array(N * N); let last = gh;
          res.forEach((cg: any, i: number) => { const v = Number.isFinite(cg?.height) ? cg.height : last; last = v; h[i] = v - gh; });
          hm = analyse({ n: N, d: D, h }); divert = safeTarget(hm);
          const red = C.Color.fromCssColorString('#f22e38');
          hm.craters.forEach((k) => {
            const pts: any[] = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; const e = k.e + Math.sin(a) * k.r, n = k.n + Math.cos(a) * k.r; pts.push(W(e, n, heightAt(hm!.grid, e, n) + 3)); }
            craterEnts.push(viewer.entities.add({ show: false, polyline: { positions: pts, width: 2.5, material: red.withAlpha(0.95) } }));
            craterEnts.push(viewer.entities.add({ show: false, position: W(k.e, k.n, heightAt(hm!.grid, k.e, k.n) + 6), label: { text: `crater ⌀${(2 * k.r).toFixed(0)} m · ${k.depth.toFixed(0)} m deep`, font: '11px ui-monospace, Menlo, monospace', fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString('#0a0a0b').withAlpha(0.7), pixelOffset: new C.Cartesian2(0, -14), distanceDisplayCondition: new C.DistanceDisplayCondition(0, 4500), disableDepthTestDistance: 1e9 } }));
          });
          if (divert.moved > 0) craterEnts.push(viewer.entities.add({ show: false, position: W(divert.e, divert.n, heightAt(hm.grid, divert.e, divert.n) + 2), point: { pixelSize: 12, color: C.Color.fromCssColorString('#33d980'), outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: 1e9 }, label: { text: 'Safe divert point', font: '12px sans-serif', pixelOffset: new C.Cartesian2(0, -20), fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.BLACK.withAlpha(0.6), disableDepthTestDistance: 1e9 } }));
          hzShowRef.current(hzOn);
          setHz({ n: hm.craters.length, big: hm.craters.reduce((m, k) => Math.max(m, 2 * k.r), 0) });
        } catch { /* hazard analysis unavailable; slope check still works */ }
      })();
      hzShowRef.current = (on: boolean) => { hzOn = on; craterEnts.forEach((en) => { en.show = on; }); };

      /* --- Sun, Earth, light --- */
      const dc = (draw: (g: CanvasRenderingContext2D) => void) => { const k = document.createElement('canvas'); k.width = k.height = 128; draw(k.getContext('2d')!); return k; };
      const sunImg = dc((g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,246,220,1)'); gr.addColorStop(0.35, 'rgba(255,214,140,0.55)'); gr.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
      const DIST = 500000;
      const sunB = viewer.entities.add({ position: W(0, 0, 0), billboard: { image: sunImg, sizeInMeters: true, width: 1, height: 1, color: C.Color.WHITE } });
      const earthB = viewer.entities.add({ position: W(0, 0, 0), billboard: { image: dc(() => {}), sizeInMeters: true, width: 1, height: 1 } });
      const eimg = new Image(); eimg.crossOrigin = 'anonymous';
      eimg.onload = () => { const k = dc((g) => { g.save(); g.beginPath(); g.arc(64, 64, 62, 0, 6.2832); g.clip(); g.drawImage(eimg, 0, 0, 128, 128); g.restore(); }); earthB.billboard.image = k; };
      eimg.src = import.meta.env.BASE_URL + 'map/earth.jpg';
      const enuDir = (az: number, el: number) => new C.Cartesian3(Math.sin(az * D2R) * Math.cos(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R));
      const setTime = (tt: number) => {
        const sAz = site.sunAz[tt], sEl = site.sunEl[tt];
        const sd = enuDir(sAz, sEl);
        const lw = C.Matrix4.multiplyByPointAsVector(enu, C.Cartesian3.negate(sd, new C.Cartesian3()), new C.Cartesian3());
        sc.light = new C.DirectionalLight({ direction: C.Cartesian3.normalize(lw, lw), intensity: sEl > 0 ? 10 : 0.25 });
        sunB.position = W(sd.x * DIST, sd.y * DIST, sd.z * DIST); const sw = 2 * DIST * Math.tan(0.8 * D2R) * 3; sunB.billboard.width = sw; sunB.billboard.height = sw; sunB.show = sEl > -2;
        const ed = enuDir(site.earthAz[tt], site.earthEl[tt]); earthB.position = W(ed.x * DIST, ed.y * DIST, ed.z * DIST);
        const ew = 2 * DIST * Math.tan(common.earthR[tt] * D2R); earthB.billboard.width = ew; earthB.billboard.height = ew; earthB.show = site.earthEl[tt] > -2;
      };
      setTime(tRef.current);

      /* --- Lander, dust, exhaust --- */
      let lm: any = null; let lk = 1;
      try {
        const j = (await (await fetch(modelsBase + 'lm.glb.json')).json()) as { b64: string };
        const url = URL.createObjectURL(new Blob([decodeB64(j.b64)], { type: 'model/gltf-binary' }));
        lm = await C.Model.fromGltfAsync({ url, modelMatrix: enu, scale: 1 });
        sc.primitives.add(lm); lm.show = false;
        const fit = () => { lk = 4.4 / lm.boundingSphere.radius; lm.scale = lk; };
        lm.readyEvent.addEventListener(fit); if (lm.ready) fit();
      } catch { lm = null; }
      const puff = dc((g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
      const mkPS = (o: any) => sc.primitives.add(new C.ParticleSystem({ image: puff, modelMatrix: enu, lifetime: Number.MAX_VALUE, show: false, ...o }));
      const dust = mkPS({ startColor: C.Color.fromCssColorString('#cfc8bb').withAlpha(0.5), endColor: C.Color.fromCssColorString('#cfc8bb').withAlpha(0), startScale: 3, endScale: 16, minimumParticleLife: 1.5, maximumParticleLife: 4, minimumSpeed: 4, maximumSpeed: 22, imageSize: new C.Cartesian2(5, 5), emissionRate: 0, emitter: new C.CircleEmitter(2.5) });
      const exhaust = mkPS({ startColor: C.Color.fromCssColorString('#cfe6ff').withAlpha(0.7), endColor: C.Color.fromCssColorString('#7fb4ff').withAlpha(0), startScale: 1.2, endScale: 0.3, minimumParticleLife: 0.15, maximumParticleLife: 0.45, minimumSpeed: 25, maximumSpeed: 45, imageSize: new C.Cartesian2(1.6, 1.6), emissionRate: 0, emitter: new C.ConeEmitter(12 * D2R) });
      const pose = (e: number, n: number, u: number) => C.Matrix4.fromTranslation(new C.Cartesian3(e, n, u));
      const down = C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationX(Math.PI), new C.Cartesian3(0, 0, -1.9));

      /* --- Pin and home pole --- */
      const pinE = viewer.entities.add({ show: false, position: target, point: { pixelSize: 13, color: C.Color.fromCssColorString('#6fa8ff'), outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: 1e9 }, label: { text: 'Planned touchdown', font: '13px sans-serif', pixelOffset: new C.Cartesian2(0, -22), fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.BLACK.withAlpha(0.6), disableDepthTestDistance: 1e9 } });
      const homePole = viewer.entities.add({ show: false, polyline: { positions: [worldAt(0, 0, 0), worldAt(0, 0, 40)], width: 3, material: C.Color.fromCssColorString('#a9cbff') } });
      const extra: any[] = []; let lastLL = '';
      const placePin = (e: number, n: number) => {
        const q = describe(e, n);
        if (pinE.show && pinE.position) { // keep earlier touchdowns as numbered markers
          const pv = (pinE.position as any).getValue ? (pinE.position as any).getValue(C.JulianDate.now()) : pinE.position;
          extra.push(viewer.entities.add({ position: pv, point: { pixelSize: 11, color: C.Color.fromCssColorString('#6fa8ff'), outlineColor: C.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: 1e9 }, label: { text: `T${extra.length + 1}${lastLL ? ' · ' + lastLL : ''}`, font: '12px sans-serif', pixelOffset: new C.Cartesian2(0, -18), fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString('#0a0f1c').withAlpha(0.8), disableDepthTestDistance: 1e9 } }));
        }
        pinE.position = worldAt(e, n, 0); pinE.show = true;
        const ll = `${Math.abs(q.lat).toFixed(4)}°${q.lat < 0 ? 'S' : 'N'} ${Math.abs(q.lon).toFixed(4)}°${q.lon < 0 ? 'W' : 'E'}`;
        lastLL = ll;
        if (pinE.label) pinE.label.text = new C.ConstantProperty(`T${extra.length + 1} · ${ll} · ${Math.round(q.elev)} m · ${q.slope.toFixed(1)}°`);
        setPin({ lat: q.lat, lon: q.lon, elev: q.elev, slope: q.slope, base: q.base, dist: q.dist, brg: q.brg });
      };

      /* --- Overview (Site view) interaction --- */
      const sh = viewer.screenSpaceEventHandler;
      sh.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      sh.setInputAction((m: any) => { if (viewRef.current !== 'orbit') return; const p = sc.pickPosition(m.position); if (!p) return; const q = toLocal(p); pickE.show = false; placePin(q.x, q.y); }, C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      const pickE = viewer.entities.add({ show: false, position: target, point: { pixelSize: 10, color: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#6fa8ff'), outlineWidth: 3, disableDepthTestDistance: 1e9 }, label: { text: '', font: '12.5px sans-serif', pixelOffset: new C.Cartesian2(0, -20), fillColor: C.Color.WHITE, showBackground: true, backgroundColor: C.Color.fromCssColorString('#0a0f1c').withAlpha(0.85), disableDepthTestDistance: 1e9 } });
      sh.setInputAction((m: any) => { // single click: show exactly where you clicked
        if (viewRef.current !== 'orbit') return; const p = sc.pickPosition(m.position); if (!p) return; const q0 = toLocal(p); const q = describe(q0.x, q0.y);
        pickE.position = worldAt(q0.x, q0.y, 0); pickE.show = true;
        if (pickE.label) pickE.label.text = new C.ConstantProperty(`${Math.abs(q.lat).toFixed(4)}°${q.lat < 0 ? 'S' : 'N'} ${Math.abs(q.lon).toFixed(4)}°${q.lon < 0 ? 'W' : 'E'} · ${Math.round(q.elev)} m · slope ${q.slope.toFixed(1)}°`);
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      let lastMove = 0;
      sh.setInputAction((m: any) => {
        if (viewRef.current !== 'orbit' || !cursorRef.current) return; const now = performance.now(); if (now - lastMove < 120) return; lastMove = now;
        const p = sc.pickPosition(m.endPosition); if (!p) { cursorRef.current.textContent = ''; return; }
        const c = C.Cartographic.fromCartesian(p); cursorRef.current.textContent = `${ll(c.latitude / D2R, c.longitude / D2R)} · ${c.height.toFixed(0)} m`;
      }, C.ScreenSpaceEventType.MOUSE_MOVE);

      /* --- Surface (first-person) --- */
      let hz = 0, vz = 0, gait = 0; // jump height and speed under real lunar gravity (1.62 m/s²)
      let px = 0, pn = 0, yaw = 0, pitch = 0, moveSpeed = 4; const keys = new Set<string>();
      const KEYMAP: Record<string, string> = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', d: 'r', q: 'tl', arrowleft: 'tl', e: 'tr', arrowright: 'tr' };
      const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement; return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'); };
      const kd = (e: KeyboardEvent) => { if (viewRef.current !== 'lander' || typing(e)) return; if (e.key === ' ') { if (hz <= 0) vz = 1.6; e.preventDefault(); return; } const k = KEYMAP[e.key.toLowerCase()]; if (k) { keys.add(k); e.preventDefault(); } };
      const ku = (e: KeyboardEvent) => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys.delete(k); };
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); cleanups.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });
      const cv = viewer.canvas as HTMLCanvasElement; let drag = false, lx = 0, ly = 0;
      const pd = (e: PointerEvent) => { if (viewRef.current === 'lander') { drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); } else if (viewRef.current === 'descent') cine = false; };
      const pm = (e: PointerEvent) => { if (!drag) return; yaw += (e.clientX - lx) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; };
      const pu = () => { drag = false; };
      cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pm); cv.addEventListener('pointerup', pu);
      let last = performance.now(), frame = 0;
      const walk = () => {
        const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now; frame++;
        if (viewRef.current !== 'lander') return;
        yaw += ((keys.has('tr') ? 1 : 0) - (keys.has('tl') ? 1 : 0)) * 1.2 * dt;
        const fwd = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0), st = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
        if (fwd || st) { const step = moveSpeed * dt; px += (Math.sin(yaw) * fwd + Math.cos(yaw) * st) * step; pn += (Math.cos(yaw) * fwd - Math.sin(yaw) * st) * step; }
        if (hz > 0 || vz > 0) { hz += vz * dt; vz -= 1.62 * dt; if (hz <= 0) { hz = 0; vz = 0; } }
        gait = (fwd || st) ? gait + dt * 2.4 * Math.max(1, moveSpeed / 2) : gait * 0.9; // low-gravity lope
        const bob = (fwd || st) ? Math.abs(Math.sin(gait)) * Math.min(0.18, 0.05 * moveSpeed) : 0;
        cam.setView({ destination: worldAt(px, pn, 1.7 + hz + bob), orientation: { heading: yaw, pitch, roll: (fwd || st) ? Math.sin(gait) * 0.006 : 0 } });
        homePole.show = Math.hypot(px, pn) > 20;
        if (frame % 6 === 0 && teleRef.current) {
          const q = describe(px, pn); const hd = ((yaw / D2R) % 360 + 360) % 360;
          teleRef.current.innerHTML =
            `<span><i>Position</i><b>${ll(q.lat, q.lon)}</b></span><span><i>Elevation</i><b>${q.elev.toFixed(1)} m</b></span>` +
            `<span><i>Ground slope</i><b>${q.slope.toFixed(1)}° <small>over ${q.base} m</small></b></span><span><i>Heading</i><b>${hd.toFixed(0)}° ${compass(hd)}</b></span>` +
            `<span><i>From landing point</i><b>${q.dist < 1 ? (q.dist * 1000).toFixed(0) + ' m' : q.dist.toFixed(2) + ' km'}${q.dist > 0.005 ? ' ' + compass(q.brg) : ''}</b></span>`;
        }
      };
      const camU = () => { const cs = ts.customShader; if (!cs) return; const c = cam.positionWC; const M = 65536; const m = (x: number) => ((x % M) + M) % M; try { cs.setUniform('u_cam', new C.Cartesian3(m(c.x), m(c.y), m(c.z))); } catch { /* shader without u_cam */ } };
      sc.preRender.addEventListener(camU); cleanups.push(() => sc.preRender.removeEventListener(camU));
      sc.preRender.addEventListener(walk); cleanups.push(() => sc.preRender.removeEventListener(walk));

      /* --- Landing (cinematic) --- */
      let cine = true, shot = -1;
      host.current.querySelectorAll('.cine-ov').forEach((n) => n.remove());
      const ov = document.createElement('div'); ov.className = 'cine-ov'; ov.style.display = 'none';
      ov.innerHTML = '<i class="cb t"></i><i class="cb b"></i><i class="cv"></i><i class="cg"></i><span class="cc"></span><button type="button" class="cbtn">🎬 Cinematic</button>';
      host.current.appendChild(ov);
      const capEl = ov.querySelector('.cc') as HTMLElement; (ov.querySelector('.cbtn') as HTMLButtonElement).onclick = () => { cine = true; shot = -1; };
      const CAP = ['BRAKING BURN', 'APPROACH', 'HAZARD CHECK', 'TERMINAL DESCENT', 'TOUCHDOWN'];
      let lmPos = new C.Cartesian3(), simE = 0, simN = 0, simU = 0;
      let trackMax = 0, trackAt = 0, lastProbe = -1, reported = false;
      const setSim = (ts: number, p: Plan) => {
        const s = traj(p, ts);
        if (ts < 0.05) { trackMax = 0; trackAt = 0; lastProbe = -1; if (reported) { reported = false; verdictRef.current(null); } } const az = (p.azFrom * Math.PI) / 180;
        const te = divert?.e ?? 0, tn = divert?.n ?? 0;
        simE = te + (s.landed ? 0 : Math.sin(az) * s.d); simN = tn + (s.landed ? 0 : Math.cos(az) * s.d);
        const gAbs = groundAbs(simE, simN); const hov = s.landed ? 0 : Math.max(0, s.h);
        if (!s.landed && s.h < 150 && Math.abs(ts - lastProbe) > 0.4) { lastProbe = ts; const sl = hm ? Math.max(hzSlope(hm, simE, simN), isHazard(hm, simE, simN) && s.h < 30 ? 10 : 0) : describe(simE, simN).slope; if (sl > trackMax) { trackMax = sl; trackAt = Math.hypot(simE - te, simN - tn); } }
        if (s.landed && !reported) { reported = true; const tdS = hm ? hzSlope(hm, te, tn) : describe(0, 0).slope; verdictRef.current({ max: Math.max(trackMax, tdS), at: trackMax >= tdS ? trackAt : 0, td: tdS, moved: divert?.moved ?? 0, reason: divert?.reason ?? '', craters: hm?.craters.length ?? 0 }); }
        const c = C.Cartographic.fromCartesian(W(simE, simN, 0)); lmPos = C.Cartesian3.fromRadians(c.longitude, c.latitude, gAbs + hov + 1.9); simU = gAbs - gh + hov;
        const active = viewRef.current === 'descent';
        if (lm) { lm.show = active; lm.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(lmPos); lm.scale = lk; }
        const near = Math.max(0, 1 - hov / 90);
        dust.show = exhaust.show = active;
        dust.emitterModelMatrix = pose(simE, simN, simU - hov); dust.emissionRate = s.landed ? Math.max(0, 40 * (1 - (ts - p.tEnd) / 8)) : 260 * near;
        exhaust.emitterModelMatrix = C.Matrix4.multiply(pose(simE, simN, simU - 0.2), down, new C.Matrix4()); exhaust.emissionRate = s.landed ? 0 : 220;
        ov.style.display = active ? 'block' : 'none'; ov.classList.toggle('on', cine);
        if (ts === 0 && active) { cine = true; shot = -1; }
        if (!active) return;
        if (!cine) { ctl.enableInputs = true; return; }
        ctl.enableInputs = false;
        const t1 = p.t1; let k: number;
        if (s.landed || p.tEnd - ts < 3) k = 4; else if (ts >= t1) k = 3; else if (ts >= t1 - 15) k = 2; else if (ts >= 0.38 * t1) k = 1; else k = 0;
        const tt = performance.now() / 1000;
        if (k !== shot) { shot = k; }
        const aim = lmPos; let fov = 45;
        if (k === 1) {
          const cp = worldAt(-70, -90, 2.4); cam.frustum.fov = 28 * D2R;
          cam.setView({ destination: cp, orientation: { direction: C.Cartesian3.normalize(C.Cartesian3.subtract(aim, cp, new C.Cartesian3()), new C.Cartesian3()), up: upV } });
        } else {
          let hd = 0.9, pt = -18, rg = 60;
          if (k === 0) { hd = 0.9 + ts * 0.012; pt = -18; rg = Math.min(380, Math.max(50, s.h * 0.12)); fov = 42; }
          else if (k === 2) { hd = 0.4 + (ts - (t1 - 15)) * 0.05; pt = -72; rg = 90; fov = 50; }
          else if (k === 3) { const u = Math.max(0, (ts - t1) / Math.max(1, p.tEnd - t1)); hd = 2.2 + u * 0.4; pt = -9 - 4 * u; rg = 70 - 48 * u; fov = 34 - 6 * u; }
          else { const u = Math.min(1, Math.max(0, (ts - p.tEnd + 3) / 12)); hd = 2.6 + u * 1.2; pt = -12 - 8 * u; rg = 24 + 70 * u; fov = 36; }
          cam.frustum.fov += (fov * D2R - cam.frustum.fov) * 0.2;
          const sk = (k <= 1 ? 0.02 : 0.006) * (s.landed ? 0 : 1);
          cam.lookAt(aim, new C.HeadingPitchRange(hd + Math.sin(tt * 7.3) * sk * 0.1, pt * D2R + Math.sin(tt * 9.1) * sk * 0.05, rg));
        }
        capEl.textContent = CAP[Math.min(s.phase, 4)];
      };

      /* --- Layers, exaggeration, views --- */
      const setLayer = (l: Layer, lo: number, hi: number) => { ts.customShader = mkShader(l === 'slope' ? SLOPE : l === 'elev' ? ELEV : l === 'hazard' ? HAZARD : NATURAL, lo, hi); };
      const lookOverview = (dur: number) => cam.flyToBoundingSphere(new C.BoundingSphere(target, 1), { duration: dur, offset: new C.HeadingPitchRange((site.sunAz[tRef.current] + 95) * D2R, -22 * D2R, 6000) });
      const setView2 = (m: View) => {
        cam.lookAtTransform(C.Matrix4.IDENTITY); cam.frustum.fov = 60 * D2R;
        ctl.enableInputs = m === 'orbit'; ctl.minimumZoomDistance = 3; ctl.maximumZoomDistance = 120000;
        pinE.show = m !== 'descent' && !!pinE.position && pinE.show; homePole.show = m === 'lander' && Math.hypot(px, pn) > 20;
        if (m === 'orbit') { lookOverview(1.8); ov.style.display = 'none'; if (lm) lm.show = false; dust.show = exhaust.show = false; }
        if (m === 'lander') { pitch = -0.05; yaw = (site.sunAz[tRef.current] + 125) * D2R; px = -14 * Math.sin(yaw); pn = -14 * Math.cos(yaw); ov.style.display = 'none'; if (lm) { lm.show = true; lm.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(worldAt(0, 0, 1.9)); lm.scale = lk; } dust.show = exhaust.show = false; cam.setView({ destination: worldAt(px, pn, 1.7), orientation: { heading: yaw, pitch, roll: 0 } }); }
        if (m === 'descent') { cine = true; shot = -1; }
      };
      api.current = {
        setTime, setView: setView2, setSim, setLayer: (l) => setLayer(l, 0, 0),
        setExag: (x) => { try { sc.verticalExaggeration = x; sc.verticalExaggerationRelativeHeight = gh; } catch { /* unsupported */ } },
        setSpeed: (v) => { moveSpeed = v; }, key: (k, on) => { if (on) keys.add(k); else keys.delete(k); },
        pinHere: () => placePin(px, pn), goHome: () => { px = -14 * Math.sin(yaw); pn = -14 * Math.cos(yaw); }, clearPin: () => { pinE.show = false; extra.splice(0).forEach((x) => viewer.entities.remove(x)); setPin(null); },
      };
      (api.current as any).layerR = (l: Layer, r: [number, number]) => setLayer(l, r[0], r[1]);
      void northV; void eastV;
      setReady(true);
      setView2(viewRef.current);
    }).catch((e) => { if (dead) return; const m = String(e?.message || e); setErr(m); onFail?.(); });
    return () => {
      dead = true; cleanups.forEach((f) => f()); api.current = null;
      try { viewer?.destroy(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

  useEffect(() => { api.current?.setTime(t); }, [t, ready]);
  useEffect(() => { api.current?.setView(view); }, [view, ready]);
  useEffect(() => { api.current?.setExag(exag); }, [exag, ready]);
  useEffect(() => { (api.current as any)?.layerR(view === 'orbit' ? layer : 'natural', range); }, [layer, view, ready, range]);
  useEffect(() => { api.current?.setSpeed(speed); }, [speed, ready]);
  useEffect(() => { hzShowRef.current((view === 'orbit' && layer === 'hazard') || view === 'descent'); }, [view, layer, ready, hz]);

  const plan = useMemo(() => (ready ? makePlan(4, site.sunAz[t]) : null), [ready, site, t]);
  useEffect(() => { if (view === 'descent' && plan) api.current?.setSim(simT, plan); }, [simT, plan, view, ready, exag]);
  useEffect(() => {
    if (!simPlay || !plan || view !== 'descent') return;
    const id = window.setInterval(() => setSimT((v) => {
      const nx = Math.min(plan.tEnd, v + 0.04 * rate);
      if (nx >= plan.tEnd) setSimPlay(false);
      return nx;
    }), 40);
    return () => window.clearInterval(id);
  }, [simPlay, plan, rate, view]);
  useEffect(() => { if (view === 'descent') { setSimT(0); setSimPlay(true); } }, [view, site.id]);
  const tm = plan ? traj(plan, simT) : null;
  const left = plan ? Math.max(0, plan.tEnd - simT) : 0;
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); api.current?.key(k, true); },
    onPointerUp: () => api.current?.key(k, false),
    onPointerLeave: () => api.current?.key(k, false),
  });

  return (
    <div className="stage">
      <div ref={host} className="gl cesium-host" />
      {view === 'orbit' && ready && <DraftingCursor probe={probe} distance={geo} hint="Shift-drag to measure" />}
            {chrome}
      {view === 'orbit' && (
        <aside className={`sitepanel${spOpen ? '' : ' closed'}`} aria-label="Site data">
          <button type="button" className="sp-toggle" onClick={() => setSpOpen((o) => !o)} aria-expanded={spOpen}>{spOpen ? 'Hide site data ✕' : 'Site data ▾'}</button>
          {panel}
          <p className="sp-h">Terrain layer</p>
          <div className="seg3" role="group" aria-label="Terrain layer">
            {(['natural', 'hazard', 'slope', 'elev'] as Layer[]).map((l) => (
              <button key={l} type="button" className={layer === l ? 'on' : ''} aria-pressed={layer === l} onClick={() => setLayer(l)}>{l === 'natural' ? 'Natural' : l === 'hazard' ? 'Hazards' : l === 'slope' ? 'Slope' : 'Elevation'}</button>
            ))}
          </div>
          {layer === 'hazard' && <p className="legend"><i style={{ background: '#33d980' }} />safe, under 3°<i style={{ background: '#f9db40' }} />caution 5–10°<i style={{ background: '#f22e38' }} />hazard over 10° (crater walls, ridges)</p>}
          {layer === 'hazard' && <p className="legend">{hz ? <>Craters detected: <b>{hz.n}</b>{hz.n ? <> (largest ⌀{hz.big.toFixed(0)} m), outlined in red</> : ''}</> : 'Detecting craters on a 4 × 4 km grid…'}</p>}
          {layer === 'slope' && <p className="legend"><i style={{ background: '#40bf6e' }} />under 5°<i style={{ background: '#edd44c' }} />5 to 10°<i style={{ background: '#f58c33' }} />10 to 15°<i style={{ background: '#e64033' }} />15 to 20°<i style={{ background: '#9e1f6b' }} />over 20°</p>}
          {layer === 'elev' && <p className="legend"><i style={{ background: 'linear-gradient(90deg,#1a4099,#59cc59,#fff)', width: 90 }} />{range[0]} m to {range[1]} m</p>}
          <label className="sp-ex">Height exaggeration {exag}×<input type="range" min={1} max={5} step={1} value={exag} onChange={(e) => setExag(Number(e.target.value))} /></label>
          <p className="sp-src"><b>Imagery:</b> {imagery || 'none'}</p>
          <p className="sp-h">Planned touchdown point</p>
          {pin ? (
            <div className="pinbox">
              <b>{ll(pin.lat, pin.lon)}</b>
              <span>Elevation {pin.elev.toFixed(0)} m · slope {pin.slope.toFixed(1)}° over {pin.base} m</span>
              <span>{pin.dist < 1 ? `${(pin.dist * 1000).toFixed(0)} m` : `${pin.dist.toFixed(2)} km`} from the site centre, bearing {pin.brg.toFixed(0)}°</span>
              <button type="button" className="pill" onClick={() => api.current?.clearPin()}>Clear all touchdowns</button>
            </div>
          ) : <p className="sp-src">Double-click the terrain to drop a pin and read its exact coordinates, elevation and slope.</p>}
        </aside>
      )}
      {view === 'lander' && (
        <>
          <div ref={teleRef} className="telemetry" aria-live="off" />
          <div className="drive">
            <div className="dpad">
              <button type="button" aria-label="Turn left" {...hold('tl')}>↺</button>
              <button type="button" aria-label="Forward" {...hold('f')}>▲</button>
              <button type="button" aria-label="Turn right" {...hold('tr')}>↻</button>
              <button type="button" aria-label="Step left" {...hold('l')}>◀</button>
              <button type="button" aria-label="Back" {...hold('b')}>▼</button>
              <button type="button" aria-label="Step right" {...hold('r')}>▶</button>
            </div>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Travel speed">
              <option value={1.4}>Walk · 1.4 m/s</option>
              <option value={4}>Rover · 4 m/s</option>
              <option value={60}>Fast scout · 60 m/s</option>
              <option value={600}>Survey hop · 600 m/s</option>
            </select>
            <button type="button" className="pill" onClick={() => api.current?.pinHere()}>Mark touchdown here</button>
            <button type="button" className="pill" onClick={() => api.current?.goHome()}>Back to landing point</button>
            {pin && <span className="pinline">Pin: {ll(pin.lat, pin.lon)} · {pin.elev.toFixed(0)} m · {pin.slope.toFixed(1)}°</span>}
          </div>
        </>
      )}
      <p className="hud-tip">{view === 'descent' ? 'Drag to orbit the lander · scroll to zoom · approach flown with the Sun behind the lander' : view === 'orbit' ? 'Drag to rotate · scroll to zoom · move the mouse over the terrain for coordinates · double-click to plan a touchdown point' : 'Move: W A S D or arrow keys · turn: Q E or ← → · Space: jump (1.62 m/s² lunar gravity) · drag to look · Sun and Earth at true size and direction'}</p>
      {view === 'orbit' && <span ref={cursorRef} className="cursorll" />}
      {!ready && !err && <p className="stage-msg">Loading Cesium Moon terrain…</p>}
      {err && <p className="stage-msg error">{err}</p>}
      <div className="hud-bottom">
        {view === 'descent' && plan && tm ? (
          <div className="descent">
            <p className="simtag">SIMULATED LANDING · simplified guidance model on real NASA terrain and Sun position · not flight data from a real mission</p>
            <h3>{PHASES[tm.phase].name}</h3>
            <p className="tele">
              <b>{(tm.d / 1000).toFixed(2)}</b> km from landing site · Altitude <b>{tm.h >= 1000 ? (tm.h / 1000).toFixed(2) + ' km' : tm.h.toFixed(0) + ' m'}</b> · Speed <b>{tm.speed.toFixed(0)}</b> m/s ({(tm.speed * 3.6).toFixed(0)} km/h)
            </p>
            <p className="desc">{PHASES[tm.phase].text}</p>
            <p className="tele">{tm.landed ? <b>Landed at {site.name}</b> : <>Touchdown in <b>{mmss(left)}</b></>}</p>
            {tm.landed && verdict && (
              <div className={`verdict-card ${verdict.td < 10 && verdict.max < 10 ? 'ok' : 'bad'}`}>
                <p><b>{verdict.td < 10 && verdict.max < 10 ? '✓ Target reached safely' : '⚠ Hazard on the approach'}</b></p>
                {verdict.moved > 0 ? <p>Hazard avoidance: the planned point was {verdict.reason}, so the lander diverted <b>{verdict.moved.toFixed(0)} m</b> to the nearest safe spot.</p> : <p>The planned point was safe, so the lander touched down on it.</p>}
                <p>Ground slope at touchdown: <b>{verdict.td.toFixed(1)}°</b> {verdict.td < 10 ? '(safe, under 10°)' : '(too steep, over 10°)'}. Craters mapped around the site: {verdict.craters}.</p>
                <p>Steepest ground under the final 150 m of descent: <b>{verdict.max.toFixed(1)}°</b>{verdict.max >= 10 ? ` at ${verdict.at.toFixed(0)} m from the target` : ''} {verdict.max < 10 ? '· no detected hazard crossed' : '· crossed a detected hazard'}.</p>
              </div>
            )}
            <div className="simctl">
              <button type="button" onClick={() => setSimT(phaseStart(plan, Math.max(0, tm.phase - 1)))}>◂ Phase</button>
              <button type="button" onClick={() => { if (tm.landed) setSimT(0); setSimPlay((p) => !p || tm.landed); }}>{simPlay ? '⏸ Pause' : tm.landed ? '↺ Replay' : '▶ Play'}</button>
              <button type="button" onClick={() => setSimT(phaseStart(plan, Math.min(4, tm.phase + 1)))}>Phase ▸</button>
              <select aria-label="Simulation speed" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                <option value={1}>1× real time</option><option value={4}>4×</option><option value={10}>10×</option>
              </select>
              {tm.landed && <SpecularButton type="button" size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.4} glow={1} proximity={220} className="cta-spec" onClick={() => onView('lander')}>Start surface operations ▸</SpecularButton>}
            </div>
            <p className="nasalinks">Real landings, from NASA:
              <a href="https://www.nasa.gov/mission/apollo-11/" target="_blank" rel="noopener noreferrer">Apollo 11</a>
              <a href="https://www.nasa.gov/humans-in-space/human-landing-system/" target="_blank" rel="noopener noreferrer">Human Landing System</a>
              <a href="https://www.nasa.gov/centers-and-facilities/ames/simlabs/lunar-lander-simulation/" target="_blank" rel="noopener noreferrer">Ames lunar lander simulation</a>
              <a href="https://eyes.nasa.gov/apps/mars2020/#/home" target="_blank" rel="noopener noreferrer">Mars 2020 landing in NASA's Eyes</a>
            </p>
            <input type="range" min={0} max={plan.tEnd} step={0.1} value={simT} onChange={(e) => { setSimPlay(false); setSimT(Number(e.target.value)); }} aria-label="Descent time" />
          </div>
        ) : children}
      </div>
    </div>
  );
}
