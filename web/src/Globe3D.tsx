import { realStars } from './stars';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { pixelCap, setSettings, useSettings } from './settings';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Globe, Site } from './data';

/** Moon-fixed (Mean Earth) latitude / east longitude -> three.js axes. Matches the Moon Kit texture on a three.js sphere. */
function ll(latDeg: number, lonDeg: number, r: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (latDeg * Math.PI) / 180;
  const b = (lonDeg * Math.PI) / 180;
  return out.set(r * Math.cos(a) * Math.cos(b), r * Math.sin(a), -r * Math.cos(a) * Math.sin(b));
}

const GROUP_COLOR: Record<string, string> = {
  Apollo: '#ffc857',
  'CLPS / commercial': '#7ee0a1',
  'Other agencies': '#ff8a80',
  'Polar candidate regions': '#4cc9f0',
  'Your coordinates': '#ffffff',
};
/** A site with a landing year is a historical landing; everything else is a candidate or planned site. */
export const isHistorical = (s: Site) => s.year !== null;

function markerTexture(color: string, historical: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const halo = g.createRadialGradient(64, 64, 6, 64, 64, 60);
    halo.addColorStop(0, color + 'aa'); halo.addColorStop(0.45, color + '33'); halo.addColorStop(1, color + '00');
    g.fillStyle = halo; g.beginPath(); g.arc(64, 64, 60, 0, 2 * Math.PI); g.fill();
    if (historical) { // landed: solid dot with a white rim
      g.beginPath(); g.arc(64, 64, 17, 0, 2 * Math.PI); g.fillStyle = color; g.fill();
      g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke();
    } else { // candidate / planned: open ring with a centre point
      g.beginPath(); g.arc(64, 64, 17, 0, 2 * Math.PI); g.lineWidth = 7; g.strokeStyle = color; g.stroke();
      g.beginPath(); g.arc(64, 64, 5, 0, 2 * Math.PI); g.fillStyle = '#ffffff'; g.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}

interface Layers { grid: boolean; hist: boolean; cand: boolean }
interface Api {
  setTime: (t: number) => void;
  focus: (i: number, fly: boolean) => void;
  dive: () => void;
  look: (lat: number, lon: number, dist: number) => void;
  frameEarth: () => void;
  reset: () => void;
  layers: (l: Layers) => void;
}

interface Props {
  sites: Site[];
  selected: number;
  t: number;
  globe: Globe;
  textureUrl: string;
  onPick: (i: number) => void;
  onCustom?: (lat: number, lon: number) => void;
  earthUrl: string;
  dive: number; // increment to fly down to the selected site
  onDived: () => void;
  startClose: boolean; // arriving back from a site: start low and pull out
  chrome?: ReactNode;
  children?: ReactNode;
}

export default function Globe3D({ sites, selected, t, globe, textureUrl, onPick, onCustom, earthUrl, dive, onDived, startClose, chrome, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const api = useRef<Api | null>(null);
  const dived = useRef(onDived); dived.current = onDived;
  const pick = useRef(onPick); pick.current = onPick;
  const custom = useRef(onCustom); custom.current = onCustom;
  const cfg = useSettings();
  const layers: Layers = { grid: cfg.layerGrid, hist: cfg.layerHistorical, cand: cfg.layerCandidates };
  const [vpOpen, setVpOpen] = useState(false);
  const layersRef = useRef(layers); layersRef.current = layers;
  const nHist = sites.filter(isHistorical).length;

  useEffect(() => {
    const el = host.current;
    const lh = labelHost.current;
    if (!el || !lh) return;
    const w = () => el.clientWidth || 800;
    const h = () => el.clientHeight || 500;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelCap()));
    renderer.setSize(w(), h());
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const tmp = new THREE.Vector3();

    // stars
    scene.add(realStars(400, 1.3)); // real stars: Yale Bright Star Catalogue (NASA HEASARC)

    // the Moon: LRO imagery + relief from LOLA elevation
    const mat = new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 1, metalness: 0 });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), mat));
    const loader = new THREE.TextureLoader();
    const useTex = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map?.dispose();
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    };
    loader.load(textureUrl, (tex) => {
      useTex(tex);
      // sharper 8k imagery for close zoom, where the graphics card can take it
      if (renderer.capabilities.maxTextureSize >= 8192) loader.load(textureUrl.replace('moon.jpg', 'moon_8k.jpg'), useTex, undefined, () => undefined);
    });
    loader.load(textureUrl.replace('moon.jpg', 'moon_normal.jpg'), (tex) => { mat.normalMap = tex; mat.normalScale.set(1, 1); mat.needsUpdate = true; });
    const sun = new THREE.DirectionalLight(0xfff6e6, 5.2);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xa9b8d6, 0.42)); // lifts the night side so it stays readable

    // latitude / longitude grid, every 30 degrees; equator and prime meridian brighter
    const gridGroup = new THREE.Group();
    const line = (pts: number[], bright: boolean) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      gridGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: bright ? 0xffffff : 0xbfd4ff, transparent: true, opacity: bright ? 0.5 : 0.22 })));
    };
    for (let la = -60; la <= 60; la += 30) {
      const pts: number[] = [];
      for (let lo = 0; lo <= 360; lo += 2) { ll(la, lo, 1.002, tmp); pts.push(tmp.x, tmp.y, tmp.z); }
      line(pts, la === 0);
    }
    for (let lo = 0; lo < 360; lo += 30) {
      const pts: number[] = [];
      for (let la = -90; la <= 90; la += 2) { ll(la, lo, 1.002, tmp); pts.push(tmp.x, tmp.y, tmp.z); }
      line(pts, lo === 0);
    }
    scene.add(gridGroup);

    // Sun and Earth
    const sunArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.42, 0xffc857, 0.05, 0.02);
    const earthArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.42, 0x4cc9f0, 0.05, 0.02);
    sunArrow.cone.visible = false; // thin direction lines only; the labels say what they are
    earthArrow.cone.visible = false;
    sunArrow.visible = false; earthArrow.visible = false;
    scene.add(sunArrow, earthArrow);
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea8, roughness: 1 });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(2.4, 64, 32), earthMat);
    loader.load(earthUrl, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; earthMat.map = tex; earthMat.color.set(0xffffff); earthMat.needsUpdate = true; });
    scene.add(earth);
    earth.rotation.order = 'ZYX';
    earthMat.roughness = 0.55; earthMat.metalness = 0;
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(2.4 * 1.045, 48, 24), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 n;varying vec3 v;void main(){n=normalize(normalMatrix*normal);vec4 m=modelViewMatrix*vec4(position,1.);v=normalize(-m.xyz);gl_Position=projectionMatrix*m;}',
      fragmentShader: 'varying vec3 n;varying vec3 v;void main(){float f=pow(0.72-dot(n,v),2.6);gl_FragColor=vec4(0.35,0.62,1.0,1.0)*f*1.6;}',
    }));
    earth.add(atmo);
    const gl = new GLTFLoader();
    const fitModel = (g: THREE.Object3D, radius: number) => {
      const bb = new THREE.Box3().setFromObject(g); const sz = bb.getSize(new THREE.Vector3()); const ct = bb.getCenter(new THREE.Vector3());
      const k = (2 * radius) / Math.max(sz.x, sz.y, sz.z);
      g.scale.setScalar(k); g.position.sub(ct.multiplyScalar(k));
    };
    const base = import.meta.env.BASE_URL + 'models/';
    gl.load(base + 'earth.glb', (r) => { // NASA 3D Resources Earth model, when present
      const g = r.scene; fitModel(g, 2.4); earth.add(g); earthMat.visible = false; (earth.material as THREE.Material).visible = false;
    }, undefined, () => {});
    const fc = document.createElement('canvas');
    fc.width = fc.height = 256;
    const fx = fc.getContext('2d');
    if (fx) {
      const gr = fx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,252,240,1)'); gr.addColorStop(0.12, 'rgba(255,240,200,0.95)'); gr.addColorStop(0.3, 'rgba(255,215,140,0.3)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
      fx.fillStyle = gr; fx.fillRect(0, 0, 256, 256);
    }
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(fc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sunSprite.scale.setScalar(12);
    scene.add(sunSprite);
    let sunModel: THREE.Object3D | null = null;
    // Spacecraft on orbit (NASA 3D Resources models)
    const craft: { o: THREE.Object3D; r: number; w: number; inc: number; ph: number }[] = [];
    const addCraft = (o: THREE.Object3D, r: number, w: number, inc: number, ph: number) => { scene.add(o); craft.push({ o, r, w, inc, ph }); };
    gl.load(base + 'lro_a.glb', (r) => { const g = r.scene; fitModel(g, 0.045); const h = new THREE.Group(); h.add(g); addCraft(h, 1.16, 0.9, 1.45, 0); }, undefined, () => {});
    gl.load(base + 'llcd.glb', (r) => { const g = r.scene; fitModel(g, 0.04); const h = new THREE.Group(); h.add(g); addCraft(h, 1.3, 0.55, 0.35, 2); }, undefined, () => {});
    new STLLoader().load(base + 'orion.stl', (geo) => {
      geo.computeVertexNormals(); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: 0.4, roughness: 0.45 }));
      fitModel(m, 0.06); const h = new THREE.Group(); h.add(m); addCraft(h, 1.9, 0.3, 0.9, 4);
    }, undefined, () => {});
    gl.load(base + 'sun.glb', (r) => { // NASA 3D Resources Sun model, when present
      const g = r.scene; fitModel(g, 1.6);
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const om = m.material as THREE.MeshStandardMaterial; m.material = new THREE.MeshBasicMaterial({ map: om.map || om.emissiveMap || null, color: om.map || om.emissiveMap ? new THREE.Color(1.55, 1.38, 1.08) : new THREE.Color(0xffc060), toneMapped: false }); } });
      const holder = new THREE.Group(); holder.add(g); holder.position.copy(sunSprite.position); scene.add(holder); sunModel = holder;
    }, undefined, () => {});

    // site markers: filled discs = historical landings, hollow diamonds = candidate / planned sites
    const pos = sites.map((s) => ll(s.lat, s.lon, 1, new THREE.Vector3()));
    const hist = sites.map(isHistorical);
    const texCache = new Map<string, THREE.CanvasTexture>();
    const markers = sites.map((s, i) => {
      const key = (GROUP_COLOR[s.group] ?? '#ffffff') + hist[i];
      let tx = texCache.get(key);
      if (!tx) { tx = markerTexture(GROUP_COLOR[s.group] ?? '#ffffff', hist[i]); texCache.set(key, tx); }
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, sizeAttenuation: false, transparent: true, depthWrite: false, depthTest: false }));
      m.scale.setScalar(0.03);
      m.position.copy(pos[i]).multiplyScalar(1.006);
      scene.add(m);
      return m;
    });
    // pulsing ring on the selected site
    const rc = document.createElement('canvas');
    rc.width = rc.height = 96;
    const rg = rc.getContext('2d');
    if (rg) { rg.lineWidth = 5; rg.strokeStyle = '#ffffff'; rg.beginPath(); rg.arc(48, 48, 40, 0, 2 * Math.PI); rg.stroke(); }
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(rc), sizeAttenuation: false, transparent: true, depthWrite: false, depthTest: false }));
    scene.add(ring);

    const pulse = { s: 0.035, o: 1 };
    const pulseTw = gsap.fromTo(pulse, { s: 0.035, o: 1 }, { s: 0.11, o: 0, duration: 1.6, ease: 'power2.out', repeat: -1 });
    const btns = sites.map((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.setProperty('--c', GROUP_COLOR[s.group] ?? '#ffffff');
      b.innerHTML = `<i class="pdot"></i><span>${s.name.replace(/[<>&]/g, '')}</span>`;
      b.classList.add(hist[i] ? 'landed' : 'cand');
      b.title = `${s.mission}${hist[i] ? ` · landed ${s.year}` : ' · candidate site'}`;
      b.onclick = () => pick.current(i);
      lh.appendChild(b);
      return b;
    });
    gsap.from(btns, { opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.025, delay: 0.3 });
    const widths = btns.map((b) => b.offsetWidth || b.textContent!.length * 7 + 20);
    const mk = (text: string, cls: string) => {
      const d = document.createElement('span');
      d.className = cls;
      d.textContent = text;
      lh.appendChild(d);
      return d;
    };
    const sunLabel = mk('☀ to the Sun', 'dir sun');
    const earthLabel = mk('🌍 Earth (size exaggerated)', 'dir earth');
    const sunTip = new THREE.Vector3();
    const earthTip = new THREE.Vector3();
    // grid and region labels
    const gridLabels: { node: HTMLElement; p: THREE.Vector3; grid: boolean }[] = [];
    for (let lo = -150; lo <= 180; lo += 30) gridLabels.push({ node: mk(lo === 0 ? '0°' : lo === 180 ? '180°' : `${Math.abs(lo)}°${lo < 0 ? 'W' : 'E'}`, 'gridlab'), p: ll(0, lo, 1.004, new THREE.Vector3()), grid: true });
    for (const lo of [0, 180]) for (const la of [-60, -30, 30, 60]) gridLabels.push({ node: mk(`${Math.abs(la)}°${la < 0 ? 'S' : 'N'}`, 'gridlab'), p: ll(la, lo, 1.004, new THREE.Vector3()), grid: true });
    for (const [text, la, lo] of [['NEAR SIDE · faces Earth', 14, 0], ['FAR SIDE · never sees Earth', 14, 180], ['NORTH POLE', 89.9, 0], ['SOUTH POLE', -89.9, 0]] as [string, number, number][])
      gridLabels.push({ node: mk(text, 'regionlab'), p: ll(la, lo, 1.004, new THREE.Vector3()), grid: false });

    const cam = new THREE.PerspectiveCamera(40, w() / h(), 0.01, 2000);
    const home = new THREE.Vector3();
    let pristine = true; // until the user moves the view, it keeps opening on the lit, Earth-facing side
    const setHome = (tt: number) => {
      const e = ll(globe.earthLat[tt], globe.earthLon[tt], 1, new THREE.Vector3());
      const sdir = ll(globe.sunLat[tt], globe.sunLon[tt], 1, new THREE.Vector3());
      home.copy(e.multiplyScalar(0.6).add(sdir.multiplyScalar(0.4)).normalize()).multiplyScalar(3.6);
    };
    setHome(t);
    cam.position.copy(home);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enablePan = true; // right-drag, or two-finger drag on touch
    controls.enableDamping = true;
    controls.minDistance = 0.12;
    controls.maxDistance = 30;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.9;
    let flyTo: THREE.Vector3 | null = null;
    let flyDist: number | null = null;
    let onArrive: (() => void) | null = null;
    controls.addEventListener('start', () => { pristine = false; if (!onArrive) { flyTo = null; flyDist = null; } });

    let cur = selected;
    let hover = -1;
    let lay = layersRef.current;
    const shown = (i: number) => (hist[i] ? lay.hist : lay.cand) || i === cur;
    const setTime = (tt: number) => {
      setHome(tt);
      if (pristine && !flyTo) cam.position.copy(home);
      ll(globe.sunLat[tt], globe.sunLon[tt], 1, tmp);
      sun.position.copy(tmp).multiplyScalar(50);
      sunArrow.setDirection(tmp.clone());
      sunTip.copy(tmp).multiplyScalar(1.46);
      sunSprite.position.copy(tmp).multiplyScalar(26);
      if (sunModel) { sunModel.position.copy(sunSprite.position); sunModel.rotation.y = tt * 0.004; }
      ll(globe.earthLat[tt], globe.earthLon[tt], 1, tmp);
      earthArrow.setDirection(tmp.clone());
      earth.position.copy(tmp).multiplyScalar(11);
      earth.rotation.z = THREE.MathUtils.degToRad(23.44); // real axial tilt
      earth.rotation.y = (tt / 23.9345) * 2 * Math.PI; // sidereal day: one turn per 23 h 56 m
      earthTip.copy(tmp).multiplyScalar(11);
    };
    const focus = (i: number, fly: boolean) => {
      cur = i;
      btns.forEach((b, k) => b.classList.toggle('sel', k === i));
      const dot = btns[i]?.querySelector('.pdot'); if (dot) gsap.fromTo(dot, { scale: 0.4 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' });
      if (pos[i]) {
        ring.position.copy(pos[i]).multiplyScalar(1.007);
        if (fly) { pristine = false; flyTo = pos[i].clone(); flyDist = Math.min(cam.position.length(), 1.9); }
      }
    };
    const look = (lat: number, lon: number, dist: number) => { pristine = false; flyTo = ll(lat, lon, 1, new THREE.Vector3()); flyDist = dist; };
    setTime(t);
    focus(selected, false);
    if (startClose && pos[selected]) { pristine = false; cam.position.copy(pos[selected]).multiplyScalar(1.3); flyTo = pos[selected].clone(); flyDist = 2.9; }
    const frameEarth = () => {
      const e = earth.position.clone().normalize();
      const s = sunSprite.position.clone().normalize();
      const side = s.clone().addScaledVector(e, -s.dot(e));
      if (side.lengthSq() < 1e-4) side.set(0, 1, 0).cross(e);
      pristine = false;
      flyTo = side.normalize().addScaledVector(e, 0.12).normalize();
      flyDist = 11;
    };
    api.current = {
      setTime, focus, look, frameEarth,
      reset: () => { flyTo = home.clone().normalize(); flyDist = home.length(); },
      dive: () => { if (pos[cur]) { flyTo = pos[cur].clone(); flyDist = 1.27; onArrive = () => dived.current(); } },
      layers: (l) => { lay = l; gridGroup.visible = l.grid; },
    };
    api.current.layers(lay);

    // pointer: hover and click on markers, cursor coordinates, double-click to analyse any point
    const cv = renderer.domElement;
    const v = new THREE.Vector3();
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const nearest = (cx: number, cy: number) => {
      let best = -1, bd = 18 * 18;
      for (let i = 0; i < pos.length; i++) {
        if (!shown(i) || pos[i].dot(cam.position) <= 1.0) continue;
        v.copy(pos[i]).project(cam);
        const dx = (v.x * 0.5 + 0.5) * w() - cx, dy = (-v.y * 0.5 + 0.5) * h() - cy;
        if (dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; }
      }
      return best;
    };
    const surface = (cx: number, cy: number): [number, number] | null => {
      ndc.set((cx / w()) * 2 - 1, -(cy / h()) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const o = ray.ray.origin, d = ray.ray.direction;
      const b = o.dot(d), c = o.lengthSq() - 1, disc = b * b - c;
      if (disc < 0) return null;
      const s = -b - Math.sqrt(disc);
      if (s < 0) return null;
      v.copy(d).multiplyScalar(s).add(o);
      return [(Math.asin(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI, (Math.atan2(-v.z, v.x) * 180) / Math.PI];
    };
    const fmt = (la: number, lo: number) => `${Math.abs(la).toFixed(2)}°${la < 0 ? 'S' : 'N'}  ${Math.abs(lo).toFixed(2)}°${lo < 0 ? 'W' : 'E'}`;
    let downX = 0, downY = 0;
    const local = (e: PointerEvent | MouseEvent): [number, number] => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onMove = (e: PointerEvent) => {
      const [x, y] = local(e);
      hover = nearest(x, y);
      cv.style.cursor = hover >= 0 ? 'pointer' : 'grab';
      const p = surface(x, y);
      if (readout.current) readout.current.textContent = hover >= 0 ? `${sites[hover].name} · ${fmt(sites[hover].lat, ((sites[hover].lon + 540) % 360) - 180)}` : p ? `Cursor ${fmt(p[0], p[1])}` : '';
    };
    const onDown = (e: PointerEvent) => { [downX, downY] = local(e); };
    const onUp = (e: PointerEvent) => {
      const [x, y] = local(e);
      if (Math.hypot(x - downX, y - downY) > 5) return;
      const i = nearest(x, y);
      if (i >= 0) pick.current(i);
    };
    const onDbl = (e: MouseEvent) => {
      const [x, y] = local(e);
      if (nearest(x, y) >= 0) return;
      const p = surface(x, y);
      if (p && custom.current) custom.current(p[0], p[1]);
    };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('dblclick', onDbl);

    const place = (node: HTMLElement, p: THREE.Vector3, show: boolean) => {
      v.copy(p).project(cam);
      if (!show || v.z > 1) { node.style.display = 'none'; return; }
      node.style.display = '';
      node.style.transform = `translate(${((v.x * 0.5 + 0.5) * w()).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h()).toFixed(1)}px)`;
    };
    const origin = new THREE.Vector3();
    let raf = 0;
    let frame = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      frame++;
      { const ts = performance.now() / 1000; for (const c of craft) { const an = ts * c.w * 0.25 + c.ph; c.o.position.set(Math.cos(an) * c.r, Math.sin(an) * c.r * Math.sin(c.inc), Math.sin(an) * c.r * Math.cos(c.inc)); c.o.lookAt(0, 0, 0); } }
      if (flyTo) {
        controls.target.lerp(origin, 0.15);
        const d = cam.position.length();
        const td = flyDist ?? Math.min(d, 2.7);
        v.copy(cam.position).normalize().lerp(flyTo, 0.09).normalize();
        cam.position.copy(v).multiplyScalar(d + (td - d) * 0.09);
        if (v.angleTo(flyTo) < 0.006 && Math.abs(d - td) < 0.02) {
          flyTo = null; flyDist = null;
          controls.target.set(0, 0, 0);
          const cb = onArrive; onArrive = null;
          cb?.();
        }
      }
      controls.target.clampLength(0, 0.95); // panning cannot push the Moon out of reach
      controls.update();
      if (cam.position.length() < 1.12) cam.position.setLength(1.12); // never inside the Moon
      for (let i = 0; i < markers.length; i++) markers[i].visible = shown(i) && pos[i].dot(cam.position) > 1.0;
      ring.visible = !!pos[cur] && pos[cur].dot(cam.position) > 1.0;
      ring.scale.setScalar(pulse.s); (ring.material as THREE.SpriteMaterial).opacity = pulse.o;
      renderer.render(scene, cam);

      const camDist = cam.position.length();
      const boxes: number[][] = [];
      { // UI panels count as occupied space, so labels never sit under the header, tabs, side panel or site info
        const host = lh.getBoundingClientRect(); const st = lh.parentElement;
        st?.querySelectorAll('.brand, .modes, .subtabs, .pickers, .viewpanel, .hud2, .sp-toggle').forEach((el) => {
          const r = (el as HTMLElement).getBoundingClientRect(); if (r.width && r.height) boxes.push([r.left - host.left - 6, r.top - host.top - 6, r.right - host.left + 6, r.bottom - host.top + 6]);
        });
      }
      const ui = boxes.length;
      const order = [cur, hover, ...pos.map((_, i) => i)].filter((i, k, a) => i >= 0 && a.indexOf(i) === k);
      for (const i of order) {
        const facing = pos[i].dot(cam.position) > 1.02 && shown(i);
        v.copy(pos[i]).project(cam);
        const x = (v.x * 0.5 + 0.5) * w() + 12, y = (-v.y * 0.5 + 0.5) * h() - 11;
        if (btns[i].offsetWidth) widths[i] = btns[i].offsetWidth; // live width (fonts / pill style)
        const bw = widths[i], box = [x - 4, y - 4, x + bw + 6, y + 26];
        const clash = boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
        const show = facing && (i === hover || !clash || (i === cur && !boxes.slice(0, ui).some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])));
        if (show) boxes.push(box);
        btns[i].classList.toggle('hov', i === hover);
        place(btns[i], pos[i], show);
      }
      for (const g of gridLabels) place(g.node, g.p, (g.grid ? lay.grid && camDist < 6 : camDist < 8) && g.p.dot(cam.position) > 1.05);
      place(sunLabel, sunTip, true);
      place(earthLabel, earthTip, true);
    };
    loop();
    const ro = new ResizeObserver(() => {
      renderer.setSize(w(), h());
      cam.aspect = w() / h();
      cam.updateProjectionMatrix();
    });
    ro.observe(el);
    return () => {
      pulseTw.kill();
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('dblclick', onDbl);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      lh.replaceChildren();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, textureUrl, globe]);

  useEffect(() => { api.current?.setTime(t); }, [t]);
  const first = useRef(true);
  useEffect(() => { api.current?.focus(selected, !first.current); first.current = false; }, [selected]);
  useEffect(() => { api.current?.layers(layers); }, [layers, sites]);
  const dive0 = useRef(dive); // only a NEW request dives; remounting with an old counter must not
  useEffect(() => { if (dive !== dive0.current) { dive0.current = dive; api.current?.dive(); } }, [dive]);

  void setSettings;
  return (
    <div className="stage">
      <div ref={host} className="gl" />
      <div ref={labelHost} className="glabels" style={cfg.labels ? undefined : { display: 'none' }} />
      {chrome}
      <aside className={`viewpanel${vpOpen ? '' : ' closed'}`} aria-label="Moon view controls">
        <button type="button" className="sp-toggle" onClick={() => setVpOpen((o) => !o)} aria-expanded={vpOpen}>{vpOpen ? 'Hide view controls ✕' : 'View controls ▾'}</button>
        <p>Look at</p>
        <div className="vp-grid">
          <button type="button" onClick={() => api.current?.look(0, 0, 3.2)}>Near side</button>
          <button type="button" onClick={() => api.current?.look(0, 180, 3.2)}>Far side</button>
          <button type="button" onClick={() => api.current?.look(88, 0, 3.2)}>North pole</button>
          <button type="button" onClick={() => api.current?.look(-88, 0, 3.2)}>South pole</button>
          <button type="button" onClick={() => api.current?.frameEarth()}>Earth + Moon</button>
          <button type="button" onClick={() => api.current?.reset()}>Reset view</button>
        </div>
        <p className="vp-key">
          <span><i style={{ background: '#ffc857' }} />Apollo</span>
          <span><i style={{ background: '#7ee0a1' }} />CLPS / commercial</span>
          <span><i style={{ background: '#ff8a80' }} />Other agencies</span>
          <span><i style={{ background: '#4cc9f0' }} />South-pole regions</span>
        </p>
        <p className="vp-help">Drag: rotate · scroll or pinch: zoom · right-drag or two fingers: pan · click a marker: fly there · double-click the surface: analyse that point</p>
      </aside>
      <span ref={readout} className="cursorll" aria-live="off" />
      <div className="hud-bottom">{children}</div>
    </div>
  );
}
