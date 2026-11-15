// Compare the in-browser any-coordinate Sun/Earth geometry against the SPICE precompute for catalog sites.
import fs from 'node:fs';
import path from 'node:path';
import { decodeB64, parseCommon, parseSky, type Globe, type Manifest } from '../src/data';
import { skyAt } from '../src/custom';
const dir = process.env.DATA ?? path.resolve('public/data');
const ab = (f: string) => decodeB64(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).b64);
const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const n = manifest.n;
const common = parseCommon(ab('common.json'), n);
const gi = new Int16Array(ab('globe.json'));
const part = (k: number) => Float32Array.from(gi.subarray(k * n, (k + 1) * n), (x) => x / 100);
const globe: Globe = { sunLon: part(0), sunLat: part(1), earthLon: part(2), earthLat: part(3) };
let worst = 0;
for (const s of manifest.sites) {
  const ref = parseSky(ab(`${s.id}.sky.json`), n);
  const c = skyAt(s.lat, s.lon, s.height_m + 2, globe, common);
  let dse = 0, dee = 0, dsa = 0;
  for (let i = 0; i < n; i++) {
    dse = Math.max(dse, Math.abs(ref.sunEl[i] - c.sunEl[i]));
    dee = Math.max(dee, Math.abs(ref.earthEl[i] - c.earthEl[i]));
    if (Math.abs(ref.sunEl[i]) < 80) { const d = Math.abs(((ref.sunAz[i] - c.sunAz[i] + 540) % 360) - 180); dsa = Math.max(dsa, d * Math.cos((ref.sunEl[i] * Math.PI) / 180)); }
  }
  worst = Math.max(worst, dse, dee);
  console.log(s.name.padEnd(28), 'max diff: Sun el', dse.toFixed(3), ' Earth el', dee.toFixed(3), ' Sun az (on sky)', dsa.toFixed(3));
}
console.log('worst elevation difference (deg):', worst.toFixed(3));
