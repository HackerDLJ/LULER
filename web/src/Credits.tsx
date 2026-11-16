import LogoLoop from './rb/LogoLoop.jsx';
const W = (t: string, s: string) => <span className="ll-word"><b>{t}</b><i>{s}</i></span>;
export const CREDITS = [
  { node: W('NASA LRO', 'Lunar Reconnaissance Orbiter'), title: 'NASA LRO', href: 'https://science.nasa.gov/mission/lro/', hoverColor: '#6fa8ff' },
  { node: W('LOLA', 'laser altimeter terrain'), title: 'LRO LOLA', href: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm', hoverColor: '#6fa8ff' },
  { node: W('LROC', 'camera mosaic'), title: 'LROC', href: 'https://www.lroc.asu.edu/', hoverColor: '#6fa8ff' },
  { node: W('NASA SVS', 'CGI Moon Kit'), title: 'NASA Scientific Visualization Studio', href: 'https://svs.gsfc.nasa.gov/4720/', hoverColor: '#6fa8ff' },
  { node: W('NAIF SPICE', 'ephemerides'), title: 'NAIF SPICE', href: 'https://naif.jpl.nasa.gov/naif/', hoverColor: '#6fa8ff' },
  { node: W('JPL Horizons', 'cross-check'), title: 'JPL Horizons', href: 'https://ssd.jpl.nasa.gov/horizons/', hoverColor: '#6fa8ff' },
  { node: W('Moon Trek', 'NASA Solar System Treks'), title: 'NASA Moon Trek', href: 'https://trek.nasa.gov/moon/', hoverColor: '#6fa8ff' },
  { node: W('REGOLITH', 'rover simulation · MIT'), title: 'REGOLITH by winch (MIT licence)', href: 'https://github.com/winchxyz/moon-rover', hoverColor: '#6fa8ff' },
  { node: W('Moon Terrain', 'regolith texture · CC-BY'), title: 'Moon Terrain by abhayexe (CC-BY 4.0, Sketchfab)', href: 'https://sketchfab.com/abhayexe', hoverColor: '#6fa8ff' },
  { node: W('NASA 3D', 'Saturn V · LM · LRO models'), title: 'NASA 3D Resources', href: 'https://science.nasa.gov/3d-resources/', hoverColor: '#6fa8ff' },
  { node: W('Cesium', 'Moon Terrain'), title: 'Cesium Moon Terrain', href: 'https://cesium.com/platform/cesium-ion/content/cesium-moon-terrain/', hoverColor: '#6fa8ff' },
  { node: W('Space Apps 2026', 'NASA International Space Apps Challenge'), title: 'NASA Space Apps Challenge', href: 'https://www.spaceappschallenge.org/', hoverColor: '#6fa8ff' },
  { node: W('Team JATABELS', 'Lead: Luke Jebasundar D'), title: 'Team JATABELS', href: 'https://www.spaceappschallenge.org/2026/find-a-team/jatabels1/', hoverColor: '#6fa8ff' },
];
export default function Credits({ speed = 40 }: { speed?: number }) {
  return <div className="credits-loop"><p className="meta">BUILT ON NASA DATA</p><LogoLoop logos={CREDITS} speed={speed} logoHeight={30} gap={56} hoverSpeed={0.2} scaleOnHover fadeOut ariaLabel="NASA data sources and team" /></div>;
}
