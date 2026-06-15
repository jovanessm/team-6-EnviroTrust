"""
Pre-compute simulation results for all solar parks.

Runs simulate() for all parks × RCP4.5 + RCP8.5, saves one JSON file
to backend/precomputed.json so the API can serve results instantly.

Usage:
    python -m model.precompute
    python -m model.precompute --output path/to/output.json
    python -m model.precompute --dry-run   # validate ERA5 + API without full MC
"""

import sys
import json
import time
import argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

# Allow both `python -m model.precompute` and `python model/precompute.py`
_repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(_repo_root))
sys.path.insert(0, str(_repo_root / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

from model.parks import ALL_PARKS
from model.data import ParkSpecs, BaselineWeather
from model.adapters import build_all_scenarios, wildfire_to_heat_tail
from model.montecarlo import simulate
from model.finance import energy_to_revenue, format_for_ui

ERA5_DIR = Path(__file__).parent.parent / "backend" / "CDS Data" / "era5_data"
DEFAULT_OUTPUT = Path(__file__).parent.parent / "backend" / "precomputed.json"


def load_baseline(park_name: str) -> BaselineWeather | None:
    csv_path = ERA5_DIR / f"{park_name}.csv"
    if not csv_path.exists():
        return None
    df = pd.read_csv(csv_path)
    ghi = df["shortwave_radiation"].values.astype(float)
    temp = df["temperature_2m"].values.astype(float)
    ghi = np.where(np.isnan(ghi), 0.0, ghi)
    temp = np.where(np.isnan(temp), np.nanmean(temp), temp)
    return BaselineWeather(ghi=ghi, temp_amb=temp)


def park_to_dict(park: ParkSpecs) -> dict:
    return {
        "id": park.name,
        "name": park.name.replace("_", " "),
        "lat": park.lat,
        "lon": park.lon,
        "capacity_kwp": park.capacity_kwp,
        "commissioned": park.commissioned,
        "tilt": park.tilt,
        "azimuth": park.azimuth,
    }


def prediction_to_dict(pred, finance: dict) -> dict:
    return {
        "years": pred.years.tolist(),
        "baseline_annual_kwh": [round(v) for v in pred.baseline_annual.tolist()],
        "p10_kwh": [round(v) for v in pred.p10.tolist()],
        "p50_kwh": [round(v) for v in pred.p50.tolist()],
        "p90_kwh": [round(v) for v in pred.p90.tolist()],
        "lifetime_baseline_kwh": round(float(np.sum(pred.baseline_annual))),
        "lifetime_p50_kwh": round(pred.lifetime_p50),
        "lifetime_p90_kwh": round(pred.lifetime_p90),
        "delta_pct": round(pred.delta_pct, 3),
        "finance": finance,
        "provenance": pred.provenance,
    }


def run(output_path: Path, dry_run: bool = False, n_draws: int = 3000) -> None:
    from EnviroTrustAPI.client import EnviroTrustClient
    client = EnviroTrustClient()

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_draws": n_draws,
        "parks": [],
    }

    skipped = []

    for i, park in enumerate(ALL_PARKS, 1):
        print(f"\n[{i}/{len(ALL_PARKS)}] {park.name}")

        baseline = load_baseline(park.name)
        if baseline is None:
            print(f"  SKIP — no ERA5 CSV in {ERA5_DIR}")
            skipped.append(park.name)
            continue

        n_hours = len(baseline.ghi)
        mean_temp = float(np.mean(baseline.temp_amb))
        print(f"  ERA5: {n_hours:,} hours ({n_hours/8760:.1f} yr), mean temp {mean_temp:.1f}°C")

        print(f"  EnviroTrust API (lat={park.lat}, lon={park.lon})...")
        try:
            timeseries = client.get_heat_wind_timeseries(
                park.lat, park.lon, 2024, 2054
            )["heat_wind_timeseries_data"]
            time.sleep(3)
            wildfire = client.get_wildfire_timeseries(
                park.lat, park.lon, 2024, 2054
            )["wildfire_risk_timeseries_data"]
            time.sleep(3)
        except Exception as e:
            print(f"  SKIP — API error: {e}")
            skipped.append(park.name)
            continue

        n_years = len(timeseries)
        heat_tail_series = wildfire_to_heat_tail(wildfire, n_years)
        scenarios = build_all_scenarios(timeseries, mean_temp)

        if dry_run:
            print(f"  DRY RUN — skipping simulate() ({n_years} projection years, {list(scenarios.keys())})")
            continue

        park_entry = {**park_to_dict(park), "scenarios": {}}

        for scenario_name, deltas in scenarios.items():
            print(f"  simulate() {scenario_name} ({n_draws} draws)...", end=" ", flush=True)
            pred = simulate(park, baseline, deltas, n_draws=n_draws, heat_tail_series=heat_tail_series)
            rev = energy_to_revenue(pred)
            finance = format_for_ui(rev)
            park_entry["scenarios"][scenario_name] = prediction_to_dict(pred, finance)
            print(f"delta={pred.delta_pct:+.2f}%  P50={pred.lifetime_p50/1e6:.1f} GWh")

        output["parks"].append(park_entry)

        if i < len(ALL_PARKS):
            time.sleep(5)

    if not dry_run:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)
        size_kb = output_path.stat().st_size / 1024
        print(f"\nSaved {len(output['parks'])} parks → {output_path} ({size_kb:.0f} KB)")

    if skipped:
        print(f"\nSkipped ({len(skipped)}): {', '.join(skipped)}")


def main():
    parser = argparse.ArgumentParser(description="Pre-compute solar park simulations.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true", help="Validate data without running MC")
    parser.add_argument("--draws", type=int, default=3000, help="MC draws per scenario (default 3000)")
    args = parser.parse_args()
    run(args.output, dry_run=args.dry_run, n_draws=args.draws)


if __name__ == "__main__":
    main()
