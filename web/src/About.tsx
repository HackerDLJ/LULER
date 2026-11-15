import type { Manifest } from './data';
import MagicBento from './rb/MagicBento.jsx';
const V = (big: string, small: string) => <div className="bv"><b>{big}</b><span>{small}</span></div>;
const BENTO = [
  { label: 'POWER', title: 'Sun above the terrain', description: 'Every hour of 2027–2028, with the Sun treated as a disc against the real horizon.', visual: V('17,544 h', 'hourly Sun + Earth checks, 2027–2028'), colSpan: 2 },
  { label: 'LINK', title: 'Earth in view', description: 'Direct-to-Earth radio only works when Earth clears the ridges and your antenna minimum.', visual: V('25 sites', 'landings and candidate regions') },
  { label: 'SAFETY', title: 'Slope at touchdown', description: 'LOLA 20 m and 80 m terrain grids give the ground slope under the lander.', visual: V('20 m · 80 m', 'LOLA terrain grids') },
  { label: 'DATA', title: 'NASA only', description: 'LRO LOLA, LROC, NAIF SPICE and JPL Horizons, cross-checked.', visual: V('≤ 0.00001°', 'Sun direction vs JPL Horizons') },
  { label: 'MISSION', title: 'Launch to landing', description: 'A Saturn V stack and the Apollo LM, flown onto Cesium Moon terrain.', visual: V('S-IC → LM', 'stage by stage, onto real terrain'), colSpan: 2 },
  { label: 'TEAM', title: 'JATABELS', description: 'Six students, one website, every landing site on the Moon.', visual: V('6', 'members · Team JATABELS') },
];
const B = import.meta.env.BASE_URL;

export default function About({ manifest }: { manifest: Manifest }) {
  return (
    <section aria-labelledby="about-h" className="about">
      <MagicBento items={BENTO} columns={4} rowHeight={190} gap={10} radius={2} glowColor="111, 168, 255" enableStars={false} enableSpotlight={false} enableBorderGlow={false} enableTilt={false} clickEffect={false} enableMagnetism={false} particleCount={0} />
      <h2 id="about-h">How this works, and how far to trust it</h2>
      <div className="cols">
        <div>
          <h3>What it calculates</h3>
          <p>
            For each site and every hour from 2027 to 2028 it finds where the Sun and Earth sit in the sky. It then checks them against the real terrain
            horizon around the site. The Sun is treated as a disc, so a ridge that covers half of it counts as half the power. Earth counts as in view
            when it clears the terrain and your antenna minimum.
          </p>
          <h3>NASA data used (nothing else)</h3>
          <ul>
            <li><strong>Positions:</strong> {manifest.data_sources.ephemeris}.</li>
            <li><strong>Terrain:</strong> {manifest.data_sources.terrain}.</li>
            <li><strong>Cross-check:</strong> JPL Horizons.</li>
          </ul>
        </div>
        <div>
          <h3>Checks that were actually run</h3>
          <ul>
            <li>Sun direction vs JPL Horizons at a south pole site: difference at most 0.00001° over 7 hourly points.</li>
            <li>Terrain map orientation confirmed using the deepest points of Shackleton, Shoemaker, Faustini and Haworth, and the heights of Malapert and Nobile.</li>
            <li>Horizon code matches an exact analytic answer on synthetic terrain to within 0.01°.</li>
            <li>Browser results match the independent Python calculation to within 0.04 percentage points.</li>
          </ul>
          <h3>Limits you should know</h3>
          <ul>
            <li>Site points are provisional region centres, not landing ellipses. The Sun sits within about 1.5° of the horizon here, so moving 100 m can change sunlight by tens of points. That is why ranges are shown.</li>
            <li>Terrain is the LOLA 80 m grid (far field) and 20 m grid (near field). Small boulders and slopes are not resolved.</li>
            <li>The terrain map uses the DE421 version of the Moon's reference frame and positions use DE440. The mismatch is expected to be small but is not yet quantified.</li>
            <li>This is a planning aid for comparing sites, not flight-certified. It is an unofficial NASA Space Apps 2026 project, not a NASA product.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
