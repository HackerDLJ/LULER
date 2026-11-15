import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Site } from './data';
import { decodeB64 } from './data';

// Read-only token limited to the "Cesium Moon terrain" asset (Cesium ion asset 2684829).
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkxFSzhMTmdLWG1iczVDX2UiLCJqdGkiOiI2ZTgzNjk1MS00YThhLTQ3MDEtOGI3Ny1lMzJkMzdlYzAzMjEiLCJpZCI6NTQ5MjE2LCJzdWIiOiJsdWtlamViYXN1bmRhciIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiJDZXNpdW0gTW9vbiB0ZXJyYWluIiwiaWF0IjoxNzk0Njg5Mzk2fQ.VJbh1Pw54d2nzHq4bIuojJ4Mu9rc5RktsLmzt1RBRHs';
const VER = '1.130';
const CDN = `https://cesium.com/downloads/cesiumjs/releases/${VER}/Build/Cesium/`;
const MOON_ASSET = 2684829;
const SHADER = `
float hh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float nn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){
 vec3 p = fsInput.attributes.positionMC;
 float v = 0.45*nn(p*0.06) + 0.3*nn(p*0.4) + 0.25*nn(p*2.3);
 float rocks = smoothstep(0.78, 0.9, nn(p*1.1)) * 0.6;
 vec3 c = pow(material.diffuse * 3.4, vec3(0.9));
 material.diffuse = c * (0.55 + 0.9 * v) * (1.0 - rocks * 0.5) + vec3(rocks * 0.12);
}`;


/* eslint-disable @typescript-eslint/no-explicit-any */
function loadCesium(): Promise<any> {
  const w = window as any;
  if (w.Cesium) return Promise.resolve(w.Cesium);
  return new Promise((res, rej) => {
    w.CESIUM_BASE_URL = CDN;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CDN + 'Widgets/widgets.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = CDN + 'Cesium.js'; s.onload = () => res(w.Cesium); s.onerror = () => rej(new Error('Cesium could not be loaded (internet needed)'));
    document.head.appendChild(s);
  });
}

interface Props { site: Site; chrome?: ReactNode }
const SHOTS: [string, number, number, number][] = [
  // label, height above ground (m), pitch (deg), range (m)
  ['High orbit pass', 30000, -35, 60000],
  ['Approach', 4000, -22, 9000],
  ['Low pass', 600, -14, 1500],
  ['Touchdown', 60, -9, 20],
];

