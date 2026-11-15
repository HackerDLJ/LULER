export interface Manifest {
  generated_utc: string;
  start_utc: string;
  step_s: number;
  n: number;
  n_az: number;
  masts_m: number[];
  offsets_m: [number, number][];
  ring_m: number;
  data_sources: { ephemeris: string; terrain: string; validation: string };
  sites: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    height_m: number;
    max_horizon_deg: number;
    edge_hit_pct_80m: number;
    provisional: boolean;
    group: string;
    mission: string;
    year: number | null;
    accuracy: string;
    terrain: string;
  }[];
}

export interface Common {
  sunR: Float32Array; // angular radius of the Sun, degrees
  earthR: Float32Array; // angular radius of Earth, degrees
}

export interface Site {
  id: string;
  name: string;
  lat: number;
  lon: number;
  heightM: number;
  maxHorizonDeg: number;
  provisional: boolean;
  group: string;
  mission: string;
  year: number | null;
  accuracy: string;
  terrain: string;
  sunAz: Float32Array;
  sunEl: Float32Array;
  earthAz: Float32Array;
  earthEl: Float32Array;
  hz: Int16Array; // [mast][offset][azimuth] in 0.01 degrees
  demInline?: { n: number; pxKm: number; h: Int16Array }; // custom points carry their own terrain patch
  info?: TerrainInfo;
}

export interface TerrainInfo {
  elev_m: number;
  slope_deg: number;
  slope_baseline_m: number;
  slope_mean_deg: number;
  slope_max_deg: number;
  relief_m: number;
  area_km: number;
  source: string;
  resolution_m: number;
  mesh: string;
  fine?: { src: string; px_m: number; slope_center_deg: number; slope_mean_50m_deg: number; slope_max_50m_deg: number; relief_50m_m: number; z_err_m: number; elev_m: number; patch: string };
}

export interface Globe {
  sunLon: Float32Array;
  sunLat: Float32Array;
  earthLon: Float32Array;
  earthLat: Float32Array;
}

export interface Dataset {
  manifest: Manifest;
  common: Common;
  sites: Site[];
  globe: Globe;
}

export function parseCommon(buf: ArrayBuffer, n: number): Common {
  const u = new Uint16Array(buf, 0, 2 * n);
  const sunR = new Float32Array(n);
  const earthR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sunR[i] = u[i] / 10000;
    earthR[i] = u[n + i] / 10000;
  }
  return { sunR, earthR };
}

export function parseSky(buf: ArrayBuffer, n: number) {
  // layout: sunAz u16 (x100) | sunEl f32 | earthAz u16 (x100) | earthEl f32
  const sunAzR = new Uint16Array(buf.slice(0, 2 * n));
  const sunEl = new Float32Array(buf.slice(2 * n, 6 * n));
  const earthAzR = new Uint16Array(buf.slice(6 * n, 8 * n));
  const earthEl = new Float32Array(buf.slice(8 * n, 12 * n));
  const sunAz = new Float32Array(n);
  const earthAz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sunAz[i] = sunAzR[i] / 100;
    earthAz[i] = earthAzR[i] / 100;
  }
  return { sunAz, sunEl, earthAz, earthEl };
}

export function decodeB64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}

export async function loadDataset(base: string): Promise<Dataset> {
  const get = async (name: string) => {
    const r = await fetch(base + name);
    if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`);
    return r;
  };
  const blob = async (name: string): Promise<ArrayBuffer> => decodeB64(((await (await get(name)).json()) as { b64: string }).b64);
  const manifest: Manifest = await (await get('manifest.json')).json();
  const n = manifest.n;
  const common = parseCommon(await blob('common.json'), n);
  const sites: Site[] = await Promise.all(
    manifest.sites.map(async (s) => {
      const [skyBuf, hzBuf] = await Promise.all([
        blob(`${s.id}.sky.json`),
        blob(`${s.id}.hz.json`),
      ]);
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        heightM: s.height_m,
        maxHorizonDeg: s.max_horizon_deg,
        provisional: s.provisional,
        group: s.group,
        mission: s.mission,
        year: s.year,
        accuracy: s.accuracy,
        terrain: s.terrain,
        ...parseSky(skyBuf, n),
        hz: new Int16Array(hzBuf),
      };
    }),
  );
  const tinfo = (await (await get('terrain.json')).json()) as Record<string, TerrainInfo>;
  for (const s of sites) s.info = tinfo[s.id];
  const gi = new Int16Array(await blob('globe.json'));
  const part = (k: number) => Float32Array.from(gi.subarray(k * n, (k + 1) * n), (x) => x / 100);
  const globe: Globe = { sunLon: part(0), sunLat: part(1), earthLon: part(2), earthLat: part(3) };
  return { manifest, common, sites, globe };
}
