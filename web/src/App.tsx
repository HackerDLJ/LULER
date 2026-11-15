import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
gsap.registerPlugin(useGSAP);
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadDataset, decodeB64, type Dataset, type Site } from './data';
import SitePicker from './SitePicker';
import { buildCustomSite, type Dem8 } from './custom';
import MapView from './MapView';
import CalendarView from './CalendarView';
import Craft from './Craft';
import CesiumMoon from './CesiumMoon';
import Mission from './Mission';
import MissionTimeline from './MissionTimeline';
import Compare3 from './Compare3';
import { scoreSite } from './score';
import { Preloader } from './fx';
import Companion from './Companion';
import LiveNasa from './LiveNasa';
import MoonVsEarth from './MoonVsEarth';
import { spaceWeatherNow } from './nasa';
import Team from './Team';
import SettingsPage from './SettingsPage';
import { getSettings, useSettings } from './settings';
import OptionWheel from './rb/OptionWheel.jsx';
import Credits from './Credits';
import ShinyText from './rb/ShinyText.jsx';
import FuzzyText from './rb/FuzzyText.jsx';
import CesiumTerrain from './CesiumTerrain';
import SitePanel from './SitePanel';
import Intro from './Intro';
import { SeriesCache, statsWithUncertainty, maskAt } from './metrics';
import { N_DAYS, dateToDay, fmtDay, hourToDate } from './format';
import { bestWindows, heatValues, type HeatMetric } from './heat';
import Compare from './Compare';
import SkyView from './SkyView';
import Terrain3D from './Terrain3D';
import Hud from './Hud';
import Globe3D from './Globe3D';
import Timeline from './Timeline';
import Heatmap from './Heatmap';
import About from './About';
import SpecularButton from './rb/SpecularButton.jsx';

const LENGTHS = [7, 14, 30, 60, 90, 180, 365];
const EARTH_MINS = [0, 2, 5];
const METRICS: { id: HeatMetric; label: string; hint: string }[] = [
  { id: 'both', label: 'Sun and Earth together', hint: 'brighter is better' },
  { id: 'power', label: 'Sunlight for power', hint: 'brighter is better' },
  { id: 'night', label: 'Shortest longest-night', hint: 'brighter is better (shorter darkness)' },
];

interface State {
  a: number;
  b: number;
  day: number;
  len: number;
  mast: number;
  earth: number;
  metric: HeatMetric;
  scrub: number;
}

function readHash(nSites: number, nMasts: number): State {
  const q = new URLSearchParams(window.location.hash.slice(1));
  const num = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const len = LENGTHS.includes(num('l', 14)) ? num('l', 14) : 14;
  const m = q.get('m');
  return {
    a: clamp(num('a', 7), 0, nSites - 1),
    b: clamp(num('b', 6), 0, nSites - 1),
    day: clamp(num('d', 59), 0, N_DAYS - len),
    len,
    mast: clamp(num('k', 1), 0, nMasts - 1),
    earth: EARTH_MINS.includes(num('e', 0)) ? num('e', 0) : 0,
    metric: m === 'power' || m === 'night' ? m : 'both',
    scrub: Math.max(0, num('h', 0)),
  };
}

