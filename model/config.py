"""Default parameters and configuration for the solar model."""

# Physics defaults
GAMMA_DEFAULT = -0.0045  # power temperature coefficient, 1/°C — Trina Solar TSM-PC05 datasheet
NOCT_DEFAULT = 45.0  # nominal operating cell temperature, °C
PR_NONTHERMAL_DEFAULT = 0.87  # performance ratio (non-thermal losses only)
DEGRADATION_RATE_DEFAULT = 0.007  # fraction per year — Trina Solar TSM-PC05 warranty (max 0.7%/yr linear)

# MC parameters
N_DRAWS_DEFAULT = 3000
RNG_SEED = 42  # for reproducibility

# Scenarios (RCP4.5/RCP8.5 from EnviroTrust API; RCP2.6 synthesized via IPCC AR6 scaling)
SCENARIOS = ["RCP2.6", "RCP4.5", "RCP8.5"]

# Sanity bounds (German-specific)
SPECIFIC_YIELD_MIN = 900  # kWh/kWp/yr
SPECIFIC_YIELD_MAX = 1100  # kWh/kWp/yr

# Lifetime
LIFETIME_YEARS = 30  # standard PV warranty/analysis period
