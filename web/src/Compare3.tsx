import type { Site } from './data';
import type { Stats } from './metrics';
import type { Score } from './score';
import SpecularButton from './rb/SpecularButton.jsx';

interface Props { sites: Site[]; picks: number[]; scores: { stats: Stats; score: Score }[]; onPick: (slot: number, idx: number) => void; onOpen: (idx: number) => void }

export default function Compare3({ sites, picks, scores, onPick, onOpen }: Props) {
  const best = scores.reduce((b, s, i) => (s.score.total > scores[b].score.total ? i : b), 0);
  return (
    <section className="cmp3" aria-labelledby="cmp3-h">
      <h2 id="cmp3-h">Your point vs. the two nearest sites</h2>
      <p className="muted">Safety score out of 100 for the dates you picked. Every point comes from one measured input. Open a card to see why.</p>
      <div className="cmp3-grid">
        {picks.map((idx, slot) => {
          const { score } = scores[slot];
          return (
            <article key={slot} className={`cmp3-card ${slot === best ? 'best' : ''}`}>
              <select value={idx} onChange={(e) => onPick(slot, Number(e.target.value))} aria-label={`Candidate ${slot + 1}`}>
                {sites.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}
              </select>
              <div className="cmp3-score">
                <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" className="trk" /><circle cx="50" cy="50" r="42" className="val" style={{ strokeDasharray: `${(score.total / 100) * 264} 264` }} /></svg>
                {slot === best && <i className="best-tag">Best</i>}<b>{score.total}</b><span className={`g ${score.grade.toLowerCase()}`}>{score.grade}</span>
              </div>
              <p className="cmp3-sum">{score.summary}</p>
              <details>
                <summary>Why this score</summary>
                <ul>
                  {score.factors.map((f) => (
                    <li key={f.key}><div className="fr"><span>{f.label}</span><em>{f.value}</em><b>{f.points}/{f.max}</b></div><i className="bar"><i style={{ width: `${(f.points / f.max) * 100}%` }} /></i><small>{f.why}</small></li>
                  ))}
                </ul>
              </details>
              <SpecularButton type="button" size="md" radius={999} tint="#6fa8ff" tintOpacity={0.14} lineColor="#d6e6ff" baseColor="#3d5a8c" textColor="#f5f8ff" idleIntensity={0.75} glow={1.4} proximity={400} shineSize={24} shineFade={60} thickness={1.6} className="cta-spec" onClick={() => onOpen(idx)}>Open in 3D ▸</SpecularButton>
            </article>
          );
        })}
      </div>
    </section>
  );
}
