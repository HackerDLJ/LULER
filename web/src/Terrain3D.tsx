import { realStars } from './stars';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Common, Site } from './data';
import { decodeB64 } from './data';
import { dest } from './custom';
import { loadGlb } from './Craft';
import { trekPatch } from './trek';
import { makePlan, traj, PHASES, phaseStart, type Plan } from './descent';
import SpecularButton from './rb/SpecularButton.jsx';

const R_KM = 1737.4;

type View = 'orbit' | 'lander' | 'descent';
type Layer = 'natural' | 'slope' | 'elev';

interface Props {
  site: Site;
  common: Common;
  t: number; // absolute hour index
  mastM: number;
  base: string; // URL base of the data folder
  textured?: boolean; // Moon Kit imagery crop available for this site
  modelsBase: string;
  view: View;
  onView: (v: View) => void;
  chrome?: ReactNode;
  panel?: ReactNode; // site data shown beside the terrain in the Site view
  children?: ReactNode;
}

interface Dem { n: number; pxKm: number; h: Int16Array; scale: number } // heights = h * scale metres
interface Terr { dem: Dem; fine: Dem | null }
interface Pin { lat: number; lon: number; elev: number; slope: number; base: number; dist: number; brg: number }

/** Local east-north-up -> three.js axes: x = east, y = up, z = -north. Units: kilometres. */
function dirFromAzEl(azDeg: number, elDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}
const SLOPE_BANDS: [number, number, number, number][] = [[5, 0.25, 0.75, 0.43], [10, 0.93, 0.83, 0.3], [15, 0.96, 0.55, 0.2], [20, 0.9, 0.25, 0.2], [91, 0.62, 0.12, 0.42]];
const ll = (la: number, lo: number) => { const l = ((lo + 540) % 360) - 180; return `${Math.abs(la).toFixed(4)}°${la < 0 ? 'S' : 'N'}  ${Math.abs(l).toFixed(4)}°${l < 0 ? 'W' : 'E'}`; };

