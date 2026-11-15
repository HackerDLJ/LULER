import { useSyncExternalStore } from 'react';

/* App-wide user settings, persisted in this browser only. */
export type Provider = 'google' | 'anthropic' | 'openai' | 'ollama' | 'custom';
export interface Settings {
  // General / main page
  showIntro: boolean;
  reduceMotion: boolean;
  compactHud: boolean;
  // 3D & graphics
  quality: 'low' | 'balanced' | 'high';
  shadows: boolean;
  bloom: boolean;
  // Visibility (Moon globe layers)
  layerGrid: boolean;
  layerHistorical: boolean;
  layerCandidates: boolean;
  labels: boolean;
  // AI
  aiProvider: Provider;
  aiBaseUrl: string;
  aiKey: string;
  aiModel: string;
  aiModels: string[];
  liveModel: string;
  liveModels: string[];
  voice: string;
  nasaKey: string;
}

export const PROVIDERS: Record<Provider, { name: string; url: string; keyHint: string; keyNeeded: boolean; note: string; free?: boolean }> = {
  google: { name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta', keyHint: 'AIza…', keyNeeded: true, free: true, note: 'Free key from aistudio.google.com → Get API key. Also powers live voice.' },
  anthropic: { name: 'Anthropic', url: 'https://api.anthropic.com/v1', keyHint: 'sk-ant-…', keyNeeded: true, note: 'Key from console.anthropic.com → API keys.' },
  openai: { name: 'OpenAI', url: 'https://api.openai.com/v1', keyHint: 'sk-…', keyNeeded: true, note: 'Key from platform.openai.com → API keys.' },
  ollama: { name: 'Ollama (local)', url: 'http://localhost:11434/v1', keyHint: 'not needed', keyNeeded: false, note: 'Runs on your computer. Start Ollama, then set OLLAMA_ORIGINS=* so this site may call it.' },
  custom: { name: 'OpenAI-compatible (any URL)', url: 'http://localhost:1234/v1', keyHint: 'optional', keyNeeded: false, note: 'LM Studio, vLLM, OpenRouter, Groq, Together… any /v1/chat/completions server.' },
};

const DEFAULTS: Settings = {
  showIntro: true, reduceMotion: false, compactHud: false,
  quality: 'balanced', shadows: true, bloom: true,
  layerGrid: false, layerHistorical: true, layerCandidates: true, labels: true,
  aiProvider: 'google', aiBaseUrl: PROVIDERS.google.url, aiKey: '', aiModel: '', aiModels: [], liveModel: 'gemini-3.1-flash-live-preview', liveModels: [], voice: 'Puck', nasaKey: '',
};

const KEY = 'luler.settings.v1';
let state: Settings = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
})();
const subs = new Set<() => void>();
export const getSettings = () => state;
export function setSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  subs.forEach((f) => f());
}
export const resetSettings = () => setSettings({ ...DEFAULTS, aiKey: state.aiKey, nasaKey: state.nasaKey, aiProvider: state.aiProvider, aiBaseUrl: state.aiBaseUrl, aiModel: state.aiModel, aiModels: state.aiModels, liveModel: state.liveModel, liveModels: state.liveModels, voice: state.voice });
export function useSettings(): Settings {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
}
/** Max device-pixel-ratio for WebGL views at the chosen quality. */
export const pixelCap = () => (state.quality === 'low' ? 1 : state.quality === 'high' ? 2 : 1.25);

/* ---- AI provider calls (browser → provider; key never leaves this browser except to that URL) ---- */
const trim = (u: string) => u.replace(/\/+$/, '');
export async function fetchModels(p: Provider, baseUrl: string, key: string): Promise<{ chat: string[]; live: string[] }> {
  if (p === 'google') {
    const out: { chat: string[]; live: string[] } = { chat: [], live: [] };
    let page = '';
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${trim(baseUrl)}/models?pageSize=200&key=${encodeURIComponent(key)}${page ? `&pageToken=${page}` : ''}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      for (const m of j.models ?? []) {
        const id = String(m.name ?? '').replace(/^models\//, ''); const how: string[] = m.supportedGenerationMethods ?? [];
        if (how.includes('bidiGenerateContent')) out.live.push(id);
        if (how.includes('generateContent') && /gemini/i.test(id) && !/tts|image|embedding|live|native-audio/i.test(id)) out.chat.push(id);
      }
      if (!j.nextPageToken) break; page = j.nextPageToken;
    }
    if (!out.chat.length) throw new Error('This key lists no Gemini chat models.');
    out.chat.sort().reverse(); out.live.sort().reverse();
    return out;
  }
  const url = `${trim(baseUrl)}/models`;
  const headers: Record<string, string> = p === 'anthropic'
    ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    : key ? { Authorization: `Bearer ${key}` } : {};
  const r = await fetch(url, { headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? `HTTP ${r.status} from ${url}`);
  const list: string[] = (j.data ?? j.models ?? []).map((m: any) => m.id ?? m.name ?? m.model).filter(Boolean);
  if (!list.length) throw new Error('The server answered but listed no models.');
  return { chat: list.sort(), live: [] };
}
