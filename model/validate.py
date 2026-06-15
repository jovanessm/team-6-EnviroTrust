"""Validation and bounds checking for predictions."""

from model.data import ParkSpecs, Prediction
from model.config import SPECIFIC_YIELD_MIN, SPECIFIC_YIELD_MAX


def check_specific_yield(e_year: float, capacity_kwp: float) -> None:
    """
    Assert that annual energy falls within reasonable bounds for German solar parks.

    Specific yield = annual energy / capacity (kWh/kWp/yr).
    German typical range: 950–1050 kWh/kWp/yr.

    Args:
        e_year: annual energy, kWh
        capacity_kwp: rated capacity, kWp

    Raises:
        ValueError if specific yield is out of bounds
    """
    specific_yield = e_year / capacity_kwp
    if not (SPECIFIC_YIELD_MIN <= specific_yield <= SPECIFIC_YIELD_MAX):
        raise ValueError(
            f"Specific yield {specific_yield:.0f} kWh/kWp/yr out of bounds "
            f"[{SPECIFIC_YIELD_MIN}, {SPECIFIC_YIELD_MAX}]. Check inputs."
        )


def validate_prediction(pred: Prediction, park: ParkSpecs) -> None:
    """
    Validate a Prediction object for sanity.

    Args:
        pred: Prediction to validate
        park: park specs for context

    Raises:
        AssertionError or ValueError if validation fails
    """
    n_years = len(pred.years)

    assert len(pred.baseline_annual) == n_years, "baseline_annual length mismatch"
    assert len(pred.p10) == n_years, "p10 length mismatch"
    assert len(pred.p50) == n_years, "p50 length mismatch"
    assert len(pred.p90) == n_years, "p90 length mismatch"

    # P10 should be less than P50 should be less than P90 (at each year)
    assert np.all(pred.p10 <= pred.p50), "P10 > P50 somewhere"
    assert np.all(pred.p50 <= pred.p90), "P50 > P90 somewhere"

    # Lifetime should be sum of annual
    assert abs(pred.lifetime_p50 - np.sum(pred.p50)) < 1, "lifetime_p50 mismatch"
    assert abs(pred.lifetime_p90 - np.sum(pred.p90)) < 1, "lifetime_p90 mismatch"

    # Delta should be reasonable (usually negative, i.e., climate adjusted < baseline)
    assert -50 < pred.delta_pct < 10, f"delta_pct {pred.delta_pct}% seems unreasonable"


import numpy as np
