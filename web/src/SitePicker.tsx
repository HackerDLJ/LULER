import { useState } from 'react';
import BranchedMenu from './rb/BranchedMenu.jsx';
import { Rocket01Icon, Satellite01Icon, Globe02Icon, Target02Icon, Location01Icon } from '@hugeicons/core-free-icons';
const iconFor = (g: string) => /apollo/i.test(g) ? Rocket01Icon : /clps|commercial/i.test(g) ? Satellite01Icon : /agenc/i.test(g) ? Globe02Icon : /polar|candidate|region/i.test(g) ? Target02Icon : Location01Icon;

interface S { id: string; name: string; group: string }
export default function SitePicker({ sites, value, onPick }: { sites: S[]; value: number; onPick: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const groups = Array.from(new Set(sites.map((x) => x.group)));
  const cur = sites[value]?.name ?? 'Custom coordinates';
  const curGroup = groups.indexOf(sites[value]?.group);
  const items = groups.map((g) => ({ label: g, children: sites.map((x, i) => ({ x, i })).filter(({ x }) => x.group === g).map(({ x, i }) => ({ value: String(i), label: x.name, icon: iconFor(g) })) }));
  return (
    <div className="sitepick">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{cur} ▾</button>
      {open && (
        <div className="sitepick-pop">
          <BranchedMenu items={items} defaultOpen={groups.map((_, k) => k)} defaultActive={String(value)} width={280} fontSize={14} color="#f5f5f5" accentColor="#f5f5f5" lineColor="#3f3f46" rowHeight={36} drawDuration={400} foldDuration={300} indent={40} trunk={14} radius={10} lineWidth={1.5}
            onSelect={(v: string) => { onPick(Number(v)); setTimeout(() => setOpen(false), 520); }} />
        </div>)}
    </div>
  );
}
