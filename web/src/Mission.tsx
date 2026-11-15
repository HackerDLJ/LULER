import { getSettings, pixelCap } from './settings';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { decodeB64 } from './data';
import { AnimatedList } from './fx';
import SpecularButton from './rb/SpecularButton.jsx';

interface Props { base: string; chrome?: ReactNode; onLand: () => void }
const END = 94;
const PH: [number, string, string][] = [
  [0, 'Ascent on the Saturn V', 'The first stage (S-IC) burns five F-1 engines, about 3.4 million kg of thrust, and lifts the whole stack toward space.'],
  [10, 'First stage separates', 'The S-IC is empty after about 2.5 minutes. It is dropped and falls into the Atlantic. The second stage (S-II) ignites.'],
  [14, 'Launch escape tower jettisoned', 'Once the rocket is high enough, the escape tower is no longer needed. Its own motor carries it away from the capsule.'],
  [30, 'Second stage separates', 'The S-II has taken the crew almost to orbit. The third stage (S-IVB) takes over with a single J-2 engine.'],
  [38, 'Trans-lunar injection', 'The S-IVB burns again to push the spacecraft out of Earth orbit and onto a path to the Moon at about 10.8 km/s.'],
  [46, 'Spacecraft panels open', 'Four adapter panels swing open and fall away, exposing the Lunar Module. The Command and Service Module (CSM) pulls away.'],
  [50, 'Transposition', 'The CSM turns around 180 degrees, so its nose points at the Lunar Module.'],
  [54, 'Docking', 'The CSM docks nose to nose with the Lunar Module and pulls it out of the empty third stage. The S-IVB is released.'],
  [64, 'Coast to the Moon', 'About three days of free coast. The Moon grows from a dot into a world.'],
  [74, 'Lunar orbit', 'The CSM and Lunar Module orbit the Moon. One astronaut stays aboard the CSM. Two enter the Lunar Module.'],
  [80, 'Lunar Module undocks', 'The Lunar Module separates and drops away. Its descent engine will fire next, which is the landing you can fly.'],
  [88, 'Ready to land', 'Descent burn begins. The landing continues on the real Moon terrain.'],
];
const KEYS: [number, number[], number[]][] = [
  [0, [9, 4, 9], [0, 4, 0]], [9, [8, 3, 8], [0, 3.5, 0]], [11, [9, 1, 8], [0, 2, 0]], [15, [7, 9, 7], [0, 10, 0]],
  [28, [9, 6, 9], [0, 5, 0]], [31, [7, 3, 8], [0, 4, 0]], [40, [8, 5, 8], [0, 6, 0]], [47, [6, 13, 9], [0, 10, 0]],
  [52, [-7, 12, 8], [0, 11, 0]], [57, [-4, 10, 6], [0, 9.6, 0]], [63, [7, 10, 8], [0, 11, 0]], [70, [6, 14, 9], [0, 12, 0]],
  [80, [5, 12, 8], [0, 11, 0]], [88, [-4, 9, 5], [0, 9, 0]], [94, [-3, 7, 5], [0, 7, 0]],
];
const ease = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);

