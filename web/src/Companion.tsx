import { useCallback, useEffect, useRef, useState } from 'react';
import Strands from './rb/Strands.jsx';
import './rb/Strands.css';
// blue and purple palette for the Strands orb (edge → core → deep)
const ORB = ['#8b5cf6', '#a26bff', '#c4a1ff', '#eef1ff', '#7fd8ff', '#3b6cff', '#2b2a9e'];
import { PROVIDERS, fetchModels, setSettings, useSettings } from './settings';

/* LULER Intelligence: full-page AI companion. Works with Anthropic or any OpenAI-compatible server
   (OpenAI, Ollama on localhost, LM Studio, OpenRouter…). Answers from the app's live data and can drive the app. */

export interface CompanionCtx {
  site: { name: string; lat: number; lon: number; group?: string };
  date: string; view: string; score: unknown; stats: unknown; spaceWeatherNow?: unknown;
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
Live NASA space weather (DONKI) is in spaceWeatherNow; use it when asked if it is safe right now. LULER also detects craters in the terrain and simulates a powered descent that diverts to the nearest safe spot if the target is hazardous.
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
  const hasKey = !PROVIDERS[st.aiProvider].keyNeeded || !!st.aiKey.trim();
  // a key but no chat model yet: pick one for the key automatically so typing works straight away
  const picking = useRef('');
  const [pickErr, setPickErr] = useState('');
  useEffect(() => {
    if (st.aiModel || !hasKey) return;
    const k = st.aiProvider + st.aiBaseUrl + st.aiKey; if (picking.current === k) return; picking.current = k; setPickErr('');
    fetchModels(st.aiProvider, st.aiBaseUrl, st.aiKey.trim()).then(({ chat }) => {
      const ok = (m: string) => !/(lite|image|tts|live|audio|embed|vision|learnlm|aqa)/i.test(m);
      const pick = chat.find((m) => /flash/i.test(m) && ok(m)) || chat.find(ok) || chat[0];
      if (pick) setSettings({ aiModel: pick }); else setPickErr('No chat models are available for this key.');
    }).catch((e) => setPickErr((e as Error).message));
  }, [st.aiModel, st.aiProvider, st.aiBaseUrl, st.aiKey, hasKey]);
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

