# Changelog

All notable versions of LULER. Releases are tagged in git (`vX.Y.Z`).

> **Versions 1 to 6** were built before the project was under version control, so their source code was not saved separately. Each of them is preserved as the **actual compiled website from that milestone**, with its real build date, on the [`history`](../../tree/history) branch, tagged `v1.0.0` to `v6.0.0`. To run one: `git checkout v3.0.0 && python3 -m http.server 8080`. The source code for every feature is on `main` from v7.0.0 on, where every change is its own commit and every release its own tag.

## v7.17.1 · 2026-11-18
- AI orb now shows on the LULER Intelligence page even before a model is connected, centred above the start card.

## v7.17.0 · 2026-11-18
- LULER Intelligence: a blue and purple light orb (React Bits Strands, MIT) appears once a model is connected and stirs while LULER thinks. In live voice it reacts to the real audio: your voice while it listens, LULER's voice while it speaks.

## v7.16.2 · 2026-11-18
- LULER Rover: the menu no longer clips the "LULER ROVER" title in shorter windows; it fits or scrolls inside the frame.

## v7.16.1 · 2026-11-18
- Surface: removed the "Walk the site · mark touchdown" mode. Surface opens the LULER Rover directly.

## v7.16.0 · 2026-11-18
- Magnifying glass on the flat map: a liquid-glass lens (React Bits FluidGlass, MIT) follows the cursor over the map and bends the real map image, including the sharper LRO tiles when zoomed. 🔍 turns it on or off. The lens magnifies 2.5× and follows the cursor with no trailing.
- Spacecraft: LLCD, Saturn V, SLS, Vikram and Chandrayaan-2 now open in the React Bits ModelViewer (MIT): studio lighting, drag with momentum, pinch or ⌘/Ctrl + scroll to zoom, double-click to reset.

## v7.15.0 · 2026-11-18
- Flat map zoom and pan: pinch, ⌘/Ctrl + scroll or the +/− buttons zoom around the cursor (up to 32×), drag pans, ⤢ shows the whole Moon. Sharper NASA Trek LRO WAC tiles load for the visible area when zoomed. Dragging no longer drops a point by accident.

## v7.14.1 · 2026-11-16 · Check-up
- Checked every page (Moon, flat map, timeline, Site, Mission, Spacecraft, Surface rover and walk, Dates, Team) on laptop and phone sizes: no script errors.
- Right-hand panels (Look at, site data, walk controls) now end above the bottom details instead of running under them; walk controls no longer overlap the sub-tabs on phones.

## v7.14.0 · 2026-11-16
- Spacecraft view: Saturn V, SLS (Artemis), Chandrayaan-3 Vikram and Chandrayaan-2 3D models, each credited.
- Controls stay visible when the 3D view is cleared.

## v7.13.0 · 2026-11-16
- Walk the site restored, with a real regolith texture (crater normal map and tone) tiled over the whole Moon near the camera: no edges, mipmapped so it does not shimmer.

## v7.12.0 · 2026-11-16
- LULER Rover missions rebuilt around LULER and real missions: site check (Apollo 11), sample return, Earth link (LULER Earth-in-view, Artemis relays), old-lander visit (Apollo 12 at Surveyor 3) and deep core (Apollo 15).

## v7.11.1 · 2026-11-16
- Surface tab is LULER Rover only (the flat grey walk mode is removed); "walk the surface" buttons after landing open LULER Rover at that site.

## v7.11.0 · 2026-11-16 · LULER Rover
- The rover simulation is now LULER Rover: drives on the real NASA LOLA elevation of the selected landing site, with LULER missions (power up, subsurface survey, relay chain, survey beacon, deep core), real lunar science notes and Team JATABELS branding. Built on the REGOLITH engine by winch (MIT licence, kept in web/public/rover/LICENSE).
- Full-screen button for the rover simulation.

## v7.10.1 · 2026-11-16
- Surface tab opens the rover simulation first; the walk mode on NASA terrain is the second sub-tab. Surface terrain detail back to the normal level (the finest level loaded slowly and looked flat grey).