export default function Mission({ base, chrome, onLand }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const tRef = useRef(0); const playRef = useRef(true); const rateRef = useRef(1);
  const [t, setT] = useState(0); const [play, setPlay] = useState(true); const [rate, setRate] = useState(1); const [hold, setHold] = useState(false);
  const holdRef = useRef(false); holdRef.current = hold; const [ready, setReady] = useState(false); const landRef = useRef(onLand); landRef.current = onLand;
  playRef.current = play; rateRef.current = rate;

  useEffect(() => {
    const el = host.current; if (!el) return;
    const W = () => el.clientWidth || 800, H = () => el.clientHeight || 500;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, pixelCap())); renderer.setSize(W(), H()); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000004);
    const cam = new THREE.PerspectiveCamera(40, W() / H(), 0.05, 20000);
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.1); sun.position.set(-30, 12, 40); scene.add(sun);
    scene.add(new THREE.AmbientLight(0x8fa6c8, 0.12), new THREE.HemisphereLight(0x9ec4ff, 0x202030, 0.25));
    const star = (() => { const n = 2500, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); p.set([r * Math.cos(a) * 9000, u * 9000, r * Math.sin(a) * 9000], i * 3); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })); })();
    scene.add(star);
    const tl = new THREE.TextureLoader();
    const planet = (url: string, r: number, atmo?: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 64), new THREE.MeshStandardMaterial({ map: tl.load(import.meta.env.BASE_URL + url), roughness: 1, metalness: 0 }));
      scene.add(m);
      if (atmo) { const a = new THREE.Mesh(new THREE.SphereGeometry(r * 1.025, 64, 48), new THREE.MeshBasicMaterial({ color: atmo, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.add(a); }
      return m;
    };
    const EDIR = new THREE.Vector3(-0.35, -1, -0.45).normalize(), MDIR = new THREE.Vector3(0.45, -0.85, 0.4).normalize();
    const earthG = new THREE.Group(); earthG.rotation.z = 0.41; scene.add(earthG); const earthS = planet('map/earth.jpg', 80, 0x6aa8ff); scene.remove(earthS); earthG.add(earthS);
    new GLTFLoader().load(base + 'earth.glb', (gl) => { const o = gl.scene; const bb = new THREE.Box3().setFromObject(o); const r = bb.getSize(new THREE.Vector3()).length() / (2 * Math.sqrt(3)); o.scale.setScalar(80 / r); o.position.sub(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())); earthS.visible = false; earthG.add(o); }, undefined, () => {});
    const moonM = new THREE.Mesh(new THREE.SphereGeometry(22, 160, 120), new THREE.MeshStandardMaterial({ map: tl.load(import.meta.env.BASE_URL + 'map/moon_8k.jpg'), normalMap: tl.load(import.meta.env.BASE_URL + 'map/moon_normal.jpg'), roughness: 1, metalness: 0 })); scene.add(moonM);
    (moonM.material as any).map.colorSpace = THREE.SRGBColorSpace; (moonM.material as any).map.anisotropy = 8;

    const cyl0 = 0; void cyl0;
    const piece = (cy: number) => { const pv = new THREE.Group(); const inner = new THREE.Group(); inner.position.y = -cy; pv.position.y = cy; pv.add(inner); scene.add(pv); return { pv, inner, cy }; };

    // ---- NASA Saturn V (NASA 3D Resources), split into its real stages by height ----
    const sic = piece(2.5), sii = piece(6.6), siv = piece(9.3), csm = piece(11.5), les = piece(12.4);
    const sla: { g: THREE.Group; inner: THREE.Group; phi: number }[] = [];
    for (let i = 0; i < 4; i++) { const phi = i * Math.PI / 2 + Math.PI / 4; const g = new THREE.Group(); const inner = new THREE.Group(); g.position.set(Math.cos(phi) * 0.46, 10.2, Math.sin(phi) * 0.46); inner.position.set(-Math.cos(phi) * 0.46, -10.2, -Math.sin(phi) * 0.46); g.add(inner); scene.add(g); sla.push({ g, inner, phi }); }
    const CUT: [THREE.Group, number, number][] = [[sic.inner, -9, 4.8], [sii.inner, 4.8, 8.4], [siv.inner, 8.4, 10.2], [csm.inner, 11.0, 12.02], [les.inner, 12.02, 99]];
    new GLTFLoader().load(base + 'saturnv.glb', (gl) => {
      gl.scene.updateMatrixWorld(true);
      gl.scene.traverse((o: any) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.translate(-0.018, 0, -0.74);
        const p = g.attributes.position; const idx = g.index ? Array.from(g.index.array as ArrayLike<number>) : [...Array(p.count).keys()];
        const groups = g.groups.length ? g.groups : [{ start: 0, count: idx.length, materialIndex: 0 }];
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: any) => { m.side = THREE.DoubleSide; if (m.map) m.map.anisotropy = 8; });
        const buckets = new Map<THREE.Group, number[][]>();
        const put = (grp: THREE.Group, mi: number, a: number, b: number, c: number) => { if (!buckets.has(grp)) buckets.set(grp, mats.map(() => [])); buckets.get(grp)![mi].push(a, b, c); };
        for (const gr of groups) for (let k = gr.start; k < gr.start + gr.count; k += 3) {
          const a = idx[k], b = idx[k + 1], c = idx[k + 2];
          const cx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3, cy = (p.getY(a) + p.getY(b) + p.getY(c)) / 3, cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
          const mi = gr.materialIndex ?? 0;
          if (cy >= 10.2 && cy < 11.0) { const q = Math.floor((((Math.atan2(cz, cx)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2)); put(sla[q].inner, mi, a, b, c); continue; }
          const hit = CUT.find(([, lo, hi]) => cy >= lo && cy < hi); if (hit) put(hit[0], mi, a, b, c);
        }
        buckets.forEach((lists, grp) => lists.forEach((l, mi) => { if (!l.length) return; const ng = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) ng.setAttribute(k, g.attributes[k]); ng.setIndex(l); ng.computeBoundingSphere(); grp.add(new THREE.Mesh(ng, mats[mi])); }));
      });
      setReady(true);
    }, undefined, () => setReady(true));

    // exhaust plumes: gradient-textured cones, bloomed
    const plumeTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,236,190,0.95)'); gr.addColorStop(0.45, 'rgba(255,150,60,0.55)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const plume = (r: number, len: number, y: number, tint = 0xffffff) => { const g = new THREE.Group(); [[1, 1, 0.9], [0.55, 0.7, 1]].forEach(([rr, ll, op]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * rr * 0.55, r * rr * 1.6, len * ll, 32, 1, true), new THREE.MeshBasicMaterial({ map: plumeTex, color: tint, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.y = -len * ll / 2; g.add(m); }); g.position.y = y; return g; };
    const sicFl = new THREE.Group(); [[0, 0], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]].forEach(([x, z]) => { const f = plume(0.13, 3.4, -0.12); f.position.x = x; f.position.z = z; sicFl.add(f); }); sic.inner.add(sicFl);
    const siiFl = new THREE.Group(); [[0, 0], [0.26, 0.26], [-0.26, 0.26], [0.26, -0.26], [-0.26, -0.26]].forEach(([x, z]) => { const f = plume(0.09, 1.8, 4.8, 0xcfe4ff); f.position.x = x; f.position.z = z; siiFl.add(f); }); sii.inner.add(siiFl);
    const sivFl = plume(0.12, 1.5, 8.4, 0xcfe4ff); siv.inner.add(sivFl);
    const csmFl = plume(0.07, 0.8, 11.0, 0xbcd8ff); csm.inner.add(csmFl);
    const lesFl = new THREE.Group(); for (let i = 0; i < 4; i++) { const f = plume(0.03, 0.6, 12.35); f.rotation.z = 0.6; f.rotation.y = i * Math.PI / 2; lesFl.add(f); } les.inner.add(lesFl);
    // Apollo LM (NASA model) inside the adapter
    const lm = new THREE.Group(); scene.add(lm);
    fetch(base + 'lm.glb.json').then((r) => r.json()).then((j: { b64: string }) => new GLTFLoader().parseAsync(decodeB64(j.b64) as any, '')).then((gl) => { const o = gl.scene; const bb = new THREE.Box3().setFromObject(o); const sz = bb.getSize(new THREE.Vector3()); o.scale.setScalar(0.72 / Math.max(sz.x, sz.y, sz.z)); const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); o.position.sub(c); lm.add(o); }).catch(() => {});

    const comp = new EffectComposer(renderer); comp.addPass(new RenderPass(scene, cam)); const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.55, 0.45, 0.97); bloom.enabled = getSettings().bloom; comp.addPass(bloom); comp.addPass(new OutputPass());
    // camera path (Catmull-Rom between timed keys)
    const cp = new THREE.CatmullRomCurve3(KEYS.map((k) => v3(k[1]).sub(v3(k[2])).multiplyScalar(2.4).add(v3(k[2]))), false, 'centripetal'); const lp = new THREE.CatmullRomCurve3(KEYS.map((k) => v3(k[2])), false, 'centripetal');
    const kt = KEYS.map((k) => k[0]);
    const u = (t: number) => { let i = 0; while (i < kt.length - 2 && t > kt[i + 1]) i++; const f = ease((t - kt[i]) / (kt[i + 1] - kt[i])); return (i + clamp(f, 0, 1)) / (kt.length - 1); };
    const camPos = v3(KEYS[0][1]), camLook = v3(KEYS[0][2]);

    const fl = (g: THREE.Object3D, on: boolean, k = 1) => { g.visible = on; if (on) g.scale.set(1, k * (0.92 + Math.random() * 0.16), 1); };
    const upd = (t: number, dtc: number) => {
      // S-IC: burns 0-10, then drops and tumbles away
      const d1 = Math.max(0, t - 10); sic.pv.position.set(0, sic.cy - (0.5 * d1 + 0.22 * d1 * d1), 0); sic.pv.rotation.set(0.06 * d1, 0, 0.09 * d1); sic.pv.visible = d1 < 14; fl(sicFl, t < 10, 1 + Math.min(1, t / 6) * 0.5);
      // escape tower: fires its jettison motor at 14
      const d2 = Math.max(0, t - 14); les.pv.position.set(0.4 * d2, les.cy + 0.9 * d2 + 0.55 * d2 * d2, 0); les.pv.rotation.z = -0.35 * d2; les.pv.visible = d2 < 10; fl(lesFl, d2 > 0 && d2 < 2.5);
      // S-II: burns 10.4-30, then drops
      const d3 = Math.max(0, t - 30); sii.pv.position.set(0, sii.cy - (0.35 * d3 + 0.16 * d3 * d3), 0); sii.pv.rotation.set(0.05 * d3, 0, -0.07 * d3); sii.pv.visible = d3 < 14; fl(siiFl, t >= 10.4 && t < 30);
      // S-IVB: burns 30.5-36 (orbit) and 38-45 (TLI), released at 58
      const d4 = Math.max(0, t - 58); siv.pv.position.set(0, siv.cy - (0.3 * d4 + 0.04 * d4 * d4), 0); siv.pv.rotation.set(0.03 * d4, 0, 0.05 * d4); siv.pv.visible = d4 < 24; fl(sivFl, (t >= 30.5 && t < 36) || (t >= 38 && t < 45));
      // adapter panels hinge open at 46 and drift away
      const pa = ease(seg(t, 46, 49)), dr = Math.max(0, t - 49.5);
      sla.forEach(({ g, phi }) => { g.quaternion.setFromAxisAngle(new THREE.Vector3(Math.sin(phi), 0, -Math.cos(phi)), pa * 1.3 + 0.05 * dr); const rr = 0.46 + 0.5 * dr + 0.08 * dr * dr; g.position.set(Math.cos(phi) * rr, 10.2 - 0.25 * dr, Math.sin(phi) * rr); g.visible = dr < 16; });
      // CSM: separates, turns around, docks with the LM, extracts it
      const rise = ease(seg(t, 46.5, 50)), flip = ease(seg(t, 50, 53.6)), back = ease(seg(t, 53.6, 57.2)), pull = ease(seg(t, 58.2, 62));
      const cy = 11.5 + 2.0 * rise - 2.02 * back + 2.6 * pull; csm.pv.position.set(0, cy, 0); csm.pv.rotation.x = Math.PI * flip; csm.pv.visible = true;
      fl(csmFl, (t >= 46.6 && t < 47.6) || (t >= 58.2 && t < 59.2) || (t >= 71 && t < 73));
      // LM: in the adapter, then attached to the CSM nose, undocks at 80
      const und = Math.max(0, t - 80); const lmY = t < 57.2 ? 10.6 : cy - 0.88;
      lm.position.set(0.06 * und, lmY - (0.3 * und + 0.05 * und * und), 0); lm.rotation.set(0, 0.2 * und, 0.025 * und);
      // Earth falls behind, Moon grows
      const eD = 95 + ease(seg(t, 40, 70)) * 6000; earthG.position.copy(EDIR).multiplyScalar(eD); earthG.rotation.y = 1.2 + t * 0.01; earthG.visible = eD < 6000;
      const mD = 7000 - ease(seg(t, 44, 76)) * (7000 - 42); moonM.position.copy(MDIR).multiplyScalar(mD).add(new THREE.Vector3(0, 6, 0)); moonM.rotation.y = 2.4 + t * 0.004;
      // camera follows one continuous eased path; light shake during the first-stage burn
      const uu = u(t); const kk = 1 - Math.exp(-dtc * 4); camPos.lerp(cp.getPoint(uu), kk); camLook.lerp(lp.getPoint(uu), kk);
      const sh = t < 10 ? 0.012 * (1 - t / 10) : 0; cam.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0)); cam.lookAt(camLook);
    };
    upd(0, 1);
    const clock = new THREE.Clock(); let raf = 0, lastSet = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta());
      if (playRef.current) {
        const before = tRef.current; tRef.current = Math.min(END, before + dt * rateRef.current);
        if (holdRef.current) { const hit = PH.find((p) => p[0] > before && p[0] <= tRef.current); if (hit) { tRef.current = hit[0]; setPlay(false); } }
        if (tRef.current >= END) { setPlay(false); landRef.current(); }
      }
      upd(tRef.current, dt);
      const now = performance.now(); if (now - lastSet > 120) { lastSet = now; setT(tRef.current); }
      comp.render();
    };
    (window as any).__mission = { set: (v: number) => { tRef.current = v; }, step: (v: number) => { upd(v, 1); comp.render(); } };
    loop();
    const rs = () => { renderer.setSize(W(), H()); comp.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }; window.addEventListener('resize', rs);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', rs); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, [base]);

  const seek = (v: number) => { tRef.current = v; setT(v); };
  let pi = 0; PH.forEach((p, i) => { if (t >= p[0]) pi = i; });
  const T = `T+ ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  return (
    <div className="stage">
      <div ref={host} className="gl" />
      {chrome}
      {!ready && <p className="stage-msg">Loading NASA Saturn V…</p>}
      <aside className="mission-feed"><p className="meta">EVENT LOG</p><AnimatedList max={5} items={PH.filter((p) => t >= p[0]).map((p, i) => ({ id: p[1], title: p[1], sub: `T+ ${String(Math.floor(p[0] / 60)).padStart(2, '0')}:${String(Math.floor(p[0] % 60)).padStart(2, '0')}`, tone: (i === 0 ? 'info' : /separat|jettison|undock|panels/i.test(p[1]) ? 'warn' : 'ok') as 'ok' | 'warn' | 'info' }))} /></aside>
      <div className="hud-bottom">
        <div className="hud2 mission">
          <p className="meta">SIMPLIFIED SCHEMATIC OF AN APOLLO MISSION · {T} (compressed time)</p>
          <h2>{PH[pi][1]}</h2>
          <p className="stat"><span>{PH[pi][2]}</span></p>
          <div className="simctl stages">
            {PH.map((p, i) => (<button key={p[1]} type="button" className={i === pi ? 'on' : ''} onClick={() => { seek(p[0] + 0.01); }}>{i + 1}. {p[1]}</button>))}
            <button type="button" onClick={onLand}>{PH.length + 1}. Powered descent ▸</button><button type="button" onClick={onLand}>{PH.length + 2}. Touchdown ▸</button>
          </div>
          <div className="simctl">
            <button type="button" onClick={() => seek(PH[Math.max(0, pi - (t - PH[pi][0] > 1.5 ? 0 : 1))][0] + 0.01)}>⏮ Prev stage</button>
            <button type="button" onClick={() => { if (t >= END) seek(0); setPlay(!play); }}>{play ? '❚❚ Pause' : t >= END ? '↺ Replay' : '▶ Play'}</button>
            <input type="range" min={0} max={END} step={0.1} value={t} onChange={(e) => seek(+e.target.value)} aria-label="Mission timeline" />
            <button type="button" onClick={() => seek(PH[Math.min(PH.length - 1, pi + 1)][0] + 0.01)}>Next stage ⏭</button>
            <label className="hold"><input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> Pause at each stage</label>
            <select value={rate} onChange={(e) => setRate(+e.target.value)} aria-label="Speed"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select>
            <SpecularButton onClick={onLand} size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.4} glow={1} proximity={220} className="cta-spec">Continue to the landing ▸</SpecularButton>
          </div>
        </div>
      </div>
    </div>
  );
}
