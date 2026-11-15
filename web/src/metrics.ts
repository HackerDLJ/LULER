import type { Common, Manifest, Site } from './data';

/** Per-hour visibility flags for one site under one setting (mast, position offset, antenna minimum). */
export interface HourSeries {
  sunFrac: Float32Array; // visible fraction of the Sun's disc, 0..1
  sunUp: Uint8Array; // Sun's centre above the terrain horizon
  earthUp: Uint8Array; // Earth's centre above max(terrain horizon, 0) + antenna minimum
}

export interface Stats {
  hours: number;
  powerPct: number; // mean visible fraction of the Sun's disc
  sunUpPct: number;
  earthUpPct: number;
  bothPct: number;
  longestDarkH: number;
  longestSunlitH: number;
  longestCommGapH: number;
}

/** Terrain horizon elevation (deg) at an azimuth, linearly interpolated on a periodic profile. */
export function maskAt(hz: Int16Array, base: number, nAz: number, az: number): number {
  const a = ((az % 360) + 360) % 360;
  const x = (a / 360) * nAz;
  const f0 = Math.floor(x);
  const i0 = f0 % nAz;
  const i1 = (i0 + 1) % nAz;
  const f = x - f0;
  return (hz[base + i0] * (1 - f) + hz[base + i1] * f) / 100;
}

/** Visible fraction of a disc of angular radius r whose centre is at c, above a straight horizon at m. */
export function discFraction(c: number, m: number, r: number): number {
  let x = (c - m) / r;
  if (x > 1) x = 1;
  else if (x < -1) x = -1;
  return (Math.acos(-x) + x * Math.sqrt(1 - x * x)) / Math.PI;
}

export function buildSeries(
  site: Site,
  common: Common,
  manifest: Manifest,
  mastIdx: number,
  offIdx: number,
  earthMinEl: number,
): HourSeries {
  const n = manifest.n;
  const nAz = manifest.n_az;
  const base = (mastIdx * manifest.offsets_m.length + offIdx) * nAz;
  const sunFrac = new Float32Array(n);
  const sunUp = new Uint8Array(n);
  const earthUp = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const sm = maskAt(site.hz, base, nAz, site.sunAz[i]);
    sunFrac[i] = discFraction(site.sunEl[i], sm, common.sunR[i]);
    sunUp[i] = site.sunEl[i] > sm ? 1 : 0;
    const em = maskAt(site.hz, base, nAz, site.earthAz[i]);
    earthUp[i] = site.earthEl[i] > Math.max(em, 0) + earthMinEl ? 1 : 0;
  }
  return { sunFrac, sunUp, earthUp };
}

export function windowStats(s: HourSeries, start: number, end: number, dtH = 1): Stats {
  let fracSum = 0;
  let sun = 0;
  let earth = 0;
  let both = 0;
  let darkRun = 0;
  let litRun = 0;
  let gapRun = 0;
  let maxDark = 0;
  let maxLit = 0;
  let maxGap = 0;
  const cnt = end - start;
  for (let i = start; i < end; i++) {
    fracSum += s.sunFrac[i];
    sun += s.sunUp[i];
    earth += s.earthUp[i];
    if (s.sunUp[i] && s.earthUp[i]) both++;
    const dark = s.sunFrac[i] < 0.01;
    darkRun = dark ? darkRun + 1 : 0;
    litRun = dark ? 0 : litRun + 1;
    gapRun = s.earthUp[i] ? 0 : gapRun + 1;
    if (darkRun > maxDark) maxDark = darkRun;
    if (litRun > maxLit) maxLit = litRun;
    if (gapRun > maxGap) maxGap = gapRun;
  }
  const c = Math.max(cnt, 1);
  return {
    hours: cnt * dtH,
    powerPct: (100 * fracSum) / c,
    sunUpPct: (100 * sun) / c,
    earthUpPct: (100 * earth) / c,
    bothPct: (100 * both) / c,
    longestDarkH: maxDark * dtH,
    longestSunlitH: maxLit * dtH,
    longestCommGapH: maxGap * dtH,
  };
}

/** Caches hour series per (site, mast, offset, antenna minimum). */
export class SeriesCache {
  private map = new Map<string, HourSeries>();
  constructor(
    private sites: Site[],
    private common: Common,
    private manifest: Manifest,
  ) {}
  get(siteIdx: number, mastIdx: number, offIdx: number, earthMin: number): HourSeries {
    const key = `${siteIdx}|${mastIdx}|${offIdx}|${earthMin}`;
    let v = this.map.get(key);
    if (!v) {
      v = buildSeries(this.sites[siteIdx], this.common, this.manifest, mastIdx, offIdx, earthMin);
      this.map.set(key, v);
    }
    return v;
  }
}

export interface Range {
  center: number;
  min: number;
  max: number;
}
export type StatKey = Exclude<keyof Stats, 'hours'>;

/** Stats at the site centre plus the min/max across the nine position offsets (centre + 8 on the ring). */
export function statsWithUncertainty(
  cache: SeriesCache,
  manifest: Manifest,
  siteIdx: number,
  mastIdx: number,
  earthMin: number,
  start: number,
  end: number,
): { center: Stats; ranges: Record<StatKey, Range> } {
  const all: Stats[] = [];
  for (let o = 0; o < manifest.offsets_m.length; o++) {
    all.push(windowStats(cache.get(siteIdx, mastIdx, o, earthMin), start, end));
  }
  const keys: StatKey[] = ['powerPct', 'sunUpPct', 'earthUpPct', 'bothPct', 'longestDarkH', 'longestSunlitH', 'longestCommGapH'];
  const ranges = {} as Record<StatKey, Range>;
  for (const k of keys) {
    const vals = all.map((s) => s[k]);
    ranges[k] = { center: all[0][k], min: Math.min(...vals), max: Math.max(...vals) };
  }
  return { center: all[0], ranges };
}

/** Hours until visibility of the Sun (centre) or Earth flips from `now`, scanning up to 45 days ahead; -1 if it does not. */
export function nextChange(
  hz: Int16Array, base: number, nAz: number, el: Float32Array, az: Float32Array,
  t: number, isEarth: boolean, earthMin: number, now: boolean,
): number {
  const lim = Math.min(el.length - 1, t + 45 * 24);
  for (let i = t + 1; i <= lim; i++) {
    const m = maskAt(hz, base, nAz, az[i]);
    const vis = isEarth ? el[i] > Math.max(m, 0) + earthMin : el[i] > m;
    if (vis !== now) return i - t;
  }
  return -1;
}
