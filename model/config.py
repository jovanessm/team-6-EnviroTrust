"""Default parameters and configuration for the solar model."""

# Physics defaults
GAMMA_DEFAULT = -0.004  # power temperature coefficient, 1/°C
NOCT_DEFAULT = 45.0  # nominal operating cell temperature, °C
PR_NONTHERMAL_DEFAULT = 0.87  # performance ratio (non-thermal losses only)
DEGRADATION_RATE_DEFAULT = 0.005  # fraction per year

# MC parameters
N_DRAWS_DEFAULT = 3000
RNG_SEED = 42  # for reproducibility

# Scenarios
SCENARIOS = ["SSP1-2.6", "SSP2-4.5", "SSP5-8.5"]

# Sanity bounds (German-specific)
SPECIFIC_YIELD_MIN = 900  # kWh/kWp/yr
SPECIFIC_YIELD_MAX = 1100  # kWh/kWp/yr

# Lifetime
LIFETIME_YEARS = 30  # standard PV warranty/analysis period
