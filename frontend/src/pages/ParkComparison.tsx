import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useState, useMemo } from 'react';
import './ParkComparison.css';

// ── Park data ─────────────────────────────────────────────────────────────────

interface ComparePark {
  name:     string;
  state:    string;
  capacity: number; // MWp
  risk:     number; // heat risk 0–10
}

const PARKS: ComparePark[] = [
  { name: 'Eggebek Solar Park',                 state: 'Schleswig-Holstein',  capacity: 65,  risk: 5.4 },
  { name: 'Solarpark Weesow-Willmersdorf',      state: 'Brandenburg',          capacity: 187, risk: 7.2 },
  { name: 'Solarpark Gottesgabe Neuhardenberg', state: 'Brandenburg',          capacity: 84,  risk: 7.0 },
  { name: 'Brandenburg Briest Solarpark',       state: 'Brandenburg',          capacity: 91,  risk: 7.1 },
  { name: 'Finsterwalde Solar Park',            state: 'Brandenburg',          capacity: 80,  risk: 7.4 },
  { name: 'Krughuette Solar Park',              state: 'Saxony-Anhalt',        capacity: 52,  risk: 6.8 },
  { name: 'Solarpark Meuro',                    state: 'Brandenburg / Saxony', capacity: 166, risk: 7.3 },
  { name: 'Ernsthof Solar Park',                state: 'Baden-Württemberg',    capacity: 70,  risk: 6.5 },
  { name: 'Lauingen Energy Park',               state: 'Bavaria',              capacity: 25,  risk: 6.3 },
  { name: 'Strasskirchen Solar Park',           state: 'Bavaria',              capacity: 54,  risk: 6.2 },
  { name: 'Solarpark Pocking',                  state: 'Bavaria',              capacity: 50,  risk: 6.4 },
];

// ── Physics ───────────────────────────────────────────────────────────────────

interface Row {
  year: number; baseline: number;
  p50: number; p90: number; p10: number; band: number;
}

function buildData(park: ComparePark, totalWarming: number): Row[] {
  const BASE       = park.capacity * 0.95;
  const dTperYear  = totalWarming / 30;
  const riskFactor = 1 + (park.risk - 5.5) * 0.03;

  return Array.from({ length: 30 }, (_, i) => {
    const yr           = i + 1;
    const degradFactor = Math.pow(1 - 0.005, yr - 1);
    const baseline     = +(BASE * degradFactor).toFixed(2);
    const dT           = dTperYear * yr;
    const climLoss     = (-0.004 * dT - 0.00008 * dT * dT) * riskFactor;
    const p50   = +(baseline * (1 + climLoss)).toFixed(2);
    const sigma = baseline * (0.022 + yr * 0.0012);
    const p90   = +(p50 - 1.28 * sigma).toFixed(2);
    const p10   = +(p50 + 0.84 * sigma).toFixed(2);
    return { year: yr, baseline, p50, p90, p10, band: +(p10 - p90).toFixed(2) };
  });
}

interface Stats {
  lifetimeBaseline: number;
  lifetimeP50:      number;
  lifetimeP90:      number;
  revBaseline:      number;
  revP50:           number;
  lossPct:          number;
  revenueGap:       number;
}

const PRICE = 74; // €/MWh

