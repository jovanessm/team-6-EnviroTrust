"""Panel degradation over time."""

import numpy as np
from model.config import DEGRADATION_RATE_DEFAULT


def degradation_factor(
    years: np.ndarray,
    d0: float = DEGRADATION_RATE_DEFAULT,
    accelerated: bool = False,
    dT_per_year: np.ndarray = None,
) -> np.ndarray:
    """
    Compute annual degradation factor for each year.

    Standard: (1 - d0)^t, cumulative loss = prod over t.
    Accelerated (Arrhenius): d(t) = d0 * 2^(ΔT(t)/10), where panel ages faster in hotter years.

    Args:
        years: year indices, shape (n_years,), 0..N-1
        d0: base degradation rate, fraction/year
        accelerated: whether to apply temperature-accelerated degradation
        dT_per_year: temperature delta per year (°C), shape (n_years,); required if accelerated=True

    Returns:
        Degradation factor per year (1 - d(t)), shape (n_years,)
    """
    if not accelerated:
        return np.ones_like(years, dtype=float) - d0

    if dT_per_year is None:
        raise ValueError("dT_per_year required for accelerated degradation")

    d_t = d0 * np.power(2, dT_per_year / 10)
    return np.ones_like(years, dtype=float) - d_t
