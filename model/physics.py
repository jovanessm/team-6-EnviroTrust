"""Pure, deterministic physics core for PV energy prediction."""

import numpy as np
from model.config import GAMMA_DEFAULT, NOCT_DEFAULT, PR_NONTHERMAL_DEFAULT


def cell_temperature(t_amb: np.ndarray, ghi: np.ndarray, noct: float = NOCT_DEFAULT) -> np.ndarray:
    """
    Estimate cell temperature from ambient temp and irradiance (NOCT model).

    T_cell = T_amb + (NOCT - 20) / 800 * GHI

    Args:
        t_amb: ambient temperature, °C, shape (n_hours,)
        ghi: global horizontal irradiance, W/m², shape (n_hours,)
        noct: nominal operating cell temperature, °C

    Returns:
        Cell temperature, °C, shape (n_hours,)
    """
    return t_amb + (noct - 20) / 800 * ghi


def dc_power(
    ghi: np.ndarray,
    t_cell: np.ndarray,
    capacity_kwp: float,
    gamma: float = GAMMA_DEFAULT,
) -> np.ndarray:
    """
    Estimate DC power from irradiance and cell temperature.

    P_dc = capacity_kwp * (GHI / 1000) * (1 + gamma * (T_cell - 25))

    Args:
        ghi: irradiance, W/m², shape (n_hours,)
        t_cell: cell temperature, °C, shape (n_hours,)
        capacity_kwp: rated capacity, kWp
        gamma: temperature coefficient, 1/°C

    Returns:
        DC power, kW, shape (n_hours,)
    """
    return capacity_kwp * (ghi / 1000) * (1 + gamma * (t_cell - 25))


def ac_power(dc: np.ndarray, pr_nonthermal: float = PR_NONTHERMAL_DEFAULT) -> np.ndarray:
    """
    Convert DC power to AC power via inverter and non-thermal losses.

    P_ac = P_dc * PR_nonthermal

    Args:
        dc: DC power, kW, shape (n_hours,)
        pr_nonthermal: performance ratio (non-thermal: inverter, soiling, wiring, etc.)

    Returns:
        AC power, kW, shape (n_hours,)
    """
    return dc * pr_nonthermal


def annual_energy(
    ghi: np.ndarray,
    t_amb: np.ndarray,
    capacity_kwp: float,
    gamma: float = GAMMA_DEFAULT,
    noct: float = NOCT_DEFAULT,
    pr_nonthermal: float = PR_NONTHERMAL_DEFAULT,
) -> float:
    """
    Compute annual energy from hourly irradiance and temperature (one typical year).

    Closed-form, no randomness. Chain: GHI + T_amb → T_cell → P_dc → P_ac → E_year.

    Args:
        ghi: hourly irradiance, W/m², shape (8760,) for one year
        t_amb: hourly ambient temp, °C, shape (8760,)
        capacity_kwp: rated capacity, kWp
        gamma: temperature coefficient, 1/°C
        noct: nominal operating cell temperature, °C
        pr_nonthermal: performance ratio (non-thermal losses)

    Returns:
        Annual energy, kWh
    """
    t_cell = cell_temperature(t_amb, ghi, noct)
    p_dc = dc_power(ghi, t_cell, capacity_kwp, gamma)
    p_ac = ac_power(p_dc, pr_nonthermal)
    return np.sum(p_ac)  # kWh per year (hourly power summed)
