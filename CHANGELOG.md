# Changelog

All notable versions of LULER. Releases are tagged in git (`vX.Y.Z`).

> **About the history:** versions 1 to 6 were built before this project was under version control. Their code was not kept separately, so the entries below describe what each milestone added; the code for all of it is in **v7.0.0**. From v7.0.0 on, every change is its own commit and every release its own tag.

## v7.1.0 · 2026-11-15 · Free Gemini and live voice
- **Google Gemini** provider (free key from Google AI Studio), now the default: native Gemini API with function calling, so it can drive the app.
- **Live voice** through the **Gemini Live API** (`gemini-3.1-flash-live-preview` by default). Talk with the microphone, interrupt at any time, and get spoken answers; both sides are transcribed into the chat, and voice commands run app actions.
- Settings: "Free" badge, live voice model and voice selection; Fetch models lists Gemini chat and live models separately.

## v7.0.0 · 2026-11-15 · Intelligence and settings
- **LULER Intelligence**: a full-page AI companion. It works with Anthropic, OpenAI, Ollama (local) or any OpenAI-compatible URL. **Fetch models** lists the models available to a key; the companion reads live mission data and can select sites, open views and set dates.
- **Settings page** with General, 3D & graphics, Visibility, Dates & window, Sunlight & power, Earth & radio, Data & calibration, LULER Intelligence, and About & reset. Settings persist in the browser.
- The main page is decluttered: planning controls and globe layer toggles moved into Settings.
- **AI** and **⚙** buttons in the header.
- **Crater detection** from the terrain grid, shown in the Hazards layer.
- **Hazard-avoiding landing**: diverts to the nearest safe spot and explains why.
- Comparison is now "your point vs. the two nearest sites".
- Topography loading screen with a glowing LULER logo.
- Responsive layout for phones (portrait and landscape), tablets and large screens.
- Performance: capped render resolution, no live blur over 3D, lighter animations.
- SF Pro / Google Sans Flex typography; rounded blue glass UI; SpecularButton primary actions.
- Faster far-side terrain loading (no more endless "Loading…").

## v6 · Explainable safety score and checklist features
- Rule-based safety score (0–100) with "Why this score" breakdowns.
- Three-site comparison cards; terrain hazard layer; landing verdict card.

## v5 · React Bits UI pass
- Preloader, depth ribbon mission timeline, drafting cursor for measuring, option wheel, credits loop, About section.
- Blue liquid-glass buttons; removal of orange accents and grain.

## v4 · Realistic surface and lighting
- Cesium Moon terrain in every 3D tab, custom lighting shader with derivative normals.
- True Sun direction with soft shadows; NASA Trek LRO WAC imagery.

## v3 · Mission from launch to landing
- Saturn V from NASA 3D Resources, split into stages with real separation events.
- One tab from launch to touchdown, with controllable stages, bloom and event log.

## v2 · 3D globe and terrain
- three.js Moon globe with every landing and candidate site; flat map; site terrain in 3D; surface walk mode.

## v1 · Data engine
- Python engine: SPICE DE440 Sun/Earth ephemeris, LOLA terrain, horizon masks, sunlight and Earth-visibility metrics.
- Data pipeline from NASA sources to compact web datasets; calendar of the best dates.
