import { useLocation, useNavigate } from 'react-router-dom';
import type { PredictionResult, Park } from '../types';
import './Results.css';

interface LocationState {
  result: PredictionResult;
  park: Park;
}

export function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  if (!state?.result || !state?.park) {
    return (
      <div className="results-error">
        <h1>No Results</h1>
        <p>Please run an analysis first.</p>
        <button onClick={() => navigate('/analyze')}>Back to Analysis</button>
      </div>
    );
  }

  const { result, park } = state;

  const scenarios = Object.entries(result.scenarioOutputs).map(([name, data]) => ({
    name,
    ...data,
  }));

  const maxOutput = Math.max(
    ...scenarios.map((s) => s.upper),
    result.baselineOutput
  );

  return (
    <div className="results">
      <section className="results-header">
        <button className="back-button" onClick={() => navigate('/analyze')}>
          ← Back to Analysis
        </button>
        <h1>Prediction Results: {park.name}</h1>
        <div className="park-summary">
          <span className="badge">{park.type.toUpperCase()}</span>
          <span className="capacity">{park.capacity} MW</span>
          <span className="location">
            {park.location.lat.toFixed(2)}°, {park.location.lng.toFixed(2)}°
          </span>
        </div>
      </section>

      <section className="results-content">
        <div className="baseline-card">
          <h2>Baseline Output (Historical)</h2>
          <div className="metric">
            <span className="value">
              {(result.baselineOutput / 1e6).toFixed(2)} TWh
            </span>
            <span className="label">30-year lifetime</span>
          </div>
          {result.historicalOutput && (
            <p className="note">
              Historical actual output: {(result.historicalOutput / 1e6).toFixed(2)} TWh
              {result.divergence && (
                <span className={result.divergence > 0 ? 'positive' : 'negative'}>
                  {result.divergence > 0 ? '+' : ''}{result.divergence.toFixed(1)}%
                </span>
              )}
            </p>
          )}
        </div>

        <div className="scenarios-section">
          <h2>Climate Scenarios</h2>
          <p className="description">
            How does lifetime output change under different climate projections?
          </p>

          <div className="scenarios-comparison">
            {scenarios.map((scenario) => (
              <div key={scenario.name} className="scenario-item">
                <h3>{formatScenarioName(scenario.name)}</h3>

                <div className="output-bar">
                  <div className="uncertainty-range">
                    <div
                      className="range-bar"
                      style={{
                        width: `${((scenario.upper - scenario.lower) / maxOutput) * 100}%`,
                        left: `${(scenario.lower / maxOutput) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <div
                    className="output-marker"
                    style={{
                      left: `${(scenario.output / maxOutput) * 100}%`,
                    }}
                  ></div>
                </div>

                <div className="scenario-details">
                  <div className="detail">
                    <span className="label">Best estimate:</span>
                    <span className="value">{(scenario.output / 1e6).toFixed(2)} TWh</span>
                  </div>
                  <div className="detail">
                    <span className="label">5th–95th percentile:</span>
                    <span className="value">
                      {(scenario.lower / 1e6).toFixed(2)} – {(scenario.upper / 1e6).toFixed(2)} TWh
                    </span>
                  </div>
                  <div className="detail">
                    <span className="label">Uncertainty:</span>
                    <span className="value">±{scenario.uncertainty.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {result.assumptions && result.assumptions.length > 0 && (
          <section className="assumptions-section">
            <h2>Assumptions & Data Sources</h2>
            <ul className="assumptions-list">
              {result.assumptions.map((assumption, idx) => (
                <li key={idx}>{assumption}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="actions">
          <button className="secondary-button" onClick={() => navigate('/analyze')}>
            Analyze Another Park
          </button>
        </section>
      </section>
    </div>
  );
}

function formatScenarioName(name: string): string {
  const names: { [key: string]: string } = {
    historical: 'Historical (Baseline)',
    ssp126: 'SSP1-2.6 (Low Emissions)',
    ssp245: 'SSP2-4.5 (Moderate)',
    ssp370: 'SSP3-7.0 (High)',
    ssp585: 'SSP5-8.5 (Very High)',
  };
  return names[name] || name;
}