## v7.10.0 · 2026-11-16 · Rover simulation
- Surface tab now has two modes: "Walk the site" on real NASA/Cesium terrain, and "Rover simulation": a full 1/6 g six-wheel rover game (REGOLITH by winch, MIT licence, credited).
- Reverted the surface micro-texture and HDR glare from v7.8.4/v7.9.0, which caused ring artefacts and blown-out white ground.

## v7.9.0 · 2026-11-16 · Surface simulation
- Jump with Space under real lunar gravity (1.62 m/s²: about 0.8 m high, 2 s in the air).
- Low-gravity walking lope (head bob and sway scaled to speed).
- HDR and bloom on the surface and during descent so the unfiltered Sun glares realistically.

## v7.8.9 · 2026-11-16
- LULER logo stays visible when overlays hide; tap-to-hide now covers every 3D page (Moon globe, Site, Surface, Mission, Spacecraft).
- Surface: Cesium Moon Terrain streams at full detail (screen-space error 1) when standing on the ground.

## v7.8.8 · 2026-11-16
- Tap or drag the 3D surface to hide every overlay and see the terrain clearly; scroll to bring them back with a blur-in animation. Bottom details restored to full size.

## v7.8.7 · 2026-11-16
- Compact bottom details (smaller site name and status lines) and a shorter side panel, so the 3D terrain stays visible; the Team tab no longer clips.

## v7.8.6 · 2026-11-16
- Flat map: switch between the LRO camera map and the 3D Moon colour map; only one is shown at a time (no overlapping layers).

## v7.8.5 · 2026-11-16
- Flat map: full-width map (whole Moon visible); the time bar sits below it.

## v7.8.4 · 2026-11-15
- Team: each member's ID card swings in the first time it is shown.
- Surface (Cesium): regolith micro-relief and tone variation close to the camera (texture only, no data changed).

## v7.8.3 · 2026-11-15
- Ananth M photo added; all six team cards complete.
- Surface view: regolith micro-texture (bump and roughness) so the ground no longer looks polished. It is a texture only and changes no measured value.

## v7.8.2 · 2026-11-15
- Photos added for Alfreda Jenilyn N, Jaziya S and Jerry Daniel P.

## v7.8.1 · 2026-11-15
- Team page fills the whole screen: the lanyard hangs from the top bar with no frame, a GridScan room sits behind it, and the member wheel fades out with a gradual blur.

## v7.8.0 · 2026-11-15 · Full team
- Team is now a tab beside Dates.
- All six JATABELS members on the option wheel; Jachin Gnanaraj I photo added.
- The ID card swings across the whole page with no frame around it.

## v7.7.1 · 2026-11-15
- AI page names Google Gemini (free) as the first option.
- Team page shows a flat ID card when 3D is unavailable.

## v7.7.0 · 2026-11-15 · Team page
- New Team page (button next to the date): a 3D hanging ID card for each member of team JATABELS, with name, role, photo and member ID; an option wheel switches between members.
- First card: Luke Jebasundar D, Team Lead.

## v7.6.2 · 2026-11-15 · Fixes
- Clicked-point and touchdown labels no longer stack on top of each other; touchdown labels are one clean line.
- Hour selector in the header no longer shows a stray box border.

## v7.6.0 · 2026-11-15 · Polish and accuracy
- Mission clock is now a 24-hour UTC hour selector (replaces the browser's AM/PM time picker), keeping the current day of the window.
- Moon labels: overlap check now uses each label's real on-screen box, so no label covers another or the interface.
- Phones: one finger scrolls the page, two fingers turn and zoom the Moon.
- Click anywhere on the site terrain to pin and read its exact latitude, longitude, elevation and slope.
- Plan several touchdowns: each double-click adds a numbered point (T1, T2, …) with its coordinates; "Clear all touchdowns" removes them.
- Welcome page accuracy figure corrected to the verified value: Sun direction within 0.00001° of JPL Horizons.

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
