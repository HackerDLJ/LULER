/* ============================================================
   LULER ROVER — mission briefings, field notes and samples
   Team JATABELS · NASA Space Apps Challenge 2026
   ============================================================ */

export const CODEX = [
  {
    id: 'dossier', tag: 'BRIEFING', title: 'LULER ROVER SURVEY', meta: 'TEAM JATABELS · SITE SURVEY',
    start: true,
    body: [
      `Before any crew lands, someone has to drive the ground. LULER Rover puts you at the controls of a six-wheel survey rover parked beside the lander at the landing site you picked in LULER.`,
      `The hills, slopes and crater rims around you come from NASA LRO laser altimeter (LOLA) elevation data for this exact site. Small rocks and metre-scale craters are added for detail, because no orbiter can map pebbles.`,
      `Your job: check the ground is safe, keep the radio link to Earth, and bring back samples a crew would need.`,
      `Gravity here is 1.62 m/s², one sixth of Earth's. Everything is lighter, but it still has all its mass, so it takes just as long to stop.`
    ]
  },
  {
    id: 'geology', tag: 'GEOLOGY', title: 'WHAT YOU ARE DRIVING ON', meta: 'SURVEY PRIMER',
    start: true,
    body: [
      `Regolith is the broken rock and glass that covers the whole Moon, a few metres deep on the maria and deeper in the highlands. It is made by four billion years of meteorite impacts.`,
      `It packs hard a few centimetres down but the top layer is loose. Wheels sink, slip on slopes above about 20°, and throw dust that flies in clean arcs: there is no air to slow it.`,
      `Fresh craters are bright with sharp rims; old ones are soft and dark. The difference tells you how long the surface has been exposed.`
    ]
  },
  {
    id: 'first-return', tag: 'FIELD NOTE', title: 'FIRST RADAR RETURN', meta: 'GPR · ECHO 001',
    body: [
      `Ground-penetrating radar sends pulses into the regolith and listens for echoes from buried layers and rocks.`,
      `A strong echo a metre or two down usually means a boulder or a buried crater floor: what a habitat foundation, or a drill, would hit first.`,
      `Mark it, drive to it, and core it.`
    ]
  },
  {
    id: 'lattice', tag: 'ANALYSIS', title: 'VOLCANIC GLASS', meta: 'SAMPLE 007 · PETROGRAPHY',
    body: [
      `Tiny beads of orange and black glass: lava sprayed from fire fountains about 3.6 billion years ago, cooled in flight.`,
      `Apollo 17 found the same material at Shorty crater. The beads carry volatiles such as zinc, sulfur and water from deep inside the Moon.`,
      `They are a resource: heated, they release oxygen.`
    ]
  },
  {
    id: 'roster', tag: 'TEAM', title: 'TEAM JATABELS', meta: 'NASA SPACE APPS 2026',
    body: [
      `Luke Jebasundar D (Team Lead), Jachin Gnanaraj I, Alfreda Jenilyn N, Jerry Daniel P, Ananth M, Jaziya S.`,
      `From Tirunelveli, Tamil Nadu, India.`
    ]
  },
  {
    id: 'log6', tag: 'SURVEY LOG', title: 'SOL 6', meta: 'ROVER LOG',
    body: [
      `Array deployed, batteries full. Wheel slip under 8 % on the flat, 30 % on the crater wall.`,
      `Lesson: approach slopes straight on, never across.`
    ]
  },
  {
    id: 'log11', tag: 'SURVEY LOG', title: 'SOL 11', meta: 'ROVER LOG',
    body: [
      `Shadows are the real danger. In low sun a one-metre rock throws a shadow twenty metres long, and the camera cannot see into it.`,
      `This is why LULER plans landings for times when the Sun is high enough, but not so high that the ground looks flat.`
    ]
  },
  {
    id: 'memo', tag: 'MISSION CONTROL', title: 'WHY A RELAY CHAIN', meta: 'COMMUNICATIONS NOTE',
    body: [
      `Radio travels in straight lines. Behind a hill or down in a crater, the rover loses Earth.`,
      `Relays placed on high ground pass the signal along. LULER's "Earth in view" check does the same sum for the landing site: is Earth above the real horizon?`
    ]
  },
  {
    id: 'charge', tag: 'ANALYSIS', title: 'SOLAR WIND', meta: 'SAMPLE 019 · GRAIN SURFACES',
    body: [
      `With no magnetic field and no air, the solar wind hits the ground directly. Hydrogen and helium-3 soak into the outer microns of every grain.`,
      `Over billions of years the regolith has become a store of implanted volatiles, one reason future bases want to dig it.`
    ]
  },
  {
    id: 'lasthour', tag: 'SURVEY LOG', title: 'SUNSET', meta: 'ROVER LOG',
    body: [
      `Sunset on the Moon lasts hours and night lasts about two weeks. Temperatures drop toward -170 °C.`,
      `A lander that cannot survive the night has to finish its work in one lunar day. LULER's "longest night" number exists for exactly this reason.`
    ]
  },
  {
    id: 'node', tag: 'FIELD NOTE', title: 'DEEP CORE', meta: 'HIGH GROUND · 2 m CORE',
    body: [
      `A deep core is a timeline: every layer is a different impact, a different age.`,
      `This one completes the survey of the site.`
    ]
  },
  {
    id: 'transmission', tag: 'COMPLETE', title: 'SURVEY TRANSMITTED', meta: 'RELAY CHAIN NOMINAL · UPLINK OPEN',
    body: [
      `Ground checked, radio link proven, samples cored. The site survey is on its way to Earth.`,
      `This is what LULER is for: knowing a landing site before anyone lands there.`
    ]
  }
];

