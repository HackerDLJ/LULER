import type { Range, StatKey, Stats } from './metrics';
import { fmtHours } from './format';

interface Side {
  name: string;
  stats: Stats;
  ranges: Record<StatKey, Range>;
}
interface Props {
  a: Side;
  b: Side;
  lenDays: number;
  startLabel: string;
}

interface RowDef {
  key: StatKey;
  label: string;
  hint: string;
  higherBetter: boolean;
  unit: 'pct' | 'hours';
}

const ROWS: RowDef[] = [
  { key: 'powerPct', label: 'Sunlight for power', hint: 'Average share of the Sun that is above the terrain horizon', higherBetter: true, unit: 'pct' },
  { key: 'sunUpPct', label: 'Sun above horizon', hint: 'Share of time the centre of the Sun is above the horizon', higherBetter: true, unit: 'pct' },
  { key: 'earthUpPct', label: 'Earth in view (direct link)', hint: 'Share of time Earth is above the horizon and the antenna minimum', higherBetter: true, unit: 'pct' },
  { key: 'bothPct', label: 'Sun and Earth together', hint: 'Share of time you could have both power and a direct link', higherBetter: true, unit: 'pct' },
  { key: 'longestDarkH', label: 'Longest night', hint: 'Longest stretch with no sunlight at all', higherBetter: false, unit: 'hours' },
  { key: 'longestCommGapH', label: 'Longest communication gap', hint: 'Longest stretch with no direct view of Earth', higherBetter: false, unit: 'hours' },
];

const fmt = (v: number, u: 'pct' | 'hours') => (u === 'pct' ? `${v.toFixed(0)}%` : fmtHours(v));
const spread = (r: Range, u: 'pct' | 'hours') => r.max - r.min > (u === 'pct' ? 1 : 2);
const rangeText = (r: Range, u: 'pct' | 'hours') => `${fmt(r.min, u)} to ${fmt(r.max, u)}`;
const overlap = (x: Range, y: Range) => x.min <= y.max && y.min <= x.max;

function line(def: RowDef, a: Side, b: Side): string {
  const va = a.stats[def.key];
  const vb = b.stats[def.key];
  const tol = def.unit === 'pct' ? 1 : 2;
  if (Math.abs(va - vb) <= tol) return `${def.label}: about the same (${fmt(va, def.unit)} vs ${fmt(vb, def.unit)}).`;
  const aWins = def.higherBetter ? va > vb : va < vb;
  const [w, l, vw, vl] = aWins ? [a.name, b.name, va, vb] : [b.name, a.name, vb, va];
  const diff = Math.abs(va - vb);
  const amount = def.unit === 'pct' ? `${diff.toFixed(0)} points ${def.higherBetter ? 'more' : 'less'}` : `${fmtHours(diff)} ${def.higherBetter ? 'longer' : 'shorter'}`;
  return `${def.label}: ${w} is better, ${amount} than ${l} (${fmt(vw, def.unit)} vs ${fmt(vl, def.unit)}).`;
}

export default function Compare({ a, b, lenDays, startLabel }: Props) {
  const closeCall = ROWS.filter((r) => overlap(a.ranges[r.key], b.ranges[r.key]) && Math.abs(a.stats[r.key] - b.stats[r.key]) > (r.unit === 'pct' ? 1 : 2));
  return (
    <section aria-labelledby="cmp-h">
      <h2 id="cmp-h">Comparison for {lenDays} days from {startLabel}</h2>
      <div className="verdict">
        <ul>
          {ROWS.filter((r) => ['powerPct', 'earthUpPct', 'bothPct', 'longestDarkH'].includes(r.key)).map((r) => (
            <li key={r.key}>{line(r, a, b)}</li>
          ))}
        </ul>
        {closeCall.length > 0 && (
          <p className="caution">
            Careful: for {closeCall.map((r) => r.label.toLowerCase()).join(', ')}, the two sites' results overlap once you allow for the exact landing spot being
            up to 100 m away from the centre point. Treat those differences as too close to call.
          </p>
        )}
      </div>
      <div className="cmp">
        <table>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">{a.name}</th>
              <th scope="col">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const va = a.stats[r.key];
              const vb = b.stats[r.key];
              const tol = r.unit === 'pct' ? 1 : 2;
              const tie = Math.abs(va - vb) <= tol;
              const aWins = !tie && (r.higherBetter ? va > vb : va < vb);
              const bWins = !tie && !aWins;
              const cell = (v: number, side: Side, win: boolean) => (
                <td className={win ? 'win' : ''}>
                  <span className="big">{fmt(v, r.unit)}</span>
                  {win && <span className="badge">better</span>}
                  {spread(side.ranges[r.key], r.unit) && (
                    <span className="range" title="Range if the landing spot is within 100 m of the centre point">
                      {rangeText(side.ranges[r.key], r.unit)}
                    </span>
                  )}
                </td>
              );
              return (
                <tr key={r.key}>
                  <th scope="row">
                    {r.label}
                    <span className="hint">{r.hint}</span>
                  </th>
                  {cell(va, a, aWins)}
                  {cell(vb, b, bWins)}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="note">Small grey ranges show how much the answer changes if the lander touches down up to 100 m from the site's centre point.</p>
      </div>
    </section>
  );
}
