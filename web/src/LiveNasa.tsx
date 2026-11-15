import { useEffect, useState } from 'react';
import { epicLatest, sitePhotos, spaceWeather, type EarthImage, type NasaPhoto, type SpaceWeather } from './nasa';

const ago = (t: string) => { const h = (Date.now() - Date.parse(t)) / 3600e3; return h < 1 ? 'under 1 h ago' : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`; };
const fmt = (t: string) => t ? t.replace('T', ' ').replace(/:\d\d(\.\d+)?Z$|Z$/, '').slice(0, 16) + ' UTC' : '';

export default function LiveNasa({ site }: { site: { name: string; mission?: string } }) {
  const [sw, setSw] = useState<SpaceWeather | null>(null);
  const [swErr, setSwErr] = useState('');
  const [earth, setEarth] = useState<EarthImage | null>(null);
  const [photos, setPhotos] = useState<{ query: string; photos: NasaPhoto[] } | null>(null);
  useEffect(() => { spaceWeather().then(setSw).catch((e) => setSwErr(e.message)); epicLatest().then(setEarth).catch(() => setEarth(null)); }, []);
  useEffect(() => { setPhotos(null); sitePhotos(site.name, site.mission).then(setPhotos).catch(() => setPhotos({ query: site.name, photos: [] })); }, [site.name, site.mission]);

  const lastFlare = sw?.flares?.[0], lastCme = sw?.cme?.[0];
  const xm = sw?.flares ? sw.flares.filter((f) => /^[XM]/.test(f.cls ?? '')).length : null;
  return (
    <section className="live" aria-labelledby="live-h">
      <h2 id="live-h">Live from NASA</h2>
      <p className="live-lede">Real-time conditions that matter on the Moon, fetched now from NASA's open APIs.</p>
      <div className="live-grid">
        <article className={`live-card sw ${sw?.level ?? ''}`}>
          <header><b>Space weather</b><span>NASA DONKI · last 30 days</span></header>
          {!sw && !swErr && <p className="live-wait">Loading NASA DONKI…</p>}
          {swErr && <p className="live-wait">DONKI is not reachable right now.</p>}
          {sw && (<>
            <p className={`live-pill ${sw.level}`}>{sw.headline}</p>
            <ul className="live-stats">
              <li><b>{sw.sep ? sw.sep.length : '–'}</b><span>radiation storms (SEP){sw.sep?.[0] ? ` · last ${ago(sw.sep[0].time)}` : ''}</span></li>
              <li><b>{xm ?? '—'}</b><span>{xm === null ? 'M/X solar flares · NASA flare feed (DONKI FLR) is offline right now' : `M/X solar flares${lastFlare ? ` · last ${lastFlare.cls}, ${ago(lastFlare.peak)}` : ''}`}</span></li>
              <li><b>{sw.cme ? sw.cme.length : '–'}</b><span>coronal mass ejections{lastCme?.speed ? ` · last ${Math.round(lastCme.speed)} km/s` : ''}</span></li>
              <li><b>{sw.storms ? sw.storms.length : '–'}</b><span>geomagnetic storms at Earth{sw.storms?.[0] ? ` · max Kp ${sw.storms[0].kp}` : ''}</span></li>
            </ul>
            <p className="live-note">The Moon has no atmosphere or magnetic field, so solar radiation storms reach the surface directly. Data {sw.from} to {sw.to}, fetched {fmt(sw.fetched)}.</p>
          </>)}
        </article>
        <article className="live-card earth">
          <header><b>Earth right now</b><span>NASA EPIC · DSCOVR</span></header>
          {earth ? (<>
            <img src={earth.url} alt={`Earth photographed by NASA EPIC on ${earth.date}`} loading="lazy" />
            <p className="live-note">The planet your radio link points at, photographed {earth.date} from 1.5 million km{Number.isFinite(earth.lat) ? `, centred on ${earth.lat.toFixed(1)}°, ${earth.lon.toFixed(1)}°` : ''}.</p>
          </>) : <p className="live-wait">Loading the latest EPIC image…</p>}
        </article>
        <article className="live-card photos">
          <header><b>NASA imagery</b><span>{photos ? `“${photos.query}”` : site.name} · NASA Image Library</span></header>
          {!photos && <p className="live-wait">Searching NASA's archive…</p>}
          {photos && !photos.photos.length && <p className="live-wait">No NASA photos found for this place.</p>}
          {photos && photos.photos.length > 0 && (
            <div className="live-ph">{photos.photos.map((p) => (
              <a key={p.link} href={p.link} target="_blank" rel="noreferrer" title={`${p.title} (${p.date})`}><img src={p.thumb} alt={p.title} loading="lazy" /></a>
            ))}</div>
          )}
        </article>
      </div>
    </section>
  );
}
