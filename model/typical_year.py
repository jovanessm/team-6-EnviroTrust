"""Construct and sample typical years from multi-year baseline."""

import numpy as np


def build_typical_year(ghi: np.ndarray, temp_amb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Build a single "typical year" from multi-year baseline by averaging (or selecting a representative year).

    For now, compute per-hour mean across all years.

    Args:
        ghi: hourly irradiance, W/m², shape (8760 * n_years,)
        temp_amb: hourly temperature, °C, shape (8760 * n_years,)

    Returns:
        Typical year GHI and T_amb, each shape (8760,)
    """
    n_hours_per_year = 8760
    n_years = len(ghi) // n_hours_per_year

    # Reshape to (n_years, 8760) and compute mean per hour across years
    ghi_reshaped = ghi[: n_years * n_hours_per_year].reshape(n_years, n_hours_per_year)
    temp_reshaped = temp_amb[: n_years * n_hours_per_year].reshape(n_years, n_hours_per_year)

    typical_ghi = np.mean(ghi_reshaped, axis=0)
    typical_temp = np.mean(temp_reshaped, axis=0)

    return typical_ghi, typical_temp


def sample_year(
    ghi: np.ndarray, temp_amb: np.ndarray, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray]:
    """
    Randomly sample one complete year from the multi-year baseline (for MC sampling).

    Args:
        ghi: hourly irradiance, W/m², shape (8760 * n_years,)
        temp_amb: hourly temperature, °C, shape (8760 * n_years,)
        rng: numpy random generator

    Returns:
        One year of GHI and T_amb, each shape (8760,)
    """
    n_hours_per_year = 8760
    n_years = len(ghi) // n_hours_per_year

    year_idx = rng.integers(0, n_years)
    start = year_idx * n_hours_per_year
    end = start + n_hours_per_year

    return ghi[start:end], temp_amb[start:end]