  async function googleTurn() {
    for (let round = 0; round < 5; round++) {
      const r = await fetch(`${trim(st.aiBaseUrl)}/models/${st.aiModel}:generateContent?key=${encodeURIComponent(st.aiKey.trim())}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM(getContext()) }] }, contents: hist.current, tools: [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.params })) }] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      const parts: any[] = j.candidates?.[0]?.content?.parts ?? [];
      if (!parts.length) throw new Error(j.promptFeedback?.blockReason ? `The model declined (${j.promptFeedback.blockReason}).` : 'The model returned an empty reply.');
      hist.current.push({ role: 'model', parts });
      const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
      if (text) add({ role: 'assistant', text });
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) return;
      hist.current.push({ role: 'user', parts: calls.map((p) => { const out = run(p.functionCall.name, p.functionCall.args); add({ role: 'tool', text: out }); return { functionResponse: { name: p.functionCall.name, response: { result: out } } }; }) });
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
    if (!ready) { add({ role: 'error', text: !hasKey ? 'Add your API key in AI settings (⚙ AI settings, top right) to chat.' : pickErr ? `Could not pick a model: ${pickErr} Choose one in AI settings.` : 'Picking a model for your key… send again in a moment.' }); return; }
    setInput(''); add({ role: 'user', text: q });
    hist.current.push(st.aiProvider === 'google' ? { role: 'user', parts: [{ text: q }] } : { role: 'user', content: q });
    setBusy(true);
    try { await (st.aiProvider === 'anthropic' ? anthropicTurn() : st.aiProvider === 'google' ? googleTurn() : openaiTurn()); }
    catch (e) {
      const m = (e as Error).message;
      add({ role: 'error', text: /Failed to fetch|NetworkError|Load failed/i.test(m) ? `Could not reach ${st.aiBaseUrl}. Is the server running and allowing browser requests (CORS)?` : m });
      hist.current.pop();
    }
    setBusy(false);
  };

  /* ---- Live voice: Gemini Live API (bidirectional WebSocket audio) ---- */
  const [voice, setVoice] = useState<'off' | 'connecting' | 'listening' | 'speaking'>('off');
  const [orbShown, setOrbShown] = useState(false); // keeps the voice orb mounted while it blurs away
  useEffect(() => { if (voice !== 'off') { setOrbShown(true); return; } const t = setTimeout(() => setOrbShown(false), 750); return () => clearTimeout(t); }, [voice]);
  // live loudness for the orb: LULER's voice while it speaks, your microphone while it listens
  const getLevel = useCallback(() => {
    const L: any = live.current; if (!L) return 0;
    if (L.srcs?.length && L.an) { const a: Float32Array = L.abuf || (L.abuf = new Float32Array(L.an.fftSize)); L.an.getFloatTimeDomainData(a); let q = 0; for (let i = 0; i < a.length; i++) q += a[i] * a[i]; return Math.min(1, Math.sqrt(q / a.length) * 5); }
    return Math.min(1, (L.mic || 0) * 7);
  }, []);
  const live = useRef<any>(null);
  useEffect(() => () => stopVoice(), []);
  const b64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  function stopVoice() {
    const L = live.current; if (!L) return; live.current = null;
    if (L.inT.trim()) add({ role: 'user', text: `🎙 ${L.inT.trim()}` }); if (L.outT.trim()) add({ role: 'assistant', text: L.outT.trim() });
    try { L.proc?.disconnect(); L.src?.disconnect(); } catch { /* */ }
    L.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    try { L.ws?.close(1000); } catch { /* */ }
    L.ac?.close().catch(() => {}); L.out?.close().catch(() => {});
    setVoice('off');
  }
  function playPcm(L: any, data: string) {
    const bin = atob(data); const n = bin.length >> 1; const buf = L.out.createBuffer(1, n, 24000); const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); ch[i] = (v >= 32768 ? v - 65536 : v) / 32768; }
    const src = L.out.createBufferSource(); src.buffer = buf;
    if (!L.an) { L.an = L.out.createAnalyser(); L.an.fftSize = 512; L.an.connect(L.out.destination); }
    src.connect(L.an);
    const at = Math.max(L.out.currentTime + 0.02, L.t); src.start(at); L.t = at + buf.duration; L.srcs.push(src); setVoice('speaking');
    src.onended = () => { L.srcs = L.srcs.filter((x: any) => x !== src); if (!L.srcs.length && live.current === L) setVoice('listening'); };
  }
  async function startVoice() {
    if (live.current) { stopVoice(); return; }
    if (st.aiProvider !== 'google' || !st.aiKey.trim()) { add({ role: 'error', text: 'Live voice uses Google Gemini. Choose Google Gemini in AI settings and add your free key.' }); return; }
    setVoice('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(st.aiKey.trim())}`);
      const L: any = { ws, stream, ac: new AudioContext(), out: new AudioContext({ sampleRate: 24000 }), t: 0, srcs: [], inT: '', outT: '' };
      live.current = L;
      ws.onopen = () => ws.send(JSON.stringify({ setup: {
        model: `models/${st.liveModel}`,
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: st.voice } } } },
        systemInstruction: { parts: [{ text: SYSTEM(getContext()) + '\nYou are speaking out loud: answer in short, natural spoken sentences.' }] },
        tools: [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.params })) }],
        inputAudioTranscription: {}, outputAudioTranscription: {},
      } }));
      ws.onmessage = async (ev) => {
        if (live.current !== L) return;
        const m = JSON.parse(typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text());
        if (m.setupComplete) { // start streaming the microphone as 16 kHz 16-bit PCM
          L.src = L.ac.createMediaStreamSource(stream); L.proc = L.ac.createScriptProcessor(4096, 1, 1);
          const ratio = L.ac.sampleRate / 16000;
          L.proc.onaudioprocess = (e: AudioProcessingEvent) => {
            if (ws.readyState !== 1) return;
            const f = e.inputBuffer.getChannelData(0); { let q = 0; for (let i = 0; i < f.length; i += 4) q += f[i] * f[i]; L.mic = (L.mic || 0) * 0.5 + Math.sqrt(q / (f.length / 4)) * 0.5; } const n = Math.floor(f.length / ratio); const pcm = new Int16Array(n);
            for (let i = 0; i < n; i++) { let acc = 0, c = 0; for (let k = Math.floor(i * ratio); k < Math.floor((i + 1) * ratio); k++) { acc += f[k]; c++; } const v = Math.max(-1, Math.min(1, acc / (c || 1))); pcm[i] = v < 0 ? v * 32768 : v * 32767; }
            ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64(new Uint8Array(pcm.buffer)), mimeType: 'audio/pcm;rate=16000' } } }));
          };
          L.src.connect(L.proc); L.proc.connect(L.ac.destination); setVoice('listening');
        }
        const sc = m.serverContent;
        if (sc) {
          if (sc.interrupted) { L.srcs.forEach((x: any) => { try { x.stop(); } catch { /* */ } }); L.srcs = []; L.t = 0; setVoice('listening'); }
          for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) playPcm(L, p.inlineData.data);
          if (sc.inputTranscription?.text) L.inT += sc.inputTranscription.text;
          if (sc.outputTranscription?.text) L.outT += sc.outputTranscription.text;
          if (sc.turnComplete || sc.generationComplete) {
            if (L.inT.trim()) add({ role: 'user', text: `🎙 ${L.inT.trim()}` }); if (L.outT.trim()) add({ role: 'assistant', text: L.outT.trim() });
            L.inT = ''; L.outT = '';
          }
        }
        if (m.toolCall?.functionCalls?.length) {
          const responses = m.toolCall.functionCalls.map((c: any) => { const out = run(c.name, c.args); add({ role: 'tool', text: out }); return { id: c.id, name: c.name, response: { result: out } }; });
          ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
        }
      };
      ws.onclose = (e) => { if (live.current === L) { if (e.code !== 1000) add({ role: 'error', text: `Voice session ended${e.reason ? `: ${e.reason}` : ` (code ${e.code})`}.` }); stopVoice(); } };
    } catch (e) {
      add({ role: 'error', text: /Permission|NotAllowed/i.test(String((e as Error).name) + (e as Error).message) ? 'Microphone access was blocked. Allow the microphone for this site to talk to LULER.' : (e as Error).message });
      stopVoice(); setVoice('off');
    }
  }

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
            <div className={`ai-strands${voice !== 'off' ? ' hide' : ''}`}><Strands colors={ORB} energy={busy ? 0.95 : ready ? 0.6 : 0.45} listening={busy} glassSize={1.05} /></div>
            {!ready ? (
              <div className="ai-setup"><h2>Connect a model to start</h2><p>Use Google Gemini for free (key from Google AI Studio, also enables live voice), or Anthropic, OpenAI, a local Ollama or any OpenAI-compatible server. Add the key and fetch the models.</p><button type="button" className="ai-cta" onClick={onOpenSettings}>Open AI settings</button></div>
            ) : (<><h2>Ask anything about landing on the Moon</h2><p>I can read every site, date and score in LULER, and I can move the app for you.</p></>)}
            <div className="ai-sugs">{suggestions.map((s) => <button type="button" key={s} onClick={() => send(s)} disabled={!ready}>{s}</button>)}</div>
          </div>
        )}
        {lines.map((l, i) => <div key={i} className={`ai-msg ${l.role}`}>{l.role === 'tool' ? `↳ ${l.text}` : l.text}</div>)}
        {busy && <div className="ai-msg assistant ai-typing"><i /><i /><i /></div>}
        <div ref={endRef} />
      </div>
      {orbShown && <div className={`ai-voice-orb ${voice}${voice === 'off' ? ' out' : ''}`} aria-hidden="true"><Strands colors={ORB} energy={voice === 'off' ? 0.2 : 0.5} listening={voice === 'connecting'} getLevel={voice === 'connecting' || voice === 'off' ? undefined : getLevel} glassSize={1.1} /></div>}
      {voice !== 'off' && <div className={`ai-voice ${voice}`} role="status"><span className="ai-wave"><i /><i /><i /><i /><i /></span>{voice === 'connecting' ? 'Connecting to Gemini Live…' : voice === 'speaking' ? 'LULER is speaking… (just talk to interrupt)' : 'Listening… ask about any site, date or score'}<button type="button" onClick={stopVoice}>End</button></div>}
      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={ready ? `Message LULER Intelligence about ${ctx.site.name}…` : hasKey ? (pickErr ? 'Choose a chat model in AI settings' : 'Picking a model for your key…') : 'Add your API key in AI settings to start'} aria-label="Message" />
        <button type="button" className={`ai-mic ${voice}`} onClick={startVoice} aria-label={voice === 'off' ? 'Talk to LULER (live voice)' : 'Stop voice'} title={voice === 'off' ? 'Talk (Gemini Live voice)' : 'Stop voice'}>{voice === 'off' ? <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z"/></svg> : <i />}</button>
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">↑</button>
      </form>
    </div>
  );
}
