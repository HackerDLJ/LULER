# LULER · Lunar Landing Site Navigator

**Where on the Moon can you land, and when?**
LULER is an interactive 3D mission planner that scores lunar landing sites using real NASA data: terrain, sunlight, Earth visibility, slope and craters. It flies the whole mission from a Saturn V launch to a hazard-avoiding touchdown.

Built by **Team JATABELS** for the **NASA Space Apps Challenge 2026**.

> Unofficial project. Not a NASA product. All scientific inputs come from public NASA data.

---

## Highlights

| | Feature | Where to find it |
|---|---|---|
| 🌕 | **3D Moon globe** with every historical landing (Apollo, Luna, Chang'e, Chandrayaan, SLIM, CLPS) and Artemis south-pole candidates | **Moon → 3D globe** |
| 🗺️ | **Flat map** with LROC imagery, coordinate readout and a measuring tool (shift-drag) | **Moon → Flat map + coordinates** |
| ⛰️ | **Real terrain in 3D** (Cesium Moon terrain) lit by the true Sun position, with soft shadows | **Site → Terrain** |
| ⚠️ | **Hazard map and crater detection**: slope classes plus automatically detected craters (diameter and depth) from the terrain | **Site → Terrain → Hazards** |
| 🚀 | **Full mission**: Saturn V launch, stage separation (S-IC, S-II, S-IVB, SLA panels, LES), then powered descent, every stage controllable | **Site → Mission: launch → landing** |
| 🛬 | **Hazard-avoiding landing**: if the target is too steep or inside a crater, the lander diverts to the nearest safe spot and reports why | End of the mission |
| 🧭 | **Surface mode**: walk or drive the surface and mark a new touchdown point | **Surface** |
| ✅ | **Explainable safety score (0–100)** from measured inputs, never a black box | Score chip on every view |
| ⚖️ | **Your point vs. the two nearest sites**: comparison updates for any point you click | Below the 3D view |
| 📅 | **Calendar of sunlight and Earth contact** for every day of 2027–2028 | **Dates** |
| ✦ | **LULER Intelligence**: an AI companion (free with Google Gemini) with **live voice**; it reads the live mission data and can drive the app | **AI** button (top right) |
| ⚙️ | **Settings** for graphics, visibility, dates, sunlight, radio link, data and AI | **⚙** button (top right) |

### The safety score

Rule-based and fully explainable. Open "Why this score" on any card to see each input.

| Factor | Points |
|---|---|
| Slope at touchdown | 30 |
| Sunlight (share of hours lit) | 25 |
| Earth in view (direct radio link) | 20 |
| Steepest ground nearby | 10 |
| Longest night | 10 |
| Terrain relief | 5 |

**Good** ≥ 75 · **Fair** ≥ 50 · **Poor** below 50.

---

## NASA data

| Data | Used for |
|---|---|
| **LRO LOLA** global and polar DEMs (PDS Geosciences Node) | Terrain, slope, horizon masks |
| **NASA PGDA 5 m polar DEMs** with error maps | High-resolution south-pole terrain and uncertainty bands |
| **LROC** mosaics (NASA SVS CGI Moon Kit, Moon Trek / LRO WAC) | Imagery on the globe, map and terrain |
| **NAIF SPICE DE440** and lunar orientation kernels | Sun and Earth positions for every hour |
| **JPL Horizons** | Independent cross-check of the ephemeris |
| **NASA 3D Resources** | Saturn V and Apollo LM models |
| **Cesium ion Moon terrain** (asset 2684829, built from NASA LOLA/LROC) | Streaming 3D terrain |

---

## LULER Intelligence (AI companion)

Open **⚙ Settings → LULER Intelligence** and connect any model:

| Provider | Base URL | Key |
|---|---|---|
| **Google Gemini (free)** | `https://generativelanguage.googleapis.com/v1beta` | free key from [Google AI Studio](https://aistudio.google.com) |
| Anthropic | `https://api.anthropic.com/v1` | required |
| OpenAI | `https://api.openai.com/v1` | required |
| Ollama (local) | `http://localhost:11434/v1` | not needed (start Ollama with `OLLAMA_ORIGINS=*`) |
| Any OpenAI-compatible server (LM Studio, vLLM, OpenRouter…) | your URL | optional |

Press **Fetch models** to list the models that key can use at that URL, pick one, then open the **AI** page.
Keys are stored only in your browser (localStorage) and are sent only to the URL you entered.

### Live voice

With Google Gemini connected, press the **microphone** on the AI page to talk to LULER. It uses the **Gemini Live API** (default model `gemini-3.1-flash-live-preview`, voice selectable in Settings). You can interrupt it at any time; both sides of the conversation are transcribed into the chat, and voice commands such as "set the date to June first" or "take me to Shackleton rim" drive the app.

The companion sees the selected site, date, safety score, sunlight and Earth numbers, and every site's score. It can **select sites, open views and change dates** for you.

---

## Run it locally

```bash
# 1. Web app
cd web
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in web/dist

# 2. (Optional) Rebuild the data from NASA sources
pip install -r requirements.txt
python3 scripts/fetch_nasa_data.py     # downloads LOLA, SPICE kernels, imagery (several GB, into data/raw)
python3 scripts/build_data.py          # sunlight / Earth-visibility tables
python3 scripts/build_globe.py && python3 scripts/build_patches.py && python3 scripts/build_textures.py
```

## Project structure

```
engine/    Python science engine: ephemeris (SPICE), terrain, horizon masks, metrics
scripts/   Data pipeline: fetch NASA data and build the web datasets
tests/     Engine tests
data/      processed/ datasets (raw/ downloads are not committed)
web/       React + TypeScript + Vite app
  src/       App, 3D views (three.js, CesiumJS), score, hazards, AI companion, settings
  public/    Site data, Moon textures, 3D models
docs/      Notes
```

**Stack:** React 18, TypeScript, Vite, three.js, CesiumJS, GSAP, React Bits components. Python with SpiceyPy and NumPy for the data engine.

---

## Versions

| Version | What it brought | Where |
|---|---|---|
| **v7.1.0** | Free Google Gemini, live voice (Gemini Live API) | `main` |
| **v7.0.0** | LULER Intelligence, Settings, crater detection, hazard-avoiding landing | `main` |
| v6.0.0 | Explainable safety score, hazard layer, comparison cards | `history` branch |
| v5.0.0 | React Bits interface, preloader, glass buttons | `history` branch |
| v4.0.0 | Realistic Sun lighting on the terrain | `history` branch |
| v3.0.0 | Saturn V mission from launch to landing | `history` branch |
| v2.0.0 | Cesium Moon terrain in every 3D view | `history` branch |
| v1.0.0 | First web app: globe, map, terrain, sunlight data | `history` branch |

Every version is a git tag. v1 to v6 are the real compiled websites from each milestone (`git checkout v3.0.0 && python3 -m http.server 8080`). Details in [CHANGELOG.md](CHANGELOG.md).

## Team JATABELS

Luke Jebasundar D (lead) · Jachin Gnanaraj I · Alfreda Jenilyn N · Jerry Daniel P · Ananth M · Jaziya S

Made for the NASA Space Apps Challenge 2026.
