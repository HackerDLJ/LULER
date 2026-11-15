import type { Site } from './data';
import type { Stats } from './metrics';

/** Transparent, rule-based safety score (0-100). Every point is traceable to one measured input. */
export interface Factor { key: string; label: string; value: string; points: number; max: number; why: string }
export interface Score { total: number; grade: 'Good' | 'Fair' | 'Poor'; factors: Factor[]; summary: string }

const lin = (v: number, good: number, bad: number) => Math.max(0, Math.min(1, (bad - v) / (bad - good)));

export function scoreSite(site: Site, st: Stats): Score {
  const info = (site as unknown as { info?: { slope_deg?: number; slope_max_deg?: number; relief_m?: number; fine?: { slope_center_deg: number; slope_max_50m_deg: number } } }).info;
  const slope = info?.fine?.slope_center_deg ?? info?.slope_deg ?? NaN;
  const steep = info?.fine?.slope_max_50m_deg ?? info?.slope_max_deg ?? NaN;
  const relief = info?.relief_m ?? NaN;
  const f: Factor[] = [];
  const add = (key: string, label: string, value: string, frac: number, max: number, why: string) =>
    f.push({ key, label, value, points: Math.round((Number.isFinite(frac) ? frac : 0.5) * max), max, why });
  add('slope', 'Slope at touchdown', Number.isFinite(slope) ? `${slope.toFixed(1)}°` : 'n/a', lin(slope, 2, 12), 30,
    'Landers tip over on steep ground. Full marks under 2°, none above 12° (Apollo LM limit was about 12°).');
  add('hazard', 'Steepest ground nearby', Number.isFinite(steep) ? `${steep.toFixed(1)}°` : 'n/a', lin(steep, 8, 25), 10,
    'Crater walls and ridges near the target leave less room for error.');
  add('sun', 'Sunlight', `${st.sunUpPct.toFixed(0)}% of hours`, st.sunUpPct / 100, 25, 'Solar power. Share of hours the Sun clears the real terrain horizon.');
  add('earth', 'Direct link to Earth', `${st.earthUpPct.toFixed(0)}% of hours`, st.earthUpPct / 100, 20, 'Radio contact without a relay. Share of hours Earth clears the horizon.');
  add('night', 'Longest night', `${(st.longestDarkH / 24).toFixed(1)} days`, lin(st.longestDarkH, 48, 340), 10, 'Batteries and heaters must survive the longest stretch with no sunlight.');
  add('relief', 'Terrain relief', Number.isFinite(relief) ? `${relief.toFixed(0)} m` : 'n/a', lin(relief, 40, 600), 5, 'Rough ground (big height range) makes navigation and roving harder.');
  const total = f.reduce((a, b) => a + b.points, 0);
  const grade = total >= 70 ? 'Good' : total >= 50 ? 'Fair' : 'Poor';
  const best = [...f].sort((a, b) => b.points / b.max - a.points / a.max)[0];
  const worst = [...f].sort((a, b) => a.points / a.max - b.points / b.max)[0];
  return { total, grade, factors: f, summary: `Strongest: ${best.label.toLowerCase()} (${best.value}). Weakest: ${worst.label.toLowerCase()} (${worst.value}).` };
}
