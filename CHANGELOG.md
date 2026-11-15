# Changelog

All notable versions of LULER. Releases are tagged in git (`vX.Y.Z`).

> **Versions 1 to 6** were built before the project was under version control, so their source code was not saved separately. Each of them is preserved as the **actual compiled website from that milestone**, with its real build date, on the [`history`](../../tree/history) branch, tagged `v1.0.0` to `v6.0.0`. To run one: `git checkout v3.0.0 && python3 -m http.server 8080`. The source code for every feature is on `main` from v7.0.0 on, where every change is its own commit and every release its own tag.

## v7.5.0 · 2026-11-15 · Time of day and Moon vs Earth
- Hour picker next to the date (hourly SPICE data), keeping the current day of the window.
- "Here vs on Earth" panel from the site's real data: longest night, sunlight share, Sun speed across the sky, horizon distance, Earth in the sky.
- README: table mapping every challenge objective to where LULER meets it.

## v7.4.0 · 2026-11-15 · No overlaps, easy scrolling
- Header never overlaps: on windows narrower than 1560 px the view tabs move to their own row under the logo and controls, side panels move down to match, and long site names are shortened with an ellipsis.
- Moon labels never cover each other or the interface: the header, tabs, side panel and site info count as occupied space, and label sizes are measured live.
- Scrolling: a plain scroll over a 3D view now scrolls the page; pinch or ⌘/Ctrl + scroll zooms the view, with a short on-screen hint.

## v7.3.0 · 2026-11-15 · Coordinate preview and mission clock
- Typing coordinates on the flat map drops a live, pulsing preview pin at that exact spot with its coordinates; click it or "Analyse this point" to analyse it.
- Header clock showing the simulated mission time (UTC and date) on every page; hover for your local time. It follows the time slider and "Next sunrise".

## v7.2.0 · 2026-11-15 · Real data everywhere, live NASA
- **Sky charts rebuilt as real graphs**: continuous Sun and Earth tracks from NAIF SPICE DE440 over the NASA LOLA horizon, solid where in view and dashed where blocked, daily date ticks, automatic range (no more "off chart"), labeled current positions, legend, data-source line, and hover tooltips with exact time, azimuth and elevation.
- **Ephemeris verified against JPL Horizons** for the Sun and the Earth at a polar and an equatorial site (Sun within 0.0001°, Earth within 0.0004° in elevation); see docs/validation.md.
- **Live from NASA** (api.nasa.gov): DONKI space weather (radiation storms, solar flares, CMEs, geomagnetic storms) with a radiation status, the latest EPIC photo of Earth from DSCOVR, and NASA Image Library photos of the selected site. The companion also sees the live space weather.
- **No invented content**: removed procedural craters and colour noise from the terrain shader, random boulders and surface grain from the backup terrain; random starfields replaced by the real Yale Bright Star Catalogue (NASA HEASARC), 6,331 stars at their true positions and colours.
- **Site pins** on the 3D Moon and the map redesigned and animated with GSAP: glowing dots (solid = landed, ring = candidate), clean labels, and a pulsing selection.

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

## v6.0.0 · 2026-11-15 · Explainable safety score
- Rule-based safety score (0–100) with "Why this score" breakdowns.
- Three-site comparison cards; terrain hazard layer; landing verdict card.

## v5.0.0 · 2026-11-15 · React Bits interface
- Preloader, depth ribbon mission timeline, drafting cursor for measuring, option wheel, credits loop, About section.
- Blue liquid-glass buttons; removal of orange accents and grain.

## v4.0.0 · 2026-11-15 · Realistic Sun lighting
- Cesium Moon terrain in every 3D tab, custom lighting shader with derivative normals.
- True Sun direction with soft shadows; NASA Trek LRO WAC imagery.

## v3.0.0 · 2026-11-15 · Mission from launch to landing
- Saturn V from NASA 3D Resources, split into stages with real separation events.
- One tab from launch to touchdown, with controllable stages, bloom and event log.

## v2.0.0 · 2026-11-15 · Cesium Moon terrain everywhere
- Cesium Moon terrain (NASA LOLA/LROC) in every 3D tab, NASA Trek LRO WAC imagery, first rocket stage-separation work.

## v1.0.0 · 2026-11-14 · First web app
- three.js Moon globe with every landing and candidate site; flat map; site terrain in 3D; surface walk mode.
- Python engine: SPICE DE440 Sun/Earth ephemeris, LOLA terrain, horizon masks, sunlight and Earth-visibility metrics.
- Data pipeline from NASA sources to compact web datasets; calendar of the best dates.
