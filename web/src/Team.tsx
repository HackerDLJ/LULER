import { useEffect, useMemo, useState } from 'react';
// @ts-expect-error untyped JS component
import Lanyard from './rb/Lanyard';
// @ts-expect-error untyped JS component
import OptionWheel from './rb/OptionWheel';
import './rb/Lanyard.css';
import './rb/OptionWheel.css';

export type Member = { name: string; role: string; photo?: string };

/* Team JATABELS. Photos live in public/team/. */
export const TEAM: Member[] = [
  { name: 'Luke Jebasundar D', role: 'Team Lead', photo: 'team/luke.jpg' },
  { name: 'Jachin Gnanaraj I', role: 'Team Member', photo: 'team/jachin.jpg' },
  { name: 'Alfreda Jenilyn N', role: 'Team Member' },
  { name: 'Jerry Daniel P', role: 'Team Member' },
  { name: 'Ananth M', role: 'Team Member' },
  { name: 'Jaziya S', role: 'Team Member' },
];

const W = 1024, H = 1440;
const base = import.meta.env.BASE_URL;

const loadImg = (src?: string) => new Promise<HTMLImageElement | null>((res) => {
  if (!src) return res(null);
  const i = new Image(); i.crossOrigin = 'anonymous';
  i.onload = () => res(i); i.onerror = () => res(null); i.src = base + src;
});

const bg = (g: CanvasRenderingContext2D) => {
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, '#0d1630'); gr.addColorStop(0.55, '#070b18'); gr.addColorStop(1, '#03050b');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(140,180,255,.08)'; g.lineWidth = 2;
  for (let r = 260; r < 1400; r += 120) { g.beginPath(); g.arc(W * 0.85, H * 0.08, r, 0, Math.PI * 2); g.stroke(); }
};

const fit = (g: CanvasRenderingContext2D, t: string, max: number, size: number, weight = 600) => {
  let s = size; do { g.font = `${weight} ${s}px "SF Pro Display", "Google Sans Flex", system-ui, sans-serif`; s -= 2; } while (g.measureText(t).width > max && s > 20);
};

async function frontCard(m: Member, idx: number) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  bg(g);
  g.fillStyle = '#fff'; g.textAlign = 'left';
  g.font = '700 54px "SF Pro Display", system-ui, sans-serif'; g.fillText('L U L E R', 80, 250);
  g.fillStyle = 'rgba(200,215,255,.7)'; g.font = '500 26px "SF Pro Text", system-ui, sans-serif';
  g.fillText('LUNAR LANDING SITE NAVIGATOR', 80, 296);
  g.textAlign = 'right'; g.fillText('NASA SPACE APPS 2026', W - 80, 250);
  // photo
  const cx = W / 2, cy = 640, r = 230;
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
  const img = await loadImg(m.photo);
  if (img) { const s = Math.max((2 * r) / img.width, (2 * r) / img.height); g.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s); }
  else {
    g.fillStyle = '#1a2850'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.fillStyle = '#cfe0ff'; g.textAlign = 'center'; g.font = '600 150px "SF Pro Display", system-ui, sans-serif';
    g.fillText(m.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join(''), cx, cy + 52);
  }
  g.restore();
  g.lineWidth = 8; g.strokeStyle = '#6fa8ff'; g.beginPath(); g.arc(cx, cy, r + 10, 0, Math.PI * 2); g.stroke();
  // name and role
  g.textAlign = 'center'; g.fillStyle = '#fff'; fit(g, m.name, W - 140, 84, 650); g.fillText(m.name, cx, 1010);
  g.fillStyle = '#9cc2ff'; g.font = '600 40px "SF Pro Text", system-ui, sans-serif'; g.fillText(m.role.toUpperCase(), cx, 1080);
  // footer
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(80, 1170, W - 160, 2);
  g.fillStyle = 'rgba(200,215,255,.75)'; g.font = '500 30px "SF Pro Text", system-ui, sans-serif';
  g.textAlign = 'left'; g.fillText('TEAM JATABELS', 80, 1240);
  g.textAlign = 'right'; g.fillText(`ID · JTB-${String(idx + 1).padStart(3, '0')}`, W - 80, 1240);
  g.textAlign = 'center'; g.fillStyle = 'rgba(200,215,255,.45)'; g.font = '500 24px "SF Pro Text", system-ui, sans-serif';
  g.fillText('Lunar landing site planning with NASA data', cx, 1320);
  return c.toDataURL('image/png');
}

function backCard() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  bg(g); g.textAlign = 'center';
  g.fillStyle = '#fff'; g.font = '700 120px "SF Pro Display", system-ui, sans-serif'; g.fillText('LULER', W / 2, 700);
  g.fillStyle = 'rgba(200,215,255,.7)'; g.font = '500 30px "SF Pro Text", system-ui, sans-serif';
  g.fillText('TEAM JATABELS · NASA SPACE APPS 2026', W / 2, 780);
  return c.toDataURL('image/png');
}

function strap() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 96; const g = c.getContext('2d')!;
  g.fillStyle = '#0c1430'; g.fillRect(0, 0, 1200, 96);
  g.fillStyle = '#cfe0ff'; g.font = '600 40px "SF Pro Display", system-ui, sans-serif'; g.textBaseline = 'middle';
  g.fillText('LULER  ·  JATABELS  ·  NASA SPACE APPS 2026  ·', 30, 50);
  return c.toDataURL('image/png');
}

const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();

export default function Team() {
  const [sel, setSel] = useState(0);
  const [front, setFront] = useState<string>();
  const back = useMemo(backCard, []);
  const band = useMemo(strap, []);
  useEffect(() => { let on = true; frontCard(TEAM[sel], sel).then((u) => on && setFront(u)); return () => { on = false; }; }, [sel]);
  const m = TEAM[sel];
  return (
    <section className="team-page" aria-label="Team JATABELS">
      <div className="team-side">
        <p className="team-k">Team JATABELS</p>
        <h1 className="team-h">The people behind LULER</h1>
        <div className="team-wheel">
          <OptionWheel items={TEAM.map((t) => t.name)} defaultSelected={0} onChange={(i: number) => setSel(i)}
            fontSize={2.4} spacing={1.45} tilt={6} blur={2} fade={0.25} inset={4} textColor="#a6a6a6" activeColor="#ffffff" />
        </div>
        <p className="team-now"><b>{m.name}</b> · {m.role}</p>
        <p className="team-tip">Scroll or drag the list to switch members · drag the card to swing it, click to flip</p>
      </div>
      <div className="team-card">
        {front && !hasGL && <img className="team-flat" src={front} alt={`ID card of ${m.name}`} />}
        {front && hasGL && <Lanyard frontImage={front} backImage={back} strapImage={band} cardColor="#070b18" finish="glossy" metal="silver" anchor="right" size={0.5} strapLength={0.42} breeze={0.35} />}
      </div>
    </section>
  );
}
