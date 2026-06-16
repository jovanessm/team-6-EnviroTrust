import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useState, useMemo } from 'react';
import { PARKS, ET_FAIMAN_BY_ID, ET_NOCT_BY_ID } from '../data/parks';
import type { ParkEntry, ScenarioData } from '../data/parks';
import './ParkComparison.css';

// ── Faiman boost (mirrors ParkForecast logic) ─────────────────────────────────

function faimanBoost(park: ParkEntry): number {
  const effectiveWind = park.windExposure * park.meanWindMs;
  const noctDelta     = 400 * (45 - 20) / 800;
  const faimanDelta   = 400 / (25 + 6.84 * effectiveWind);
  return (noctDelta - faimanDelta) * 0.004;
}

// ── Scenario config ───────────────────────────────────────────────────────────

type RcpKey = 'RCP2.6' | 'RCP4.5' | 'RCP8.5';

const SSP_SCENARIOS = [
  { rcp: 'RCP2.6' as RcpKey, label: 'SSP1-2.6', name: 'Low emissions',  color: '#3b82f6' },
  { rcp: 'RCP4.5' as RcpKey, label: 'SSP2-4.5', name: 'Middle road',    color: '#f97316' },
  { rcp: 'RCP8.5' as RcpKey, label: 'SSP5-8.5', name: 'High emissions', color: '#ef4444' },
];

// ── Chart row ─────────────────────────────────────────────────────────────────

interface Row {
  year:     number;
  baseline: number;
  p90:      number; // pessimistic/lower — transparent stacking base
  band:     number; // p90_gwh − p10_gwh — colored fill height
  p50:      number;
}

function buildRows(scenario: ScenarioData): Row[] {
  return scenario.years.map(y => ({
    year:     y.year,
    baseline: y.baseline_gwh,
    p90:      y.p10_gwh,
    band:     y.p90_gwh - y.p10_gwh,
    p50:      y.p50_gwh,
  }));
}

// ── Stats from real finance data ──────────────────────────────────────────────

interface Stats {
  lifetimeBaseline: number;
  lifetimeP50:      number;
  lifetimeP10:      number;
  revBaseline:      number;
  revP50:           number;
  lossPct:          number;
  revenueGap:       number;
  priceLabel:       string;
}