export default function Terrain3D({ site, common, t, mastM, base, textured, modelsBase, view, onView, chrome, panel, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const teleRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setTime: (t: number) => void; setView: (v: View) => void; setExag: (x: number) => void; setSim: (ts: number, p: Plan) => void;
    setLayer: (l: Layer) => void; setSpeed: (v: number) => void; key: (k: string, on: boolean) => void; pinHere: () => void; goHome: () => void; clearPin: () => void;
  } | null>(null);
  const [terr, setTerr] = useState<Terr | null>(null);
  const [err, setErr] = useState('');
  const [simT, setSimT] = useState(0);
  const [simPlay, setSimPlay] = useState(false);
  const [rate, setRate] = useState(1);
  const [exag, setExag] = useState(1);
  const [layer, setLayer] = useState<Layer>('natural');
  const [imagery, setImagery] = useState('');
  const [pin, setPin] = useState<Pin | null>(null);
  const [speed, setSpeed] = useState(4);
  const [spOpen, setSpOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 980);
  const [range, setRange] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    let live = true;
    setTerr(null);
    setErr('');
    setPin(null);
    if (site.demInline) { setTerr({ dem: { ...site.demInline, scale: 1 }, fine: null }); return; }
    const get = (name: string) => fetch(`${base}${site.id}.${name}.json`).then((r) => { if (!r.ok) throw new Error(`terrain patch missing (${r.status})`); return r.json() as Promise<{ n: number; px_m: number; scale?: number; b64: string }>; })
      .then((j) => ({ n: j.n, pxKm: j.px_m / 1000, h: new Int16Array(decodeB64(j.b64)), scale: j.scale ?? 1 }));
    Promise.all([get('dem'), site.info?.fine ? get('fine').catch(() => null) : Promise.resolve(null)])
      .then(([dem, fine]) => { if (live) setTerr({ dem, fine }); })
      .catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [site, base]);

  // Build the scene once per terrain patch.
  useEffect(() => {
    const el = host.current;
    if (!el || !terr) return;
    const { dem, fine } = terr;
    let live = true;
    const w = () => el.clientWidth || 800;
    const hgt = () => el.clientHeight || 480;
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w(), hgt());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const n = dem.n;
    const half = (dem.pxKm * (n - 1)) / 2;
    const h0 = dem.h[Math.floor(n / 2) * n + Math.floor(n / 2)] * dem.scale; // metres, site centre
    const fHalf = fine ? (fine.pxKm * (fine.n - 1)) / 2 : 0;
    const fC = fine ? fine.h[Math.floor(fine.n / 2) * fine.n + Math.floor(fine.n / 2)] * fine.scale : 0;

    // --- true (un-exaggerated) terrain sampling, metres relative to the site centre ---
    const bil = (d: Dem, hf: number, x: number, z: number) => {
      const fc = Math.min(Math.max((x / (2 * hf) + 0.5) * (d.n - 1), 0), d.n - 1.001);
      const fr = Math.min(Math.max((0.5 + z / (2 * hf)) * (d.n - 1), 0), d.n - 1.001);
      const c0 = Math.floor(fc), r0 = Math.floor(fr), a = fc - c0, b = fr - r0, hh = d.h, m = d.n;
      return ((hh[r0 * m + c0] * (1 - a) + hh[r0 * m + c0 + 1] * a) * (1 - b) + (hh[(r0 + 1) * m + c0] * (1 - a) + hh[(r0 + 1) * m + c0 + 1] * a) * b) * d.scale;
    };
    const inFine = (x: number, z: number) => !!fine && Math.abs(x) < fHalf - 0.02 && Math.abs(z) < fHalf - 0.02;
    const H = (x: number, z: number) => (fine && inFine(x, z) ? bil(fine, fHalf, x, z) - fC : bil(dem, half, x, z) - h0);
    const slopeAt = (x: number, z: number): [number, number] => {
      const s = inFine(x, z) ? fine!.pxKm : dem.pxKm;
      const de = (H(x + s, z) - H(x - s, z)) / (2000 * s), dn = (H(x, z - s) - H(x, z + s)) / (2000 * s);
      return [(Math.atan(Math.hypot(de, dn)) * 180) / Math.PI, Math.round(2000 * s)];
    };
    let curEx = 1;
    const terrainY = (x: number, z: number) => (H(x, z) / 1000) * curEx - (x * x + z * z) / (2 * R_KM);
    let hMin = Infinity, hMax = -Infinity;
    for (let i = 0; i < dem.h.length; i++) { const v = dem.h[i] * dem.scale; if (v < hMin) hMin = v; if (v > hMax) hMax = v; }
    setRange([Math.round(hMin), Math.round(hMax)]);

    // Stars
    scene.add(realStars(50000, 90)); // real stars: Yale Bright Star Catalogue (NASA HEASARC)

    // --- terrain meshes: the regional patch, plus a fine inner patch where NASA 5 m data exists ---
    const grid = (m: number, hf: number, hole: boolean) => {
      const pos = new Float32Array(3 * m * m), uv = new Float32Array(2 * m * m), col = new Float32Array(3 * m * m).fill(1), idx: number[] = [];
      for (let r = 0; r < m - 1; r++) for (let c = 0; c < m - 1; c++) { const a = r * m + c; idx.push(a, a + m, a + 1, a + 1, a + m, a + m + 1); }
      const g = new THREE.BufferGeometry();
      g.setIndex(idx);
      for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) {
        const x = (c / (m - 1) - 0.5) * 2 * hf, z = -(0.5 - r / (m - 1)) * 2 * hf;
        uv.set([x / (2 * half) + 0.5, 0.5 - z / (2 * half)], 2 * (r * m + c));
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const build = (ex: number) => {
        for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) {
          const x = (c / (m - 1) - 0.5) * 2 * hf, z = -(0.5 - r / (m - 1)) * 2 * hf;
          let y = ((hole ? bil(dem, half, x, z) - h0 : H(x, z)) / 1000) * ex - (x * x + z * z) / (2 * R_KM);
          if (hole && fine && Math.abs(x) < fHalf - 0.1 && Math.abs(z) < fHalf - 0.1) y -= 0.08; // tucked under the fine patch
          pos.set([x, y, z], 3 * (r * m + c));
        }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.attributes.position.needsUpdate = true;
        g.computeVertexNormals();
        g.computeBoundingSphere();
      };
      const paint = (l: Layer) => {
        for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) {
          const x = (c / (m - 1) - 0.5) * 2 * hf, z = -(0.5 - r / (m - 1)) * 2 * hf, o = 3 * (r * m + c);
          if (l === 'natural') { col.set([1, 1, 1], o); continue; }
          // map-style relief shading (fixed light from the north-west), so the colours stay readable in any Sun
          const st = hole ? dem.pxKm : fine!.pxKm;
          const ge = (H(x + st, z) - H(x - st, z)) / (2000 * st), gn = (H(x, z - st) - H(x, z + st)) / (2000 * st);
          const sh = 0.62 + 0.38 * Math.max(0, Math.min(1, (0.5 * ge - 0.5 * gn + 0.7) / Math.sqrt(ge * ge + gn * gn + 1)));
          let rgb: number[];
          if (l === 'slope') {
            const s = (Math.atan(Math.hypot(ge, gn)) * 180) / Math.PI;
            const b = SLOPE_BANDS.find((q) => s < q[0])!;
            rgb = [b[1], b[2], b[3]];
          } else {
            const f = Math.min(1, Math.max(0, (H(x, z) + h0 - hMin) / Math.max(1, hMax - hMin)));
            rgb = f < 0.5 ? [0.1 + 0.5 * f, 0.25 + 1.1 * f, 0.6 - 0.5 * f] : [0.35 + 1.3 * (f - 0.5), 0.8 + 0.4 * (f - 0.5), 0.35 + 1.3 * (f - 0.5)];
          }
          col.set([rgb[0] * sh, rgb[1] * sh, rgb[2] * sh], o);
        }
        g.attributes.color.needsUpdate = true;
      };
      return { g, build, paint };
    };
    const outer = grid(n, half, true);
    const inner = fine ? grid(fine.n, fHalf, false) : null;
    outer.build(1);
    inner?.build(1);
    const REG = 0xb7b2a8;
    const mat = new THREE.MeshStandardMaterial({ color: REG, roughness: 0.95, metalness: 0 });
    const flat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); // unlit: used for the slope and elevation layers
    const meshes: THREE.Mesh[] = [];
    let natTex: THREE.Texture | null = null;
    let curLayer: Layer = 'natural';
    const applyLayer = (l: Layer) => {
      curLayer = l;
      outer.paint(l);
      inner?.paint(l);
      mat.map = natTex;
      mat.color.set(natTex ? 0xffffff : REG);
      mat.needsUpdate = true;
      for (const m of meshes) m.material = l === 'natural' ? mat : flat;
    };
    const useTex = (tex: THREE.Texture) => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; natTex?.dispose(); natTex = tex; if (curLayer === 'natural') applyLayer('natural'); };
    if (textured) {
      new THREE.TextureLoader().load(`${base}${site.id}.tex.jpg`, (tex) => { if (!live || natTex) return; useTex(tex); setImagery('NASA SVS Moon Kit (LROC WAC colour), about 670 m per pixel'); });
    } else setImagery(Math.abs(site.lat) >= 75 ? 'none: shaded directly from LOLA elevation (camera mosaics are unreliable this close to the pole)' : 'loading NASA Moon Trek imagery…');
    if (Math.abs(site.lat) < 75) {
      // sharper live imagery from NASA's Moon Trek service; silently keeps the bundled texture if it cannot be reached
      trekPatch(site.lat, site.lon, half, 1024).then(({ canvas, mPerPx }) => {
        if (!live) return;
        useTex(new THREE.CanvasTexture(canvas));
        setImagery(`NASA Moon Trek: LRO WAC global mosaic, about ${mPerPx} m per pixel (loaded live)`);
      }).catch(() => { if (live && !textured) setImagery('none available offline: shaded from elevation only'); });
    }
    // Fine regolith grain below the resolution of the elevation data (illustrative only; adds no information).
    const cv0 = document.createElement('canvas');
    cv0.width = cv0.height = 256;
    const cx = cv0.getContext('2d');
    if (cx) {
      const idt = cx.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) { const g = 120 + Math.random() * 110; idt.data.set([g, g, g, 255], 4 * i); }
      cx.putImageData(idt, 0, 0);
      cx.globalAlpha = 0.55; cx.filter = 'blur(3px)'; cx.drawImage(cv0, 0, 0); cx.filter = 'blur(10px)'; cx.globalAlpha = 0.35; cx.drawImage(cv0, 0, 0); cx.filter = 'none'; cx.globalAlpha = 1;
      const grain = new THREE.CanvasTexture(cv0);
      grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
      grain.repeat.set((2 * half) / 0.004, (2 * half) / 0.004);
      grain.anisotropy = 8;
      // Regolith texture only (surface roughness below the 5-118 m elevation data); it changes no measured value.
      (mat as THREE.MeshStandardMaterial).bumpMap = grain; (mat as THREE.MeshStandardMaterial).bumpScale = 0.02;
      (mat as THREE.MeshStandardMaterial).roughnessMap = grain; (mat as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    for (const gg of [outer, inner]) if (gg) { const m = new THREE.Mesh(gg.g, mat); m.castShadow = gg === outer; m.receiveShadow = true; scene.add(m); meshes.push(m); }

    // Light = the real Sun direction
    const sun = new THREE.DirectionalLight(0xfff4e0, 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -half * 1.45; sc.right = half * 1.45; sc.top = half * 1.45; sc.bottom = -half * 1.45;
    sc.near = 0.1; sc.far = half * 8;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = fine ? 0.045 : 0.02;
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0x6f7f9f, 0x2a2622, 0.55));

    // Landing-point marker (Site view), beacons (Surface view), planned-touchdown pin
    const marker = new THREE.Mesh(new THREE.ConeGeometry(half * 0.012, half * 0.05, 16), new THREE.MeshBasicMaterial({ color: 0xff5d5d }));
    marker.rotation.x = Math.PI;
    scene.add(marker);
    const pinMesh = new THREE.Mesh(new THREE.ConeGeometry(half * 0.01, half * 0.04, 16), new THREE.MeshBasicMaterial({ color: 0x4cc9f0 }));
    pinMesh.rotation.x = Math.PI;
    pinMesh.visible = false;
    scene.add(pinMesh);
    const pole = (color: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0004, 0.0004, 0.04, 8), new THREE.MeshBasicMaterial({ color })); m.visible = false; scene.add(m); return m; };
    const homePole = pole(0xff5d5d), pinPole = pole(0x4cc9f0);
    let pinXZ: [number, number] | null = null;
    const placeMarkers = () => {
      marker.position.set(0, terrainY(0, 0) + half * 0.025, 0);
      homePole.position.set(0, terrainY(0, 0) + 0.02, 0);
      if (pinXZ) { pinMesh.position.set(pinXZ[0], terrainY(pinXZ[0], pinXZ[1]) + half * 0.02, pinXZ[1]); pinPole.position.set(pinXZ[0], terrainY(pinXZ[0], pinXZ[1]) + 0.02, pinXZ[1]); }
    };
    placeMarkers();

    // Generic lander (about 4 m across), built from simple shapes. Units inside the group: metres.
    const craft = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xb98a2e, metalness: 0.25, roughness: 0.6 });
    const grey = new THREE.MeshStandardMaterial({ color: 0xa3a9b3, metalness: 0.3, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.3, 8), gold);
    body.position.y = 1.9;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 0.9, 8), grey);
    top.position.y = 3.0;
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.0, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x555a63, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }));
    nozzle.position.y = 0.95;
    craft.add(body, top, nozzle);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x16254d, metalness: 0.4, roughness: 0.35 });
    for (const sgn of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 1.3), panelMat); p.position.set(sgn * 2.75, 2.5, 0); craft.add(p); }
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), grey);
      leg.position.set(Math.cos(a) * 2.1, 0.95, Math.sin(a) * 2.1);
      leg.rotation.z = Math.cos(a) * 0.55;
      leg.rotation.x = -Math.sin(a) * 0.55;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), grey);
      pad.position.set(Math.cos(a) * 2.8, 0.04, Math.sin(a) * 2.8);
      craft.add(leg, pad);
    }
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.6, 5, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    plume.rotation.x = Math.PI;
    plume.position.y = -2.0;
    craft.add(plume);
    if (site.group === 'Apollo') {
      // NASA's own Apollo Lunar Module model replaces the generic shape at Apollo sites
      loadGlb(`${modelsBase}lm.glb.json`).then((m) => {
        if (!live) return;
        for (const ch of [...craft.children]) if (ch !== plume) ch.visible = false;
        m.scale.setScalar(1.45);
        craft.add(m);
      }).catch(() => { /* keep the generic lander */ });
    }
    // Engine dust kicked up by the exhaust near the ground (no air: it flies out low and straight)
    const NDUST = 700;
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NDUST * 3), 3));
    const dmat = new THREE.PointsMaterial({ color: 0xb8b2a6, size: 0.0011, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    const dust = new THREE.Points(dgeo, dmat); dust.frustumCulled = false; dust.visible = false; scene.add(dust);
    const dseed = Array.from({ length: NDUST }, () => ({ a: Math.random() * Math.PI * 2, r: 0.3 + Math.random() * 0.7, o: Math.random() }));
    const glowL = new THREE.PointLight(0xcfe6ff, 0, 0.05); craft.add(glowL); glowL.position.y = -2;
    craft.scale.setScalar(0.001);
    craft.visible = false;
    scene.add(craft);

    // Direction arrows (Site view) and true-size discs (Surface view)
    const arrows = new THREE.Group();
    const arrow = (color: number) => new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), half * 0.34, color, half * 0.04, half * 0.02);
    const sunArrow = arrow(0xffc857);
    const earthArrow = arrow(0x4cc9f0);
    arrows.add(sunArrow, earthArrow);
    scene.add(arrows);
    const D = 8000;
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
    const earthDisc = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshStandardMaterial({ color: 0x4f9dde, emissive: 0x1d4f9a, emissiveIntensity: 0.9, roughness: 0.9 }));
    scene.add(sunDisc, earthDisc);
    const fc = document.createElement('canvas');
    fc.width = fc.height = 256;
    const fx = fc.getContext('2d');
    if (fx) {
      const gr = fx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.06, 'rgba(255,244,210,0.9)'); gr.addColorStop(0.2, 'rgba(255,225,160,0.28)'); gr.addColorStop(0.5, 'rgba(255,210,140,0.07)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
      fx.fillStyle = gr; fx.fillRect(0, 0, 256, 256);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    scene.add(glow);

    // Cameras
    const orbitCam = new THREE.PerspectiveCamera(45, w() / hgt(), 0.002, 100000);
    orbitCam.position.set(half * 0.9, half * 0.75, half * 1.1);
    const controls = new OrbitControls(orbitCam, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();
    let intro = 1; // arrive from above, as if descending from the whole-Moon view
    const home = orbitCam.position.clone();
    controls.addEventListener('start', () => { intro = 0; });

    const lander = new THREE.PerspectiveCamera(65, w() / hgt(), 0.0003, 100000);
    const eye = Math.max(mastM, 1.7) / 1000;
    let px = 0, pz = 0; // position of the explorer on the surface, km east / km south of the site centre
    let yaw = 0, pitch = 0.03;
    let mode: View = 'orbit';
    let moveSpeed = 4; // m/s
    const keys = new Set<string>();
    let drag = false, lx = 0, ly = 0, downX = 0, downY = 0;
    const el0 = renderer.domElement;
    const local = (e: PointerEvent | MouseEvent): [number, number] => { const r = el0.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (cx2: number, cy2: number): THREE.Vector3 | null => {
      ndc.set((cx2 / w()) * 2 - 1, -(cy2 / hgt()) * 2 + 1);
      ray.setFromCamera(ndc, orbitCam);
      const hs = ray.intersectObjects(meshes, false);
      return hs.length ? hs[0].point : null;
    };
    const describe = (x: number, z: number) => {
      const dk = Math.hypot(x, z), brg = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
      const [la, lo] = dk < 1e-6 ? [site.lat, site.lon] : dest(site.lat, site.lon, brg, dk);
      const [s, b] = slopeAt(x, z);
      return { lat: la, lon: lo, elev: h0 + H(x, z), slope: s, base: b, dist: dk, brg };
    };
    const setPinAt = (x: number, z: number) => { pinXZ = [x, z]; pinMesh.visible = mode === 'orbit'; pinPole.visible = mode === 'lander'; placeMarkers(); setPin(describe(x, z)); };
    const down = (e: PointerEvent) => { [downX, downY] = local(e); if (mode === 'lander') { drag = true; lx = e.clientX; ly = e.clientY; el0.setPointerCapture(e.pointerId); } };
    const move = (e: PointerEvent) => {
      if (mode === 'orbit' && cursorRef.current) {
        const [x, y] = local(e);
        const p = hit(x, y);
        if (p) { const d = describe(p.x, p.z); cursorRef.current.textContent = `Cursor  ${ll(d.lat, d.lon)}   elevation ${d.elev.toFixed(0)} m   slope ${d.slope.toFixed(1)}° over ${d.base} m`; }
        else cursorRef.current.textContent = '';
      }
      if (!drag) return;
      yaw -= (e.clientX - lx) * 0.005;
      pitch = Math.max(-0.9, Math.min(1.2, pitch - (e.clientY - ly) * 0.005));
      lx = e.clientX; ly = e.clientY;
    };
    const up = () => { drag = false; };
    const dbl = (e: MouseEvent) => { if (mode !== 'orbit') return; const [x, y] = local(e); const p = hit(x, y); if (p) setPinAt(p.x, p.z); };
    el0.addEventListener('pointerdown', down);
    el0.addEventListener('pointermove', move);
    el0.addEventListener('pointerup', up);
    el0.addEventListener('dblclick', dbl);
    const typing = (e: KeyboardEvent) => { const tg = e.target as HTMLElement | null; return !!tg && /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName); };
    const KEYMAP: Record<string, string> = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', d: 'r', arrowleft: 'tl', arrowright: 'tr', q: 'tl', e: 'tr' };
    const kd = (e: KeyboardEvent) => { if (mode !== 'lander' || typing(e)) return; const k = KEYMAP[e.key.toLowerCase()]; if (k) { keys.add(k); e.preventDefault(); } };
    const ku = (e: KeyboardEvent) => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys.delete(k); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const v = new THREE.Vector3();
    let first = true;
    const setTime = (tt: number) => {
      dirFromAzEl(site.sunAz[tt], site.sunEl[tt], v);
      sun.position.copy(v).multiplyScalar(half * 4);
      sun.target.position.set(0, 0, 0);
      sunArrow.setDirection(v.clone());
      sunDisc.position.copy(v).multiplyScalar(D);
      sunDisc.scale.setScalar(D * Math.tan((common.sunR[tt] * Math.PI) / 180));
      glow.position.copy(sunDisc.position);
      glow.scale.setScalar(sunDisc.scale.x * 34);
      const sEl = Math.sin((site.sunEl[tt] * Math.PI) / 180);
      sun.intensity = sEl > 0 ? Math.min(8, Math.max(3.2, 1.7 / sEl)) : 3.2; // camera-style exposure for low Sun
      dirFromAzEl(site.earthAz[tt], site.earthEl[tt], v);
      earthArrow.setDirection(v.clone());
      earthDisc.position.copy(v).multiplyScalar(D);
      earthDisc.scale.setScalar(D * Math.tan((common.earthR[tt] * Math.PI) / 180));
      if (first) {
        const az = site.sunEl[tt] > -3 ? site.sunAz[tt] : site.earthAz[tt];
        yaw = (-az * Math.PI) / 180;
        first = false;
      }
    };
    // Boulders and regolith clutter around the landing point (descent + surface views)
    const NR = 0; // no invented boulders: the terrain shows only real NASA elevation data
    const rgeo = new THREE.IcosahedronGeometry(1, 1);
    { const pa = rgeo.getAttribute('position') as THREE.BufferAttribute; const seen = new Map<string, number>();
      for (let i = 0; i < pa.count; i++) { const key = [pa.getX(i), pa.getY(i), pa.getZ(i)].map((v) => v.toFixed(3)).join(); if (!seen.has(key)) seen.set(key, 0.78 + Math.random() * 0.4); const j = seen.get(key)!; pa.setXYZ(i, pa.getX(i) * j, pa.getY(i) * j * 0.7, pa.getZ(i) * j); }
      rgeo.computeVertexNormals(); }
    const rocks = new THREE.InstancedMesh(rgeo, new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: 1, metalness: 0 }), NR);
    rocks.frustumCulled = false; rocks.visible = false; scene.add(rocks);
    const rseed = Array.from({ length: NR }, (_, i) => { const near = i < 600; const r = (near ? 0.006 + Math.pow(Math.random(), 1.4) * 0.07 : 0.07 + Math.random() * 0.35); const a = Math.random() * Math.PI * 2; return { x: Math.cos(a) * r, z: Math.sin(a) * r, s: (0.00012 + Math.pow(Math.random(), 3) * 0.0011) * (near ? 1 : 2.2), ry: Math.random() * 6.28, rx: Math.random() * 0.5 }; });
    const placeRocks = () => { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      for (let i = 0; i < NR; i++) { const o = rseed[i]; e.set(o.rx, o.ry, o.rx * 0.5); q.setFromEuler(e); sc.set(o.s * 1.3, o.s, o.s * 1.1); ps.set(o.x, terrainY(o.x, o.z) + o.s * 0.25, o.z); m4.compose(ps, q, sc); rocks.setMatrixAt(i, m4); }
      rocks.instanceMatrix.needsUpdate = true; };
    const setView2 = (m: View) => {
      const was = mode;
      mode = m;
      craft.visible = m === 'descent';
      rocks.visible = m === 'descent' || m === 'lander'; if (rocks.visible) placeRocks();
      if (m === 'descent') {
        controls.minDistance = 0.008;
        controls.maxPolarAngle = Math.PI * 0.62;
      } else if (was === 'descent') {
        controls.minDistance = 0;
        controls.maxPolarAngle = Math.PI * 0.49;
        controls.target.set(0, 0, 0);
        orbitCam.position.set(half * 0.9, half * 0.75, half * 1.1);
      }
      controls.enabled = m !== 'lander';
      arrows.visible = m === 'orbit';
      marker.visible = m === 'orbit';
      pinMesh.visible = m === 'orbit' && !!pinXZ;
      homePole.visible = m === 'lander';
      pinPole.visible = m === 'lander' && !!pinXZ;
      sunDisc.visible = m === 'lander';
      glow.visible = m === 'lander';
      earthDisc.visible = m === 'lander';
      if (m !== 'lander') keys.clear();
    };
    setView2('orbit');
    setTime(t);

    // Cinematic director: film-style cuts, letterbox, caption
    let cine = true, shot = -1;
    el.querySelectorAll('.cine-ov').forEach((n) => n.remove());
    const ov = document.createElement('div'); ov.className = 'cine-ov'; ov.style.display = 'none';
    ov.innerHTML = '<i class="cb t"></i><i class="cb b"></i><i class="cv"></i><i class="cg"></i><span class="cc"></span><button type="button" class="cbtn">🎬 Cinematic</button>';
    el.appendChild(ov);
    const capEl = ov.querySelector('.cc') as HTMLElement;
    const cbtn = ov.querySelector('.cbtn') as HTMLButtonElement;
    cbtn.onclick = () => { cine = true; shot = -1; };
    controls.addEventListener('start', () => { if (mode === 'descent') cine = false; });
    const CAP = ['BRAKING BURN', 'APPROACH', 'HAZARD CHECK', 'TERMINAL DESCENT', 'TOUCHDOWN'];
    const camP = new THREE.Vector3(), look = new THREE.Vector3(), right = new THREE.Vector3(), trav = new THREE.Vector3();
    const cineCam = (ts: number, p: Plan, s: ReturnType<typeof traj>, dx: number, dz: number, gy: number) => {
      trav.set(-dx, 0, -dz); right.set(-trav.z, 0, trav.x);
      const R = (o: number, u: number, f: number) => camP.set(cp.x + right.x * o + trav.x * f, cp.y + u, cp.z + right.z * o + trav.z * f);
      const t1 = p.t1, rem = p.tEnd - ts;
      let k: number, fov = 42;
      if (s.landed || rem < 3) k = 4; else if (ts >= t1) k = 3; else if (ts >= t1 - 15) k = 2; else if (ts >= 0.38 * t1) k = 1; else k = 0;
      look.copy(cp);
      if (k === 0) { const a = 0.9 + ts * 0.012; camP.set(cp.x + Math.cos(a) * 0.05 * right.x - trav.x * 0.035, cp.y + 0.012, cp.z + Math.cos(a) * 0.05 * right.z - trav.z * 0.035); fov = 40; }
      else if (k === 1) { camP.set(0 + right.x * 0.05, gy + 0.0012, 0 + right.z * 0.05); fov = 26; look.copy(cp); }
      else if (k === 2) { R(0.004, 0.032, 0.012); look.set(cp.x, gy, cp.z); fov = 50; }
      else if (k === 3) { const u = Math.max(0, (ts - t1) / Math.max(1, p.tEnd - t1)); const d = 0.034 - 0.02 * u; camP.set(cp.x + right.x * d, gy + 0.0016 + 0.002 * (1 - u), cp.z + right.z * d); look.set(cp.x, cp.y - 0.0015, cp.z); fov = 34 - 8 * u; }
      else { const u = Math.min(1, Math.max(0, (ts - p.tEnd + 3) / 12)); const a = 0.5 + u * 0.9; const rr = 0.012 + 0.05 * u; camP.set(cp.x + Math.cos(a) * rr * right.x + Math.sin(a) * rr * trav.x, gy + 0.003 + 0.02 * u * u, cp.z + Math.cos(a) * rr * right.z + Math.sin(a) * rr * trav.z); look.set(cp.x, gy + 0.002, cp.z); fov = 36; }
      const tt = performance.now() / 1000, sh = (k <= 1 ? 0.0004 : 0.00012) * (s.landed ? 0 : 1);
      camP.x += Math.sin(tt * 7.3) * sh; camP.y += Math.sin(tt * 9.1) * sh; camP.z += Math.cos(tt * 6.7) * sh;
      if (k !== shot) { shot = k; orbitCam.position.copy(camP); } else orbitCam.position.lerp(camP, 0.35);
      controls.target.lerp(look, k === 3 ? 0.6 : 0.3);
      if (Math.abs(orbitCam.fov - fov) > 0.05) { orbitCam.fov += (fov - orbitCam.fov) * 0.15; orbitCam.updateProjectionMatrix(); }
      if (orbitCam.position.y < gy + 0.0004) orbitCam.position.y = gy + 0.0004;
      capEl.textContent = CAP[Math.min(s.phase, 4)];
    };
    const cp = new THREE.Vector3();
    const upY = new THREE.Vector3(0, 1, 0);
    let simStarted = false;
    const setSim = (ts: number, p: Plan) => {
      const s = traj(p, ts);
      const az = (p.azFrom * Math.PI) / 180;
      const dx = Math.sin(az), dz = -Math.cos(az);
      const dk = s.d / 1000;
      const x = dx * dk, z = dz * dk;
      const y = Math.max(s.h / 1000 - (dk * dk) / (2 * R_KM), terrainY(x, z) + (s.d > 1 ? 0.12 : 0));
      cp.set(x, s.landed ? terrainY(0, 0) : y, z);
      const delta = cp.clone().sub(craft.position);
      craft.position.copy(cp);
      craft.quaternion.setFromUnitVectors(upY, new THREE.Vector3(dx * s.vh, 90, dz * s.vh).normalize());
      plume.visible = !s.landed;
      { const fl = 0.9 + Math.random() * 0.25; plume.scale.set(fl, (0.4 + Math.min(s.speed / 300, 1.6)) * (0.92 + Math.random() * 0.16), fl); glowL.intensity = s.landed ? 0 : 0.002; }
      { const gy = terrainY(cp.x, cp.z); const alt = Math.max(0, s.h); const inten = s.landed ? Math.max(0, 1 - (ts - p.tEnd) / 6) * 0.9 : Math.min(1, Math.max(0, 1 - alt / 90));
        dust.visible = mode === 'descent' && inten > 0.01; dmat.opacity = 0.55 * inten;
        if (dust.visible) { const pa = dgeo.getAttribute('position') as THREE.BufferAttribute; const tt = performance.now() / 1000;
          for (let i = 0; i < NDUST; i++) { const q = dseed[i]; const f = (tt * 0.9 + q.o) % 1; const rad = (0.003 + 0.05 * q.r * f) * (s.landed ? 1.4 : 1); pa.setXYZ(i, cp.x + Math.cos(q.a) * rad, gy + 0.0006 + 0.004 * Math.sin(f * Math.PI) * q.r, cp.z + Math.sin(q.a) * rad); }
          pa.needsUpdate = true; } }
      ov.style.display = mode === 'descent' ? 'block' : 'none'; ov.classList.toggle('on', cine);
      if (ts === 0 && mode === 'descent') { cine = true; shot = -1; }
      if (mode === 'descent' && cine) { cineCam(ts, p, s, dx, dz, terrainY(cp.x, cp.z)); simStarted = true; }
      else if (mode === 'descent') {
        if (!simStarted || ts === 0) {
          controls.target.copy(cp);
          orbitCam.position.set(cp.x + dx * 0.015 - dz * 0.014, cp.y + 0.006, cp.z + dz * 0.015 + dx * 0.014);
          simStarted = true;
        } else {
          orbitCam.position.add(delta);
          controls.target.copy(cp);
        }
      } else simStarted = false;
    };
    api.current = {
      setTime, setView: setView2, setSim,
      setExag: (x) => { curEx = x; outer.build(x); inner?.build(x); placeMarkers(); if (rocks.visible) placeRocks(); },
      setLayer: applyLayer,
      setSpeed: (s) => { moveSpeed = s; },
      key: (k, on) => { if (on) keys.add(k); else keys.delete(k); },
      pinHere: () => setPinAt(px, pz),
      goHome: () => { px = 0; pz = 0; },
      clearPin: () => { pinXZ = null; pinMesh.visible = false; pinPole.visible = false; setPin(null); },
    };

    const lh = labelHost.current;
    const mkL = (text: string, cls: string) => { const d = document.createElement('span'); d.className = 'dir ' + cls; d.textContent = text; lh?.appendChild(d); return d; };
    const sunL = mkL('☀ Sun', 'sun');
    const earthL = mkL('🌍 Earth', 'earth');
    const homeL = mkL('▼ Landing point', 'home');
    const pv = new THREE.Vector3();
    const placeDir = (node: HTMLElement, p: THREE.Vector3, show = true) => {
      if (mode !== 'lander' || !show) { node.style.display = 'none'; return; }
      pv.copy(p).project(lander);
      let x = pv.x, y = pv.y;
      const behind = pv.z > 1;
      if (behind) { x = -x; y = -y; }
      const off = behind || Math.abs(x) > 0.9 || y > 0.78 || y < -0.2;
      if (off) {
        const m = Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.78, 1e-6);
        x /= m; y /= m;
        y = Math.max(y, -0.2);
      }
      node.style.display = '';
      node.classList.toggle('off', off);
      node.style.transform = `translate(${((x * 0.5 + 0.5) * w()).toFixed(1)}px, ${((-y * 0.5 + 0.5) * hgt()).toFixed(1)}px)`;
    };
    const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
    let raf = 0, last = performance.now(), frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frame++;
      if (mode !== 'lander') {
        if (intro > 0.002 && mode === 'orbit') { intro *= 0.9; orbitCam.position.copy(home).multiplyScalar(1 + 2.2 * intro); }
        controls.update();
        renderer.render(scene, orbitCam);
        placeDir(sunL, sunDisc.position);
        placeDir(earthL, earthDisc.position);
        placeDir(homeL, homePole.position);
        return;
      }
      // --- exploring on the surface ---
      const turn = (keys.has('tl') ? 1 : 0) - (keys.has('tr') ? 1 : 0);
      yaw += turn * 1.2 * dt;
      const fwd = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0), strafe = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
      if (fwd || strafe) {
        const step = (moveSpeed * dt) / 1000;
        const fxk = -Math.sin(yaw), fzk = -Math.cos(yaw);
        px = Math.max(-half + 0.3, Math.min(half - 0.3, px + (fxk * fwd - fzk * strafe) * step));
        pz = Math.max(-half + 0.3, Math.min(half - 0.3, pz + (fzk * fwd + fxk * strafe) * step));
      }
      lander.position.set(px, terrainY(px, pz) + eye, pz);
      const d = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      lander.lookAt(lander.position.clone().add(d));
      renderer.render(scene, lander);
      placeDir(sunL, sunDisc.position);
      placeDir(earthL, earthDisc.position);
      placeDir(homeL, homePole.position, Math.hypot(px, pz) > 0.03);
      if (frame % 5 === 0 && teleRef.current) {
        const q = describe(px, pz);
        const hd = (((-yaw * 180) / Math.PI) % 360 + 360) % 360;
        teleRef.current.innerHTML =
          `<span><i>Position</i><b>${ll(q.lat, q.lon)}</b></span>` +
          `<span><i>Elevation</i><b>${q.elev.toFixed(1)} m</b></span>` +
          `<span><i>Ground slope</i><b>${q.slope.toFixed(1)}° <small>over ${q.base} m</small></b></span>` +
          `<span><i>Heading</i><b>${hd.toFixed(0)}° ${compass(hd)}</b></span>` +
          `<span><i>From landing point</i><b>${q.dist < 1 ? (q.dist * 1000).toFixed(0) + ' m' : q.dist.toFixed(2) + ' km'}${q.dist > 0.005 ? ' ' + compass(q.brg) : ''}</b></span>`;
      }
    };
    loop();

    const ro = new ResizeObserver(() => {
      renderer.setSize(w(), hgt());
      orbitCam.aspect = lander.aspect = w() / hgt();
      orbitCam.updateProjectionMatrix();
      lander.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el0.removeEventListener('pointerdown', down);
      el0.removeEventListener('pointermove', move);
      el0.removeEventListener('pointerup', up);
      el0.removeEventListener('dblclick', dbl);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      lh?.replaceChildren();
      controls.dispose();
      outer.g.dispose();
      inner?.g.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terr, site.id]);

  useEffect(() => { api.current?.setTime(t); }, [t, terr]);
  useEffect(() => { api.current?.setView(view); }, [view, terr]);
  useEffect(() => { api.current?.setExag(exag); }, [exag, terr]);
  useEffect(() => { api.current?.setLayer(view === 'orbit' ? layer : 'natural'); }, [layer, view, terr]);
  useEffect(() => { api.current?.setSpeed(speed); }, [speed, terr]);

  const plan = useMemo(() => (terr ? makePlan((terr.dem.pxKm * (terr.dem.n - 1)) / 2, site.sunAz[t]) : null), [terr, site, t]);
  useEffect(() => { if (view === 'descent' && plan) api.current?.setSim(simT, plan); }, [simT, plan, view, terr, exag]);
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
      <div ref={host} className="gl" />
      <div ref={labelHost} className="glabels" />
      {chrome}
      {view === 'orbit' && (
        <aside className={`sitepanel${spOpen ? '' : ' closed'}`} aria-label="Site data">
          <button type="button" className="sp-toggle" onClick={() => setSpOpen((o) => !o)} aria-expanded={spOpen}>{spOpen ? 'Hide site data ✕' : 'Site data ▾'}</button>
          {panel}
          <p className="sp-h">Terrain layer</p>
          <div className="seg3" role="group" aria-label="Terrain layer">
            {(['natural', 'slope', 'elev'] as Layer[]).map((l) => (
              <button key={l} type="button" className={layer === l ? 'on' : ''} aria-pressed={layer === l} onClick={() => setLayer(l)}>{l === 'natural' ? 'Natural' : l === 'slope' ? 'Slope' : 'Elevation'}</button>
            ))}
          </div>
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
              <button type="button" className="pill" onClick={() => api.current?.clearPin()}>Remove pin</button>
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
      <p className="hud-tip">{view === 'descent' ? 'Drag to orbit the lander · scroll to zoom · approach flown with the Sun behind the lander' : view === 'orbit' ? 'Drag to rotate · scroll to zoom · move the mouse over the terrain for coordinates · double-click to plan a touchdown point' : 'Move: W A S D or arrow keys · turn: Q E or ← → · drag to look · Sun and Earth at true size and direction'}</p>
      {view === 'orbit' && <span ref={cursorRef} className="cursorll" />}
      {!terr && !err && <p className="stage-msg">Loading NASA terrain…</p>}
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
