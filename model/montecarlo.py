"""Monte Carlo uncertainty engine for PV lifetime prediction."""

import numpy as np
from model.data import ParkSpecs, BaselineWeather, ClimateDeltas, Prediction
from model.config import (
    N_DRAWS_DEFAULT,
    RNG_SEED,
    GAMMA_DEFAULT,
    PR_NONTHERMAL_DEFAULT,
    DEGRADATION_RATE_DEFAULT,
    LIFETIME_YEARS,
)
from model.physics import annual_energy
from model.typical_year import build_typical_year, sample_year
from model.degradation import degradation_factor
from model.climate import apply_delta


def simulate(
    park: ParkSpecs,
    baseline: BaselineWeather,
    deltas: ClimateDeltas,
    n_draws: int = N_DRAWS_DEFAULT,
    seed: int = RNG_SEED,
) -> Prediction:
    """
    Run Monte Carlo simulation for one scenario.

    Samples four sources:
    1. Climate-model spread (ΔT ensemble)
    2. Interannual weather (resample historical years)
    3. Parameter uncertainty (gamma, PR, degradation)
    4. Scenario (already fixed by input ClimateDeltas)

    Args:
        park: solar park specs
        baseline: multi-year historical weather
        deltas: temperature change projections for one scenario
        n_draws: number of MC draws
        seed: RNG seed for reproducibility

    Returns:
        Prediction object with p10/p50/p90 fans and lifetime stats
    """
    rng = np.random.default_rng(seed)

    # Build typical year and allocate storage
    typical_ghi, typical_temp = build_typical_year(baseline.ghi, baseline.temp_amb)
    n_years = len(deltas.dT_per_year)
    years = np.arange(n_years)

    # Storage: (n_draws, n_years)
    annual_energies_adjusted = np.zeros((n_draws, n_years))
    annual_energies_baseline = np.zeros((n_draws, n_years))

    # Compute baseline (flat climate) once per draw
    for draw in range(n_draws):
        # Sample parameters
        gamma = rng.normal(GAMMA_DEFAULT, 2e-4)
        pr = rng.normal(PR_NONTHERMAL_DEFAULT, 0.02)
        d0 = rng.normal(DEGRADATION_RATE_DEFAULT, 5e-4)

        # Baseline: typical year held flat with degradation
        e_year_base = annual_energy(
            typical_ghi,
            typical_temp,
            park.capacity_kwp,
            gamma=gamma,
            pr_nonthermal=pr,
        )
        deg_factors = degradation_factor(years, d0=d0)
        annual_energies_baseline[draw, :] = e_year_base * deg_factors

        # Climate-adjusted: per year, shift temp by dT, resample weather
        for year in range(n_years):
            # Sample climate-model ensemble (scalar per draw, shared across years for correlation)
            m = rng.standard_normal()
            dT = deltas.dT_per_year[year] + m * deltas.dT_model_std[year]

            # Resample a year from the baseline and apply delta
            ghi_sampled, temp_sampled = sample_year(baseline.ghi, baseline.temp_amb, rng)
            temp_shifted = apply_delta(temp_sampled, dT)

            # Compute energy with shifted temperature
            e_year_adj = annual_energy(
                ghi_sampled,
                temp_shifted,
                park.capacity_kwp,
                gamma=gamma,
                pr_nonthermal=pr,
            )

            annual_energies_adjusted[draw, year] = e_year_adj * deg_factors[year]

    # Aggregate: compute percentiles per year and lifetime
    p10_annual = np.percentile(annual_energies_adjusted, 10, axis=0)
    p50_annual = np.percentile(annual_energies_adjusted, 50, axis=0)
    p90_annual = np.percentile(annual_energies_adjusted, 90, axis=0)
    baseline_annual = np.mean(annual_energies_baseline, axis=0)

    # Lifetime aggregations
    lifetime_baseline = np.sum(baseline_annual)
    lifetime_p50 = np.sum(p50_annual)
    lifetime_p90 = np.sum(p90_annual)
    delta_pct = (lifetime_p50 - lifetime_baseline) / lifetime_baseline * 100

    # Provenance (simplified: store scenario and overall stats)
    provenance = {
        "scenario": deltas.scenario,
        "n_draws": n_draws,
        "park_name": park.name,
        "park_lat": park.lat,
        "park_lon": park.lon,
        "park_capacity_kwp": park.capacity_kwp,
    }

    return Prediction(
        years=years,
        baseline_annual=baseline_annual,
        p10=p10_annual,
        p50=p50_annual,
        p90=p90_annual,
        lifetime_p50=lifetime_p50,
        lifetime_p90=lifetime_p90,
        delta_pct=delta_pct,
        provenance=provenance,
    )
