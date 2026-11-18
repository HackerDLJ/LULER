import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Counter from './rb/Counter.jsx';
import './rb/Counter.css';
import ScrollReveal from './rb/ScrollReveal.jsx';
import './rb/ScrollReveal.css';

/* Upcoming Moon missions, as stated by the agencies (status as of 18 Nov 2026).
   `t` is the earliest day inside each stated launch window, so the clock counts to the start of the window.
   Dates are targets and slip often; a mission drops off the clock once its window start has passed. */
interface M { id: string; name: string; who: string; kind: string; when: string; t: string; where: string; what: string; src: string; url: string }
const MISSIONS: M[] = [
  { id: 'griffin1', name: 'Griffin Mission One', who: 'Astrobotic for NASA (CLPS "Moon Base II")', kind: 'Robotic lander', when: 'January 2027', t: '2027-01-01', where: 'Not announced', what: "Astrobotic's large Griffin lander on a NASA commercial delivery. Its maker now targets January 2027; NASA's event page still says late 2026.", src: 'Voyager Technologies, 12 Nov 2026; SpacePolicyOnline, 9 Nov 2026', url: 'https://spacenexus.us/moon/next-landing' },
  { id: 'bluemoon1', name: 'Blue Moon MK1 "Endurance"', who: 'Blue Origin for NASA (CLPS "Moon Base I")', kind: 'Uncrewed cargo lander', when: 'First part of 2027', t: '2027-01-01', where: 'Not announced', what: "Blue Origin's uncrewed cargo pathfinder. It tests the landing system ahead of the company's crew lander.", src: 'NASA via Aerospace America, 15 Sep 2026', url: 'https://spacenexus.us/moon/next-landing' },
  { id: 'viper', name: 'VIPER on Blue Moon MK1 #2', who: 'NASA and Blue Origin', kind: 'Rover on a lander', when: '2027', t: '2027-01-01', where: 'Lunar south pole', what: 'A water-ice prospecting rover for the south pole, the same region where LULER scores its south-pole landing sites.', src: 'NASA, 20 Oct 2026', url: 'https://spacenexus.us/moon/next-landing' },
  { id: 'im3', name: 'IM-3 "Trinity"', who: 'Intuitive Machines for NASA (CLPS "Moon Base III")', kind: 'Robotic lander', when: 'March to April 2027', t: '2027-03-01', where: 'Reiner Gamma lunar swirl', what: "Intuitive Machines' third landing attempt, after IM-1 and IM-2 both tipped over after touchdown. It also releases data relay satellites.", src: 'Intuitive Machines SEC filing, 12 Nov 2026', url: 'https://spacenexus.us/moon/next-landing' },
  { id: 'artemis3', name: 'Artemis III', who: 'NASA', kind: 'Crewed test flight (Earth orbit)', when: 'Summer 2027', t: '2027-06-01', where: 'Low Earth orbit, not the Moon', what: 'Four astronauts spend about two weeks in Earth orbit practising rendezvous and docking with the commercial Moon landers. It does not land on the Moon.', src: 'NASA briefing at Kennedy, 23 Oct 2026', url: 'https://aerospaceamerica.aiaa.org/nasa-eyeing-year-end-tanking-test-and-summer-2027-launch-for-artemis-iii/' },
  { id: 'bg2', name: 'Blue Ghost Mission 2', who: 'Firefly Aerospace for NASA', kind: 'Robotic lander and rover', when: 'Later in 2027', t: '2027-07-01', where: 'Lunar far side', what: "A far-side landing carrying the UAE's Rashid 2 rover. Firefly's Elytra orbiter relays its signal, because the far side never faces Earth.", src: 'NASA via Aerospace America, 15 Sep 2026', url: 'https://spacenexus.us/moon/next-landing' },
  { id: 'artemis4', name: 'Artemis IV', who: 'NASA', kind: 'Crewed landing', when: 'Early 2028', t: '2028-01-01', where: 'Lunar south pole', what: 'Planned as the first crewed Moon landing since Apollo 17 in 1972, and the first at the south pole.', src: 'NASA, 23 Oct 2026', url: 'https://www.nasa.gov/mission/artemis-iv/' },
  { id: 'cy4', name: 'Chandrayaan-4', who: 'ISRO (India)', kind: 'Sample return', when: 'By 2028', t: '2028-01-01', where: 'Not announced', what: "India's first lunar sample return, building on Chandrayaan-3's landing.", src: 'ISRO chairman, 11 Dec 2025', url: 'https://spacenexus.us/moon/next-landing' },
  { id: 'promise', name: 'PROMISE rover', who: 'NASA / JPL', kind: 'Nuclear-powered rover', when: 'Late 2028 launch', t: '2028-10-01', where: 'Lunar south pole', what: 'Built from engineering hardware of the Curiosity and Perseverance Mars rovers, powered by a spare nuclear generator, for an 18-month scouting mission for the Moon Base.', src: 'NASA PROMISE page', url: 'https://www.nasa.gov/promise/' },
  { id: 'artemis5', name: 'Artemis V', who: 'NASA', kind: 'Crewed landing', when: 'By late 2028', t: '2028-10-01', where: 'Lunar south pole', what: 'The second crewed landing of the programme, meant to start building a semi-permanent base.', src: 'NASA ESDMD, 3 Mar 2026', url: 'https://spacenexus.us/moon/next-landing' },
];
const NO_DATE = [{ name: "Chang'e 7", who: 'CNSA (China)', note: 'Postponed on 23 Aug 2026 with no new date. Lander, rover and hopping probe for the south pole.' }];

