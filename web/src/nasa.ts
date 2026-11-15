import { getSettings } from './settings';

/* Live NASA data (api.nasa.gov + images-api.nasa.gov), cached for 30 minutes in this browser tab.
   Key: Settings → LULER Intelligence → NASA API key, else the project key built into this deployment. */
export const nasaKey = () => getSettings().nasaKey?.trim() || (import.meta.env.VITE_NASA_KEY as string | undefined) || 'DEMO_KEY';
const day = (d: Date) => d.toISOString().slice(0, 10);

async function getJSON(url: string, ttlMin = 30): Promise<any> {
  const k = 'luler.nasa:' + url.replace(/api_key=[^&]+/, '');
  try { const c = JSON.parse(sessionStorage.getItem(k) || 'null'); if (c && Date.now() - c.t < ttlMin * 60e3) return c.v; } catch { /* no cache */ }
  const r = await fetch(url, { signal: AbortSignal.timeout?.(8000) });
  if (!r.ok) throw new Error(`NASA API ${r.status}`);
  const v = await r.json();
  try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch { /* full */ }
  return v;
}
const safe = async <T,>(p: Promise<T>): Promise<T | null> => { try { return await p; } catch { return null; } };

export interface SpaceWeather {
  from: string; to: string; fetched: string;
  flares: { cls: string; peak: string }[] | null;
  sep: { time: string }[] | null;
  cme: { time: string; speed?: number; type?: string }[] | null;
  storms: { time: string; kp: number }[] | null;
  level: 'quiet' | 'watch' | 'alert'; headline: string;
}
let lastSW: SpaceWeather | null = null;
export const spaceWeatherNow = () => lastSW;

export async function spaceWeather(): Promise<SpaceWeather> {
  const to = new Date(), from = new Date(Date.now() - 30 * 864e5);
  const q = `startDate=${day(from)}&endDate=${day(to)}&api_key=${nasaKey()}`;
  const B = 'https://api.nasa.gov/DONKI/';
  const [flr, sep, cme, gst] = await Promise.all([safe(getJSON(B + 'FLR?' + q).catch(() => getJSON(`https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?startDate=${day(from)}&endDate=${day(to)}`))), safe(getJSON(B + 'SEP?' + q)), safe(getJSON(B + 'CME?' + q)), safe(getJSON(B + 'GST?' + q))]);
  const flares = Array.isArray(flr) ? flr.map((f: any) => ({ cls: f.classType, peak: f.peakTime ?? f.beginTime })).reverse() : null;
  const seps = Array.isArray(sep) ? sep.map((s: any) => ({ time: s.eventTime })).reverse() : null;
  const cmes = Array.isArray(cme) ? cme.map((c: any) => { const a = (c.cmeAnalyses ?? []).find((x: any) => x.isMostAccurate) ?? c.cmeAnalyses?.[0]; return { time: c.startTime, speed: a?.speed, type: a?.type }; }).reverse() : null;
  const storms = Array.isArray(gst) ? gst.map((g: any) => ({ time: g.startTime, kp: Math.max(0, ...(g.allKpIndex ?? []).map((k: any) => k.kpIndex)) })).reverse() : null;
  const recent = (t?: string) => !!t && Date.now() - Date.parse(t) < 72 * 3600e3;
  const sepNow = !!seps?.some((s) => recent(s.time));
  const bigFlare = !!flares?.some((f) => recent(f.peak) && /^X/.test(f.cls ?? ''));
  const fastCme = !!cmes?.some((c) => recent(c.time) && (c.speed ?? 0) >= 1000);
  const level = sepNow ? 'alert' : bigFlare || fastCme ? 'watch' : 'quiet';
  const headline = level === 'alert' ? 'Solar radiation storm in the last 72 h: crew should stay in shelter'
    : level === 'watch' ? 'Strong solar activity in the last 72 h: watch for a radiation storm'
    : 'Quiet: no solar radiation storm in the last 72 h';
  lastSW = { from: day(from), to: day(to), fetched: new Date().toISOString(), flares, sep: seps, cme: cmes, storms, level, headline };
  return lastSW;
}

export interface EarthImage { url: string; date: string; caption: string; lat: number; lon: number }
export async function epicLatest(): Promise<EarthImage | null> {
  const list = await getJSON(`https://api.nasa.gov/EPIC/api/natural?api_key=${nasaKey()}`, 60);
  const e = Array.isArray(list) ? list[list.length - 1] : null; if (!e) return null;
  const [d] = String(e.date).split(' '); const [y, m, dd] = d.split('-');
  return { url: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${dd}/jpg/${e.image}.jpg`, date: e.date + ' UTC', caption: e.caption, lat: e.centroid_coordinates?.lat, lon: e.centroid_coordinates?.lon };
}

export interface NasaPhoto { thumb: string; title: string; date: string; link: string }
export async function sitePhotos(name: string, mission?: string): Promise<{ query: string; photos: NasaPhoto[] }> {
  const tries = [mission && /apollo|surveyor|luna|lunar/i.test(mission) ? `${name} landing site` : '', `${name} Moon`, /pole|rim|ridge|massif|plateau|shackleton|gerlache|malapert|nobile|leibnitz/i.test(name) ? 'lunar south pole' : 'lunar surface'].filter(Boolean) as string[];
  for (const q of tries) {
    const j = await safe(getJSON(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=12`, 240));
    const items = (j?.collection?.items ?? []).filter((it: any) => it.links?.[0]?.href).slice(0, 6);
    if (items.length >= 3) return { query: q, photos: items.map((it: any) => ({ thumb: it.links[0].href, title: it.data?.[0]?.title ?? '', date: (it.data?.[0]?.date_created ?? '').slice(0, 10), link: `https://images.nasa.gov/details/${encodeURIComponent(it.data?.[0]?.nasa_id ?? '')}` })) };
  }
  return { query: tries[tries.length - 1], photos: [] };
}
