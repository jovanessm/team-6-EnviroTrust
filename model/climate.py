"""Apply climate deltas (temperature shifts) to weather data."""

import numpy as np


def apply_delta(temp_amb: np.ndarray, dT: float) -> np.ndarray:
    """
    Add a temperature delta (shift) to ambient temperature.

    Args:
        temp_amb: hourly temperature, °C, shape (8760,)
        dT: temperature shift, °C

    Returns:
        Shifted temperature, °C, shape (8760,)
    """
    return temp_amb + dT


def heat_tail(temp_amb: np.ndarray, dT_extra: float, percentile: float = 90) -> np.ndarray:
    """
    Add extra heat to the hottest hours to model increased heatwave intensity.

    Args:
        temp_amb: hourly temperature, °C, shape (8760,)
        dT_extra: extra temperature bump for hot hours, °C
        percentile: threshold (e.g., 90 means top 10% hottest hours), 0-100

    Returns:
        Temperature with heat-tail applied, °C, shape (8760,)
    """
    threshold = np.percentile(temp_amb, percentile)
    mask = temp_amb >= threshold
    result = temp_amb.copy()
    result[mask] += dT_extra
    return result
