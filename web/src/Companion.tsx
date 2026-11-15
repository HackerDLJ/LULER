import { useEffect, useRef, useState } from 'react';
import { PROVIDERS, useSettings } from './settings';

/* LULER Intelligence: full-page AI companion. Works with Anthropic or any OpenAI-compatible server
   (OpenAI, Ollama on localhost, LM Studio, OpenRouter…). Answers from the app's live data and can drive the app. */

export interface CompanionCtx {
  site: { name: string; lat: number; lon: number; group?: string };
  date: string; view: string; score: unknown; stats: unknown;
  sites: { name: string; lat: number; lon: number; group?: string; score?: number; grade?: string }[];
}
export interface CompanionActions { goToSite: (name: string) => string; openView: (view: string) => string; setDate: (isoDate: string) => string }
type Line = { role: 'user' | 'assistant' | 'tool' | 'error'; text: string };

const TOOLS = [
  { name: 'go_to_site', description: 'Select a landing site in LULER by (part of) its name, e.g. "Shackleton rim", "Apollo 11".', params: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'open_view', description: 'Open a LULER view: moon (3D globe), map (flat map), terrain (3D site terrain with crater/hazard map), mission (Saturn V launch to landing), surface (walk the surface), dates (calendar).', params: { type: 'object', properties: { view: { type: 'string', enum: ['moon', 'map', 'terrain', 'mission', 'surface', 'dates'] } }, required: ['view'] } },
  { name: 'set_date', description: 'Set the planning start date (UTC), 2027-01-01 to 2028-12-31.', params: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'] } },
];

const SYSTEM = (c: CompanionCtx) => `You are LULER Intelligence, the assistant inside LULER (Lunar Landing Site Navigator) by Team JATABELS, NASA Space Apps Challenge 2026.
LULER helps choose where and when to land on the Moon using NASA data: LRO LOLA terrain, LROC imagery, NASA PGDA 5 m polar DEMs, NAIF SPICE DE440 Sun/Earth ephemeris, Cesium Moon terrain, NASA 3D Resources models.
Safety score 0-100 (rule-based, explainable): slope at touchdown 30, sunlight 25, Earth in view for radio 20, steepest nearby ground 10, night length 10, relief 5. Good >= 75, Fair >= 50, else Poor.
LULER also detects craters in the terrain and simulates a powered descent that diverts to the nearest safe spot if the target is hazardous.
Answer concisely and concretely from the live data below; never invent numbers that are not in it. Use the tools when the user wants to see, open or go somewhere. Call simulations and estimates what they are.
LIVE APP STATE (JSON): ${JSON.stringify(c)}`;

const trim = (u: string) => u.replace(/\/+$/, '');
const keep: { lines: Line[]; hist: any[]; key: string } = { lines: [], hist: [], key: '' }; // survives leaving the AI page

export default function Companion({ getContext, actions, onOpenSettings }: { getContext: () => CompanionCtx; actions: CompanionActions; onOpenSettings: () => void }) {
  const st = useSettings();
  const [lines, setLinesRaw] = useState<Line[]>(() => keep.lines);
  const setLines = (f: Line[] | ((x: Line[]) => Line[])) => setLinesRaw((x) => { const n = typeof f === 'function' ? f(x) : f; keep.lines = n; return n; });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const hist = useRef<any[]>(keep.hist);
  const endRef = useRef<HTMLDivElement>(null);
  const ready = !!st.aiModel && (!PROVIDERS[st.aiProvider].keyNeeded || !!st.aiKey.trim());
  const ctx = getContext();
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [lines, busy]);
  useEffect(() => { const k = st.aiProvider + st.aiBaseUrl; if (keep.key && keep.key !== k) { hist.current = []; keep.hist = hist.current; setLines([]); } keep.key = k; }, [st.aiProvider, st.aiBaseUrl]);

  const run = (name: string, a: any): string => {
    try {
      if (name === 'go_to_site') return actions.goToSite(String(a?.name ?? ''));
      if (name === 'open_view') return actions.openView(String(a?.view ?? ''));
      if (name === 'set_date') return actions.setDate(String(a?.date ?? ''));
    } catch (e) { return `Error: ${(e as Error).message}`; }
    return 'Unknown tool';
  };
  const add = (l: Line) => { keep.lines = [...keep.lines, l]; setLinesRaw(keep.lines); }; // keeps working after the AI navigates away

  async function anthropicTurn() {
    for (let round = 0; round < 5; round++) {
      const r = await fetch(`${trim(st.aiBaseUrl)}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': st.aiKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: st.aiModel, max_tokens: 1000, system: SYSTEM(getContext()), tools: TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.params })), messages: hist.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      hist.current.push({ role: 'assistant', content: j.content });
      const text = j.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
      if (text) add({ role: 'assistant', text });
      const calls = j.content.filter((b: any) => b.type === 'tool_use');
      if (j.stop_reason !== 'tool_use' || !calls.length) return;
      hist.current.push({ role: 'user', content: calls.map((b: any) => { const out = run(b.name, b.input); add({ role: 'tool', text: out }); return { type: 'tool_result', tool_use_id: b.id, content: out }; }) });
    }
  }

  async function openaiTurn() {
    let tools = true;
    for (let round = 0; round < 5; round++) {
      const body: any = { model: st.aiModel, messages: [{ role: 'system', content: SYSTEM(getContext()) }, ...hist.current] };
      if (tools) body.tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.params } }));
      const r = await fetch(`${trim(st.aiBaseUrl)}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', ...(st.aiKey.trim() ? { Authorization: `Bearer ${st.aiKey.trim()}` } : {}) }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const m = j?.error?.message ?? j?.error ?? `HTTP ${r.status}`;
        if (tools && /tool|function/i.test(String(m))) { tools = false; round--; continue; } // model without tool support: plain chat
        throw new Error(String(m));
      }
      const msg = j.choices?.[0]?.message ?? {};
      hist.current.push({ role: 'assistant', content: msg.content ?? '', ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) });
      if (msg.content?.trim()) add({ role: 'assistant', text: msg.content.trim() });
      if (!msg.tool_calls?.length) return;
      for (const c of msg.tool_calls) {
        let a = {}; try { a = JSON.parse(c.function?.arguments || '{}'); } catch { /* bad args */ }
        const out = run(c.function?.name, a); add({ role: 'tool', text: out });
        hist.current.push({ role: 'tool', tool_call_id: c.id, content: out });
      }
    }
  }

  const send = async (text: string) => {
    const q = text.trim(); if (!q || busy) return;
    if (!ready) { onOpenSettings(); return; }
    setInput(''); add({ role: 'user', text: q });
    hist.current.push({ role: 'user', content: q });
    setBusy(true);
    try { await (st.aiProvider === 'anthropic' ? anthropicTurn() : openaiTurn()); }
    catch (e) {
      const m = (e as Error).message;
      add({ role: 'error', text: /Failed to fetch|NetworkError|Load failed/i.test(m) ? `Could not reach ${st.aiBaseUrl}. Is the server running and allowing browser requests (CORS)?` : m });
      hist.current.pop();
    }
    setBusy(false);
  };

  const sc = ctx.score as { total?: number; grade?: string } | undefined;
  const best = [...ctx.sites].filter((x) => typeof x.score === 'number').sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const suggestions = [
    `Is ${ctx.site.name} a safe place to land?`,
    'Which site scores best for this window, and why?',
    'Take me to the south-pole site with the most sunlight',
    'Explain how the safety score works',
  ];

  return (
    <div className="ai-page">
      <header className="ai-head">
        <div className="ai-title"><span className="ai-orb" aria-hidden="true" /><div><h1>LULER Intelligence</h1><p>{ready ? <>{PROVIDERS[st.aiProvider].name} · <b>{st.aiModel}</b></> : 'Not connected'}</p></div></div>
        <div className="ai-head-r">
          {lines.length > 0 && <button type="button" className="ai-ghost" onClick={() => { hist.current = []; keep.hist = hist.current; setLines([]); }}>New chat</button>}
          <button type="button" className="ai-ghost" onClick={onOpenSettings}>⚙ AI settings</button>
        </div>
      </header>
      <aside className="ai-ctx" aria-label="What the AI can see">
        <span>Live context</span>
        <b>{ctx.site.name}</b>
        <i>{ctx.date}</i>
        {sc?.total !== undefined && <em className={`g-${(sc.grade ?? '').toLowerCase()}`}>Safety {sc.total} · {sc.grade}</em>}
        {best && <i>Best now: {best.name} ({best.score})</i>}
      </aside>
      <div className="ai-log">
        {!lines.length && (
          <div className="ai-empty">
            {!ready ? (
              <div className="ai-setup"><h2>Connect a model to start</h2><p>Choose Anthropic, OpenAI, a local Ollama or any OpenAI-compatible server, add a key if it needs one, and fetch the models.</p><button type="button" className="ai-cta" onClick={onOpenSettings}>Open AI settings</button></div>
            ) : (<><h2>Ask anything about landing on the Moon</h2><p>I can read every site, date and score in LULER, and I can move the app for you.</p></>)}
            <div className="ai-sugs">{suggestions.map((s) => <button type="button" key={s} onClick={() => send(s)} disabled={!ready}>{s}</button>)}</div>
          </div>
        )}
        {lines.map((l, i) => <div key={i} className={`ai-msg ${l.role}`}>{l.role === 'tool' ? `↳ ${l.text}` : l.text}</div>)}
        {busy && <div className="ai-msg assistant ai-typing"><i /><i /><i /></div>}
        <div ref={endRef} />
      </div>
      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={ready ? `Message LULER Intelligence about ${ctx.site.name}…` : 'Connect a model in AI settings to start'} aria-label="Message" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">↑</button>
      </form>
    </div>
  );
}
