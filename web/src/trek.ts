/** Live imagery from NASA's Moon Trek tile service (LRO Wide Angle Camera global mosaic, 303 px/deg at full zoom).
 * Tiles are equirectangular: zoom z has 2^(z+1) columns and 2^z rows, column 0 starting at 180W, row 0 at 90N.
 * Returns a north-up square image centred on (lat, lon), or rejects if the service cannot be reached. */
const R = 1737.4;
const D = Math.PI / 180;
const URL0 = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/';

export async function trekPatch(lat: number, lon: number, halfKm: number, N: number): Promise<{ canvas: HTMLCanvasElement; mPerPx: number }> {
  const dest = (az: number, dk: number): [number, number] => {
    const p = lat * D, l = lon * D, dd = dk / R;
    const s2 = Math.sin(p) * Math.cos(dd) + Math.cos(p) * Math.sin(dd) * Math.cos(az);
    const p2 = Math.asin(Math.max(-1, Math.min(1, s2)));
    return [p2 / D, (l + Math.atan2(Math.sin(az) * Math.sin(dd) * Math.cos(p), Math.cos(dd) - Math.sin(p) * s2)) / D];
  };
  const dLat = ((halfKm * 1.42) / R) / D, dLon = dLat / Math.max(Math.cos(lat * D), 0.05);
  let z = 8, td = 0, c0 = 0, c1 = 0, r0 = 0, r1 = 0;
  for (; ; z--) {
    td = 180 / 2 ** z;
    c0 = Math.floor((lon - dLon + 180) / td); c1 = Math.floor((lon + dLon + 180) / td);
    r0 = Math.max(0, Math.floor((90 - (lat + dLat)) / td)); r1 = Math.min(2 ** z - 1, Math.floor((90 - (lat - dLat)) / td));
    if ((c1 - c0 + 1) * (r1 - r0 + 1) <= 64 || z === 3) break;
  }
  const cols = 2 ** (z + 1), W = (c1 - c0 + 1) * 256, H = (r1 - r0 + 1) * 256;
  const mc = document.createElement('canvas');
  mc.width = W; mc.height = H;
  const mg = mc.getContext('2d');
  if (!mg) throw new Error('no canvas');
  const jobs: Promise<void>[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    jobs.push(new Promise<void>((res, rej) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => { mg.drawImage(im, (c - c0) * 256, (r - r0) * 256); res(); };
      im.onerror = () => rej(new Error('Moon Trek tile unavailable'));
      im.src = `${URL0}${z}/${r}/${((c % cols) + cols) % cols}.jpg`;
    }));
  }
  await Promise.all(jobs);
  const src = mg.getImageData(0, 0, W, H).data;
  const oc = document.createElement('canvas');
  oc.width = oc.height = N;
  const og = oc.getContext('2d');
  if (!og) throw new Error('no canvas');
  const out = og.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const e = (i / (N - 1) - 0.5) * 2 * halfKm, n = (0.5 - j / (N - 1)) * 2 * halfKm;
    const [la, lo0] = dest(Math.atan2(e, n), Math.hypot(e, n));
    const lo = lon + (((lo0 - lon + 540) % 360) - 180);
    const x = Math.min(W - 1, Math.max(0, Math.round(((lo + 180) / td - c0) * 256 - 0.5)));
    const y = Math.min(H - 1, Math.max(0, Math.round(((90 - la) / td - r0) * 256 - 0.5)));
    const k = 4 * (y * W + x), o = 4 * (j * N + i);
    out.data[o] = src[k]; out.data[o + 1] = src[k + 1]; out.data[o + 2] = src[k + 2]; out.data[o + 3] = 255;
  }
  og.putImageData(out, 0, 0);
  return { canvas: oc, mPerPx: Math.round((td / 256) * D * R * 1000) };
}