const at = (m: M) => Date.parse(m.t + 'T00:00:00Z');
const split = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 }; };

function Clock({ ms, size, intro }: { ms: number; size: number; intro?: boolean }) {
  const c = split(ms);
  const part = (v: number, unit: string, digits: number) => (
    <span className="nm-part"><Counter value={v} minDigits={digits} fontSize={size} fontWeight={600} intro={!!intro} duration={0.6} stagger={0.03} fade={0.25} /><i>{unit}</i></span>
  );
  return <span className="nm-clock">{part(c.d, 'd', 2)}{part(c.h, 'h', 2)}{part(c.m, 'm', 2)}{part(c.s, 's', 2)}</span>;
}

export default function NextMission() {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (open) { setShown(true); return; } const t = setTimeout(() => setShown(false), 650); return () => clearTimeout(t); }, [open]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  const up = MISSIONS.filter((m) => at(m) > now).sort((a, b) => at(a) - at(b));
  const next = up[0];
  if (!next) return null;
  return (
    <>
      <button type="button" className="nm-chip" onClick={() => setOpen(true)} title="Upcoming Moon missions" aria-label={`Next Moon mission: ${next.name}, ${next.when}. Open details.`}>
        <span className="nm-dot" aria-hidden="true" />
        <span className="nm-txt"><em>Next to the Moon</em><b>{next.name}</b></span>
        <Clock ms={at(next) - now} size={15} />
      </button>
      {shown && createPortal(
        <div className={`nm-stage${open ? '' : ' out'}`} ref={scroller} role="dialog" aria-modal="true" aria-label="Upcoming Moon missions">
          <button type="button" className="nm-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          <div className="nm-body">
            <p className="nm-kicker">Next to the Moon · {next.who}</p>
            <h1 className="nm-title">{next.name}</h1>
            <div className="nm-big"><Clock ms={at(next) - now} size={64} intro /></div>
            <p className="nm-when">Target: {next.when} · {next.kind} · {next.where}</p>
            <ScrollReveal scrollContainerRef={scroller} mode="enter" effect="fade" splitBy="words" stagger={0.03} duration={0.7} baseOpacity={0.08} baseRotation={2} blurStrength={6} containerClassName="nm-lead" textClassName="nm-lead-t">{next.what}</ScrollReveal>
            <h2 className="nm-h2">Every mission on the clock</h2>
            {up.map((m, i) => (
              <section key={m.id} className={`nm-item${i === 0 ? ' on' : ''}`}>
                <div className="nm-row"><div><p className="nm-k">{m.kind} · {m.who}</p><h3>{m.name}</h3></div><div className="nm-mini"><Counter value={split(at(m) - now).d} fontSize={28} fontWeight={600} duration={0.6} /><i>days</i></div></div>
                <p className="nm-meta">Target: <b>{m.when}</b> · {m.where}</p>
                <ScrollReveal scrollContainerRef={scroller} mode="scrub" effect="fade" splitBy="words" stagger={0.05} baseOpacity={0.12} baseRotation={2} blurStrength={4} containerClassName="nm-sr" textClassName="nm-sr-t" wordAnimationEnd="center center">{m.what}</ScrollReveal>
                <p className="nm-src">Source: <a href={m.url} target="_blank" rel="noreferrer">{m.src}</a></p>
              </section>
            ))}
            {NO_DATE.map((m) => <section key={m.name} className="nm-item nodate"><p className="nm-k">{m.who} · no date</p><h3>{m.name}</h3><p className="nm-meta">{m.note}</p></section>)}
            <p className="nm-foot">Each clock counts to the first day of the launch window the agency gave, so a "2027" target counts to 1 January 2027. These dates are targets and often slip. Status as of 18 November 2026, from NASA, ISRO, CNSA and the companies, collected by the SpaceNexus Moon tracker. A mission leaves the clock once its window opens.</p>
          </div>
        </div>, document.body)}
    </>
  );
}
