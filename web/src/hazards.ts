/* Terrain hazard analysis on a regular height grid (metres), rows = north, cols = east, centred on the site.
   Used for crater detection, slope hazards and lander hazard-avoidance (divert to the nearest safe spot). */

export interface Grid { n: number; d: number; h: Float32Array } // n x n samples, spacing d metres, h[row*n+col]
export interface Crater { e: number; n: number; r: number; depth: number }
export interface HazardMap { grid: Grid; slope: Float32Array; craters: Crater[] }

const idx = (g: Grid, r: number, c: number) => r * g.n + c;
export const toCell = (g: Grid, e: number, n: number) => ({ c: e / g.d + (g.n - 1) / 2, r: n / g.d + (g.n - 1) / 2 });

export function heightAt(g: Grid, e: number, n: number): number {
  const { c, r } = toCell(g, e, n);
  const c0 = Math.max(0, Math.min(g.n - 2, Math.floor(c))), r0 = Math.max(0, Math.min(g.n - 2, Math.floor(r)));
  const a = Math.max(0, Math.min(1, c - c0)), b = Math.max(0, Math.min(1, r - r0)), h = g.h;
  return (h[idx(g, r0, c0)] * (1 - a) + h[idx(g, r0, c0 + 1)] * a) * (1 - b) + (h[idx(g, r0 + 1, c0)] * (1 - a) + h[idx(g, r0 + 1, c0 + 1)] * a) * b;
}

function slopeGrid(g: Grid): Float32Array {
  const s = new Float32Array(g.n * g.n);
  for (let r = 0; r < g.n; r++) for (let c = 0; c < g.n; c++) {
    const cl = Math.max(0, c - 1), cr = Math.min(g.n - 1, c + 1), rd = Math.max(0, r - 1), ru = Math.min(g.n - 1, r + 1);
    const dx = (g.h[idx(g, r, cr)] - g.h[idx(g, r, cl)]) / ((cr - cl) * g.d), dy = (g.h[idx(g, ru, c)] - g.h[idx(g, rd, c)]) / ((ru - rd) * g.d);
    s[idx(g, r, c)] = (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI;
  }
  return s;
}

function smooth(g: Grid): Float32Array {
  const o = new Float32Array(g.n * g.n);
  for (let r = 0; r < g.n; r++) for (let c = 0; c < g.n; c++) {
    let t = 0, k = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < g.n && cc < g.n) { t += g.h[idx(g, rr, cc)]; k++; } }
    o[idx(g, r, c)] = t / k;
  }
  return o;
}

/** Crater detection: local depressions enclosed by a raised, roughly circular rim (16-ray rim test, several sizes). */
export function detectCraters(g: Grid): Crater[] {
  const s = smooth(g), N = g.n, out: (Crater & { q: number })[] = [];
  const RAYS = 16;
  for (const rc of [2, 3, 4, 6, 8, 11, 15]) {
    for (let r = rc; r < N - rc; r++) for (let c = rc; c < N - rc; c++) {
      const h0 = s[r * N + c];
      let isMin = true;
      for (let dr = -rc; dr <= rc && isMin; dr += Math.max(1, rc >> 1)) for (let dc = -rc; dc <= rc; dc += Math.max(1, rc >> 1)) {
        if ((dr || dc) && s[(r + dr) * N + c + dc] < h0) { isMin = false; break; }
      }
      if (!isMin) continue;
      const rims: number[] = [], dists: number[] = [];
      for (let k = 0; k < RAYS; k++) {
        const a = (k / RAYS) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        let best = -1e9, bd = 0;
        for (let t = rc * 0.6; t <= rc * 1.7; t += 0.5) {
          const rr = Math.round(r + sa * t), cc = Math.round(c + ca * t);
          if (rr < 0 || cc < 0 || rr >= N || cc >= N) break;
          const v = s[rr * N + cc]; if (v > best) { best = v; bd = t; }
        }
        rims.push(best); dists.push(bd);
      }
      const rimMean = rims.reduce((a, b) => a + b, 0) / RAYS, depth = rimMean - h0;
      const R = (dists.reduce((a, b) => a + b, 0) / RAYS) * g.d;
      if (depth < Math.max(1.5, 0.035 * 2 * R)) continue; // fresh craters: depth/diameter >~ 0.04
      const closed = rims.filter((v) => v - h0 > 0.5 * depth).length;
      if (closed < 13) continue; // rim must enclose the bowl
      const spread = Math.sqrt(dists.reduce((a, b) => a + (b * g.d - R) ** 2, 0) / RAYS) / R;
      if (spread > 0.45) continue; // roughly circular
      out.push({ e: (c - (N - 1) / 2) * g.d, n: (r - (N - 1) / 2) * g.d, r: R, depth, q: depth / (2 * R) - spread * 0.05 });
    }
  }
  out.sort((a, b) => b.q - a.q);
  const keep: Crater[] = [];
  for (const k of out) if (!keep.some((p) => Math.hypot(p.e - k.e, p.n - k.n) < 0.8 * Math.max(p.r, k.r))) keep.push({ e: k.e, n: k.n, r: k.r, depth: k.depth });
  return keep.slice(0, 60);
}

export function analyse(g: Grid): HazardMap { return { grid: g, slope: slopeGrid(g), craters: detectCraters(g) }; }

export function slopeAt(m: HazardMap, e: number, n: number): number {
  const { c, r } = toCell(m.grid, e, n); const cc = Math.max(0, Math.min(m.grid.n - 1, Math.round(c))), rr = Math.max(0, Math.min(m.grid.n - 1, Math.round(r)));
  return m.slope[rr * m.grid.n + cc];
}
export const craterAt = (m: HazardMap, e: number, n: number, pad = 1.1) => m.craters.find((k) => Math.hypot(k.e - e, k.n - n) < k.r * pad) ?? null;
export const isHazard = (m: HazardMap, e: number, n: number) => slopeAt(m, e, n) >= 10 || !!craterAt(m, e, n, 0.85);

/** Hazard avoidance: keep the target if it is safe, otherwise the nearest spot within maxDiv metres with gentle slope and no crater. */
export function safeTarget(m: HazardMap, maxDiv = 450): { e: number; n: number; moved: number; reason: string } {
  const sl0 = slopeAt(m, 0, 0), cr0 = craterAt(m, 0, 0, 0.9);
  if (sl0 < 8 && !cr0) return { e: 0, n: 0, moved: 0, reason: '' };
  const reason = cr0 ? `inside a ${(2 * cr0.r).toFixed(0)} m crater` : `slope ${sl0.toFixed(1)}°`;
  const step = m.grid.d / 2;
  for (let rad = step; rad <= maxDiv; rad += step) {
    let best: { e: number; n: number; s: number } | null = null;
    const k = Math.max(8, Math.round((2 * Math.PI * rad) / step));
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2, e = Math.sin(a) * rad, n = Math.cos(a) * rad;
      const s = Math.max(slopeAt(m, e, n), slopeAt(m, e + step, n), slopeAt(m, e, n + step), slopeAt(m, e - step, n), slopeAt(m, e, n - step));
      if (s < 5 && !craterAt(m, e, n, 1.15) && (!best || s < best.s)) best = { e, n, s };
    }
    if (best) return { e: best.e, n: best.n, moved: rad, reason };
  }
  return { e: 0, n: 0, moved: 0, reason: `${reason} (no safer spot within ${maxDiv} m)` };
}
