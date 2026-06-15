"""Stub data demo: synthetic inputs to test the full simulate() pipeline."""

import numpy as np
from model.data import ParkSpecs, BaselineWeather, ClimateDeltas
from model.montecarlo import simulate
from model.config import LIFETIME_YEARS


def create_stub_park() -> ParkSpecs:
    """Create a fake German solar park."""
    return ParkSpecs(
        name="Demo Park (Synthetic)",
        lat=51.5,  # Germany
        lon=10.0,
        capacity_kwp=100.0,
    )


def create_stub_baseline() -> BaselineWeather:
    """Create synthetic multi-year weather with realistic patterns."""
    n_years = 5
    hours_per_year = 8760
    total_hours = n_years * hours_per_year

    # Synthetic irradiance: sine wave with realistic amplitude (~0-1200 W/m²)
    # Modulate by hour-of-year for seasonal variation
    hours = np.arange(total_hours)
    hour_of_year = hours % hours_per_year
    day_of_year = hour_of_year / hours_per_year * 365

    # Seasonal: more sun in summer (June = day 172)
    seasonal_factor = 0.5 + 0.5 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
    # Diurnal: peak at noon
    hour_of_day = hour_of_year % 24
    diurnal_factor = np.maximum(0, np.sin(np.pi * (hour_of_day - 6) / 12))

    ghi = 1000 * seasonal_factor * diurnal_factor

    # Synthetic temperature: 0-30°C with seasonal variation
    base_temp = 15 + 15 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
    # Add diurnal variation (warmer at noon)
    diurnal_temp = 5 * np.sin(np.pi * (hour_of_day - 6) / 12)
    temp_amb = base_temp + diurnal_temp + np.random.normal(0, 1, total_hours)

    return BaselineWeather(ghi=ghi, temp_amb=temp_amb)


def create_stub_deltas(scenario: str = "SSP2-4.5") -> ClimateDeltas:
    """Create synthetic climate deltas (steady warming)."""
    dT_per_year = np.linspace(0, 1.5, LIFETIME_YEARS)  # 1.5°C warming over 30 years
    dT_model_std = np.ones(LIFETIME_YEARS) * 0.3  # ±0.3°C ensemble spread

    return ClimateDeltas(
        scenario=scenario,
        dT_per_year=dT_per_year,
        dT_model_std=dT_model_std,
    )


def main():
    """Run stub demo."""
    print("Creating stub data...")
    park = create_stub_park()
    baseline = create_stub_baseline()
    deltas = create_stub_deltas()

    print(f"Park: {park.name}, {park.capacity_kwp} kWp at ({park.lat}, {park.lon})")
    print(f"Baseline: {len(baseline.ghi) // 8760} years of weather data")
    print(f"Scenario: {deltas.scenario}")
    print()

    print("Running simulate()...")
    pred = simulate(park, baseline, deltas, n_draws=1000)

    print(f"✓ Prediction generated")
    print(f"  Lifetime baseline: {pred.lifetime_p50 / 1e6:.2f} GWh")
    print(f"  Lifetime P50 (adjusted): {np.sum(pred.p50) / 1e6:.2f} GWh")
    print(f"  Lifetime P90: {np.sum(pred.p90) / 1e6:.2f} GWh")
    print(f"  Delta: {pred.delta_pct:.1f}%")
    print(f"  Years: {len(pred.years)}")
    print()

    # Quick sanity checks
    assert len(pred.years) == LIFETIME_YEARS
    assert len(pred.baseline_annual) == LIFETIME_YEARS
    assert len(pred.p10) == LIFETIME_YEARS
    assert len(pred.p50) == LIFETIME_YEARS
    assert len(pred.p90) == LIFETIME_YEARS
    assert np.all(pred.p10 <= pred.p50), "P10 should be ≤ P50"
    assert np.all(pred.p50 <= pred.p90), "P50 should be ≤ P90"

    print("✓ All sanity checks passed")
    print()
    print("Sample output (first 5 years):")
    print(f"  Year | Baseline | P10 | P50 | P90 (all kWh)")
    for i in range(min(5, len(pred.years))):
        print(
            f"  {pred.years[i]:3d}  | {pred.baseline_annual[i]:8.0f} | {pred.p10[i]:7.0f} | {pred.p50[i]:7.0f} | {pred.p90[i]:7.0f}"
        )


if __name__ == "__main__":
    main()