function Navigator({ ds, onHome }: { ds: Dataset; onHome: () => void }) {
  const graphRef = useRef<HTMLDivElement>(null);
  const { manifest, common } = ds;
  const [custom, setCustom] = useState<Site | null>(null);
  const sites = useMemo(() => (custom ? [...ds.sites, custom] : ds.sites), [ds.sites, custom]);
  const [s, setS] = useState<State>(() => readHash(ds.sites.length, manifest.masts_m.length));
  const [busy, setBusy] = useState(false);
  const [dive, setDive] = useState(0);
  const cameFromSite = useRef(false);
  const demRef = useRef<Promise<Dem8> | null>(null);
  const set = (p: Partial<State>) => setS((o) => ({ ...o, ...p }));
  // Stable identity so Hud's playback interval isn't torn down and recreated on every tick.
  const onScrub = useCallback((v: number) => setS((o) => ({ ...o, scrub: v })), []);
  const [cesiumFail, setCesiumFail] = useState(false);
  const [view, setViewRaw] = useState<'globe' | 'orbit' | 'lander' | 'descent' | 'map' | 'calendar' | 'craft' | 'cesium' | 'mission' | 'timeline' | 'settings' | 'ai' | 'team'>('globe');
  useGSAP(() => { // smooth GSAP entrance for panels on every view change
    const els = gsap.utils.toArray<HTMLElement>('.app .subtabs, .app .hud2, .app .drive, .app .viewpanel, .app .sitepanel, .app .site-wheel, .app .hud-bottom, .app .below > *');
    gsap.fromTo(els, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.03, clearProps: 'transform,opacity,visibility' });
  }, { dependencies: [view] });
  const hadHash = useRef(window.location.hash.length > 1);

  useEffect(() => {
    // Debounced: playback and slider drags change `s` many times a second, and browsers throttle or reject frequent replaceState calls.
    const id = window.setTimeout(() => {
      const q = new URLSearchParams({ a: String(s.a), b: String(s.b), d: String(s.day), l: String(s.len), k: String(s.mast), e: String(s.earth), m: s.metric, h: String(s.scrub) });
      try {
        window.history.replaceState(null, '', '#' + q.toString());
      } catch {
        /* sandboxed previews may refuse; sharing links still work on the live site */
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [s]);

  const cache = useMemo(() => new SeriesCache(sites, common, manifest), [sites, common, manifest]);
  const day = Math.min(s.day, N_DAYS - s.len);
  const start = day * 24;
  const end = Math.min(start + s.len * 24, manifest.n);
  const scrub = Math.min(s.scrub, end - start - 1);

  const sa = useMemo(() => statsWithUncertainty(cache, manifest, s.a, s.mast, s.earth, start, end), [cache, manifest, s.a, s.mast, s.earth, start, end]);
  const sb = useMemo(() => statsWithUncertainty(cache, manifest, s.b, s.mast, s.earth, start, end), [cache, manifest, s.b, s.mast, s.earth, start, end]);
  const [pick3, setPick3] = useState<number[]>(() => { const f = (re: RegExp, d: number) => { const i = sites.findIndex((x) => re.test(x.name)); return i >= 0 ? i : d; }; return [f(/connecting ridge/i, 0), f(/de gerlache/i, 1), f(/malapert/i, 2)]; });
  useEffect(() => { // compare = the point you picked + the two nearest known sites to it
    const c = sites[s.a]; if (!c) return;
    const r = Math.PI / 180, d = (x: { lat: number; lon: number }) => Math.acos(Math.min(1, Math.sin(c.lat * r) * Math.sin(x.lat * r) + Math.cos(c.lat * r) * Math.cos(x.lat * r) * Math.cos((x.lon - c.lon) * r)));
    const near = sites.map((x, i) => ({ i, k: d(x) })).filter(({ i }) => i !== s.a && !/custom/i.test(sites[i].group ?? '') && !/^custom/i.test(sites[i].name)).sort((p, q) => p.k - q.k).slice(0, 2).map((o) => o.i);
    setPick3([s.a, ...near]);
  }, [s.a, sites]);
  const scores3 = useMemo(() => pick3.map((i) => { const st = statsWithUncertainty(cache, manifest, i, s.mast, s.earth, start, end).center; return { stats: st, score: scoreSite(sites[i], st) }; }), [pick3, cache, manifest, s.mast, s.earth, start, end, sites]);
  const scoreA = useMemo(() => scoreSite(sites[s.a], sa.center), [sites, s.a, sa]);

  const heat = useMemo(() => {
    const series = sites.map((_, i) => cache.get(i, s.mast, 0, s.earth));
    return heatValues(series, s.len, s.metric, N_DAYS);
  }, [cache, sites, s.mast, s.earth, s.len, s.metric]);
  const best = useMemo(() => bestWindows(heat, s.metric), [heat, s.metric]);

  const names = sites.map((x) => x.name);
  const GROUPS = Array.from(new Set(sites.map((x) => x.group)));
  const unit = s.metric === 'night' ? 'h' : '%';

  /** First hour in [from,to) when the Sun clears the terrain edge, relative to `from`; 0 if never. */
  const firstLit = (si: number, from: number, to: number) => {
    const x = sites[si];
    const base = s.mast * manifest.offsets_m.length * manifest.n_az;
    for (let i = from; i < to; i++) if (x.sunEl[i] > maskAt(x.hz, base, manifest.n_az, x.sunAz[i])) return i - from;
    return 0;
  };
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (hadHash.current) return;
    const r = best.find((x) => x.siteIdx === s.a);
    const d = Math.min(r ? r.day : day, N_DAYS - s.len);
    set({ day: d, scrub: firstLit(s.a, d * 24, Math.min(d * 24 + s.len * 24, manifest.n)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = useSettings();
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', cfg.reduceMotion); document.documentElement.classList.toggle('compact-hud', cfg.compactHud); gsap.globalTimeline.timeScale(cfg.reduceMotion ? 4 : 1); }, [cfg.reduceMotion, cfg.compactHud]);
  const [zoomHint, setZoomHint] = useState(false);
  useEffect(() => { // plain scroll over a 3D view scrolls the page; pinch or ⌘/Ctrl + scroll zooms the view
    let tm = 0;
    const h = (e: WheelEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.('.stage') || el.closest('.page-stage, .sitepick-pop, .viewpanel, .sitepanel, .drive, .hud-bottom, .modes, .subtabs, .pickers, .ai-page, .st-page')) return;
      if (el.tagName !== 'CANVAS' && !el.closest('.cesium-widget, .gl, .glabels')) return;
      if (e.ctrlKey || e.metaKey) return;
      e.stopPropagation();
      setZoomHint(true); window.clearTimeout(tm); tm = window.setTimeout(() => setZoomHint(false), 1600);
    };
    window.addEventListener('wheel', h, { capture: true, passive: true });
    return () => { window.removeEventListener('wheel', h, { capture: true }); window.clearTimeout(tm); };
  }, []);
  const [stSec, setStSec] = useState<'general' | 'ai'>('general');
  const openSettings = (sec: 'general' | 'ai' = 'general') => { setStSec(sec); setViewRaw('settings'); window.scrollTo({ top: 0 }); };
  const pickSite = (i: number) => set({ a: i, scrub: firstLit(i, start, end) });
  const setView = (v: typeof view) => {
    if (view === 'globe' && v === 'orbit') { // fly down from the whole Moon to the site
      setDive((d) => d + 1);
      window.setTimeout(() => setViewRaw((cur) => (cur === 'globe' ? 'orbit' : cur)), 1700);
      return;
    }
    cameFromSite.current = v === 'globe' && (view === 'orbit' || view === 'lander' || view === 'descent');
    setViewRaw(v);
  };
  const onCustom = async (lat: number, lon: number) => {
    setBusy(true);
    try {
      demRef.current ??= fetch(import.meta.env.BASE_URL + 'map/ldem8.json').then((r) => r.json()).then((j: { w: number; h: number; b64: string }) => ({ w: j.w, h: j.h, d: new Int16Array(decodeB64(j.b64)) }));
      const site = buildCustomSite(lat, lon, ds.globe, common, manifest, await demRef.current);
      setCustom(site);
      set({ a: ds.sites.length, scrub: 0 });
    } finally {
      setBusy(false);
    }
  };
  const pickers = (
    <>
      <SitePicker sites={sites} value={s.a} onPick={pickSite} />
      <input type="date" aria-label="Date (UTC)" min="2027-01-01" max="2028-12-31" value={fmtDay(day)} onChange={(e) => e.target.value && set({ day: Math.min(dateToDay(e.target.value), N_DAYS - s.len), scrub: 0 })} />
      <button type="button" className={`hdr-team${view === 'team' ? ' on' : ''}`} title="Team JATABELS" onClick={() => { setViewRaw('team'); window.scrollTo({ top: 0 }); }}>Team</button>
      <label className="hdr-clock" title={`Mission time in UTC (hourly NASA SPICE data). Your local time: ${hourToDate(start + scrub).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`}>
        <span className="hc-dot" aria-hidden="true" />
        <select aria-label="Hour of day (UTC)" value={hourToDate(start + scrub).getUTCHours()} onChange={(e) => { const hh = Number(e.target.value); set({ scrub: Math.min(end - start - 1, Math.max(0, Math.floor(scrub / 24) * 24 + hh)) }); }}>
          {Array.from({ length: 24 }, (_, hh) => <option key={hh} value={hh}>{String(hh).padStart(2, '0')}:00</option>)}
        </select>
        <span>UTC · {hourToDate(start + scrub).toUTCString().slice(5, 16)}</span>
      </label>
      <div className="hdr-icons">
        <button type="button" className={`hdr-ic ai${view === 'ai' ? ' on' : ''}`} title="LULER Intelligence (AI)" aria-label="Open LULER Intelligence" onClick={() => { setViewRaw('ai'); window.scrollTo({ top: 0 }); }}><span className="ai-dot" aria-hidden="true" />AI</button>
        <button type="button" className={`hdr-ic${view === 'settings' ? ' on' : ''}`} title="Settings" aria-label="Open settings" onClick={() => openSettings('general')}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg></button>
      </div>
    </>
  );
  const VIEWS: [typeof view, string, string][] = [['globe', 'Moon', 'Pick a landing site on the 3D Moon'], ['orbit', 'Site', 'Terrain, slope and comparison'], ['lander', 'Surface', 'Stand there and drive around'], ['calendar', 'Dates', 'Best days to land']];
  const activeTab = view === 'map' || view === 'timeline' ? 'globe' : view === 'descent' || view === 'craft' || view === 'cesium' || view === 'mission' ? 'orbit' : view;
  const chrome = (
    <>
      <div className="brand" role="button" tabIndex={0} title="Back to the front page" onClick={onHome} onKeyDown={(e) => e.key === 'Enter' && onHome()} style={{ cursor: 'pointer' }}><b>LULER</b><span><ShinyText text="LUNAR LANDING SITE NAVIGATOR" color="#8d8c86" shineColor="#ffffff" speed={3.2} delay={2.5} /></span></div>
      <div className="modes" role="tablist" aria-label="View">
        {VIEWS.map(([id, label, hint]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'on' : ''} title={hint} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      <div className="pickers">{pickers}</div>
      {(view === 'globe' || view === 'map' || view === 'timeline') && (
        <div className="subtabs"><button type="button" className={view === 'globe' ? 'on' : ''} onClick={() => setView('globe')}>3D globe</button><button type="button" className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Flat map + coordinates</button><button type="button" className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>Mission timeline</button></div>
      )}
      {(view === 'orbit' || view === 'descent' || view === 'craft' || view === 'cesium' || view === 'mission') && (
        <div className="subtabs"><button type="button" className={view === 'orbit' ? 'on' : ''} onClick={() => setView('orbit')}>Terrain</button><button type="button" className={view === 'mission' || view === 'descent' ? 'on' : ''} onClick={() => setView('mission')}>Mission: launch → landing</button><button type="button" className={view === 'craft' ? 'on' : ''} onClick={() => setView('craft')}>Spacecraft</button></div>
      )}
    </>
  );
  const COMPANION = (
    <Companion onOpenSettings={() => openSettings('ai')}
        getContext={() => {
          const all = sites.map((x, i) => { let sc: { total?: number; grade?: string } = {}; try { sc = scoreSite(x, statsWithUncertainty(cache, manifest, i, s.mast, s.earth, start, end).center); } catch { /* no data */ } return { name: x.name, lat: +x.lat.toFixed(3), lon: +x.lon.toFixed(3), group: x.group, score: sc.total, grade: sc.grade }; });
          const cur = sites[s.a];
          const sw = spaceWeatherNow(); return { site: { name: cur?.name ?? 'Custom point', lat: cur?.lat ?? 0, lon: cur?.lon ?? 0, group: cur?.group }, date: fmtDay(day), view, score: scoreA, stats: sa.center, sites: all, spaceWeatherNow: sw ? { source: 'NASA DONKI, live', level: sw.level, headline: sw.headline, radiationStorms30d: sw.sep?.length, mxFlares30d: sw.flares?.filter((f) => /^[XM]/.test(f.cls ?? '')).length, cmes30d: sw.cme?.length, latestCme: sw.cme?.[0] } : 'not loaded yet' };
        }}
        actions={{
          goToSite: (name) => { const q = name.toLowerCase(); const i = sites.findIndex((x) => x.name.toLowerCase() === q); const j = i >= 0 ? i : sites.findIndex((x) => x.name.toLowerCase().includes(q) || q.includes(x.name.toLowerCase())); if (j < 0) return `No site matching "${name}"`; pickSite(j); return `Selected ${sites[j].name}`; },
          openView: (v) => { const m: Record<string, typeof view> = { moon: 'globe', map: 'map', terrain: 'orbit', mission: 'mission', surface: 'lander', dates: 'calendar' }; const t = m[v]; if (!t) return `Unknown view ${v}`; setView(t); window.scrollTo({ top: 0, behavior: 'smooth' }); return `Opened ${v}`; },
          setDate: (iso) => { const d = dateToDay(iso); if (!Number.isFinite(d) || d < 0) return 'Date out of range (2027-01-01 to 2028-12-31)'; set({ day: Math.min(d, N_DAYS - s.len) }); return `Date set to ${iso}`; },
        }}
      />
  );
  const hud = (
    <Hud site={sites[s.a]} manifest={manifest} mastIdx={s.mast} earthMin={s.earth} t={start + scrub} start={start} end={end} scrub={scrub} onScrub={onScrub}
      action={<><button type="button" className={`score-chip ${scoreA.grade.toLowerCase()}`} title={scoreA.summary} onClick={() => document.getElementById('cmp3-h')?.scrollIntoView({ behavior: 'smooth' })}><b>{scoreA.total}</b><span>SAFETY · {scoreA.grade}</span></button>{view === 'globe' ? <SpecularButton type="button" size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.4} glow={1} proximity={220} className="cta-spec" onClick={() => setView('orbit')}>Go to site ▸</SpecularButton>
        : view === 'orbit' ? <SpecularButton type="button" size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.4} glow={1} proximity={220} className="cta-spec" onClick={() => setView('mission')}>Fly the mission ▸</SpecularButton> : null}</>} />
  );
  return (
    <>
      {zoomHint && <div className="zoom-hint" role="status">Pinch or hold <b>{/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'}</b> + scroll to zoom · scroll to move down the page</div>}
      {view === 'settings' || view === 'ai' || view === 'team' ? (
        <div className="stage page-stage">
          {chrome}
          <div className="page-body">
            {view === 'settings' ? (
              <SettingsPage key={stSec} initial={stSec} plan={{
                day: fmtDay(day), minDay: '2027-01-01', maxDay: '2028-12-31', onDay: (iso) => set({ day: Math.min(dateToDay(iso), N_DAYS - s.len), scrub: 0 }),
                len: s.len, lengths: LENGTHS, onLen: (l) => set({ len: l, day: Math.min(day, N_DAYS - l), scrub: 0 }),
                mast: s.mast, masts: manifest.masts_m, onMast: (i) => set({ mast: i }),
                earth: s.earth, earthMins: EARTH_MINS, onEarth: (m) => set({ earth: m }),
                siteB: s.b, sites, onSiteB: (i) => set({ b: i }),
              }} />
            ) : view === 'team' ? <Team /> : COMPANION}
          </div>
        </div>
      ) : view === 'globe' ? (
        <Globe3D sites={sites} selected={s.a} t={start + scrub} globe={ds.globe} textureUrl={import.meta.env.BASE_URL + 'map/moon.jpg'} earthUrl={import.meta.env.BASE_URL + 'map/earth.jpg'}
          onPick={pickSite} onCustom={onCustom} dive={dive} onDived={() => setViewRaw((cur) => (cur === 'globe' ? 'orbit' : cur))} startClose={cameFromSite.current} chrome={chrome}>
          {hud}
        </Globe3D>
      ) : view === 'map' ? (
        <MapView sites={sites} selected={s.a} t={start + scrub} globe={ds.globe} mapUrl={import.meta.env.BASE_URL + 'map/moon.jpg'} busy={busy} onPickSite={pickSite} onCustom={onCustom} chrome={chrome}>
          {hud}
        </MapView>
      ) : view === 'calendar' ? (
        <CalendarView site={sites[s.a]} manifest={manifest} mastIdx={s.mast} earthMin={s.earth} day={day} onDay={(d) => set({ day: Math.min(d, N_DAYS - s.len), scrub: 0 })} onGo={() => setViewRaw('globe')} chrome={chrome} />
      ) : view === 'cesium' ? (
        <CesiumMoon site={sites[s.a]} chrome={chrome} />
      ) : view === 'timeline' ? (
        <MissionTimeline sites={sites} chrome={chrome} onOpen={(i) => { pickSite(i); setView('orbit'); }} />
      ) : view === 'mission' ? (
        <Mission base={import.meta.env.BASE_URL + 'models/'} chrome={chrome} onLand={() => setView('descent')} />
      ) : view === 'craft' ? (
        <Craft site={sites[s.a]} base={import.meta.env.BASE_URL + 'models/'} chrome={chrome} />
      ) : (
        cesiumFail ? (
        <Terrain3D
            site={sites[s.a]} common={common} t={start + scrub} mastM={manifest.masts_m[s.mast]} base={import.meta.env.BASE_URL + 'data/'} modelsBase={import.meta.env.BASE_URL + 'models/'}
            textured={sites[s.a].terrain.startsWith('LOLA global 64')} view={view} onView={setView} chrome={chrome}
            panel={<SitePanel sites={sites} a={s.a} b={s.b === s.a || s.b >= sites.length ? (s.a === 7 ? 6 : 7) : s.b} onB={(i) => set({ b: i })} onCustom={onCustom} busy={busy}
              ill={{ a: { sun: sa.center.sunUpPct, earth: sa.center.earthUpPct, dark: sa.center.longestDarkH }, b: { sun: sb.center.sunUpPct, earth: sb.center.earthUpPct, dark: sb.center.longestDarkH }, label: `${s.len} days from ${fmtDay(day)}` }} />}
          >
            {hud}
          </Terrain3D>
  
        ) : (
        <CesiumTerrain
            site={sites[s.a]} common={common} t={start + scrub} mastM={manifest.masts_m[s.mast]} base={import.meta.env.BASE_URL + 'data/'} modelsBase={import.meta.env.BASE_URL + 'models/'}
            textured={sites[s.a].terrain.startsWith('LOLA global 64')} view={view} onView={setView} chrome={chrome} onFail={() => setCesiumFail(true)}
            panel={<SitePanel sites={sites} a={s.a} b={s.b === s.a || s.b >= sites.length ? (s.a === 7 ? 6 : 7) : s.b} onB={(i) => set({ b: i })} onCustom={onCustom} busy={busy}
              ill={{ a: { sun: sa.center.sunUpPct, earth: sa.center.earthUpPct, dark: sa.center.longestDarkH }, b: { sun: sb.center.sunUpPct, earth: sb.center.earthUpPct, dark: sb.center.longestDarkH }, label: `${s.len} days from ${fmtDay(day)}` }} />}
          >
            {hud}
          </CesiumTerrain>
  
        )
      )}
      {view !== 'settings' && view !== 'ai' && view !== 'team' && <div className="below">
      <Compare3 sites={sites} picks={pick3} scores={scores3} onPick={(slot, i) => setPick3((p) => p.map((v, k) => (k === slot ? i : v)))} onOpen={(i) => { pickSite(i); setView('orbit'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      <MoonVsEarth stats={sa.center} mastM={manifest.masts_m[s.mast]} lat={sites[s.a].lat} />
      <LiveNasa site={sites[s.a]} />
      <h2 className="below-h">Two sites side by side, and the best dates</h2>
      <p className="below-note">Change the dates, stay length, array height, Earth margin or the second site in <button type="button" className="linkish" onClick={() => openSettings('general')}>Settings</button>.</p>

      <Compare
        a={{ name: sites[s.a].name, stats: sa.center, ranges: sa.ranges }}
        b={{ name: sites[s.b].name, stats: sb.center, ranges: sb.ranges }}
        lenDays={s.len}
        startLabel={fmtDay(day)}
      />

      <div className="graphs" ref={graphRef}>
      <section aria-labelledby="sky-h">
        <h2 id="sky-h">Where the Sun and Earth are, against the real horizon</h2>
        <p className="lede">
          Each dot is one point in time in your window: <span className="swatch sun" /> Sun, <span className="swatch earth" /> Earth. Solid dots are above the
          terrain; faint dots are hidden behind it. Drag the slider to move through the window.
        </p>
        <label className="scrub">
          Time in window
          <input type="range" min={0} max={end - start - 1} value={scrub} onChange={(e) => set({ scrub: Number(e.target.value) })} />
        </label>
        <SkyView label="Site A" site={sites[s.a]} common={common} manifest={manifest} mastIdx={s.mast} start={start} end={end} scrub={start + scrub} earthMin={s.earth} />
        <SkyView label="Site B" site={sites[s.b]} common={common} manifest={manifest} mastIdx={s.mast} start={start} end={end} scrub={start + scrub} earthMin={s.earth} />
      </section>

      <section aria-labelledby="tl-h">
        <h2 id="tl-h">When you have power and a link</h2>
        <Timeline
          rows={[
            { label: sites[s.a].name, series: cache.get(s.a, s.mast, 0, s.earth) },
            { label: sites[s.b].name, series: cache.get(s.b, s.mast, 0, s.earth) },
          ]}
          start={start}
          end={end}
          scrub={start + scrub}
          startDay={day}
        />
      </section>

      <section aria-labelledby="hm-h">
        <h2 id="hm-h">Best dates: every site, every start day</h2>
        <p className="lede">
          Each row is a site and each column is a start day across 2027–2028, for a {s.len}-day stay. Click anywhere to jump to that site and date.
        </p>
        <div className="seg" role="group" aria-label="Heatmap measure">
          {METRICS.map((m) => (
            <button key={m.id} className={m.id === s.metric ? 'on' : ''} aria-pressed={m.id === s.metric} onClick={() => set({ metric: m.id })} title={m.hint}>
              {m.label}
            </button>
          ))}
        </div>
        <Heatmap
          names={names}
          values={heat}
          metric={s.metric}
          lenDays={s.len}
          startDay={day}
          selected={[s.a, s.b]}
          onPick={(si, d) => set({ a: si, day: d, scrub: 0 })}
        />
        <h3>Best start date for each site</h3>
        <ol className="best">
          {best.map((r) => (
            <li key={r.siteIdx}>
              <button onClick={() => set({ a: r.siteIdx, day: r.day, scrub: 0 })}>
                <strong>{names[r.siteIdx]}</strong>: {fmtDay(r.day)}, {s.metric === 'night' ? `longest night ${r.value.toFixed(0)} h` : `${r.value.toFixed(0)}${unit}`}
              </button>
            </li>
          ))}
        </ol>
      </section>
      </div>

      <About manifest={manifest} />
      <Credits />
      <footer>Built from NASA LRO/LOLA terrain, LROC imagery (NASA SVS Moon Kit), NAIF SPICE ephemerides and JPL Horizons checks. Not an official NASA product. South-polar region centres are provisional.</footer>
      </div>}
    </>
  );
}

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [started, setStarted] = useState(window.location.hash.length > 1 || !getSettings().showIntro);
  const [err, setErr] = useState('');
  useEffect(() => {
    loadDataset(import.meta.env.BASE_URL + 'data/').then(setDs).catch((e) => setErr(String(e)));
  }, []);
  return (
    <div className={`app${getSettings().reduceMotion ? ' reduce-motion' : ''}`}>
      {err && <div className="splash error"><FuzzyText fontSize="clamp(2.4rem,8vw,6rem)" fontFamily="ui-monospace, Menlo, monospace" fontWeight={700} color="#6fa8ff" baseIntensity={0.25} hoverIntensity={0.6} glitchMode intro>SIGNAL LOST</FuzzyText><span>Could not load the data: {err}</span></div>}
      <Preloader done={!!ds || !!err} />
      {ds && !started && <Intro onStart={() => setStarted(true)} list={ds.sites} sites={ds.sites.length} landings={ds.sites.filter((s) => s.year !== null).length} />}
      {ds && started && <Navigator ds={ds} onHome={() => { try { history.replaceState(null, "", location.pathname); } catch { /* ignore */ } setStarted(false); }} />}
    </div>
  );
}
