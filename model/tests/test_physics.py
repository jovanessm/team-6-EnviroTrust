"""Tests for physics core."""

import numpy as np
import pytest
from model.physics import cell_temperature, dc_power, annual_energy


class TestCellTemperature:
    """Test NOCT cell-temperature model."""

    def test_zero_irradiance(self):
        """At zero irradiance, T_cell = T_amb."""
        t_amb = np.array([20.0])
        ghi = np.array([0.0])
        t_cell = cell_temperature(t_amb, ghi)
        assert np.isclose(t_cell[0], 20.0)

    def test_standard_conditions(self):
        """At 1000 W/m² and NOCT conditions, verify formula."""
        # At NOCT (45 °C measured at 20 °C ambient, 800 W/m² irradiance):
        # T_cell = 20 + (45 - 20) / 800 * 800 = 20 + 25 = 45
        t_amb = np.array([20.0])
        ghi = np.array([800.0])
        t_cell = cell_temperature(t_amb, ghi, noct=45.0)
        assert np.isclose(t_cell[0], 45.0)


class TestDCPower:
    """Test DC power computation."""

    def test_known_value(self):
        """At STC (1000 W/m², 25 °C), expect rated power."""
        ghi = np.array([1000.0])
        t_cell = np.array([25.0])
        capacity_kwp = 100.0
        p_dc = dc_power(ghi, t_cell, capacity_kwp)
        # P_dc = 100 * (1000/1000) * (1 + gamma*(25-25)) = 100 kW
        assert np.isclose(p_dc[0], capacity_kwp)

    def test_zero_irradiance(self):
        """At zero irradiance, power is zero."""
        ghi = np.array([0.0])
        t_cell = np.array([30.0])
        p_dc = dc_power(ghi, t_cell, 100.0)
        assert np.isclose(p_dc[0], 0.0)

    def test_temperature_derating(self):
        """Hotter temperature should reduce power."""
        ghi = np.array([1000.0])
        t_cell_cool = np.array([25.0])
        t_cell_hot = np.array([35.0])
        capacity_kwp = 100.0

        p_dc_cool = dc_power(ghi, t_cell_cool, capacity_kwp)
        p_dc_hot = dc_power(ghi, t_cell_hot, capacity_kwp)

        assert p_dc_hot[0] < p_dc_cool[0], "Hotter cells should have lower power"


class TestAnnualEnergy:
    """Test annual energy computation."""

    def test_shape(self):
        """Annual energy should return a scalar."""
        ghi = np.zeros(8760)
        t_amb = np.ones(8760) * 25.0
        e_year = annual_energy(ghi, t_amb, 100.0)
        assert isinstance(e_year, (float, np.floating))
