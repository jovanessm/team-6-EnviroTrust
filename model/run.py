"""
Full end-to-end run: real ERA5 baseline + CMIP6 ensemble → simulate() → print.

Usage:
    python -m model.run
"""

import sys
import numpy as np
import pandas as pd
from pathlib import Path

from model.data import ParkSpecs, BaselineWeather
from model.cmip6 import fetch_ensemble_annual, build_all_scenarios_cmip6, heat_tail_from_deltas
from model.montecarlo import simulate
from model.config import LIFETIME_YEARS
from model.parks import PARKS_BY_NAME

ERA5_CSV = Path("backend/CDS Data/era5_data/Eggebek_Solar_Park.csv")
CMIP6_CACHE = Path("backend/cmip6_cache/Eggebek_Solar_Park.json")
PARK = PARKS_BY_NAME["Eggebek_Solar_Park"]


def load_baseline(csv_path: Path) -> BaselineWeather:
    df = pd.read_csv(csv_path)
    ghi = df["shortwave_radiation"].values.astype(float)
    temp = df["temperature_2m"].values.astype(float)
    ghi = np.where(np.isnan(ghi), 0, ghi)
    temp = np.where(np.isnan(temp), np.nanmean(temp), temp)
    return BaselineWeather(ghi=ghi, temp_amb=temp)


def main():
    if not ERA5_CSV.exists():
        print(f"ERA5 data not found at {ERA5_CSV}. Run the fetch script first.")
        sys.exit(1)

    print("Loading ERA5 baseline weather...")
    baseline = load_baseline(ERA5_CSV)
    print(f"  {len(baseline.ghi):,} hours ({len(baseline.ghi)/8760:.1f} years)")
    print(f"  Mean temp: {np.mean(baseline.temp_amb):.1f}°C")
    print()

    print("Fetching CMIP6 7-model ensemble (Open-Meteo HighResMIP)...")
    ensemble = fetch_ensemble_annual(PARK.lat, PARK.lon, CMIP6_CACHE)
    scenarios = build_all_scenarios_cmip6(ensemble, n_years=LIFETIME_YEARS)
    print(f"  {len(ensemble)} models")
    for name, d in scenarios.items():
        print(f"  {name}: 30yr warming +{d.dT_per_year[-1]:.2f} ± {d.dT_model_std[-1]:.2f}°C")
    print()

    results = {}
    for scenario_name, deltas in scenarios.items():
        print(f"Running simulate() — {scenario_name} ...")
        pred = simulate(
            PARK, baseline, deltas,
            n_draws=3000,
            heat_tail_series=heat_tail_from_deltas(deltas),
        )
        results[scenario_name] = pred

        lifetime_gwh = pred.lifetime_p50 / 1e6
        baseline_gwh = np.sum(pred.baseline_annual) / 1e6
        print(f"  Baseline lifetime:        {baseline_gwh:.1f} GWh")
        print(f"  Climate-adjusted P50:     {lifetime_gwh:.1f} GWh  ({pred.delta_pct:+.2f}%)")
        print(f"  Climate-adjusted P90:     {np.sum(pred.p90)/1e6:.1f} GWh")
        print()

    print("=" * 50)
    print(f"Park: {PARK.name}  ({PARK.capacity_kwp/1000:.0f} MWp)")
    print()
    for name, pred in results.items():
        print(f"  {name}:  delta = {pred.delta_pct:+.2f}%")


if __name__ == "__main__":
    main()
