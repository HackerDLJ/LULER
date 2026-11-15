/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only token limited to the "Cesium Moon terrain" asset (Cesium ion asset 2684829).
export const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkxFSzhMTmdLWG1iczVDX2UiLCJqdGkiOiI2ZTgzNjk1MS00YThhLTQ3MDEtOGI3Ny1lMzJkMzdlYzAzMjEiLCJpZCI6NTQ5MjE2LCJzdWIiOiJsdWtlamViYXN1bmRhciIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiJDZXNpdW0gTW9vbiB0ZXJyYWluIiwiaWF0IjoxNzk0Njg5Mzk2fQ.VJbh1Pw54d2nzHq4bIuojJ4Mu9rc5RktsLmzt1RBRHs';
export const MOON_ASSET = 2684829;
const CDN = 'https://cesium.com/downloads/cesiumjs/releases/1.130/Build/Cesium/';

let p: Promise<any> | null = null;
export function loadCesium(): Promise<any> {
  const w = window as any;
  if (w.Cesium) return Promise.resolve(w.Cesium);
  if (p) return p;
  p = new Promise((res, rej) => {
    w.CESIUM_BASE_URL = CDN;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CDN + 'Widgets/widgets.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = CDN + 'Cesium.js'; s.onload = () => res(w.Cesium);
    s.onerror = () => { p = null; rej(new Error('Cesium could not be loaded (internet needed)')); };
    document.head.appendChild(s);
  });
  return p;
}

const NOISE = `
float hh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float nn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
export const NATURAL = NOISE + `
float crat(vec3 p){vec3 i=floor(p),f=fract(p);float h=fract(sin(dot(i,vec3(12.9898,78.233,37.719)))*43758.5453);
 vec3 c=vec3(fract(h*7.13),fract(h*3.71),fract(h*5.29))*0.6+0.2;float r=length(f-c)/(0.12+0.25*fract(h*9.1));
 return h>0.55?(r<1.0?(r*r-1.0)*0.6:exp(-(r-1.0)*6.0)*0.25*step(r,1.6)):0.0;}
float hgt(vec3 p,float lod){
 float h=0.0;
 h+=0.9*nn(p*0.05)+0.5*nn(p*0.21);
 h+=mix(0.0,0.35*crat(p*0.12)+0.22*crat(p*0.47),smoothstep(30.0,4.0,lod));
 h+=mix(0.0,0.10*crat(p*0.9),smoothstep(4.0,0.8,lod));
 return h;}
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){
 vec3 pe = fsInput.attributes.positionEC;
 vec3 p = u_cam + czm_inverseViewRotation * pe;
 vec3 dpx = dFdx(pe), dpy = dFdy(pe);
 vec3 N = normalize(cross(dpx, dpy)); if (dot(N, -pe) < 0.0) N = -N; // normal of the real NASA terrain mesh only
 vec3 Nb = N;
 vec3 upEC = normalize((czm_view * vec4(normalize(fsInput.attributes.positionWC), 0.0)).xyz);
 vec3 L = czm_lightDirectionEC;
 float sinEl = max(dot(upEC, L), 0.06);
 float d = max(dot(Nb, L), 0.0);
 float sun = smoothstep(-0.02, 0.04, dot(upEC, L));
 float lit = 0.04 + sun * 1.45 * d / sinEl;
 vec3 c = pow(material.diffuse * 3.0, vec3(1.1)); // real LRO imagery colour, no procedural detail
 float near = smoothstep(900.0, 120.0, length(pe));
 material.diffuse = c * mix(1.0, lit, near);
}`;
export const SLOPE = `
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){
 vec3 pe = fsInput.attributes.positionEC;
 vec3 nEC = normalize(cross(dFdx(pe), dFdy(pe)));
 vec3 nWC = normalize(czm_inverseViewRotation * nEC);
 vec3 up = normalize(fsInput.attributes.positionWC);
 float s = degrees(acos(clamp(abs(dot(nWC, up)), 0.0, 1.0)));
 vec3 col = s < 5.0 ? vec3(0.25,0.75,0.43) : s < 10.0 ? vec3(0.93,0.83,0.3) : s < 15.0 ? vec3(0.96,0.55,0.2) : s < 20.0 ? vec3(0.9,0.25,0.2) : vec3(0.62,0.12,0.42);
 material.diffuse = mix(material.diffuse * 1.6, col, 0.78);
}`;
export const ELEV = `
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){
 float h = length(fsInput.attributes.positionWC) - 1737400.0;
 float t = clamp((h - u_lo) / max(1.0, u_hi - u_lo), 0.0, 1.0);
 vec3 a = vec3(0.1,0.25,0.6), b = vec3(0.35,0.8,0.35), c = vec3(1.0);
 vec3 col = t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
 material.diffuse = mix(material.diffuse * 1.4, col, 0.8);
}`;

export const HAZARD = `
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){
 vec3 pe = fsInput.attributes.positionEC;
 vec3 nEC = normalize(cross(dFdx(pe), dFdy(pe)));
 vec3 nWC = normalize(czm_inverseViewRotation * nEC);
 vec3 up = normalize(fsInput.attributes.positionWC);
 float s = degrees(acos(clamp(abs(dot(nWC, up)), 0.0, 1.0)));
 vec3 base = pow(material.diffuse * 3.0, vec3(1.1));
 vec3 col = base;
 if (s >= 10.0) col = mix(base, vec3(0.95, 0.18, 0.22), 0.72);
 else if (s >= 5.0) col = mix(base, vec3(0.98, 0.86, 0.25), 0.42);
 else if (s < 3.0) col = mix(base, vec3(0.2, 0.85, 0.5), 0.22);
 material.diffuse = col;
}`;
