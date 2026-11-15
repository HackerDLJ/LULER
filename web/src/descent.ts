/** Simulated powered descent to the chosen site. A simplified guidance model for illustration:
 * constant 3 m/s^2 horizontal braking, quadratic altitude profile, 45 s vertical terminal descent.
 * It is NOT flight data from any mission. Units: metres, seconds. */
export interface Plan { d0: number; h0: number; t1: number; tEnd: number; azFrom: number }
const A = 3;
const HOVER = 100;
const TERM = 45;

export function makePlan(halfKm: number, sunAzDeg: number): Plan {
  const d0 = halfKm * 900; // start 90% of the way to the edge of the terrain patch
  const t1 = Math.sqrt((2 * d0) / A);
  // approach with the Sun behind the lander (as Apollo did, so surface shadows are visible ahead)
  return { d0, h0: 0.25 * d0, t1, tEnd: t1 + TERM, azFrom: sunAzDeg };
}

export const PHASES = [
  { name: 'Braking burn', text: 'The main engine fires against the direction of travel to shed orbital speed. There is no atmosphere to help: every metre per second must be removed with propellant.' },
  { name: 'Pitch-over and approach', text: 'The lander tilts upright so its sensors can see the landing area, and steers toward the target.' },
  { name: 'Hover and hazard check', text: 'Horizontal speed is nearly zero. The lander checks the ground below for rocks, slopes and shadows before committing.' },
  { name: 'Terminal descent', text: 'A slow vertical drop on throttled thrust until the footpads touch the surface.' },
  { name: 'Touchdown', text: 'Engine off. Surface operations begin: power now depends on the Sun, and the radio link on a clear view of Earth.' },
];

export function phaseStart(p: Plan, i: number): number {
  return [0, 0.6 * p.t1, p.t1 - 15, p.t1, p.tEnd][i];
}

export function traj(p: Plan, tsIn: number) {
  const ts = Math.min(Math.max(tsIn, 0), p.tEnd);
  let d = 0, h = 0, vh = 0, vv = 0;
  if (ts < p.t1) {
    const rem = p.t1 - ts;
    d = 0.5 * A * rem * rem;
    vh = A * rem;
    h = HOVER + (p.h0 - HOVER) * (rem / p.t1) ** 2;
    vv = (2 * (p.h0 - HOVER) * rem) / (p.t1 * p.t1);
  } else {
    const s = ts - p.t1;
    h = HOVER * (1 - s / TERM);
    vv = ts >= p.tEnd ? 0 : HOVER / TERM;
  }
  let phase = 0;
  for (let i = 0; i < 5; i++) if (ts >= phaseStart(p, i)) phase = i;
  return { d, h, vh, vv, speed: Math.hypot(vh, vv), phase, landed: ts >= p.tEnd, ts };
}
