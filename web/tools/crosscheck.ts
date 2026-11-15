// Verifies the browser metrics code against the Python engine's first_run.json.
import fs from 'node:fs';
import path from 'node:path';
import { decodeB64, parseCommon, parseSky, type Manifest, type Site } from '../src/data';
import { SeriesCache, windowStats } from '../src/metrics';

const dataDir = process.env.DATA_DIR ?? path.resolve('public/data');
const ref = JSON.parse(fs.readFileSync(process.env.REF ?? path.resolve('../data/processed/first_run.json'), 'utf8'));
const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'manifest.json'), 'utf8'));
const ab = (f: string) => decodeB64(JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')).b64);
const n = manifest.n;
const common = parseCommon(ab('common.json'), n);
const sites: Site[] = manifest.sites.map((s) => ({
  id: s.id, name: s.name, lat: s.lat, lon: s.lon, heightM: s.height_m, maxHorizonDeg: s.max_horizon_deg, provisional: s.provisional, group: s.group, mission: s.mission, year: s.year, accuracy: s.accuracy, terrain: s.terrain,
  ...parseSky(ab(`${s.id}.sky.json`), n), hz: new Int16Array(ab(`${s.id}.hz.json`)),
}));
const cache = new SeriesCache(sites, common, manifest);
const mastIdx = manifest.masts_m.indexOf(2);
let worst = 0;
console.log('site                    metric            python    browser    diff');
for (const r of ref) {
  const i = sites.findIndex((s) => s.name === r.site);
  const st = windowStats(cache.get(i, mastIdx, 0, 0), 0, n);
  const pairs: [string, number, number][] = [
    ['sun_up_pct', r.metrics.sun_up_pct, st.sunUpPct],
    ['power_index_pct', r.metrics.power_index_pct, st.powerPct],
    ['earth_up_pct', r.metrics.earth_up_pct, st.earthUpPct],
    ['both_pct', r.metrics.both_pct, st.bothPct],
    ['longest_dark_h', r.metrics.longest_dark_h, st.longestDarkH],
    ['longest_comm_gap_h', r.metrics.longest_comm_gap_h, st.longestCommGapH],
  ];
  for (const [k, p, b] of pairs) {
    const d = b - p;
    if (k.endsWith('pct')) worst = Math.max(worst, Math.abs(d));
    console.log(`${r.site.padEnd(22)}  ${k.padEnd(18)} ${p.toFixed(2).padStart(9)} ${b.toFixed(2).padStart(10)} ${d.toFixed(2).padStart(8)}`);
  }
}
console.log(`\nworst percentage-point difference: ${worst.toFixed(3)}`);
process.exit(worst < 0.5 ? 0 : 1);
