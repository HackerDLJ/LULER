import { useEffect, useState, type ReactNode } from 'react';
import type { Site } from './data';
import { DepthRibbon, siteThumb, type RibbonItem } from './fx';

const COLOR: Record<string, string> = { Apollo: '#ffc857', 'CLPS / commercial': '#7ee0a1', 'Other agencies': '#ff8a80', 'Polar candidate regions': '#4cc9f0' };

export default function Timeline({ sites, chrome, onOpen }: { sites: Site[]; chrome?: ReactNode; onOpen: (i: number) => void }) {
  const [items, setItems] = useState<RibbonItem[]>([]);
  useEffect(() => {
    let dead = false;
    const list = sites.map((s, i) => ({ s, i })).filter(({ s }) => s.id !== 'custom')
      .sort((a, b) => (a.s.year ?? 9999) - (b.s.year ?? 9999) || a.s.name.localeCompare(b.s.name));
    const base = list.map(({ s, i }) => ({ id: String(i), title: s.name, tag: s.year ? String(s.year) : 'CANDIDATE', color: COLOR[s.group] ?? '#ffffff',
      sub: `${s.mission || s.group} · ${Math.abs(s.lat).toFixed(2)}°${s.lat < 0 ? 'S' : 'N'} ${Math.abs(((s.lon + 540) % 360) - 180).toFixed(2)}°${((s.lon + 540) % 360) - 180 < 0 ? 'W' : 'E'}` }));
    setItems(base);
    Promise.all(list.map(({ s }) => siteThumb(s.lat, s.lon, Math.abs(s.lat) > 70 ? 6 : 10).catch(() => undefined)))
      .then((imgs) => { if (!dead) setItems(base.map((b, k) => ({ ...b, img: imgs[k] }))); });
    return () => { dead = true; };
  }, [sites]);
  return (
    <div className="stage timeline-stage">
      {chrome}
      {items.length > 0 && <DepthRibbon items={items} onPick={(id) => onOpen(Number(id))} />}
      <div className="timeline-cap"><p className="meta">MISSION TIMELINE · LANDINGS AND CANDIDATE SITES</p><p>Scroll, drag or use ← → to travel through every landing on record, then open a site. Images are cut from the NASA LROC mosaic at each site.</p></div>
    </div>
  );
}