function getStats(data: Row[]): Stats {
  const lifetimeBaseline = data.reduce((s, r) => s + r.baseline, 0);
  const lifetimeP50      = data.reduce((s, r) => s + r.p50,      0);
  const lifetimeP90      = data.reduce((s, r) => s + r.p90,      0);
  const revBaseline      = (lifetimeBaseline * PRICE * 1000) / 1e6;
  const revP50           = (lifetimeP50      * PRICE * 1000) / 1e6;
  return {
    lifetimeBaseline,
    lifetimeP50,
    lifetimeP90,
    revBaseline,
    revP50,
    lossPct:    ((lifetimeP50 - lifetimeBaseline) / lifetimeBaseline) * 100,
    revenueGap: revP50 - revBaseline,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SLIDER_MIN = 0.5;
const SLIDER_MAX = 4.0;
const SSP_MARKS  = [
  { temp: 1.5, label: 'Low emissions',  sub: 'SSP1-2.6' },
  { temp: 2.5, label: 'Middle road',    sub: 'SSP2-4.5' },
  { temp: 3.5, label: 'High emissions', sub: 'SSP5-8.5' },
];

function sliderPct(t: number) {
  return ((t - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
}

function warmingLineColor(t: number) {
  if (t <= 1.5) return '#3b82f6';
  if (t <= 2.5) return '#f97316';
  return '#ef4444';
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} TWh` : `${n.toFixed(0)} GWh`;
}

// ── Park colours (A = emerald, B = violet — fixed, scenario-independent) ──────

const COLOR_A = { line: '#10b981', band: 'rgba(16,185,129,0.18)' };
const COLOR_B = { line: '#8b5cf6', band: 'rgba(139,92,246,0.18)'  };

// ── Shared warming slider ─────────────────────────────────────────────────────

function WarmingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct   = sliderPct(value);
  const color = warmingLineColor(value);
  return (
    <div className="cmp-warming">
      <div className="cmp-warming-header">
        <span className="cmp-warming-label">Shared warming scenario — both parks use this setting</span>
        <span className="cmp-warming-val" style={{ color }}>+{value.toFixed(1)}°C by 2055</span>
      </div>
      <div className="cmp-warming-track-wrap">
        <input
          type="range"
          min={SLIDER_MIN} max={SLIDER_MAX} step={0.1}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="cmp-warming-slider"
          style={{ '--w-color': color, '--w-pct': `${pct}%` } as React.CSSProperties}
        />
        <div className="cmp-warming-marks">
          {SSP_MARKS.map(m => (
            <div
              key={m.temp}
              className={`cmp-mark${Math.abs(value - m.temp) < 0.26 ? ' active' : ''}`}
              style={{ left: `${sliderPct(m.temp)}%` }}
            >
              <div className="cmp-mark-tick" />
              <div className="cmp-mark-label">{m.label}</div>
              <div className="cmp-mark-sub">{m.temp}°C · {m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Park selector ─────────────────────────────────────────────────────────────

interface SelectorProps {
  label:    string;
  color:    string;
  value:    ComparePark;
  exclude:  ComparePark;
  onChange: (p: ComparePark) => void;
}

function ParkSelector({ label, color, value, exclude, onChange }: SelectorProps) {
  return (
    <div className="cmp-selector">
      <div className="cmp-selector-label" style={{ color }}>{label}</div>
      <select
        className="cmp-select"
        style={{ borderColor: color }}
        value={value.name}
        onChange={e => {
          const found = PARKS.find(p => p.name === e.target.value);
          if (found && found.name !== exclude.name) onChange(found);
        }}
      >
        {PARKS.map(p => (
          <option key={p.name} value={p.name} disabled={p.name === exclude.name}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="cmp-selector-meta">
        <span className="cmp-badge solar">solar</span>
        <span className="cmp-selector-state">{value.state} · {value.capacity} MWp</span>
      </div>
    </div>
  );
}

// ── Mini chart ────────────────────────────────────────────────────────────────

interface MiniChartProps {
  data:   Row[];
  color:  { line: string; band: string };
  label:  string;
}

function MiniChart({ data, color, label }: MiniChartProps) {
  const yMin = Math.floor(Math.min(...data.map(d => d.p90)) * 0.97);
  const yMax = Math.ceil(data[0].baseline * 1.01);
  return (
    <div className="mini-chart-wrap">
      <div className="mini-chart-park-label">{label}</div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false} axisLine={false}
            label={{ value: 'years', position: 'insideRight', offset: -4, fontSize: 10, fill: 'var(--text-muted)', dy: 2 }}
          />
          <YAxis
            type="number" domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false} axisLine={false}
            tickFormatter={v => v.toFixed(0)} width={34}
          />
          <Area type="monotone" dataKey="p90"  stackId="fan" fill="transparent" stroke="none" isAnimationActive={false} />
          <Area type="monotone" dataKey="band" stackId="fan" fill={color.band}  stroke="none" isAnimationActive={false} />
          <Line type="monotone" dataKey="p50"      stroke={color.line}       strokeWidth={2}   dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="baseline" stroke="var(--slate-400)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mini-chart-legend">
        <span><span className="mini-swatch" style={{ background: color.line }} /> Climate-adjusted</span>
        <span><span className="mini-dash" /> Industry assumption</span>
      </div>
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────

interface Winner { a: boolean; b: boolean }

function winnerOf(aVal: number, bVal: number, lowerIsBetter: boolean): Winner {
  if (Math.abs(aVal - bVal) < 0.001) return { a: false, b: false };
  const aWins = lowerIsBetter ? aVal < bVal : aVal > bVal;
  return { a: aWins, b: !aWins };
}

function WinBadge({ wins }: { wins: boolean }) {
  if (!wins) return null;
  return <span className="win-badge">✓ Better</span>;
}

interface TableProps {
  parkA:  ComparePark;
  parkB:  ComparePark;
  statsA: Stats;
  statsB: Stats;
  warming: number;
}

function CompareTable({ parkA, parkB, statsA, statsB, warming }: TableProps) {
  const wOutput  = winnerOf(statsA.lifetimeBaseline, statsB.lifetimeBaseline, false);
  const wAdjust  = winnerOf(statsA.lifetimeP50,      statsB.lifetimeP50,      false);
  const wLoss    = winnerOf(statsA.lossPct,           statsB.lossPct,          false); // less negative = better
  const wRevGap  = winnerOf(statsA.revenueGap,        statsB.revenueGap,       false); // less negative = better
  const wRisk    = winnerOf(parkA.risk,               parkB.risk,              true);  // lower risk = better

  // Composite exposure score (lower = less exposed)
  const scoreA = Math.abs(statsA.lossPct) * 0.5 + parkA.risk * 0.5;
  const scoreB = Math.abs(statsB.lossPct) * 0.5 + parkB.risk * 0.5;
  const lessExposed   = scoreA < scoreB ? parkA : parkB;
  const moreExposed   = scoreA < scoreB ? parkB : parkA;
  const diffPct       = Math.abs(scoreA - scoreB) / Math.max(scoreA, scoreB) * 100;

  return (
    <div className="compare-table-section">
      <h2 className="compare-table-title">Head-to-head at +{warming.toFixed(1)}°C</h2>
      <p className="compare-table-sub">Lower climate exposure is better for lenders and insurers.</p>

      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead>
            <tr>
              <th className="cmp-th-metric">Metric</th>
              <th className="cmp-th-a">
                <span className="cmp-th-dot" style={{ background: COLOR_A.line }} />
                {parkA.name.split(' ').slice(0, 2).join(' ')}
              </th>
              <th className="cmp-th-b">
                <span className="cmp-th-dot" style={{ background: COLOR_B.line }} />
                {parkB.name.split(' ').slice(0, 2).join(' ')}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="cmp-td-metric">Standard 30-yr output</td>
              <td className={wOutput.a ? 'cmp-td win' : 'cmp-td'}>
                {fmt(statsA.lifetimeBaseline)}<WinBadge wins={wOutput.a} />
              </td>
              <td className={wOutput.b ? 'cmp-td win' : 'cmp-td'}>
                {fmt(statsB.lifetimeBaseline)}<WinBadge wins={wOutput.b} />
              </td>
            </tr>
            <tr>
              <td className="cmp-td-metric">Climate-adjusted output (P50)</td>
              <td className={wAdjust.a ? 'cmp-td win' : 'cmp-td'}>
                {fmt(statsA.lifetimeP50)}<WinBadge wins={wAdjust.a} />
              </td>
              <td className={wAdjust.b ? 'cmp-td win' : 'cmp-td'}>
                {fmt(statsB.lifetimeP50)}<WinBadge wins={wAdjust.b} />
              </td>
            </tr>
            <tr className="cmp-tr-highlight">
              <td className="cmp-td-metric">
                Output loss vs standard
                <span className="cmp-td-hint">lower % loss = less exposed</span>
              </td>
              <td className={wLoss.a ? 'cmp-td win' : 'cmp-td loss'}>
                {statsA.lossPct.toFixed(2)}%<WinBadge wins={wLoss.a} />
              </td>
              <td className={wLoss.b ? 'cmp-td win' : 'cmp-td loss'}>
                {statsB.lossPct.toFixed(2)}%<WinBadge wins={wLoss.b} />
              </td>
            </tr>
            <tr className="cmp-tr-highlight">
              <td className="cmp-td-metric">
                Revenue shortfall vs standard
                <span className="cmp-td-hint">over 30 years at €{PRICE}/MWh</span>
              </td>
              <td className={wRevGap.a ? 'cmp-td win' : 'cmp-td loss'}>
                −€{Math.abs(statsA.revenueGap).toFixed(1)}M<WinBadge wins={wRevGap.a} />
              </td>
              <td className={wRevGap.b ? 'cmp-td win' : 'cmp-td loss'}>
                −€{Math.abs(statsB.revenueGap).toFixed(1)}M<WinBadge wins={wRevGap.b} />
              </td>
            </tr>
            <tr>
              <td className="cmp-td-metric">
                Heat risk score
                <span className="cmp-td-hint">exposure to extreme heat days through 2055</span>
              </td>
              <td className={wRisk.a ? 'cmp-td win' : 'cmp-td loss'}>
                {parkA.risk.toFixed(1)}/10<WinBadge wins={wRisk.a} />
              </td>
              <td className={wRisk.b ? 'cmp-td win' : 'cmp-td loss'}>
                {parkB.risk.toFixed(1)}/10<WinBadge wins={wRisk.b} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Verdict */}
      <div className="compare-verdict">
        <div className="verdict-body">
          <strong>{lessExposed.name}</strong> carries roughly {diffPct.toFixed(0)}% less climate
          exposure than <strong>{moreExposed.name}</strong> at +{warming.toFixed(1)}°C of warming
          — lower output loss, lower heat risk score.
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ParkComparison() {
  const [parkA,   setParkA]   = useState<ComparePark>(PARKS[1]); // Weesow (large, high risk)
  const [parkB,   setParkB]   = useState<ComparePark>(PARKS[0]); // Eggebek (smaller, lower risk)
  const [warming, setWarming] = useState(2.0);

  const dataA = useMemo(() => buildData(parkA, warming), [parkA, warming]);
  const dataB = useMemo(() => buildData(parkB, warming), [parkB, warming]);

  const statsA = useMemo(() => getStats(dataA), [dataA]);
  const statsB = useMemo(() => getStats(dataB), [dataB]);

  const samepark = parkA.name === parkB.name;

  return (
    <div className="park-comparison">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="compare-page-header">
        <h1>Compare two parks</h1>
        <p>
          Select any two parks to see which carries more climate risk — and by exactly how much.
          The warming slider is shared: both forecasts update together so you can see the
          divergence grow as temperatures rise.
        </p>
      </div>

      {/* ── Selectors + VS ───────────────────────────────── */}
      <div className="compare-selectors">
        <ParkSelector
          label="Park A"
          color={COLOR_A.line}
          value={parkA}
          exclude={parkB}
          onChange={setParkA}
        />
        <div className="vs-badge">VS</div>
        <ParkSelector
          label="Park B"
          color={COLOR_B.line}
          value={parkB}
          exclude={parkA}
          onChange={setParkB}
        />
      </div>

      {samepark && (
        <div className="same-park-warning">
          Please select two different parks to compare.
        </div>
      )}

      {/* ── Warming slider ────────────────────────────────── */}
      <WarmingSlider value={warming} onChange={setWarming} />

      {/* ── Side-by-side charts ──────────────────────────── */}
      <div className="compare-charts">
        <div className="compare-chart-card" style={{ borderTopColor: COLOR_A.line }}>
          <div className="compare-chart-header">
            <span className="cmp-badge" style={{ background: `${COLOR_A.line}18`, color: COLOR_A.line }}>Park A</span>
            <span className="compare-chart-name">{parkA.name}</span>
            <span className="compare-chart-state">{parkA.state}</span>
          </div>
          <MiniChart data={dataA} color={COLOR_A} label="" />
          <div className="chart-headline">
            <div className="ch-item">
              <div className="ch-label">Standard output</div>
              <div className="ch-val">{fmt(statsA.lifetimeBaseline)}</div>
            </div>
            <div className="ch-sep" />
            <div className="ch-item">
              <div className="ch-label">Climate-adjusted</div>
              <div className="ch-val" style={{ color: COLOR_A.line }}>{fmt(statsA.lifetimeP50)}</div>
              <div className="ch-delta">{statsA.lossPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div className="compare-chart-card" style={{ borderTopColor: COLOR_B.line }}>
          <div className="compare-chart-header">
            <span className="cmp-badge" style={{ background: `${COLOR_B.line}18`, color: COLOR_B.line }}>Park B</span>
            <span className="compare-chart-name">{parkB.name}</span>
            <span className="compare-chart-state">{parkB.state}</span>
          </div>
          <MiniChart data={dataB} color={COLOR_B} label="" />
          <div className="chart-headline">
            <div className="ch-item">
              <div className="ch-label">Standard output</div>
              <div className="ch-val">{fmt(statsB.lifetimeBaseline)}</div>
            </div>
            <div className="ch-sep" />
            <div className="ch-item">
              <div className="ch-label">Climate-adjusted</div>
              <div className="ch-val" style={{ color: COLOR_B.line }}>{fmt(statsB.lifetimeP50)}</div>
              <div className="ch-delta">{statsB.lossPct.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Head-to-head table + verdict ─────────────────── */}
      {!samepark && (
        <CompareTable
          parkA={parkA} parkB={parkB}
          statsA={statsA} statsB={statsB}
          warming={warming}
        />
      )}

    </div>
  );
}
