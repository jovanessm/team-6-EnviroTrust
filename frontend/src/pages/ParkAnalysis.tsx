import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parkAPI, predictionAPI } from '../utils/api';
import type { Park } from '../types';
import './ParkAnalysis.css';

export function ParkAnalysis() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [parks, setParks] = useState<Park[]>([]);
  const [selectedPark, setSelectedPark] = useState<Park | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState({
    historical: true,
    ssp245: true,
    ssp585: true,
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await parkAPI.searchParks(searchQuery);
      setParks(response.data);
      if (response.data.length === 0) {
        setError('No parks found. Try searching by name or location.');
      }
    } catch (err) {
      setError('Failed to search parks. Check the backend connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedPark) return;

    setLoading(true);
    setError(null);

    try {
      const scenarioNames = Object.keys(scenarios).filter(
        (key) => scenarios[key as keyof typeof scenarios]
      );

      const response = await predictionAPI.predict(
        selectedPark.id,
        scenarioNames
      );

      navigate('/results', {
        state: {
          result: response.data,
          park: selectedPark,
        },
      });
    } catch (err) {
      setError('Failed to run prediction. Check the backend connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="park-analysis">
      <section className="search-section">
        <h1>Analyze a Park</h1>
        <p>Search for a real operating wind or solar park and see its predicted lifetime output under changing climate scenarios.</p>

        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by park name or location (e.g., 'Westwind Farm', 'Germany')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="search-button"
          >
            {loading ? 'Searching...' : 'Search Parks'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}
      </section>

      {parks.length > 0 && (
        <section className="parks-section">
          <h2>Found {parks.length} Park(s)</h2>
          <div className="parks-grid">
            {parks.map((park) => (
              <div
                key={park.id}
                className={`park-card ${selectedPark?.id === park.id ? 'selected' : ''}`}
                onClick={() => setSelectedPark(park)}
              >
                <h3>{park.name}</h3>
                <div className="park-details">
                  <p>
                    <strong>Type:</strong> {park.type.charAt(0).toUpperCase() + park.type.slice(1)}
                  </p>
                  <p>
                    <strong>Capacity:</strong> {park.capacity.toFixed(1)} MW
                  </p>
                  {park.turbines && (
                    <p>
                      <strong>Turbines:</strong> {park.turbines}
                    </p>
                  )}
                  <p>
                    <strong>Operating Since:</strong> {park.operatingYear}
                  </p>
                  <p>
                    <strong>Location:</strong> {park.location.lat.toFixed(3)}, {park.location.lng.toFixed(3)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedPark && (
        <section className="analysis-section">
          <h2>Analysis Settings</h2>
          <div className="scenarios-selector">
            <h3>Climate Scenarios</h3>
            <div className="scenario-checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={scenarios.historical}
                  onChange={(e) =>
                    setScenarios({
                      ...scenarios,
                      historical: e.target.checked,
                    })
                  }
                />
                Historical (baseline)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={scenarios.ssp245}
                  onChange={(e) =>
                    setScenarios({
                      ...scenarios,
                      ssp245: e.target.checked,
                    })
                  }
                />
                SSP2-4.5 (moderate warming)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={scenarios.ssp585}
                  onChange={(e) =>
                    setScenarios({
                      ...scenarios,
                      ssp585: e.target.checked,
                    })
                  }
                />
                SSP5-8.5 (high emissions)
              </label>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !Object.values(scenarios).some(Boolean)}
            className="analyze-button"
          >
            {loading ? 'Running Monte Carlo...' : 'Run Analysis'}
          </button>
        </section>
      )}
    </div>
  );
}
