import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useState, useMemo } from 'react';
import './ParkForecast.css';

export interface ParkEntry {
  name:     string;
  type:     string;
  state:    string;
  lat:      number;
  lon:      number;
  capacity: number; // MWp
  risk:     number; // heat risk 0–10
}

interface Props {
  park: ParkEntry;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SLIDER_MIN     = 0.5;
const SLIDER_MAX     = 4.0;
const SLIDER_DEFAULT = 2.0;
const PRICE_EUR_PER_MWH = 74;

const SSP_MARKS = [
  { temp: 1.5, label: 'Low emissions',  sub: 'SSP1-2.6' },
  { temp: 2.5, label: 'Middle road',    sub: 'SSP2-4.5' },
  { temp: 3.5, label: 'High emissions', sub: 'SSP5-8.5' },
] as const;

// ── Data model ────────────────────────────────────────────────────────────────

interface Row {
  year:     number;
  baseline: number;
  p50:      number;
  p90:      number; // absolute bottom of uncertainty band
  p10:      number; // absolute top of uncertainty band
  band:     number; // p10 - p90, used for stacked area height
  dT:       number;
  thermal:  number;
  degrad:   number;
  histYear: number;
}

function buildWarmingData(capacity: number, risk: number, totalWarming: number): Row[] {
  const BASE       = capacity * 0.95; // ~950 kWh/kWp/yr → GWh
  const DEGRAD     = 0.005;
  const GAMMA      = -0.004;
  const dTperYear  = totalWarming / 30;
  const riskFactor = 1 + (risk - 5.5) * 0.03; // higher heat-risk parks lose more

  return Array.from({ length: 30 }, (_, i) => {
    const yr           = i + 1;
    const degradFactor = Math.pow(1 - DEGRAD, yr - 1);
    const baseline     = +(BASE * degradFactor).toFixed(2);
    const dT           = +(dTperYear * yr).toFixed(3);
    const climLoss     = (GAMMA * dT - 0.00008 * dT * dT) * riskFactor;
    const p50         = +(baseline * (1 + climLoss)).toFixed(2);
    const sigma       = baseline * (0.022 + yr * 0.0012);
    const p90         = +(p50 - 1.28 * sigma).toFixed(2); // downside
    const p10         = +(p50 + 0.84 * sigma).toFixed(2); // upside
    return {
      year: yr,
      baseline,
      p50,
      p90,
      p10,
      band:     +(p10 - p90).toFixed(2),
      dT,
      thermal:  +(climLoss * 100).toFixed(3),
      degrad:   +((1 - degradFactor) * 100).toFixed(1),
      histYear: 2000 + ((yr * 7 + 3) % 23),
    };
  });
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function warmingColor(temp: number): { line: string; band: string } {
  if (temp <= 1.5) return { line: '#3b82f6', band: 'rgba(59,130,246,0.22)' };
  if (temp <= 2.5) return { line: '#f97316', band: 'rgba(249,115,22,0.24)' };
  return                  { line: '#ef4444', band: 'rgba(239,68,68,0.22)'  };
}

function sliderPct(temp: number) {
  return ((temp - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(gwh: number) {
  return gwh >= 1000 ? `${(gwh / 1000).toFixed(2)} TWh` : `${gwh.toFixed(0)} GWh`;
}

function toRevM(gwh: number) {
  return +((gwh * PRICE_EUR_PER_MWH * 1000) / 1e6).toFixed(1);
}

function fmtRev(m: number)  { return `€${m.toFixed(1)}M`; }

function fmtGap(gap: number, pct: number) {
  const sign = gap < 0 ? '−' : '+';
  return `${sign}€${Math.abs(gap).toFixed(1)}M (${sign}${Math.abs(pct).toFixed(1)}%)`;
}


// ── Warming slider ────────────────────────────────────────────────────────────

interface SliderProps {
  value:    number;
  onChange: (v: number) => void;
}

function WarmingSlider({ value, onChange }: SliderProps) {
  const pct    = sliderPct(value);
  const colors = warmingColor(value);

  return (
    <div className="warming-section">
      <div className="warming-header">
        <span className="warming-label">Projected warming by 2055</span>
        <span className="warming-value" style={{ color: colors.line }}>
          +{value.toFixed(1)}°C
        </span>
      </div>

      <div className="warming-track-wrap">
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={0.1}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="warming-slider"
          style={{
            '--w-color': colors.line,
            '--w-pct':   `${pct}%`,
          } as React.CSSProperties}
        />

        <div className="warming-marks">
          {SSP_MARKS.map(m => (
            <div
              key={m.temp}
              className={`warming-mark${value >= m.temp - 0.25 && value <= m.temp + 0.25 ? ' active' : ''}`}
              style={{ left: `${sliderPct(m.temp)}%` }}
            >
              <div className="warming-mark-tick" />
              <div className="warming-mark-label">{m.label}</div>
              <div className="warming-mark-temp">{m.temp}°C · {m.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="warming-explainer">
        Drag to set how much average temperatures rise by 2055. The tick marks show
        the three standard climate pathways used by scientists worldwide.
      </p>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?:      boolean;
  label?:       number;
  data:         Row[];
  warmingLevel: number;
}

function ForecastTooltip({ active, label, data, warmingLevel }: TooltipProps) {
  if (!active || label == null) return null;
  const row    = data.find(d => d.year === Number(label));
  if (!row) return null;
  const colors = warmingColor(warmingLevel);

  return (
    <div className="prov-tooltip">
      <div className="prov-header">Year {label} &nbsp;·&nbsp; {2025 + Number(label)}</div>
      <div className="prov-baseline">
        Industry standard &nbsp;<strong>{row.baseline.toFixed(1)} GWh/yr</strong>
      </div>
      <div className="prov-scenario" style={{ borderLeftColor: colors.line }}>
        <div className="prov-name">Climate-adjusted · +{warmingLevel.toFixed(1)}°C by 2055</div>
        <div className="prov-grid">
          <span>Expected output</span>            <span>{row.p50.toFixed(1)} GWh/yr</span>
          <span>Likely range</span>               <span>{row.p90.toFixed(1)} – {row.p10.toFixed(1)} GWh</span>
          <span>Warming at this year</span>       <span>+{row.dT.toFixed(2)}°C above baseline</span>
          <span>Heat reduces output by</span>     <span>{Math.abs(row.thermal).toFixed(2)}%</span>
          <span>Age-related panel decline</span>  <span>−{row.degrad.toFixed(1)}%</span>
          <span>Weather sampled from</span>       <span>{row.histYear}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ParkForecast({ park, onClose }: Props) {
  const [warmingLevel, setWarmingLevel] = useState(SLIDER_DEFAULT);

  const data = useMemo(
    () => buildWarmingData(park.capacity, park.risk, warmingLevel),
    [park.capacity, park.risk, warmingLevel],
  );
  const colors = warmingColor(warmingLevel);

  // Lifetime energy (GWh)
  const lifetimeBaseline = data.reduce((s, d) => s + d.baseline, 0);
  const lifetimeP50      = data.reduce((s, d) => s + d.p50,      0);
  const lifetimeP90      = data.reduce((s, d) => s + d.p90,      0); // downside
  const lifetimeP10      = data.reduce((s, d) => s + d.p10,      0); // upside
  const dp50             = ((lifetimeP50 - lifetimeBaseline) / lifetimeBaseline) * 100;

  // Lifetime revenue (€M)
  const revBaseline = toRevM(lifetimeBaseline);
  const revP50      = toRevM(lifetimeP50);
  const revP90      = toRevM(lifetimeP90);
  const revP10      = toRevM(lifetimeP10);
  const gapM_p50    = +(revP50 - revBaseline).toFixed(1);
  const gapPct_p50  = +((gapM_p50 / revBaseline) * 100).toFixed(1);
  const gapM_p90    = +(revP90 - revBaseline).toFixed(1);
  const gapPct_p90  = +((gapM_p90 / revBaseline) * 100).toFixed(1);

  // Annual first 5 years
  const annual5 = data.slice(0, 5).map(d => ({
    year:     2024 + d.year - 1,
    baseline: toRevM(d.baseline),
    p50:      toRevM(d.p50),
    p10:      toRevM(d.p10),
  }));

  const yMin    = Math.floor(Math.min(...data.map(d => d.p90)) - 1);
  const yMax    = Math.ceil(data[0].baseline + 1);
  const score    = park.risk.toFixed(1);
  const scoreNum = park.risk;

  return (
    <div className="park-forecast">

      {/* ── Park header ──────────────────────────────────── */}
      <div className="forecast-top">
        <div className="forecast-park-info">
          <span className={`forecast-badge ${park.type}`}>{park.type}</span>
          <h2 className="forecast-park-name">{park.name}</h2>
          <p className="forecast-park-meta">{park.state} &nbsp;·&nbsp; {park.lat.toFixed(3)}, {park.lon.toFixed(3)}</p>
        </div>
        <button className="forecast-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* ── Headline cards ────────────────────────────────── */}
      <div className="forecast-headline">
        <div className="hl-item">
          <div className="hl-label">Industry Standard</div>
          <div className="hl-value">{fmt(lifetimeBaseline)}</div>
          <div className="hl-sub">30-year total output</div>
        </div>
        <div className="hl-sep" />
        <div className="hl-item">
          <div className="hl-label">Climate-Adjusted · +{warmingLevel.toFixed(1)}°C</div>
          <div className="hl-value" style={{ color: colors.line }}>{fmt(lifetimeP50)}</div>
          <div className={`hl-delta ${dp50 < 0 ? 'neg' : 'pos'}`}>{dp50.toFixed(1)}%</div>
        </div>
        <div className="hl-sep" />
        <div className="hl-item">
          <div className="hl-label">Revenue at Risk</div>
          <div className="hl-value">{fmtRev(Math.abs(gapM_p50))}</div>
          <div className="hl-sub">vs industry standard</div>
        </div>
      </div>

      {/* ── Warming slider ────────────────────────────────── */}
      <WarmingSlider value={warmingLevel} onChange={setWarmingLevel} />

      {/* ── Legend ───────────────────────────────────────── */}
      <div className="forecast-legend">
        <span className="legend-scen">
          <span className="legend-swatch" style={{ background: colors.line }} />
          Climate-adjusted forecast
        </span>
        <span className="legend-scen" style={{ color: 'var(--text-muted)' }}>
          <span className="legend-swatch" style={{ background: colors.band.replace(/[\d.]+\)$/, '0.7)') }} />
          Likely range of outcomes
        </span>
        <span className="legend-baseline">
          <span className="legend-dash" />
          Industry assumption (no climate change)
        </span>
      </div>

      {/* ── Fan chart ─────────────────────────────────────── */}
      <div className="forecast-chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false} axisLine={false}
              label={{ value: 'years', position: 'insideRight', offset: -4, fontSize: 11, fill: 'var(--text-muted)', dy: 2 }}
            />
            <YAxis
              type="number" domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false} axisLine={false}
              tickFormatter={v => v.toFixed(0)} width={36}
              label={{ value: 'GWh/yr', angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: 'var(--text-muted)' }}
            />
            <Tooltip content={(props) => (
              <ForecastTooltip
                active={props.active}
                label={props.label as number}
                data={data}
                warmingLevel={warmingLevel}
              />
            )} />

            {/* Uncertainty band: p90 is the transparent base, band stacks on top */}
            <Area type="monotone" dataKey="p90"  stackId="fan" fill="transparent"  stroke="none" isAnimationActive={false} legendType="none" />
            <Area type="monotone" dataKey="band" stackId="fan" fill={colors.band}  stroke="none" isAnimationActive={false} legendType="none" />

            {/* P50 and baseline lines */}
            <Line type="monotone" dataKey="p50"      stroke={colors.line}        strokeWidth={2}   dot={false} isAnimationActive={false} legendType="none" />
            <Line type="monotone" dataKey="baseline" stroke="var(--slate-900)"   strokeWidth={2}   strokeDasharray="5 3" dot={false} isAnimationActive={false} legendType="none" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="forecast-hint">Hover any year to see what's driving the numbers · the gap between lines is the climate adjustment</p>

      {/* ── Finance section ───────────────────────────────── */}
      <div className="finance-divider" />
      <div className="finance-section">

        {/* Heat risk */}
        <div className="heat-risk-row">
          <span className="heat-risk-label">Climate Heat Risk</span>
          <span className="heat-risk-score" style={{ color: scoreNum >= 7 ? '#dc2626' : scoreNum >= 5 ? '#d97706' : '#059669' }}>
            {score}<span className="heat-risk-denom">/10</span>
          </span>
          <span className="heat-risk-note">how exposed this park is to extreme heat days through 2055 — hotter panels produce less power and degrade faster</span>
        </div>

        {/* Lifetime revenue */}
        <div className="finance-block">
          <div className="finance-block-title">Lifetime Revenue (30 years) · +{warmingLevel.toFixed(1)}°C scenario</div>
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Industry assumption</th>
                  <th>Most likely outcome</th>
                  <th>Conservative estimate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">30-yr revenue</td>
                  <td>{fmtRev(revBaseline)}</td>
                  <td>{fmtRev(revP50)}</td>
                  <td>{fmtRev(revP90)}</td>
                </tr>
                <tr>
                  <td className="row-label">Best case</td>
                  <td className="em-dash">—</td>
                  <td>{fmtRev(revP10)}</td>
                  <td className="em-dash">—</td>
                </tr>
                <tr>
                  <td className="row-label">Shortfall vs assumption</td>
                  <td className="em-dash">—</td>
                  <td className={gapM_p50 < 0 ? 'gap-neg' : 'gap-pos'}>{fmtGap(gapM_p50, gapPct_p50)}</td>
                  <td className={gapM_p90 < 0 ? 'gap-neg' : 'gap-pos'}>{fmtGap(gapM_p90, gapPct_p90)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="finance-note">Price assumption: €{PRICE_EUR_PER_MWH}/MWh · illustrative, not a forecast</p>
        </div>

        {/* Annual first 5 years */}
        <div className="finance-block">
          <div className="finance-block-title">Annual Revenue — first 5 years · +{warmingLevel.toFixed(1)}°C</div>
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Industry Standard</th>
                  <th>Expected</th>
                  <th>Optimistic</th>
                </tr>
              </thead>
              <tbody>
                {annual5.map(r => (
                  <tr key={r.year}>
                    <td className="row-label">{r.year}</td>
                    <td>{fmtRev(r.baseline)}</td>
                    <td>{fmtRev(r.p50)}</td>
                    <td>{fmtRev(r.p10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
