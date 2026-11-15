import type { HourSeries } from './metrics';

export type HeatMetric = 'both' | 'power' | 'night';

/** value[site][startDay]; NaN where the window would run past the end of the data. */
export function heatValues(series: HourSeries[], lenDays: number, metric: HeatMetric, nDays: number): number[][] {
  const L = lenDays * 24;
  return series.map((s) => {
    const n = s.sunFrac.length;
    const out: number[] = new Array(nDays).fill(NaN);
    if (metric === 'night') {
      for (let d = 0; d + lenDays <= nDays; d++) {
        let run = 0;
        let best = 0;
        for (let i = d * 24; i < d * 24 + L && i < n; i++) {
          run = s.sunFrac[i] < 0.01 ? run + 1 : 0;
          if (run > best) best = run;
        }
        out[d] = best;
      }
      return out;
    }
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const v = metric === 'both' ? (s.sunUp[i] && s.earthUp[i] ? 1 : 0) : s.sunFrac[i];
      pre[i + 1] = pre[i] + v;
    }
    for (let d = 0; d + lenDays <= nDays; d++) {
      out[d] = (100 * (pre[Math.min(d * 24 + L, n)] - pre[d * 24])) / L;
    }
    return out;
  });
}

export function bestWindows(values: number[][], metric: HeatMetric): { siteIdx: number; day: number; value: number }[] {
  const better = (a: number, b: number) => (metric === 'night' ? a < b : a > b);
  const res = values.map((row, siteIdx) => {
    let bestD = -1;
    let bestV = NaN;
    row.forEach((v, d) => {
      if (Number.isNaN(v)) return;
      if (bestD < 0 || better(v, bestV)) {
        bestD = d;
        bestV = v;
      }
    });
    return { siteIdx, day: bestD, value: bestV };
  });
  return res.filter((r) => r.day >= 0).sort((a, b) => (metric === 'night' ? a.value - b.value : b.value - a.value));
}
