import { useState, type ReactNode } from 'react';
import { PROVIDERS, fetchModels, resetSettings, setSettings, useSettings, type Provider } from './settings';

export interface PlanProps {
  day: string; minDay: string; maxDay: string; onDay: (iso: string) => void;
  len: number; lengths: number[]; onLen: (n: number) => void;
  mast: number; masts: number[]; onMast: (i: number) => void;
  earth: number; earthMins: number[]; onEarth: (n: number) => void;
  siteB: number; sites: { name: string; group?: string }[]; onSiteB: (i: number) => void;
}

const SECTIONS = [
  ['general', 'General', '◐'], ['graphics', '3D & graphics', '◆'], ['visibility', 'Visibility', '◎'],
  ['dates', 'Dates & window', '▦'], ['sunlight', 'Sunlight & power', '☀'], ['earth', 'Earth & radio', '◍'],
  ['data', 'Data & calibration', '≋'], ['ai', 'LULER Intelligence', '✦'], ['about', 'About & reset', 'ⓘ'],
] as const;
type Sec = (typeof SECTIONS)[number][0];

const Row = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <div className="st-row"><div className="st-txt"><b>{title}</b>{hint && <span>{hint}</span>}</div><div className="st-ctl">{children}</div></div>
);
const Toggle = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className={`st-switch${on ? ' on' : ''}`} onClick={() => set(!on)}><i /></button>
);
function Seg<T extends string | number>({ value, opts, set }: { value: T; opts: [T, string][]; set: (v: T) => void }) {
  return <div className="st-seg">{opts.map(([v, l]) => <button type="button" key={String(v)} className={v === value ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>;
}

export default function SettingsPage({ plan, initial = 'general' }: { plan: PlanProps; initial?: Sec }) {
  const st = useSettings();
  const [sec, setSec] = useState<Sec>(initial);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const prov = PROVIDERS[st.aiProvider];

  const pickProvider = (p: Provider) => { setSettings({ aiProvider: p, aiBaseUrl: PROVIDERS[p].url, aiModels: [], aiModel: '' }); setMsg(null); };
  const doFetch = async () => {
    setBusy(true); setMsg(null);
    try {
      const list = await fetchModels(st.aiProvider, st.aiBaseUrl, st.aiKey.trim());
      setSettings({ aiModels: list, aiModel: list.includes(st.aiModel) ? st.aiModel : list[0] });
      setMsg({ ok: true, text: `Connected · ${list.length} model${list.length === 1 ? '' : 's'} available` });
    } catch (e) {
      const m = (e as Error).message;
      setMsg({ ok: false, text: /Failed to fetch|NetworkError|Load failed/i.test(m) ? `Could not reach ${st.aiBaseUrl}. Check the URL, that the server is running, and that it allows browser requests (CORS).` : m });
    }
    setBusy(false);
  };

  return (
    <div className="st-page">
      <nav className="st-nav" aria-label="Settings sections">
        <p className="st-nav-h">Settings</p>
        {SECTIONS.map(([id, label, ic]) => (
          <button type="button" key={id} className={sec === id ? 'on' : ''} onClick={() => setSec(id)}><i aria-hidden="true">{ic}</i>{label}</button>
        ))}
      </nav>
      <section className="st-body" aria-live="polite">
        {sec === 'general' && (<>
          <h2>General</h2><p className="st-lede">How LULER starts and feels.</p>
          <div className="st-card">
            <Row title="Show the welcome page on launch" hint="Off: open straight into the Moon view."><Toggle label="Welcome page" on={st.showIntro} set={(v) => setSettings({ showIntro: v })} /></Row>
            <Row title="Reduce motion" hint="Shorter, calmer animations and transitions."><Toggle label="Reduce motion" on={st.reduceMotion} set={(v) => setSettings({ reduceMotion: v })} /></Row>
            <Row title="Compact site panel" hint="Shows a shorter summary at the bottom of the 3D views."><Toggle label="Compact panel" on={st.compactHud} set={(v) => setSettings({ compactHud: v })} /></Row>
          </div>
        </>)}

        {sec === 'graphics' && (<>
          <h2>3D & graphics</h2><p className="st-lede">Trade sharpness for speed. Changes apply when a 3D view next opens.</p>
          <div className="st-card">
            <Row title="Render quality" hint="Low suits older laptops and phones; High is sharpest on Retina screens."><Seg value={st.quality} opts={[['low', 'Low'], ['balanced', 'Balanced'], ['high', 'High']]} set={(v) => setSettings({ quality: v })} /></Row>
            <Row title="Terrain shadows" hint="Real Sun-cast shadows on the Cesium Moon terrain."><Toggle label="Shadows" on={st.shadows} set={(v) => setSettings({ shadows: v })} /></Row>
            <Row title="Glow" hint="Bloom around the Sun, engines and bright edges."><Toggle label="Glow" on={st.bloom} set={(v) => setSettings({ bloom: v })} /></Row>
          </div>
        </>)}

        {sec === 'visibility' && (<>
          <h2>Visibility</h2><p className="st-lede">What is drawn on the 3D Moon.</p>
          <div className="st-card">
            <Row title="Latitude / longitude grid"><Toggle label="Grid" on={st.layerGrid} set={(v) => setSettings({ layerGrid: v })} /></Row>
            <Row title="Historical landings" hint="Apollo, Luna, Chang'e, Chandrayaan, SLIM, CLPS…"><Toggle label="Historical landings" on={st.layerHistorical} set={(v) => setSettings({ layerHistorical: v })} /></Row>
            <Row title="Candidate sites" hint="Artemis south-pole regions and science candidates."><Toggle label="Candidate sites" on={st.layerCandidates} set={(v) => setSettings({ layerCandidates: v })} /></Row>
            <Row title="Site names" hint="Labels next to each marker."><Toggle label="Labels" on={st.labels} set={(v) => setSettings({ labels: v })} /></Row>
          </div>
        </>)}

        {sec === 'dates' && (<>
          <h2>Dates & planning window</h2><p className="st-lede">The window every score, chart and comparison is computed over. Ephemeris: NAIF SPICE DE440, {plan.minDay} to {plan.maxDay}.</p>
          <div className="st-card">
            <Row title="Window starts (UTC)"><input type="date" className="st-in" min={plan.minDay} max={plan.maxDay} value={plan.day} onChange={(e) => e.target.value && plan.onDay(e.target.value)} /></Row>
            <Row title="Stay length" hint="Longer windows cover a full lunar day-night cycle (≈29.5 days)."><Seg value={plan.len} opts={plan.lengths.map((l) => [l, `${l} d`] as [number, string])} set={plan.onLen} /></Row>
          </div>
        </>)}

        {sec === 'sunlight' && (<>
          <h2>Sunlight & power</h2><p className="st-lede">Polar sunlight depends on how high the solar array sits: a few metres can clear a ridge and add days of light.</p>
          <div className="st-card">
            <Row title="Solar array / antenna height" hint="Height above the ground used for every Sun and Earth visibility test."><Seg value={plan.mast} opts={plan.masts.map((m, i) => [i, `${m} m`] as [number, string])} set={plan.onMast} /></Row>
          </div>
        </>)}

        {sec === 'earth' && (<>
          <h2>Earth & radio link</h2><p className="st-lede">A direct-to-Earth link needs Earth clear of the local horizon by a margin.</p>
          <div className="st-card">
            <Row title="Earth must be at least" hint="Elevation above the real terrain horizon to count as “in view”."><Seg value={plan.earth} opts={plan.earthMins.map((m) => [m, `${m}°`] as [number, string])} set={plan.onEarth} /></Row>
          </div>
        </>)}

        {sec === 'data' && (<>
          <h2>Data & calibration</h2><p className="st-lede">Sources and the reference used in side-by-side comparisons.</p>
          <div className="st-card">
            <Row title="Second site for side-by-side charts">
              <select className="st-in" value={plan.siteB} onChange={(e) => plan.onSiteB(Number(e.target.value))}>{plan.sites.map((x, i) => <option key={i} value={i}>{x.name}</option>)}</select>
            </Row>
            <Row title="Terrain" hint="NASA LRO LOLA (global) and NASA PGDA 5 m polar DEMs with their error maps for uncertainty bands."><span className="st-tag">NASA</span></Row>
            <Row title="Sun & Earth positions" hint="NAIF SPICE DE440, horizon-masked against the real terrain at the chosen height."><span className="st-tag">NAIF</span></Row>
            <Row title="Imagery & 3D" hint="LROC mosaics (SVS Moon Kit, Moon Trek), Cesium Moon terrain, NASA 3D Resources models."><span className="st-tag">LRO</span></Row>
          </div>
        </>)}

        {sec === 'ai' && (<>
          <h2>LULER Intelligence</h2><p className="st-lede">Connect any AI model to power the companion. Keys stay in this browser and are sent only to the URL below.</p>
          <div className="st-card">
            <div className="st-prov">{(Object.keys(PROVIDERS) as Provider[]).map((p) => (
              <button type="button" key={p} className={st.aiProvider === p ? 'on' : ''} onClick={() => pickProvider(p)}><b>{PROVIDERS[p].name}</b><span>{PROVIDERS[p].url}</span></button>
            ))}</div>
            <Row title="API base URL" hint={prov.note}><input className="st-in wide" spellCheck={false} value={st.aiBaseUrl} onChange={(e) => setSettings({ aiBaseUrl: e.target.value.trim() })} placeholder={prov.url} /></Row>
            <Row title="API key" hint={prov.keyNeeded ? 'Required for this provider.' : 'Usually not needed for local servers.'}>
              <div className="st-key"><input className="st-in wide" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={st.aiKey} onChange={(e) => setSettings({ aiKey: e.target.value })} placeholder={prov.keyHint} /><button type="button" onClick={() => setShowKey(!showKey)}>{showKey ? 'Hide' : 'Show'}</button></div>
            </Row>
            <Row title="Model" hint="Fetch the models this key can use at this URL, then pick one.">
              <div className="st-key">
                <select className="st-in wide" value={st.aiModel} onChange={(e) => setSettings({ aiModel: e.target.value })} disabled={!st.aiModels.length}>
                  {!st.aiModels.length && <option value="">Fetch models first</option>}
                  {st.aiModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" className="st-primary" disabled={busy || (prov.keyNeeded && !st.aiKey.trim())} onClick={doFetch}>{busy ? 'Fetching…' : 'Fetch models'}</button>
              </div>
            </Row>
            {msg && <p className={`st-msg ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</p>}
            <Row title="NASA API key" hint="For live NASA data in the companion (api.nasa.gov). DEMO_KEY works with low limits.">
              <input className="st-in wide" type="password" autoComplete="off" value={st.nasaKey} onChange={(e) => setSettings({ nasaKey: e.target.value })} placeholder="DEMO_KEY" />
            </Row>
          </div>
          <p className="st-status">{st.aiModel ? <>✦ Companion ready · <b>{prov.name}</b> · {st.aiModel}</> : 'Companion not connected yet.'}</p>
        </>)}

        {sec === 'about' && (<>
          <h2>About & reset</h2><p className="st-lede">LULER · Lunar Landing Site Navigator, by Team JATABELS for NASA Space Apps Challenge 2026. Not an official NASA product.</p>
          <div className="st-card">
            <Row title="Reset settings" hint="Restores defaults. Your AI connection is kept."><button type="button" className="st-btn" onClick={resetSettings}>Reset</button></Row>
            <Row title="Forget AI keys" hint="Removes the API key and NASA key from this browser."><button type="button" className="st-btn danger" onClick={() => setSettings({ aiKey: '', nasaKey: '', aiModels: [], aiModel: '' })}>Forget keys</button></Row>
          </div>
        </>)}
      </section>
    </div>
  );
}
