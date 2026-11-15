import { useEffect, useRef } from 'react';
import GridScan from './rb/GridScan.jsx';
import CurvedLoop from './rb/CurvedLoop.jsx';
import GradualBlur from './rb/GradualBlur.jsx';
import ParticleText from './rb/ParticleText.jsx';
import VariableProximity from './rb/VariableProximity.jsx';
import AnimatedContent from './rb/AnimatedContent.jsx';
import ScrollReveal from './rb/ScrollReveal.jsx';
import type { Site } from './data';
import MetallicPaint from './rb/MetallicPaint.jsx';
import GlassSurface from './rb/GlassSurface.jsx';

interface Props { onStart: () => void; sites: number; landings: number; list?: Site[] }

function VP({ t, size }: { t: string; size: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} style={{ display: 'block' }}>
      <VariableProximity label={t} fontSize={size} radius={120} falloff="gaussian" smoothing={0.12} containerRef={ref}
        fromFontVariationSettings="'wght' 400, 'opsz' 14" toFontVariationSettings="'wght' 900, 'opsz' 40" toColor="#7fb4ff" />
    </span>
  );
}

export default function Intro({ onStart, sites, landings, list }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const vp = (label: string, size: number) => (
    <VariableProximity label={label} fontSize={size} containerRef={tabsRef} radius={140} falloff="gaussian"
      fromFontVariationSettings="'wght' 300, 'opsz' 9" toFontVariationSettings="'wght' 1000, 'opsz' 40"
      toColor="#7fb4ff" scale={1.1} />
  );
  const ac = { container: '.intro2' };
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const on = () => { const k = Math.min(1, el.scrollTop / (window.innerHeight * 0.7)); gridRef.current?.style.setProperty('--blur', (k * 7).toFixed(2) + 'px'); gridRef.current?.style.setProperty('--dim', (1 - k * 0.45).toFixed(3)); };
    on(); el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  const vt = (t: string, size: number) => <VP key={t} t={t} size={size} />;
  const vtOld = (t: string, size: number) => (
    <VariableProximity label={t} fontSize={size} radius={140} falloff="gaussian" smoothing={0.15}
      fromFontVariationSettings="'wght' 400, 'opsz' 14" toFontVariationSettings="'wght' 900, 'opsz' 40" toColor="#7fb4ff" />
  );
  const sr = { scrollContainerRef: scroller };
  return (
    <div className="intro2" ref={scroller}>
      <div className="intro2-grid" ref={gridRef} aria-hidden="true">
        <GridScan linesColor="#2a3550" scanColor="#7fb4ff" cells={9} depth={4} depthFade={0.7} parallax={1.4} shading={0.4}
          reflection={0} dpr={1} points autoScan intro scanDuration={3.2} scanDelay={2.2} trail={0.6} glow={0.3} clickEffect="ping" interactive />
      </div>
      <section className="i2-hero" ref={heroRef}>
        
        <AnimatedContent {...ac} trigger="mount" distance={30} reverse blur={6}><p className="i2-eyebrow">NASA SPACE APPS CHALLENGE 2026</p></AnimatedContent>
        <AnimatedContent {...ac} trigger="mount" distance={20} delay={0.3}><p className="i2-team">TEAM <b>JATABELS</b></p></AnimatedContent>
        <div className="i2-logo">
          <ParticleText text="LULER" particleSize={2} density={4} color="#ffffff" highlightColor="#7fb4ff"
            highlightMode="motion" shape="circle" intro="gather" scatter={220} gatherDuration={1800} stagger={500}
            clickBurst burstStrength={1.2} pointerRepel={50} repelRadius={130} idleDrift={0.7} glow
            fontSize="clamp(4rem, 17vw, 12rem)" fontWeight={800} />
        </div>
        <div className="i2-tag" ref={tabsRef}>{vp('Where on the Moon can you land, and when?', 30)}</div>
        <AnimatedContent {...ac} trigger="mount" delay={1.6} distance={40} blur={6}><GlassSurface width={320} height={66} borderRadius={33} distortionScale={-160} displace={0.6} backgroundOpacity={0.12} brightness={58} saturation={1.6} blueOffset={26} greenOffset={12} className="cta-glass"><button type="button" className="glass-btn" onClick={onStart}>Explore the Moon ▸</button></GlassSurface></AnimatedContent>
        <AnimatedContent {...ac} trigger="mount" delay={2.4}><p className="i2-team i2-lead">LEAD: <b>LUKE JEBASUNDAR D</b></p></AnimatedContent>
        <AnimatedContent {...ac} trigger="mount" delay={2.4}><div className="i2-scroll">scroll ↓</div></AnimatedContent>
      </section>

      <section className="i2-sec">
        <AnimatedContent {...ac} distance={50} blur={8} duration={1}><div className="i2-vp">{vt("Every lunar landing lives or dies on two angles: how high the Sun sits for power, and whether Earth is above the horizon for a radio link.", 52)}</div></AnimatedContent>
      </section>
      <section className="i2-sec">
        <AnimatedContent {...ac} distance={50} blur={8} duration={1}><div className="i2-vp">{vt("LULER computes both for any point on the Moon, every hour of 2027 and 2028, from NASA terrain, imagery and ephemerides.", 52)}</div></AnimatedContent>
      </section>

      <AnimatedContent {...ac} className="i2-sec i2-tabs" stagger={0.12} distance={60} tilt={25} blur={6} ease="power3.out" threshold={0.15}>
        {[['Moon', `Pick one of ${sites} sites, ${landings} of them real landings, or type any coordinate`],
          ['Site', 'NASA terrain in 3D, slope, elevation, comparison and a simulated landing'],
          ['Surface', 'Stand there, watch the Sun and Earth move, and drive to better ground'],
          ['Dates', 'A calendar of sunlight and Earth-contact hours for every day']].map(([t, d]) => (
          <div key={t} className="i2-card">
            <div className="i2-card-t">{vp(t, 44)}</div>
            <AnimatedContent {...ac} distance={50} blur={8} duration={1}><div className="i2-vp">{vt(d, 20)}</div></AnimatedContent>
          </div>))}
      </AnimatedContent>

      <AnimatedContent {...ac} className="i2-sec i2-stats" stagger={0.1} distance={50} scale={0.9} staggerFrom="center">
        {[[String(sites), 'landing sites'], ['17,544', 'hours computed per site'], ['5 m', 'polar terrain detail'], ['0.008°', 'sun-angle error vs NASA SPICE']].map(([n, l]) => (
          <div key={l} className="i2-stat"><b>{n}</b><span>{l}</span></div>))}
      </AnimatedContent>

      <AnimatedContent {...ac} className="i2-sec i2-data" wipe="left" distance={0} duration={1.4}>
        <p className="i2-eyebrow">BUILT ONLY ON NASA DATA</p>
        <p className="i2-data-l">LRO LOLA terrain · LROC imagery · NASA SVS Moon Kit · Moon Trek · PGDA 5 m DEMs · NAIF SPICE DE440 · NASA 3D Resources</p>
      </AnimatedContent>

      <section className="i2-sec i2-end">
        <AnimatedContent {...ac} distance={50} blur={8} duration={1}><div className="i2-vp">{vt("Ready to choose a landing site?", 46)}</div></AnimatedContent>
        <AnimatedContent {...ac} distance={50} blur={8} duration={1}><div className="i2-vp">{vt("We could have made this an app, but it is more useful as a website.", 30)}</div></AnimatedContent>
        <AnimatedContent {...ac} distance={40} blur={6} delay={0.3}><GlassSurface width={320} height={66} borderRadius={33} distortionScale={-160} displace={0.6} backgroundOpacity={0.12} brightness={58} saturation={1.6} blueOffset={26} greenOffset={12} className="cta-glass"><button type="button" className="glass-btn" onClick={onStart}>Explore the Moon ▸</button></GlassSurface></AnimatedContent>
        <AnimatedContent {...ac} distance={20} delay={0.5}><p className="intro-src">Data: NASA LRO LOLA terrain · LROC imagery (NASA SVS Moon Kit, Moon Trek) · NASA PGDA 5 m polar DEMs · NAIF SPICE DE440 · NASA 3D Resources. Not an official NASA product.</p></AnimatedContent>
      </section>
      <section className="i2-crew">
        <p className="i2-eyebrow">TEAM</p>
        <div className="i2-metal"><MetallicPaint text="JATABELS" fontFamily="ui-monospace, Menlo, monospace" fontWeight={800} color="#ffffff" scale={0.82} density={2.4} edgeBend={0.8} dispersion={0.15} mouseTilt={0.7} /></div>
        <CurvedLoop marqueeText="LUKE JEBASUNDAR D ✦ JACHIN GNANARAJ I ✦ ALFREDA JENILYN N ✦ JERRY DANIEL P ✦ ANANTH M ✦ JAZIYA S ✦" shape="wave" curveAmount={60} speed={1.5} fontSize={44} fontWeight={700} separator="" edgeFade={0.25} />
      </section>
      <GradualBlur target="page" position="bottom" height="4rem" strength={1.5} layers={3} curve="bezier" tint="rgba(0,0,0,0.5)" zIndex={60} />
    </div>
  );
}
