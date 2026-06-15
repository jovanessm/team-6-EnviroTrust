"""
Finance layer: converts Prediction energy output → revenue figures.

Price assumption: mean of SMARD day-ahead hourly prices (2018–2026), held flat.
Falls back to €78/MWh if the SMARD CSV is not found.
Illustrative only — lenders apply their own price assumptions.
"""

from dataclasses import dataclass
from pathlib import Path
import numpy as np
import pandas as pd
from model.data import Prediction

# Fallback if SMARD CSV is unavailable
_FALLBACK_PRICE_EUR_PER_KWH = 78 / 1000  # €0.078/kWh

# Default path to the SMARD CSV relative to the repo root
_DEFAULT_SMARD_PATH = Path(__file__).parent.parent / "backend" / "Smard Prices Data" / "price_data" / "germany_dayahead_prices.csv"

# Resolved at import time; cached for the session
def _load_smard_mean(path: Path = _DEFAULT_SMARD_PATH) -> tuple[float, str]:
    """Return (mean price in EUR/kWh, provenance string)."""
    if not path.exists():
        return _FALLBACK_PRICE_EUR_PER_KWH, "€78/MWh (fallback — SMARD CSV not found)"
    df = pd.read_csv(path, parse_dates=["datetime"])
    mean_mwh = df["price_eur_mwh"].mean()
    date_min = df["datetime"].min().strftime("%Y-%m")
    date_max = df["datetime"].max().strftime("%Y-%m")
    label = f"€{mean_mwh:.1f}/MWh (SMARD day-ahead mean {date_min}–{date_max})"
    return mean_mwh / 1000, label

ELECTRICITY_PRICE_EUR_PER_KWH, _PRICE_LABEL = _load_smard_mean()


@dataclass
class RevenueProjection:
    """Financial translation of a Prediction — illustrative only."""
    years: np.ndarray
    scenario: str

    baseline_annual_eur: np.ndarray   # €/yr
    p50_annual_eur: np.ndarray
    p90_annual_eur: np.ndarray

    lifetime_baseline_eur: float      # € total over 30 years
    lifetime_p50_eur: float
    lifetime_p90_eur: float

    revenue_gap_eur: float            # € lost vs baseline at P50
    revenue_gap_pct: float            # % revenue gap

    price_per_kwh: float


def energy_to_revenue(pred: Prediction, price_eur_per_kwh: float = ELECTRICITY_PRICE_EUR_PER_KWH) -> RevenueProjection:
    """Convert Prediction (kWh) → RevenueProjection (EUR) at a fixed price."""
    baseline_eur = pred.baseline_annual * price_eur_per_kwh
    p50_eur = pred.p50 * price_eur_per_kwh
    p90_eur = pred.p90 * price_eur_per_kwh

    lifetime_baseline = float(np.sum(baseline_eur))
    lifetime_p50 = float(np.sum(p50_eur))
    lifetime_p90 = float(np.sum(p90_eur))

    return RevenueProjection(
        years=pred.years,
        scenario=pred.provenance.get("scenario", "unknown"),
        baseline_annual_eur=baseline_eur,
        p50_annual_eur=p50_eur,
        p90_annual_eur=p90_eur,
        lifetime_baseline_eur=lifetime_baseline,
        lifetime_p50_eur=lifetime_p50,
        lifetime_p90_eur=lifetime_p90,
        revenue_gap_eur=lifetime_p50 - lifetime_baseline,
        revenue_gap_pct=(lifetime_p50 - lifetime_baseline) / lifetime_baseline * 100,
        price_per_kwh=price_eur_per_kwh,
    )


def format_for_ui(rev: RevenueProjection) -> dict:
    """JSON-ready dict for the frontend."""
    return {
        "scenario": rev.scenario,
        "price_assumption": _PRICE_LABEL,
        "lifetime_baseline_meur": round(rev.lifetime_baseline_eur / 1e6, 1),
        "lifetime_p50_meur": round(rev.lifetime_p50_eur / 1e6, 1),
        "lifetime_p90_meur": round(rev.lifetime_p90_eur / 1e6, 1),
        "revenue_gap_meur": round(rev.revenue_gap_eur / 1e6, 1),
        "revenue_gap_pct": round(rev.revenue_gap_pct, 2),
        "annual": [
            {
                "year": int(rev.years[i]),
                "baseline_eur": round(rev.baseline_annual_eur[i]),
                "p50_eur": round(rev.p50_annual_eur[i]),
                "p90_eur": round(rev.p90_annual_eur[i]),
            }
            for i in range(len(rev.years))
        ],
    }
