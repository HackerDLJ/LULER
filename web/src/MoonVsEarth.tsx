import type { Stats } from './metrics';

/* Why the Moon is so different: this site's real numbers (NASA LOLA + SPICE, current window) next to Earth. */
const R_MOON = 1737.4e3, R_EARTH = 6371e3, SYNODIC_H = 29.530589 * 24;
const km = (m: number) => (m / 1000).toFixed(1);

export default function MoonVsEarth({ stats, mastM, lat }: { stats: Stats; mastM: number; lat: number }) {
  const h = Math.max(mastM, 1.7); // eye or antenna height above flat ground
  const horizonMoon = Math.sqrt(2 * R_MOON * h), horizonEarth = Math.sqrt(2 * R_EARTH * h);
  const sunRate = 360 / SYNODIC_H; // degrees per hour the Sun crosses the lunar sky
  const night = stats.longestDarkH;
  const rows: [string, string, string, string][] = [
    ['Longest night', night >= 48 ? `${(night / 24).toFixed(1)} days` : `${Math.round(night)} h`, 'about 12 h at most latitudes', 'Batteries and heaters must survive it; no wind or clouds, only terrain decides.'],
    ['Sunlight in this window', `${stats.sunUpPct.toFixed(0)}%`, 'about 50%', Math.abs(lat) > 80 ? 'Near the poles the Sun skims the horizon, so a few metres of ridge or mast change everything.' : 'Away from the poles the Moon has two-week days and two-week nights.'],
    ['How fast the Sun moves', `${sunRate.toFixed(2)}° per hour`, '15° per hour', 'A lunar day lasts 29.5 Earth days, so shadows creep and operating windows last days.'],
    [`Horizon distance (${h.toFixed(1)} m height, flat ground)`, `${km(horizonMoon)} km`, `${km(horizonEarth)} km`, 'The smaller, airless Moon curves away faster, and with no refraction the horizon is set only by terrain.'],
    ['Earth in the sky', `${stats.earthUpPct.toFixed(0)}% of hours`, 'not applicable', 'Earth barely moves in the lunar sky (libration ±7°): it is always up on the near side, never on the far side.'],
  ];
  return (
    <section className="mve" aria-labelledby="mve-h">
      <h2 id="mve-h">Here vs on Earth</h2>
      <p className="mve-lede">Why small changes in place or date matter so much on the Moon. Values for this site and window come from NASA LOLA terrain and SPICE ephemerides.</p>
      <div className="mve-grid">
        {rows.map(([k, moon, earth, why]) => (
          <article key={k} className="mve-card">
            <span className="mve-k">{k}</span>
            <div className="mve-v"><b>{moon}</b><i>here</i><em>{earth}</em><i>on Earth</i></div>
            <p>{why}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
