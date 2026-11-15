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
| ✦ | **LULER Intelligence**: an AI companion that reads the live mission data and can drive the app | **AI** button (top right) |
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
| Anthropic | `https://api.anthropic.com/v1` | required |
| OpenAI | `https://api.openai.com/v1` | required |
| Ollama (local) | `http://localhost:11434/v1` | not needed (start Ollama with `OLLAMA_ORIGINS=*`) |
| Any OpenAI-compatible server (LM Studio, vLLM, OpenRouter…) | your URL | optional |

Press **Fetch models** to list the models that key can use at that URL, pick one, then open the **AI** page.
Keys are stored only in your browser (localStorage) and are sent only to the URL you entered.

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

See [CHANGELOG.md](CHANGELOG.md). Each release is a git tag (`git tag -l`).

## Team JATABELS

Luke Jebasundar D (lead) · Jachin Gnanaraj I · Alfreda Jenilyn N · Jerry Daniel P · Ananth M · Jaziya S

Made for the NASA Space Apps Challenge 2026.
