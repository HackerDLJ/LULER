/** Sun/Earth geometry and a coarse terrain horizon for ANY lunar coordinate, computed in the browser.
 * Sun and Earth directions come from the hourly sub-solar and sub-Earth points (NASA SPICE, precomputed);
 * Earth's direction is corrected for the observer's position on the Moon (parallax).
 * Terrain: NASA LOLA global grid averaged to 8 px/deg (about 3.8 km), so only large-scale relief is captured. */
import type { Common, Globe, Manifest, Site } from './data';

export interface Dem8 { w: number; h: number; d: Int16Array }
const R = 1737.4;
const RE = 6371.0;
const D2R = Math.PI / 180;

export function hAt(dem: Dem8, lat: number, lon: number): number {
  const ppd = dem.w / 360;
  const x = ((((lon % 360) + 360) % 360) * ppd - 0.5 + dem.w) % dem.w;
  const y = Math.min(Math.max((90 - lat) * ppd - 0.5, 0), dem.h - 1.001);
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, x1 = (x0 + 1) % dem.w;
  const d = dem.d, w = dem.w;
  return (d[y0 * w + x0] * (1 - fx) + d[y0 * w + x1] * fx) * (1 - fy) + (d[(y0 + 1) * w + x0] * (1 - fx) + d[(y0 + 1) * w + x1] * fx) * fy;
}

/** Point reached from (lat, lon) going `distKm` along azimuth `azDeg` (great circle). */
export function dest(lat: number, lon: number, azDeg: number, distKm: number): [number, number] {
  const p = lat * D2R, l = lon * D2R, a = azDeg * D2R, dd = distKm / R;
  const s2 = Math.sin(p) * Math.cos(dd) + Math.cos(p) * Math.sin(dd) * Math.cos(a);
  const p2 = Math.asin(Math.min(1, Math.max(-1, s2)));
  const l2 = l + Math.atan2(Math.sin(a) * Math.sin(dd) * Math.cos(p), Math.cos(dd) - Math.sin(p) * s2);
  return [p2 / D2R, l2 / D2R];
}

export function horizonCoarse(dem: Dem8, lat: number, lon: number, nAz: number, mastM: number): Float32Array {
  const out = new Float32Array(nAz);
  const r0 = R + (hAt(dem, lat, lon) + mastM) / 1000;
  for (let k = 0; k < nAz; k++) {
    let best = -90;
    for (let dk = 2; dk <= 400; dk += Math.max(2, dk * 0.03)) {
      const [la, lo] = dest(lat, lon, (360 * k) / nAz, dk);
      const r2 = R + hAt(dem, la, lo) / 1000, dd = dk / R;
      const e = Math.atan2(r2 * Math.cos(dd) - r0, r2 * Math.sin(dd)) / D2R;
      if (e > best) best = e;
    }
    out[k] = best;
  }
  return out;
}

export function skyAt(lat: number, lon: number, heightM: number, globe: Globe, common: Common) {
  const n = globe.sunLon.length;
  const sunAz = new Float32Array(n), sunEl = new Float32Array(n), earthAz = new Float32Array(n), earthEl = new Float32Array(n);
  const p = lat * D2R, l = lon * D2R;
  const u = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  const e = [-Math.sin(l), Math.cos(l), 0];
  const nn = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  const rs = R + heightM / 1000;
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let i = 0; i < n; i++) {
    let a = globe.sunLat[i] * D2R, b = globe.sunLon[i] * D2R;
    const s = [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
    sunEl[i] = Math.asin(Math.max(-1, Math.min(1, dot(s, u)))) / D2R;
    sunAz[i] = ((Math.atan2(dot(s, e), dot(s, nn)) / D2R) + 360) % 360;
    a = globe.earthLat[i] * D2R; b = globe.earthLon[i] * D2R;
    const dist = RE / Math.sin(common.earthR[i] * D2R);
    const v = [dist * Math.cos(a) * Math.cos(b) - rs * u[0], dist * Math.cos(a) * Math.sin(b) - rs * u[1], dist * Math.sin(a) - rs * u[2]];
    const vl = Math.hypot(v[0], v[1], v[2]);
    earthEl[i] = Math.asin(Math.max(-1, Math.min(1, dot(v, u) / vl))) / D2R;
    earthAz[i] = ((Math.atan2(dot(v, e), dot(v, nn)) / D2R) + 360) % 360;
  }
  return { sunAz, sunEl, earthAz, earthEl };
}

export function buildCustomSite(lat: number, lonIn: number, globe: Globe, common: Common, manifest: Manifest, dem: Dem8): Site {
  const lon = ((lonIn + 540) % 360) - 180;
  const heightM = hAt(dem, lat, lon);
  const nAz = manifest.n_az, nM = manifest.masts_m.length, nO = manifest.offsets_m.length;
  const hz = new Int16Array(nM * nO * nAz);
  manifest.masts_m.forEach((m, mi) => {
    const prof = horizonCoarse(dem, lat, lon, nAz, m);
    for (let o = 0; o < nO; o++) for (let k = 0; k < nAz; k++) hz[(mi * nO + o) * nAz + k] = Math.round(prof[k] * 100);
  });
  const n = 129, half = 60;
  const h = new Int16Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const ee = (c / (n - 1) - 0.5) * 2 * half, no = (0.5 - r / (n - 1)) * 2 * half;
    const [la, lo] = dest(lat, lon, Math.atan2(ee, no) / D2R, Math.hypot(ee, no));
    h[r * n + c] = Math.round(hAt(dem, la, lo));
  }
  const sp = (360 / dem.w) * D2R * R * 1000; // grid spacing in metres at the equator
  const hN = hAt(dem, ...dest(lat, lon, 0, sp / 1000)), hS = hAt(dem, ...dest(lat, lon, 180, sp / 1000));
  const hE = hAt(dem, ...dest(lat, lon, 90, sp / 1000)), hW = hAt(dem, ...dest(lat, lon, 270, sp / 1000));
  const slope = Math.atan(Math.hypot((hE - hW) / (2 * sp), (hN - hS) / (2 * sp))) / D2R;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < h.length; i++) { lo = Math.min(lo, h[i]); hi = Math.max(hi, h[i]); }
  let mx = -90;
  for (let k = 0; k < nAz; k++) mx = Math.max(mx, hz[k] / 100);
  return {
    id: 'custom', name: `Custom point ${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`,
    lat, lon, heightM, maxHorizonDeg: mx, provisional: false, group: 'Your coordinates', mission: 'Custom coordinates', year: null,
    accuracy: 'LRO-refined', terrain: 'LOLA global, coarse 3.8 km grid',
    ...skyAt(lat, lon, heightM + 2, globe, common), hz, demInline: { n, pxKm: (2 * half) / (n - 1), h },
    info: {
      elev_m: Math.round(heightM), slope_deg: Math.round(slope * 100) / 100, slope_baseline_m: Math.round(2 * sp), slope_mean_deg: NaN, slope_max_deg: NaN,
      relief_m: Math.round(hi - lo), area_km: 2 * half, source: 'NASA LRO LOLA global grid LDEM_64, averaged to 8 px/deg', resolution_m: Math.round(sp), mesh: '3D mesh: 120 km square at 938 m spacing (interpolated from the 3.8 km grid)',
    },
  };
}
