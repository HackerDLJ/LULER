import { realStars } from './stars';
import { pixelCap } from './settings';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { Site } from './data';
import { decodeB64 } from './data';
import { FACTS } from './events';

interface Props { site: Site; base: string; chrome?: ReactNode }
type Which = 'lm' | 'lro' | 'llcd' | 'orion' | 'stack';
const MODEL: Record<string, { title: string; credit: string; text: string }> = {
  lm: { title: 'Apollo Lunar Module', credit: 'NASA 3D Resources: Apollo Lunar Module', text: 'The two-stage lander flown on every Apollo landing. The gold descent stage stayed on the Moon; the ascent stage carried the two astronauts back to orbit.' },
  lro: { title: 'Lunar Reconnaissance Orbiter', credit: 'NASA 3D Resources: Lunar Reconnaissance Orbiter', text: 'In lunar orbit since 2009. Its LOLA laser altimeter measured the terrain and its cameras took the imagery that this whole application is built on.' },
};

MODEL.stack = { title: 'Apollo stack: how the spacecraft comes apart', credit: 'Built from NASA Apollo Program drawings, with the NASA Apollo Lunar Module model', text: 'Saturn V (S-IC first stage, S-II second stage, S-IVB third stage and instrument ring) lifts the stack. The S-IVB sends it to the Moon, then the four adapter panels fold open and the Lunar Module is pulled out. The Service Module and Command Module fly on together to orbit the Moon. Slide to take it apart, stage by stage. Drag to rotate.' };
MODEL.llcd = { title: 'Lunar Laser Communications Demonstration (LLCD)', credit: 'NASA 3D Resources: LLCD', text: 'Flown on the LADEE orbiter in 2013, LLCD sent data between the Moon and Earth with laser light instead of radio. It reached 622 megabits per second down and 20 megabits per second up, the first laser link beyond Earth orbit. Optical links like this are why future lunar bases could stream high-definition video home.' };
MODEL.orion = { title: 'Orion crew capsule', credit: 'NASA 3D Resources: Orion Capsule', text: 'The capsule that carries Artemis astronauts to lunar orbit and back. It rides on top of the SLS rocket with a service module for power and propulsion, and returns to Earth at about 40,000 km/h under a heat shield. It does not land on the Moon: a separate lander takes the crew down to the surface.' };
export async function loadGlb(url: string): Promise<THREE.Group> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`model missing (${r.status})`);
  const j = (await r.json()) as { b64: string };
  return new Promise((res, rej) => new GLTFLoader().parse(decodeB64(j.b64), '', (g) => res(g.scene), (e) => rej(e)));
}

