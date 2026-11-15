import { useMemo, useState, type ReactNode } from 'react';
import type { Manifest, Site } from './data';
import { maskAt } from './metrics';
import { START_MS, N_DAYS } from './format';
import { EVENTS } from './events';
import SpecularButton from './rb/SpecularButton.jsx';

interface Props {
  site: Site;
  manifest: Manifest;
  mastIdx: number;
  earthMin: number;
  day: number;
  onDay: (d: number) => void;
  onGo: () => void;
  chrome?: ReactNode;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ site, manifest, mastIdx, earthMin, day, onDay, onGo, chrome }: Props) {
  const sel = new Date(START_MS + day * 86400e3);
  const [ym, setYm] = useState<[number, number]>([sel.getUTCFullYear(), sel.getUTCMonth()]);
  const [y, m] = ym;
  const nAz = manifest.n_az;
  const base = mastIdx * manifest.offsets_m.length * nAz;

  const stat = useMemo(() => {
    const f = (d: number) => {
      let sun = 0, earth = 0, both = 0, maxEl = -90;
      const flips: string[] = [];
      let prev: boolean | null = d > 0 ? site.sunEl[d * 24 - 1] > maskAt(site.hz, base, nAz, site.sunAz[d * 24 - 1]) : null;
      for (let h = 0; h < 24; h++) {
        const i = d * 24 + h;
        const sv = site.sunEl[i] > maskAt(site.hz, base, nAz, site.sunAz[i]);
        const ev = site.earthEl[i] > Math.max(maskAt(site.hz, base, nAz, site.earthAz[i]), 0) + earthMin;
        if (sv) sun++;
        if (ev) earth++;
        if (sv && ev) both++;
        maxEl = Math.max(maxEl, site.sunEl[i]);
        if (prev !== null && sv !== prev) flips.push(`${sv ? 'Sunrise' : 'Sunset'} about ${String(h).padStart(2, '0')}:00 UTC`);
        prev = sv;
      }
      return { sun, earth, both, maxEl, flips };
    };
    const cache = new Map<number, ReturnType<typeof f>>();
    return (d: number) => { let v = cache.get(d); if (!v) { v = f(d); cache.set(d, v); } return v; };
  }, [site, base, nAz, earthMin]);

  const first = new Date(Date.UTC(y, m, 1));
  const nDays = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: nDays }, (_, i) => i + 1)];
  const idx = (dd: number) => Math.round((Date.UTC(y, m, dd) - START_MS) / 86400e3);
  const move = (k: number) => { const t = y * 12 + m + k; if (t >= 2027 * 12 && t <= 2028 * 12 + 11) setYm([Math.floor(t / 12), t % 12]); };

  const s = stat(day);
  const today = EVENTS.filter((e) => e.m === sel.getUTCMonth() + 1 && e.d === sel.getUTCDate());
  const doy = (mm: number, dd: number) => mm * 32 + dd;
  const upcoming = today.length ? [] : [...EVENTS].sort((a, b) => ((doy(a.m, a.d) - doy(sel.getUTCMonth() + 1, sel.getUTCDate()) + 500) % 500) - ((doy(b.m, b.d) - doy(sel.getUTCMonth() + 1, sel.getUTCDate()) + 500) % 500)).slice(0, 3);
  const verdict = s.sun === 0 ? 'No sunlight at all on this day. A solar-powered lander would be running on stored energy and heaters only.'
    : s.earth === 0 ? 'Earth is never in view on this day. Every signal would need a relay satellite.'
    : s.sun === 24 && s.earth === 24 ? 'Power and a direct link to Earth for the whole day. A workable day to land or operate.'
    : s.both >= 12 ? 'Power and a direct link overlap for most of the day.'
    : 'Power and a direct link overlap for only part of the day. Check the hours before planning operations.';

  return (
    <div className="stage calstage">
      {chrome}
      <div className="calwrap">
        <section className="calgrid" aria-label="Calendar">
          <div className="calhead">
            <button type="button" className="iconbtn" onClick={() => move(-1)} aria-label="Previous month">‹</button>
            <h2>{MONTHS[m]} {y}</h2>
            <button type="button" className="iconbtn" onClick={() => move(1)} aria-label="Next month">›</button>
          </div>
          <div className="dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="days">
            {cells.map((dd, k) => {
              if (dd === null) return <span key={k} />;
              const d = idx(dd);
              if (d < 0 || d >= N_DAYS) return <span key={k} className="day off">{dd}</span>;
              const st = stat(d);
              const ev = EVENTS.some((e) => e.m === m + 1 && e.d === dd);
              return (
                <button key={k} type="button" className={'day' + (d === day ? ' sel' : '')} onClick={() => onDay(d)}
                  style={{ background: `rgba(255,200,87,${(0.06 + 0.5 * (st.sun / 24)).toFixed(2)})` }}
                  aria-label={`${dd} ${MONTHS[m]}: ${st.sun} hours of sunlight, ${st.earth} hours with Earth in view${ev ? ', mission anniversary' : ''}`}>
                  <b>{dd}</b>
                  {ev && <i className="evdot" title="Lunar mission anniversary" />}
                  <span className="sunh">☀ {st.sun}h</span>
                  <span className="earthbar"><i style={{ width: `${(st.earth / 24) * 100}%` }} /></span>
                </button>
              );
            })}
          </div>
          <p className="callegend">Brighter yellow = more hours of sunlight at <b>{site.name}</b>. Blue bar = hours with Earth in view. White dot = a lunar mission milestone happened on this date. Conditions are computed for 2027 and 2028.</p>
        </section>
        <section className="caldetail" aria-live="polite">
          <p className="simtag">{DOW[sel.getUTCDay()]} · {sel.toISOString().slice(0, 10)} (UTC)</p>
          <h2>{sel.getUTCDate()} {MONTHS[sel.getUTCMonth()]} {sel.getUTCFullYear()}</h2>
          <h3>If you were at {site.name} on this day</h3>
          <ul className="calstats">
            <li><b>{s.sun} of 24 h</b> of sunlight for power{s.flips.length ? ` · ${s.flips.join(' · ')}` : s.sun === 24 ? ' · the Sun never sets today' : s.sun === 0 ? ' · the Sun never rises today' : ''}</li>
            <li>Highest Sun: <b>{s.maxEl.toFixed(1)}°</b> {s.maxEl >= 0 ? 'above' : 'below'} the horizon</li>
            <li><b>{s.earth} of 24 h</b> with Earth in view for a direct radio link</li>
            <li><b>{s.both} of 24 h</b> with power and link together</li>
          </ul>
          <p className="verdict2">{verdict}</p>
          <SpecularButton type="button" size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.4} glow={1} proximity={220} className="cta-spec" onClick={onGo}>See this day in 3D ▸</SpecularButton>
          <h3>On this date in lunar exploration</h3>
          {today.length ? (
            <ul className="calevents">{today.map((e) => <li key={e.y + e.text}><b>{e.y}</b> {e.text}</li>)}</ul>
          ) : (
            <>
              <p className="muted">No milestone in this app's list falls on this date. Next anniversaries:</p>
              <ul className="calevents">{upcoming.map((e) => <li key={e.y + e.text}><b>{e.d} {MONTHS[e.m - 1].slice(0, 3)} {e.y}</b> {e.text}</li>)}</ul>
            </>
          )}
          <p className="muted small">Mission dates are UTC, compiled from public agency records.</p>
        </section>
      </div>
    </div>
  );
}
