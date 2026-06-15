import { Link } from 'react-router-dom';
import './Home.css';

export function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Power, Seen From Orbit</h1>
          <p className="subtitle">
            Predict renewable energy output over 30 years using satellite data and climate projections
          </p>
          <p className="description">
            Traditional forecasts assume tomorrow's climate matches yesterday's. Climate is shifting.
            We combine real satellite imagery, forward-looking climate models, and real turbine data
            to predict what your wind or solar park will actually produce—with honest uncertainty.
          </p>
          <Link to="/analyze" className="cta-button">
            Analyze a Park
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🛰️</div>
            <h3>Satellite Imagery</h3>
            <p>Real park geometry from orbit. Not assumptions, but actual layout and spacing.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌍</div>
            <h3>Climate Projections</h3>
            <p>Forward-looking Copernicus models under different climate scenarios, not just historical weather.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Physics-Based Models</h3>
            <p>Real turbine power curves. Wind doesn't behave the same behind every turbine.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Honest Uncertainty</h3>
            <p>Monte Carlo results show ranges and scenarios, not false-precision single numbers.</p>
          </div>
        </div>
      </section>

      <section className="use-cases">
        <h2>Use Cases</h2>
        <ul className="use-cases-list">
          <li>
            <strong>Revaluing a park.</strong> Climate has shifted since your forecast was set.
            What is the rest of its life really worth now?
          </li>
          <li>
            <strong>Due diligence on a deal.</strong> The seller assumes a stable climate.
            What does the number look like without that assumption?
          </li>
          <li>
            <strong>Pricing insurance.</strong> Which parks carry heat and storm exposure
            that the historical record doesn't show?
          </li>
          <li>
            <strong>Planning operations.</strong> How does output drift year to year?
            When does repowering pay for itself?
          </li>
        </ul>
      </section>
    </div>
  );
}