export default function Craft({ site, base, chrome }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const hasLm = site.group === 'Apollo';
  const [which, setWhich] = useState<Which>(hasLm ? 'lm' : 'lro');
  const [state, setState] = useState('Loading NASA 3D model…');
  const [exp, setExp] = useState(0);
  const expT = useRef(0);
  const setE = (v: number) => { expT.current = v; setExp(v); };
  useEffect(() => { setWhich(site.group === 'Apollo' ? 'lm' : 'lro'); }, [site.id, site.group]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const w = () => el.clientWidth || 800, h = () => el.clientHeight || 500;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelCap()));
    renderer.setSize(w(), h());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(3 * 1500);
    const tmp = new THREE.Vector3();
    void sp; void tmp; void sg;
    scene.add(realStars(300, 1.1)); // real stars: Yale Bright Star Catalogue (NASA HEASARC)
    const key = new THREE.DirectionalLight(0xfff4e0, 4.2);
    key.position.set(5, 6, 4);
    scene.add(key, new THREE.HemisphereLight(0x9fb4d8, 0x3a332c, 1.1));
    const fill = new THREE.DirectionalLight(0x8fa8d0, 0.9);
    fill.position.set(-6, 2, -3);
    scene.add(fill);
    const cam = new THREE.PerspectiveCamera(38, w() / h(), 0.05, 2000);
    cam.position.set(6.5, 3.2, 7.5);
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    let live = true;
    let stackUpdate: ((u: number) => void) | null = null;
    if (which === 'stack') {
      const grp = new THREE.Group(); scene.add(grp);
      const mat = (c: number, m = 0.15, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, side: THREE.DoubleSide });
      const parts: { o: THREE.Object3D; y0: number; k: number }[] = [];
      const add = (o: THREE.Object3D, y: number, k: number) => { o.position.y = y; grp.add(o); parts.push({ o, y0: y, k }); };
      const cyl = (rt: number, rb: number, h: number, c: number, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
      const G = (...ch: THREE.Object3D[]) => { const g = new THREE.Group(); ch.forEach((c) => g.add(c)); return g; };
      const at = (m: THREE.Object3D, x: number, y: number, z: number) => { m.position.set(x, y, z); return m; };
      { const g = G(at(cyl(1, 1, 5, 0xf4f4f2), 0, 2.5, 0), at(cyl(1.01, 1.01, 0.9, 0x141414), 0, 1.2, 0), at(cyl(1.01, 1.01, 0.9, 0x141414), 0, 3.8, 0));
        for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; const f = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.06), mat(0x202020)); f.position.set(Math.cos(a) * 1.35, 0.75, Math.sin(a) * 1.35); f.rotation.y = -a; g.add(f); }
        for (let i = 0; i < 5; i++) { const a = (i * Math.PI) / 2; const r = i < 4 ? 0.55 : 0; g.add(at(cyl(0.13, 0.3, 0.55, 0x5b6068, 20), Math.cos(a) * r, -0.25, Math.sin(a) * r)); }
        add(g, 0, 0); }
      add(G(at(cyl(1, 1, 3.6, 0xf4f4f2), 0, 1.8, 0), at(cyl(1.01, 1.01, 0.6, 0x141414), 0, 0.5, 0), at(cyl(0.12, 0.34, 0.5, 0x5b6068, 20), 0, -0.25, 0)), 5.1, 1);
      add(G(at(cyl(1, 1, 2, 0xf4f4f2), 0, 1, 0), at(cyl(0.1, 0.32, 0.5, 0x5b6068, 20), 0, -0.25, 0)), 8.7, 2);
      add(at(cyl(1, 1, 0.3, 0x2a2a2a), 0, 0.15, 0), 10.7, 3);
      const panels: { piv: THREE.Group; a: number }[] = [];
      { const sla = new THREE.Group();
        for (let i = 0; i < 4; i++) { const a0 = (i * Math.PI) / 2, am = a0 + Math.PI / 4;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1, 1.5, 16, 1, true, a0, Math.PI / 2), mat(0xe6e5e0, 0.1, 0.6)); m.position.y = 0.75;
          const piv = new THREE.Group(); piv.position.set(Math.sin(am) * 0.95, 0, Math.cos(am) * 0.95); m.position.x = -piv.position.x; m.position.z = -piv.position.z; piv.add(m); sla.add(piv); panels.push({ piv, a: am }); }
        add(sla, 11, 4); }
      const lmHold = new THREE.Group(); add(lmHold, 11.15, 5.2);
      loadGlb(`${base}lm.glb.json`).then((m) => { if (!live) return; const b = new THREE.Box3().setFromObject(m); const sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); const k = 1.25 / Math.max(sz.x, sz.y, sz.z); m.scale.setScalar(k); m.position.set(-c.x * k, -c.y * k + 0.65, -c.z * k); lmHold.add(m); }).catch(() => {});
      add(G(at(cyl(0.6, 0.6, 1.4, 0xcfd3d8), 0, 0.7, 0), at(cyl(0.16, 0.42, 0.65, 0x3a3f46, 24), 0, -0.3, 0)), 12.5, 6.2);
      add(at(cyl(0.15, 0.6, 0.95, 0xd9d5cf, 40), 0, 0.475, 0), 13.9, 7.2);
      add(G(at(cyl(0.05, 0.05, 1.3, 0xe8e8e8, 10), 0, 0.65, 0), at(cyl(0.2, 0.2, 0.7, 0xf0f0ee, 20), 0, 0.35, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 20), mat(0xc83a2e)), 0, 1.0, 0)), 14.85, 8.4);
      stackUpdate = (u) => { for (const p of parts) p.o.position.y = p.y0 + p.k * u * 1.15; for (const pn of panels) { const t = new THREE.Vector3(Math.cos(pn.a), 0, -Math.sin(pn.a)); pn.piv.quaternion.setFromAxisAngle(t, Math.min(1, u * 2.2) * 1.9); } };
      setState(''); cam.position.set(15, 12, 28); controls.target.set(0, 11, 0); controls.minDistance = 6; controls.maxDistance = 90; cam.far = 600; cam.updateProjectionMatrix();
    }
    setState('Loading NASA 3D model…');
    const mp = which === 'stack' ? new Promise<THREE.Object3D>(() => {}) : which === 'llcd' ? new Promise<THREE.Object3D>((res, rej) => new GLTFLoader().load(`${base}llcd.glb`, (g) => res(g.scene), undefined, rej)) : which === 'orion' ? new Promise<THREE.Object3D>((res, rej) => new STLLoader().load(`${base}orion.stl`, (geo) => { geo.computeVertexNormals(); res(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9dde6, metalness: 0.45, roughness: 0.4 }))); }, undefined, rej)) : loadGlb(`${base}${which}.glb.json`);
    mp.then((m) => {
      if (!live) return;
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const k = 5.2 / Math.max(size.x, size.y, size.z);
      m.scale.setScalar(k);
      m.position.set(-c.x * k, -c.y * k + 0.4, -c.z * k);
      scene.add(m);
      setState('');
    }).catch((e) => live && setState(String(e)));
    let raf = 0;
    let ec = 0;
    const loop = () => { raf = requestAnimationFrame(loop); if (stackUpdate) { ec += (expT.current - ec) * 0.06; stackUpdate(ec); } controls.update(); renderer.render(scene, cam); };
    loop();
    const ro = new ResizeObserver(() => { renderer.setSize(w(), h()); cam.aspect = w() / h(); cam.updateProjectionMatrix(); });
    ro.observe(el);
    return () => { live = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement); };
  }, [which, base]);

  const f = FACTS[site.id];
  return (
    <div className="stage">
      <div ref={host} className="gl" />
      {chrome}
      {state && <p className="stage-msg">{state}</p>}
      <div className="hud-bottom">
        <div className="hud2 craft">
          <div className="simctl">
            <button type="button" className={which === 'lm' ? 'on' : ''} onClick={() => setWhich('lm')}>Apollo Lunar Module</button>
            <button type="button" className={which === 'lro' ? 'on' : ''} onClick={() => setWhich('lro')}>Lunar Reconnaissance Orbiter</button>
            <button type="button" className={which === 'llcd' ? 'on' : ''} onClick={() => setWhich('llcd')}>LLCD laser comms</button>
            <button type="button" className={which === 'orion' ? 'on' : ''} onClick={() => setWhich('orion')}>Orion capsule</button>
            <button type="button" className={which === 'stack' ? 'on' : ''} onClick={() => setWhich('stack')}>Apollo stack ▸ disassemble</button>
          </div>
          {which === 'stack' && (<div className="simctl"><button type="button" onClick={() => setE(0)}>Assemble</button><input type="range" min={0} max={1} step={0.01} value={exp} onChange={(e) => setE(+e.target.value)} aria-label="Disassemble" style={{ flex: 1, minWidth: 160 }} /><button type="button" onClick={() => setE(1)}>Disassemble</button></div>)}
          <h2>{which === 'lm' && f && hasLm ? f.craft : MODEL[which].title}</h2>
          <p className="meta">3D model: {MODEL[which].credit} · drag to rotate · scroll to zoom</p>
          <p className="stat"><span>{MODEL[which].text}</span></p>
          {f && (
            <div className="facts">
              <p><b>{site.name}</b> · {f.craft}</p>
              <p>{f.when} · {f.who}</p>
              <p>{f.stay}. {f.note}</p>
              {!hasLm && <p className="muted">NASA's 3D Resources has no model of this spacecraft, so the Landing view uses a generic lander shape for {site.name}.</p>}
            </div>
          )}
          {!f && <p className="muted">{site.name} has no landed mission yet. The Landing view uses a generic lander shape here.</p>}
        </div>
      </div>
    </div>
  );
}