/* ---------------- sample taxonomy ---------------- */
export const SAMPLES = {
  regolith: { name: 'REGOLITH CORE', rare: false, value: 1, desc: 'Mature soil: about 40 % pore space, rich in impact glass.' },
  breccia: { name: 'IMPACT BRECCIA', rare: false, value: 2, desc: 'Rock shattered and welded back together by an impact.' },
  ilmenite: { name: 'ILMENITE', rare: false, value: 2, desc: 'FeTiO₃. Heated with hydrogen it gives water, and so oxygen.' },
  agglutinate: { name: 'AGGLUTINATE', rare: false, value: 2, desc: 'Soil grains glued by micrometeorite melt. Typical lunar weathering.' },
  pyroclast: { name: 'VOLCANIC GLASS BEADS', rare: true, value: 4, desc: 'Orange glass from fire fountains about 3.6 billion years ago.' },
  meteoritic: { name: 'METEORITIC IRON', rare: true, value: 4, desc: 'Iron-nickel fragment from an asteroid impact.' },
  tube: { name: 'GLASS BEAD CLUSTER', rare: true, value: 6, desc: 'Volcanic glass carrying volatiles from the deep Moon.', unlock: 'lattice' },
  film: { name: 'SOLAR-WIND GRAINS', rare: true, value: 8, desc: 'Grains loaded with implanted hydrogen and helium-3.', unlock: 'charge' },
  core: { name: 'DEEP CORE', rare: true, value: 12, desc: 'Two metres of layered impact history.', unlock: 'node' }
};

/* ---------------- missions ---------------- */
export const MISSIONS = [
  {
    id: 'coldstart', tag: 'MISSION 01', name: 'POWER UP',
    brief: `The rover is parked beside the lander. Open the solar array, drive away from the lander and run your first radar sweep.`,
    objectives: [
      { id: 'deploy', text: 'Deploy the solar array', hint: 'press T' },
      { id: 'drive', text: 'Drive 120 m from the lander' },
      { id: 'scan', text: 'Run one ground-penetrating radar sweep', hint: 'press G' }
    ]
  },
  {
    id: 'firstecho', tag: 'MISSION 02', name: 'SUBSURFACE SURVEY',
    brief: `The radar found buried targets. Drive to them, core them, and bring the samples back to the lander.`,
    objectives: [
      { id: 'find3', text: 'Excavate 3 subsurface targets', count: 3 },
      { id: 'home1', text: 'Return the samples to the lander' }
    ]
  },
  {
    id: 'relay', tag: 'MISSION 03', name: 'RELAY CHAIN',
    brief: `Hills block the radio link to Earth. Place relays on high ground so the rover can keep talking to Earth anywhere on the site.`,
    objectives: [
      { id: 'relays', text: 'Deploy 3 relays on high ground', count: 3, hint: 'press B on ground above 10 m, 95 m apart' }
    ]
  },
  {
    id: 'station', tag: 'MISSION 04', name: 'SURVEY BEACON',
    brief: `An earlier survey beacon stopped reporting. Drive to it and download its data logs.`,
    objectives: [
      { id: 'reach', text: 'Reach the survey beacon' },
      { id: 'recover', text: 'Download the data logs', hint: 'hold E at the hatch' }
    ]
  },
  {
    id: 'node', tag: 'MISSION 05', name: 'DEEP CORE',
    brief: `Finish the survey: take a deep core from the high ground, then return to the lander and transmit everything to Earth.`,
    objectives: [
      { id: 'massif', text: 'Reach the high ground' },
      { id: 'deep', text: 'Extract the deep core' },
      { id: 'transmit', text: 'Return to the lander and transmit' }
    ]
  }
];
