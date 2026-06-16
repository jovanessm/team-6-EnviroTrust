# Power, Seen From Orbit — Climate-Adjusted Lifetime Yield for Solar Parks

**EnviroTrust "Power, Seen From Orbit" challenge — Team 6**

> We combine **26 years of ERA5 historical weather** (the baseline) with **forward-looking
> temperature projections from a 7-model CMIP6 HighResMIP ensemble** and the
> **EnviroTrust Climate Risks API** (two independent climate sources, shown side by side).
> Panel performance is computed with two physics models: **NOCT** (standard) and
> **Faiman** (adds real wind cooling derived from satellite imagery of each park).
> Every output is a **P10/P50/P90 distribution** under separate RCP scenarios —
> never a bare number, always traceable to every input.

A lender, insurer, or owner signs off on a single lifetime-energy number. That number was
set on a climate that has since moved. **We re-price it.**

---

## Table of contents

1. [The problem & who it's for](#1-the-problem--who-its-for)
2. [What we built](#2-what-we-built)
3. [How the prediction works](#3-how-the-prediction-works)
4. [The 4-way comparison](#4-the-4-way-comparison)
5. [Data sources — all public & official](#5-data-sources--all-public--official)
6. [Architecture](#6-architecture)
7. [Selling points](#7-selling-points)
8. [How we meet the challenge](#8-how-we-meet-the-challenge)
9. [Business potential & scaling](#9-business-potential--scaling)
10. [Repository map](#10-repository-map)

---

## 1. The problem & who it's for

A solar park is built to run **30–40 years**. Before it is financed, insured, or sold,
someone estimates how much energy it will produce over that whole life. That one number
decides whether the project clears its loan, what premium it is insured at, and what it
sells for. For an operating park it gets re-asked at every refinancing, reinsurance, or sale.

Almost all of that estimate comes from the **past**: the standard method builds a "typical
year" from one or two decades of historical weather and projects it forward, assuming the
next thirty years look like the last twenty. They won't. Rising ambient temperature cuts
what panels and electronics can put out, and heatwaves that used to be rare are arriving
more often. **The forecast describes a climate that isn't there anymore** — and being off a
few percent a year, every year for thirty years, is the difference between a park that
covers its loan and one that doesn't.

---

## 2. What we built

A full **end-to-end product** that takes a **real, operating German solar park** — real
location, real hardware, real layout from public registries — and produces its
**climate-adjusted lifetime energy and revenue**, as a **distribution (P10/P50/P90)** under
separate climate scenarios, with the **provenance** behind every point.

It is a **physical stress test for an energy asset** — the engineering twin of the financial
models these projects already run.

- **No invented sites or hardware.** 10 real German parks (1.8–62 MWp) from the
  Marktstammdatenregister; weather and climate are modeled/scenario-based, as the brief allows.
- **Every number is a range, never a single figure.** Monte Carlo propagates climate-model
  spread, interannual weather, and parameter uncertainty into P10/P50/P90 fans.
- **Every number is explainable.** A `provenance` object travels with each result so the UI
  can show *"the inputs and assumptions behind this point."*
- **The climate dimension moves the result.** Swapping the flat historical baseline for
  forward-looking Copernicus/CMIP6 projections and EnviroTrust climate projection visibly shifts the lifetime number — exactly
  what the **EnviroTrust partner** rewards.

---

## 3. How the prediction works

The "model" is a **deterministic physics core + Monte Carlo uncertainty propagation** — *not*
a trained ML model. There are no per-park generation labels in Germany, and a learned model
would bake in the **historical** climate, which is the exact thing we're attacking. A physics
core is also fully **explainable**, which the brief requires for "a number that moves money."

**1. Physics core (pure, one year, closed-form).**
- Cell temperature, two interchangeable models:
  - **NOCT:** `T_cell = T_amb + (NOCT − 20)/800 · GHI` (conservative; assumes low wind)
  - **Faiman:** `T_cell = T_amb + GHI / (U0 + U1·wind)` (wind cooling → more accurate kWh)
- DC power: `P = capacity · (GHI/1000) · (1 + γ·(T_cell − 25))`, then a performance-ratio loss
  stack, summed hourly → annual energy. Closed-form and fast, so 3000 Monte Carlo draws are cheap.

**2. Baseline ("the lender's view").** A typical year held flat across all 30 years, plus
standard degradation. This is the standard, history-based number we are measuring the gap against.

**3. Climate-adjusted.** Each year, shift the typical year's temperature by `ΔT[t]` from the
climate projection and re-run the core. Degradation stays in **both** lines so the delta is
**purely climate**, not aging.

**4. Uncertainty engine (the centrepiece).** Monte Carlo over four sources, with **common
random numbers** (baseline & adjusted share the same sampled weather and parameters per draw,
so interannual noise cancels out of the delta instead of swamping the ~0.5–3% climate signal):
- **Scenario** — RCP2.6 / 4.5 / 8.5 as separate branches, **never averaged**.
- **Climate-model spread** — sampled from the real across-model standard deviation.
- **Interannual weather** — resample different historical years.
- **Parameters** — γ, performance ratio, degradation rate as small distributions.

→ **P10 / P50 / P90 fans + a lifetime distribution per scenario.**

**Making the effect material without cheating.** Mean-temperature derating alone is small
(~1% for ~1–1.5 °C). We add two honest, physics-grounded levers and **report the band we get**:
- **Heat-tail:** extreme-heat hours warm ~1.5× the mean (IPCC AR6), where loss is disproportionate.
- **Temperature-accelerated degradation:** hotter panels age faster (**Arrhenius, ~doubles per
  10 °C**) — this compounds over 30 years and is the differentiated story.

**5. Money translation.** Energy → revenue at the **SMARD German day-ahead mean (~93,4 €/MWh,
2011–2026)**, held flat. Illustrative — lenders apply their own price curve — and shown as a
revenue gap with the same P50/P90 band.

---

## 4. The 4-way comparison

The demo's centrepiece is a **source-vs-source, model-vs-model** comparison. We hold the park,
the baseline weather, the physics stack, and the finance identical and vary only two axes:

|  | **CMIP6** (climate source) | **EnviroTrust** (climate source) |
|---|---|---|
| **NOCT** (cell-temp model) | `precomputed_cmip6_noct.json` | `precomputed_envirotrust_noct.json` |
| **Faiman** (cell-temp model) | `precomputed_cmip6_faiman.json` | `precomputed_envirotrust_faiman.json` |

- **Climate axis — where ΔT comes from:**
  - **CMIP6** — a **7-model HighResMIP ensemble** (Open-Meteo / Copernicus), annual-mean warming
    trend; ensemble spread becomes the real uncertainty band. Scenarios RCP2.6 / 4.5 / 8.5.
  - **EnviroTrust** — the partner's Climate Risks API daily-max-temperature field (RCP4.5 / 8.5).
    This is an annual *extreme* and far noisier; we surface it as an honest second opinion and
    **stamp exactly how it was processed into the provenance** (see §10).
- **Physics axis — NOCT vs Faiman:** Faiman adds real wind cooling, derived from satellite park
  geometry (below), and typically lifts the kWh estimate a couple of percent.

The UI's existing **NOCT↔Faiman switch** picks the physics axis; the climate axis selects the
data source. Same park, four defensible numbers — and a clear story about which inputs move the result.

---

## 5. Data sources — all public & official

Every input is officially published public data — auditable, nothing invented. This is a
**hard constraint** of the challenge and a core trust argument for the user.

| Layer | Source | What we take | In repo |
|---|---|---|---|
| **Park specs** | **Marktstammdatenregister (MaStR)** — Germany's official installation registry | 10 real parks: location, capacity, tilt, azimuth, commissioning year | `model/parks.py` |
| **Baseline weather** | **Open-Meteo / ERA5** (Copernicus reanalysis) | 26 yr hourly GHI + temperature per park | `backend/CDS Data/` |
| **Forward climate (headline)** | **Copernicus / CMIP6** — 7-model HighResMIP ensemble via Open-Meteo Climate API | annual-mean warming trend + across-model spread → ΔT signal | `model/cmip6.py`, `backend/cmip6_cache/` |
| **Forward climate (comparison)** | **EnviroTrust Climate Risks API** | daily-max temperature, heatwave & wind indices (RCP4.5 / 8.5) | `backend/EnviroTrustAPI/`, `model/envirotrust.py` |
| **Park geometry / wind** | **Microsoft Global Renewables Watch (GRW)** — satellite-derived solar footprints worldwide | polygon areas near each park → wind-exposure factor | `backend/GRW Data/` |
| **Wind speed** | **Open-Meteo / ERA5** | mean 10 m wind speed per park (Faiman input) | `backend/GRW Data/fetch_wind_speed.py` |
| **Electricity price** | **SMARD** (German day-ahead market) | mean price for the revenue translation | `backend/Smard Prices Data/` |

**The satellite layer in detail.** Microsoft's **Global Renewables Watch** is a computer-vision
model trained on global **Sentinel-2** satellite imagery that maps the footprint of every solar
and wind park on Earth. We spatially join those footprints to our parks (`extract_wind_exposure.py`,
3 km radius) and turn total nearby panel area into a **wind-exposure factor** — bigger parks have
more sheltered interior rows, so their panels run hotter. That real, per-site geometry feeds the
Faiman model. *The park's layout finally makes it into the forecast.*

---

## 6. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  DATA SCRAPING / PROCESSING (backend/)                                     │
│  MaStR specs · ERA5 hourly weather · CMIP6 ensemble · EnviroTrust API ·    │
│  Microsoft GRW satellite footprints · SMARD prices                         │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  MODEL (model/)  —  pure physics + Monte Carlo, deterministic & explainable│
│  physics.py (NOCT/Faiman) · cmip6.py / envirotrust.py (ΔT) ·               │
│  degradation.py (Arrhenius) · climate.py (heat-tail) ·                     │
│  montecarlo.py (P10/P50/P90 + provenance) · finance.py (€) ·              │
│  precompute.py → 4 × precomputed_{climate}_{model}.json                    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  API (backend/main.py, FastAPI)  —  serves precomputed results instantly + │
│  live EnviroTrust endpoints. Stateless; on-prem or cloud.                  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (frontend/, React + Vite + TS)                                   │
│  Leaflet map · Recharts fan charts · scenario/model switches ·            │
│  provenance drill-down · plain-language explainer chatbot                  │
└──────────────────────────────────────────────────────────────────────────┘
```

(An architecture diagram also lives in `pitch/architecture-diagram.html`.)

The **physics core is a pure, unit-tested function**; all randomness lives in the Monte Carlo
wrapper, and all defaults (γ, NOCT, PR, degradation) sit in one config block (`model/config.py`)
with a seeded RNG for reproducible demos.

---

## 7. Selling points

### Technical
- **Production-ready, full end-to-end.** Real data scraping → processing → physics + Monte
  Carlo prediction (backend) and an interactive prediction/insight visualization (frontend) —
  not a notebook, not slides.
- **Open by design.** The physics core takes pluggable derating factors and the pipeline is
  parameterised (`--climate`, `--model`, scenarios), so **new variables drop in without
  rebuilding the pipeline**. Adding a second climate source (EnviroTrust) alongside CMIP6 was
  one new module — proof the architecture is open.

### Governance
- **Technology-agnostic.** Stateless FastAPI + a static frontend + precomputed JSON — deploys
  **on-prem or cloud** with no managed-service lock-in.
- **EU data sovereignty (GDPR-ready).** The natural-language explainer is designed to run on a
  **self-hosted, open-source LLM**, so no user data has to leave the perimeter. (An
  `ANTHROPIC_API_KEY` slot exists for a hosted option; the deterministic explainer needs no LLM
  at all, and the LLM path is swappable.)
- **Auditable inputs.** **Every data source is officially published public data** (MaStR, ERA5,
  Copernicus/CMIP6, EnviroTrust, Microsoft GRW, SMARD). Nothing about the site or hardware is invented.

### Domain
- **Three data dimensions fused:** historical reanalysis + **forward climate projections** +
  **satellite imagery** — the three sources the brief says "almost nobody has connected" into an
  investable number.
- **Ensemble forward signal:** a **7-model CMIP6 HighResMIP ensemble**, so the projection carries
  a *real* model-spread band rather than one model's guess.
- **NOCT vs Faiman, head to head:** we compute kWh both ways and show the difference real
  wind cooling makes.
- **Satellite-derived wind exposure:** wind cooling comes from **Microsoft Global Renewables
  Watch**, a vision model trained on worldwide Sentinel-2 imagery — real per-park geometry, not
  an assumption.
- **Plain-language explainer:** *don't know what "P90" or "RCP8.5" means?* The built-in chatbot
  explains any metric in everyday language — **even "explain it like I'm five"** — grounded in
  the park's real numbers.

---

## 8. How we meet the challenge

**Hard constraints**

| Constraint | How we satisfy it |
|---|---|
| Model a **real, operating** park (real location/layout/specs; site & hardware not invented) | 10 real MaStR parks; geometry from Microsoft GRW satellite footprints. Only weather/climate is modeled, as allowed. |
| **Every prediction carries its uncertainty** | P10/P50/P90 fans + lifetime distribution, per scenario, from Monte Carlo. No single bare figure anywhere. |
| **A number that moves money must be explainable** | A `provenance` object travels with every result (scenario source, ΔT, model spread source, park inputs, assumptions) and is surfaced in the UI. |

**Deliverables**

1. **Solution concept + value prop** — §1–2: a climate stress test for solar assets, for
   lenders/insurers/owners, beating the flat history-based number.
2. **A working prediction on real data** — `python -m model.run` / the 4 precomputed datasets /
   the live API + UI, with the climate dimension visible across scenarios and sources.
3. **Expo pitch** — a working demo (map → fan chart → provenance → chatbot), not slides.

**Evaluation criteria**

- **Solution Quality** — clear user, clear value prop, physics-grounded assumptions, separate
  scenarios, honest band.
- **Prototype Tangibility** — actually runs on real park data end to end; a narrow, deep slice
  (German solar, thermal derating) done well.
- **Business Potential** — see §11.
- **Pitch & Team** — we are explicit about **what the prediction is worth and what the data
  cannot say** (§10).

**Partner bonus (best use of Copernicus data).** The forward-looking signal is a **Copernicus
CMIP6 HighResMIP ensemble**, and switching from the flat historical baseline to that projection
**visibly moves the lifetime number** — the climate dimension drives the result, rather than
leaning on historical weather alone.

---

## 9. Business potential & scaling

- **Beyond one park:** the pipeline already runs all 10 parks unchanged; MaStR + GRW cover
  **every** installed German park, and the same physics generalises across the EU.
- **Beyond one customer:** lenders, insurers, owners, and operators all consume the same number
  for different decisions — a horizontal "climate stress test for energy assets."
- **The ML scaling story (future work, honestly labelled):** today's model is deterministic
  physics — the right choice for explainability. To score *thousands* of parks in milliseconds we
  can train an emulator to **mimic the physics core** (not weather→output on historical labels,
  which would re-bake the past), keeping the explainable physics as ground truth.
- **Deployment:** on-prem for data-sovereign customers, or cloud for scale — same artifact.

---

## 10. Repository map

```
.
├── model/                        # the prediction (pure physics + Monte Carlo)
│   ├── physics.py                # NOCT + Faiman cell-temp & energy core
│   ├── cmip6.py                  # CMIP6 7-model ensemble → ΔT (headline climate source)
│   ├── envirotrust.py            # EnviroTrust daily-max → ΔT (comparison source)
│   ├── degradation.py            # standard + Arrhenius-accelerated aging
│   ├── climate.py                # apply ΔT, heat-tail on hottest hours
│   ├── montecarlo.py             # simulate(): P10/P50/P90 + provenance
│   ├── finance.py                # energy → € (SMARD price)
│   ├── precompute.py             # all parks × scenarios × models → 4 JSON files
│   ├── run.py / stub_demo.py     # end-to-end + demo entry points
│   ├── parks.py · config.py · data.py · typical_year.py · validate.py · pvgis_calibration.py
│   └── tests/                    # pytest — physics core unit tests
├── backend/
│   ├── main.py                   # FastAPI: serves precomputed results + EnviroTrust endpoints
│   ├── precomputed_{cmip6,envirotrust}_{noct,faiman}.json   # the 4 deploy-time results
│   ├── EnviroTrustAPI/           # EnviroTrust Climate Risks API client (cache-backed)
│   ├── CDS Data/ · CDS Data Future/    # ERA5 + CMIP6 fetchers and cached weather
│   ├── GRW Data/                 # Microsoft Global Renewables Watch → wind exposure/speed
│   ├── cmip6_cache/              # per-park CMIP6 ensemble cache
│   └── Smard Prices Data/        # SMARD day-ahead price fetcher + data
├── frontend/                     # React + Vite + TypeScript
│   └── src/{pages,components,data,utils}/   # map, fan charts, switches, chatbot
├── power_curves_envirotrust/     # EnviroTrust-provided sample power curves
├── pitch/architecture-diagram.html
└── Challenge_Brief_EnviroTrust_Aerospace.pdf
```

---

*Built for the EnviroTrust "Power, Seen From Orbit" challenge. Real parks, real specs,
forward-looking Copernicus climate — an honest, explainable number a lender would put their
name to.*