function getStats(scenario: ScenarioData): Stats {
  return {
    lifetimeBaseline: scenario.lifetime_baseline_gwh,
    lifetimeP50:      scenario.lifetime_p50_gwh,
    lifetimeP10:      scenario.lifetime_p10_gwh,
    revBaseline:      scenario.finance.lifetime_baseline_meur,
    revP50:           scenario.finance.lifetime_p50_meur,
    lossPct:          scenario.delta_pct,
    revenueGap:       scenario.finance.revenue_gap_meur,
    priceLabel:       scenario.finance.price_assumption,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} TWh` : `${n.toFixed(0)} GWh`;
}

// ── Park colours (A = emerald, B = violet — fixed, scenario-independent) ──────

const COLOR_A = { line: '#10b981', band: 'rgba(16,185,129,0.18)' };
const COLOR_B = { line: '#8b5cf6', band: 'rgba(139,92,246,0.18)'  };

// ── Scenario tabs ─────────────────────────────────────────────────────────────

function ScenarioTabs({ value, onChange, hasRcp26 }: { value: RcpKey; onChange: (r: RcpKey) => void; hasRcp26: boolean }) {
  return (
    <div className="cmp-warming">
      <div className="cmp-warming-header" style={{ marginBottom: '0.75rem' }}>
        <span className="cmp-warming-label">Shared scenario — both parks use this setting</span>
      </div>
      <div className="cmp-ssp-tabs">
        {SSP_SCENARIOS.map(s => {
          const unavailable = s.rcp === 'RCP2.6' && !hasRcp26;
          return (
            <button
              key={s.rcp}
              className={`cmp-ssp-tab${value === s.rcp ? ' active' : ''}${unavailable ? ' disabled' : ''}`}
              style={value === s.rcp && !unavailable
                ? { borderColor: s.color, color: s.color, background: `${s.color}12` }
                : unavailable ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
              onClick={() => !unavailable && onChange(s.rcp)}
              disabled={unavailable}
              title={unavailable ? 'Not available for EnviroTrust source' : undefined}
            >
              <span className="tab-label">{s.label}</span>
              <span className="tab-name">{unavailable ? 'Not available' : s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Park selector ─────────────────────────────────────────────────────────────

interface SelectorProps {
  label:    string;
  color:    string;
  value:    ParkEntry;
  exclude:  ParkEntry;
  onChange: (p: ParkEntry) => void;
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
        <span className="cmp-selector-state">{value.state} · {value.capacity_mwp} MWp</span>
      </div>
    </div>
  );
}

// ── Mini chart ────────────────────────────────────────────────────────────────

interface MiniChartProps {
  data:  Row[];
  color: { line: string; band: string };
  label: string;
}

function MiniChart({ data, color, label }: MiniChartProps) {
  const dataMin  = Math.min(...data.map(d => d.p90));
  const dataMax  = Math.max(...data.map(d => d.baseline));
  const pad      = Math.max((dataMax - dataMin) * 0.08, 0.05);
  const chartMin = Math.floor((dataMin - pad) * 10) / 10;
  const chartMax = Math.ceil((dataMax + pad) * 10) / 10;

  const shifted = data.map(d => ({
    ...d,
    baseline: +(d.baseline - chartMin).toFixed(3),
    p90:      +Math.max(0, d.p90 - chartMin).toFixed(3),
    p50:      +(d.p50 - chartMin).toFixed(3),
  }));

  return (
    <div className="mini-chart-wrap">
      <div className="mini-chart-park-label">{label}</div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={shifted} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false} axisLine={false}
            label={{ value: 'years', position: 'insideRight', offset: -4, fontSize: 10, fill: 'var(--text-muted)', dy: 2 }}
          />
          <YAxis
            type="number" domain={[0, +(chartMax - chartMin).toFixed(2)]}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false} axisLine={false}
            tickFormatter={v => (v + chartMin).toFixed(1)} width={38}
          />
          <Area type="monotone" dataKey="p90"  stackId="fan" fill="transparent" stroke="none" isAnimationActive={false} />
          <Area type="monotone" dataKey="band" stackId="fan" fill={color.band}  stroke="none" isAnimationActive={false} />
          <Line type="monotone" dataKey="p50"      stroke={color.line}       strokeWidth={2}   dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="baseline" stroke="var(--slate-400)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mini-chart-legend">
        <span><span className="mini-swatch" style={{ background: color.line }} /> Climate-adjusted P10–P90 band</span>
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
  parkA:    ParkEntry;
  parkB:    ParkEntry;
  statsA:   Stats;
  statsB:   Stats;
  scenario: typeof SSP_SCENARIOS[number];
}

function CompareTable({ parkA, parkB, statsA, statsB, scenario }: TableProps) {
  const wOutput  = winnerOf(statsA.lifetimeBaseline, statsB.lifetimeBaseline, false);
  const wAdjust  = winnerOf(statsA.lifetimeP50,      statsB.lifetimeP50,      false);
  const wLoss    = winnerOf(statsA.lossPct,           statsB.lossPct,          false);
  const wRevGap  = winnerOf(statsA.revenueGap,        statsB.revenueGap,       false);
  const wRisk    = winnerOf(parkA.risk,               parkB.risk,              true);

  const scoreA      = Math.abs(statsA.lossPct) * 0.5 + parkA.risk * 0.5;
  const scoreB      = Math.abs(statsB.lossPct) * 0.5 + parkB.risk * 0.5;
  const lessExposed = scoreA < scoreB ? parkA : parkB;
  const moreExposed = scoreA < scoreB ? parkB : parkA;
  const diffPct     = Math.abs(scoreA - scoreB) / Math.max(scoreA, scoreB) * 100;

  return (
    <div className="compare-table-section">
      <h2 className="compare-table-title">
        Head-to-head — {scenario.label} ({scenario.name})
      </h2>
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
                <span className="cmp-td-hint">over 30 years · {statsA.priceLabel}</span>
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

      <div className="compare-verdict">
        <div className="verdict-body">
          <strong>{lessExposed.name}</strong> carries roughly {diffPct.toFixed(0)}% less climate
          exposure than <strong>{moreExposed.name}</strong> under {scenario.label} — lower output
          loss, lower heat risk score.
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ParkComparison() {
  const [parkA,     setParkA]     = useState<ParkEntry>(PARKS[1]);
  const [parkB,     setParkB]     = useState<ParkEntry>(PARKS[0]);
  const [scenario,  setScenario]  = useState<RcpKey>('RCP4.5');
  const [useET,     setUseET]     = useState(false);
  const [useFaiman, setUseFaiman] = useState(true);

  const hasRcp26 = !useET;

  // Resolve active park entry for the chosen climate source + cell-temp model
  function resolveActive(base: ParkEntry): { park: ParkEntry; factor: number } {
    if (useET) {
      const map  = useFaiman ? ET_FAIMAN_BY_ID : ET_NOCT_BY_ID;
      const park = map[base.id] ?? base;
      return { park, factor: 1 };
    }
    if (!useFaiman) {
      const boost  = faimanBoost(base);
      return { park: base, factor: 1 / (1 + boost) };
    }
    return { park: base, factor: 1 };
  }

  const { park: activeA, factor: factorA } = resolveActive(parkA);
  const { park: activeB, factor: factorB } = resolveActive(parkB);

  // If EnviroTrust selected and current scenario is RCP2.6, fall back to RCP4.5
  const effectiveScenario: RcpKey = (!hasRcp26 && scenario === 'RCP2.6') ? 'RCP4.5' : scenario;

  const scenarioInfo = SSP_SCENARIOS.find(s => s.rcp === effectiveScenario)!;

  const scenA = activeA.scenarios[effectiveScenario] ?? activeA.scenarios['RCP4.5'];
  const scenB = activeB.scenarios[effectiveScenario] ?? activeB.scenarios['RCP4.5'];

  const rowsA  = useMemo(() => buildRows(scenA).map(r => ({
    ...r, baseline: r.baseline * factorA, p90: r.p90 * factorA, band: r.band * factorA, p50: r.p50 * factorA,
  })), [scenA, factorA]);
  const rowsB  = useMemo(() => buildRows(scenB).map(r => ({
    ...r, baseline: r.baseline * factorB, p90: r.p90 * factorB, band: r.band * factorB, p50: r.p50 * factorB,
  })), [scenB, factorB]);

  const rawStatsA = useMemo(() => getStats(scenA), [scenA]);
  const rawStatsB = useMemo(() => getStats(scenB), [scenB]);
  const statsA: Stats = factorA === 1 ? rawStatsA : {
    ...rawStatsA,
    lifetimeBaseline: rawStatsA.lifetimeBaseline * factorA,
    lifetimeP50:      rawStatsA.lifetimeP50 * factorA,
    lifetimeP10:      rawStatsA.lifetimeP10 * factorA,
    revBaseline:      rawStatsA.revBaseline * factorA,
    revP50:           rawStatsA.revP50 * factorA,
    revenueGap:       rawStatsA.revenueGap * factorA,
  };
  const statsB: Stats = factorB === 1 ? rawStatsB : {
    ...rawStatsB,
    lifetimeBaseline: rawStatsB.lifetimeBaseline * factorB,
    lifetimeP50:      rawStatsB.lifetimeP50 * factorB,
    lifetimeP10:      rawStatsB.lifetimeP10 * factorB,
    revBaseline:      rawStatsB.revBaseline * factorB,
    revP50:           rawStatsB.revP50 * factorB,
    revenueGap:       rawStatsB.revenueGap * factorB,
  };

  const samepark = parkA.name === parkB.name;

  return (
    <div className="park-comparison">

      <div className="compare-page-header">
        <h1>Compare two parks</h1>
        <p>
          Select any two parks to see which carries more climate risk — and by exactly how much.
          Switch scenario to see how the gap changes under different emissions futures.
        </p>
      </div>

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

      {/* ── Source / model toggles ── */}
      <div className="cmp-model-toggles">
        <div className="cmp-toggle-row">
          <span className="cmp-toggle-label">Climate source</span>
          <div className="cmp-toggle-pills">
            <button className={`cmp-pill${!useET ? ' active' : ''}`} onClick={() => setUseET(false)}>CMIP6</button>
            <button className={`cmp-pill${useET ? ' active' : ''}`}  onClick={() => setUseET(true)}>EnviroTrust</button>
          </div>
        </div>
        <div className="cmp-toggle-row">
          <span className="cmp-toggle-label">Cell temperature model</span>
          <div className="cmp-toggle-pills">
            <button className={`cmp-pill${!useFaiman ? ' active' : ''}`} onClick={() => setUseFaiman(false)}>Standard · NOCT</button>
            <button className={`cmp-pill${useFaiman ? ' active' : ''}`}  onClick={() => setUseFaiman(true)}>Satellite · Faiman</button>
          </div>
        </div>
        <div className="cmp-toggle-note" style={{ visibility: useET ? 'visible' : 'hidden' }}>
          EnviroTrust provides <strong>RCP4.5 and RCP8.5 only</strong> — SSP1-2.6 disabled.
        </div>
      </div>

      <ScenarioTabs value={effectiveScenario} onChange={setScenario} hasRcp26={hasRcp26} />

      <div className="compare-charts">
        <div className="compare-chart-card" style={{ borderTopColor: COLOR_A.line }}>
          <div className="compare-chart-header">
            <span className="cmp-badge" style={{ background: `${COLOR_A.line}18`, color: COLOR_A.line }}>Park A</span>
            <span className="compare-chart-name">{parkA.name}</span>
            <span className="compare-chart-state">{parkA.state}</span>
          </div>
          <MiniChart data={rowsA} color={COLOR_A} label="" />
          <div className="chart-headline">
            <div className="ch-item">
              <div className="ch-label">Standard output</div>
              <div className="ch-val">{fmt(statsA.lifetimeBaseline)}</div>
            </div>
            <div className="ch-sep" />
            <div className="ch-item">
              <div className="ch-label">Climate-adjusted P50</div>
              <div className="ch-val" style={{ color: COLOR_A.line }}>{fmt(statsA.lifetimeP50)}</div>
              <div className="ch-delta">{statsA.lossPct.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <div className="compare-chart-card" style={{ borderTopColor: COLOR_B.line }}>
          <div className="compare-chart-header">
            <span className="cmp-badge" style={{ background: `${COLOR_B.line}18`, color: COLOR_B.line }}>Park B</span>
            <span className="compare-chart-name">{parkB.name}</span>
            <span className="compare-chart-state">{parkB.state}</span>
          </div>
          <MiniChart data={rowsB} color={COLOR_B} label="" />
          <div className="chart-headline">
            <div className="ch-item">
              <div className="ch-label">Standard output</div>
              <div className="ch-val">{fmt(statsB.lifetimeBaseline)}</div>
            </div>
            <div className="ch-sep" />
            <div className="ch-item">
              <div className="ch-label">Climate-adjusted P50</div>
              <div className="ch-val" style={{ color: COLOR_B.line }}>{fmt(statsB.lifetimeP50)}</div>
              <div className="ch-delta">{statsB.lossPct.toFixed(2)}%</div>
            </div>
          </div>
        </div>
      </div>

      {!samepark && (
        <CompareTable
          parkA={parkA} parkB={parkB}
          statsA={statsA} statsB={statsB}
          scenario={scenarioInfo}
        />
      )}

    </div>
  );
}