export default function CesiumMoon({ site, chrome }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ go: (i: number) => void; orbit: (on: boolean) => void; land: () => void } | null>(null);
  const [state, setState] = useState('Loading Cesium Moon terrain…');
  const [spin, setSpin] = useState(false);
  const [shot, setShot] = useState(1);

  useEffect(() => {
    let dead = false; let viewer: any = null; let timer = 0;
    loadCesium().then(async (C) => {
      if (dead || !host.current) return;
      C.Ion.defaultAccessToken = TOKEN;
      C.Ellipsoid.default = C.Ellipsoid.MOON;
      viewer = new C.Viewer(host.current, {
        baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        animation: false, timeline: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, requestRenderMode: false, shadows: false,
      });
      (window as any).__cv = viewer; viewer.shadows = true; viewer.shadowMap.softShadows = true; viewer.shadowMap.size = 4096; viewer.shadowMap.darkness = 0.04; viewer.shadowMap.maximumDistance = 9000; Object.assign(viewer.shadowMap._primitiveBias, { normalOffsetScale: 30, depthBias: 0.002, polygonOffsetFactor: 4, polygonOffsetUnits: 8 });  const sc = viewer.scene;
      if (sc.globe) sc.globe.show = false; if (sc.skyAtmosphere) sc.skyAtmosphere.show = false; if (sc.fog) sc.fog.enabled = false; sc.backgroundColor = C.Color.BLACK;
      sc.highDynamicRange = false; sc.postProcessStages.fxaa.enabled = true;
      viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
      sc.light = new C.DirectionalLight({ direction: new C.Cartesian3(0.7, -0.45, -0.55), intensity: 10 });
      (viewer._cesiumWidget._creditContainer as HTMLElement).style.display = 'none';
      try {
        const ts = await C.Cesium3DTileset.fromIonAssetId(MOON_ASSET, { maximumScreenSpaceError: 4 });
        if (dead) return;
        ts.customShader = new C.CustomShader({ lightingModel: C.LightingModel.UNLIT, fragmentShaderText: SHADER });
        ts.imageBasedLighting.imageBasedLightingFactor = new C.Cartesian2(0.05, 0.05); ts.shadows = C.ShadowMode.ENABLED;
        sc.primitives.add(ts);
      } catch (e) { setState('Cesium Moon terrain could not load: ' + String(e)); return; }
      let gh = 0;
      try { const hs = await sc.sampleHeightMostDetailed([C.Cartographic.fromDegrees(site.lon, site.lat)]); if (Number.isFinite(hs[0]?.height)) gh = hs[0].height; } catch { /* keep 0 */ }
      const target = C.Cartesian3.fromDegrees(site.lon, site.lat, gh);
      const up = C.Ellipsoid.default.geodeticSurfaceNormal(target, new C.Cartesian3());
      let lm: any = null, lk = 1;
      try {
        const j = (await (await fetch(import.meta.env.BASE_URL + 'models/lm.glb.json')).json()) as { b64: string };
        const url = URL.createObjectURL(new Blob([decodeB64(j.b64)], { type: 'model/gltf-binary' }));
        lm = await C.Model.fromGltfAsync({ url, modelMatrix: C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.add(target, C.Cartesian3.multiplyByScalar(C.Ellipsoid.default.geodeticSurfaceNormal(target, new C.Cartesian3()), 1.9, new C.Cartesian3()), new C.Cartesian3())), scale: 1, shadows: C.ShadowMode.DISABLED });
        sc.primitives.add(lm);
        lm.readyEvent.addEventListener(() => { lk = 4.4 / lm.boundingSphere.radius; lm.scale = lk; });
        if (lm.ready) { lk = 4.4 / lm.boundingSphere.radius; lm.scale = lk; }
      } catch { lm = null; }
      const dc = document.createElement('canvas'); dc.width = dc.height = 64; { const g = dc.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(210,205,195,0.9)'); gr.addColorStop(1, 'rgba(210,205,195,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
      const dust = sc.primitives.add(new C.ParticleSystem({ image: dc, startColor: C.Color.fromAlpha(C.Color.fromCssColorString('#cfc8bb'), 0.55), endColor: C.Color.fromAlpha(C.Color.fromCssColorString('#cfc8bb'), 0), startScale: 3, endScale: 16, minimumParticleLife: 1.5, maximumParticleLife: 4, minimumSpeed: 5, maximumSpeed: 22, imageSize: new C.Cartesian2(5, 5), emissionRate: 90, emitter: new C.CircleEmitter(2.5), modelMatrix: C.Transforms.eastNorthUpToFixedFrame(target), lifetime: Number.MAX_VALUE, show: false }));
      { const enu = C.Transforms.eastNorthUpToFixedFrame(target); const el = C.Math.toRadians(16); const d = C.Matrix4.multiplyByPointAsVector(enu, new C.Cartesian3(-Math.cos(el), -0.15, -Math.sin(el)), new C.Cartesian3()); sc.light = new C.DirectionalLight({ direction: C.Cartesian3.normalize(d, d), intensity: 6 }); }
      const look = (i: number, dur: number) => {
        const [, , pitch, range] = SHOTS[i];
        viewer.camera.flyToBoundingSphere(new C.BoundingSphere(target, 1), { duration: dur, offset: new C.HeadingPitchRange(C.Math.toRadians(20), C.Math.toRadians(pitch), range) });
      };
      look(1, 0);
      let hd = 20;
      let landTimer = 0;
      const land = () => {
        window.clearInterval(timer); window.clearInterval(landTimer);
        const ctl = sc.screenSpaceCameraController; ctl.enableInputs = false;
        const T = 34000, t0 = performance.now(); let hd0 = 20;
        const pos = new C.Cartesian3();
        landTimer = window.setInterval(() => {
          const u = Math.min(1, (performance.now() - t0) / T);
          const hover = u < 0.78 ? 140 * Math.pow(1 - u / 0.78, 1.6) + 4 : Math.max(0, 4 * (1 - (u - 0.78) / 0.16));
          if (lm) { C.Cartesian3.multiplyByScalar(up, hover, pos); C.Cartesian3.add(target, pos, pos); lm.modelMatrix = C.Transforms.eastNorthUpToFixedFrame(pos); lm.scale = lk; }
          dust.show = u > 0.55; dust.emissionRate = u < 0.94 ? 40 + 260 * Math.max(0, 1 - hover / 60) : Math.max(0, 90 * (1 - (u - 0.94) / 0.06));
          const e = Math.pow(1 - Math.min(1, u / 0.92), 2.4);
          const range = u < 0.92 ? 18 + 7000 * e : 18 + 60 * ((u - 0.92) / 0.08);
          const pitch = u < 0.92 ? -(8 + 26 * e) : -8 - 6 * ((u - 0.92) / 0.08);
          hd0 += u < 0.92 ? 0.22 + 0.5 * e : 0.45;
          C.Cartesian3.multiplyByScalar(up, Math.max(2, hover * 0.6 + 3), pos); C.Cartesian3.add(target, pos, pos);
          viewer.camera.lookAt(u < 0.92 ? pos : target, new C.HeadingPitchRange(C.Math.toRadians(hd0), C.Math.toRadians(pitch), range));
          if (u >= 1) { window.clearInterval(landTimer); viewer.camera.lookAtTransform(C.Matrix4.IDENTITY); ctl.enableInputs = true; }
        }, 33);
      };
      api.current = {
        land,
        go: (i) => look(i, 5),
        orbit: (on) => { window.clearInterval(timer); if (on) timer = window.setInterval(() => { hd += 0.35; viewer.camera.lookAt(target, new C.HeadingPitchRange(C.Math.toRadians(hd), viewer.camera.pitch, viewer.camera.positionCartographic ? C.Cartesian3.distance(viewer.camera.position, target) : 1500)); }, 33); else viewer.camera.lookAtTransform(C.Matrix4.IDENTITY); },
      };
      setState('');
    }).catch((e) => !dead && setState(String(e?.message || e)));
    return () => { dead = true; window.clearInterval(timer); api.current = null; try { viewer?.destroy(); } catch { /* ignore */ } };
  }, [site.id, site.lat, site.lon]);

  return (
    <div className="stage">
      <div ref={host} className="gl cesium-host" />
      {chrome}
      {state && <p className="stage-msg">{state}</p>}
      <div className="hud-bottom">
        <div className="hud2 craft">
          <div className="simctl">
            {SHOTS.map(([l], i) => (<button key={l} type="button" className={shot === i ? 'on' : ''} onClick={() => { setShot(i); api.current?.go(i); }}>{l}</button>))}
            <button type="button" onClick={() => api.current?.land()}>▶ Cinematic landing</button>
            <button type="button" className={spin ? 'on' : ''} onClick={() => { setSpin(!spin); api.current?.orbit(!spin); }}>{spin ? 'Stop orbit' : 'Orbit slowly'}</button>
          </div>
          <h2>{site.name}</h2>
          <p className="meta">Cesium Moon Terrain (built from NASA LRO LOLA / LROC data) · {site.lat.toFixed(2)}°, {site.lon.toFixed(2)}° · drag to look, scroll to zoom</p>
        </div>
      </div>
    </div>
  );
}
