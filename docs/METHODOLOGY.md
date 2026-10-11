# Methodology

All numbers below are produced by `uv run python -m pipelines.run_all` (about 10 s once raw files are cached) and published in `site/public/data/`. Seeds: 20261010.

## Pipeline
1. **Ingest** (`pipelines/ingestion/fetch.py`): WDI API (15 indicator codes + 1 derived input set) and one OWID/Maddison CSV; sequential, backoff, raw JSON cached in `data/raw/`, sha256 + `lastupdated` + retrieval time in `data/manifests/raw_manifest.json`. The WB "error as HTTP 200" body is raised.
2. **Clean** (`pipelines/cleaning/clean.py`): entity list split into 217 countries and 79 aggregates (`region == Aggregates`); aggregate data rows (49 entities x 66 years per indicator) dropped and counted; null values counted; range rules reject impossible values only (share outside 0..100 [trade 0..1500], level <= 0): 19 rows across the export-share series, all counted in `cleaning_ledger.json`. Invariants asserted per indicator.
3. **Derive**: `hhi5` = sum over five export groups of (share / allocated total)^2, requiring all five groups and allocated total >= 80 percent. Range 0.2 to 1.
4. **Analyse** (`analytics/`), **publish** (`pipelines/publish.py`), **validate** (`pipelines/validation.py`, pytest).

## Unit safety
`analytics/units.py::assert_same_basis` is called by every convergence, cluster and correlation builder. PPP (constant 2021 international $), constant 2015 US$, current US$ and Maddison 2011 intl-$ are four bases. Convergence is estimated separately for PPP (from 1990) and constant USD (from 1960). Correlations and clusters use PPP only. Tests: guard raises; published artifacts carry one basis per result.

## Convergence
Growth g = 100 (ln y_end - ln y_start) / T (percent per year). Regression g = a + b ln y_start across countries with both endpoints (OLS, HC3 standard errors, t(n-2) CI, plus a 2000-draw seeded case bootstrap). Half-life from b (percent per year per ln unit, so b/100 enters): lambda = -ln(1 + (b/100) T) / T, half-life = ln 2 / lambda; null when b >= 0.
Samples: **primary** excludes countries whose territory plausibly changed inside the window (`analytics/boundaries.py`); **sensitivity_all** keeps them; **terciles** split by initial income (the regressor, not current income); **pop_weighted** uses WLS with initial population, and **pop_weighted_ex_chn_ind** refits it without China and India (together 38.8 percent of the 1990 weight): the 1990 to 2025 PPP weighted slope falls from -1.60 (CI -3.05 to -0.15) to -0.56 (CI -0.88 to -0.23), so the weighted result is driven mostly by those two countries. Sigma: population SD of ln income per year (unbalanced, balanced, population-weighted).
Results (end year 2025 PPP, 2024 constant USD):
| Window | Basis | Primary n | Beta (pp/yr per ln unit) | 95% CI (HC3) | Pop-weighted beta |
|---|---|---|---|---|---|
| 1990 to 2025 | PPP | 175 | -0.37 | -0.59 to -0.15 | -1.60 (CI -3.05 to -0.15) |
| 2000 to 2025 | PPP | 180 | -0.40 | -0.59 to -0.22 | -1.32 |
| 2010 to 2025 | PPP | 183 | -0.35 | -0.56 to -0.13 | -0.86 |
| 1960 to 2024 | constant USD | 102 | -0.03 | -0.22 to 0.17 | -0.82 (CI -1.95 to 0.31) |
| 1980 to 2024 | constant USD | 154 | -0.31 | -0.50 to -0.13 | -1.12 |
| 2000 to 2024 | constant USD | 191 | -0.39 | -0.53 to -0.24 | -0.83 |
Reading: since 1990 there is weak absolute convergence (poorer countries grew somewhat faster, implied half-life roughly 160 to 200 years unweighted); the 1960 to 2024 window shows none (CI spans 0, and its sample is about half the countries). Long-run context: across the 53 countries observed in both 1820 and 2022 the max/min ratio of income per capita rose from 5.2 to 56 (Maddison dollars, same countries). Sigma across countries is nearly flat (SD of ln income 1.17 in 1990, 1.13 in 2025) while population-weighted sigma falls (1.20 to 0.89), driven by very large countries growing fast. Neither result is causal.

## Clustering
Features (complete cases only, 165 of 217 countries; no imputation): mean ln GDP per capita PPP (2015 to 2023), mean real growth (2010 to 2023), mean agriculture and industry share (2015 to 2023; services omitted as the near-residual), mean ln trade openness, asinh of median inflation (2010 to 2023); each needs >= 5 observations. Z-scored with population SD. KMeans (n_init 10), k = 2..8; k chosen from 3..6 by the published rule (min cluster size >= 5, mean seed ARI >= 0.8, highest silhouette): **k = 3**, silhouette 0.225 (k = 2 scores 0.276 but only re-draws the rich/poor line). Stability: 20 random_state values give identical partitions (ARI 1.0); 50 subsamples at 80 percent give mean ARI 0.96. Ward hierarchical clustering at k = 3 agrees only moderately with k-means (ARI 0.48, cophenetic r 0.48). Honest summary: weak separation, stable partition, descriptive only. Cluster ids are ordered by centroid income.

## Correlations
Spearman across countries on the same period means, pairwise complete, n >= 30, Fisher-z CI (SE 1.06/sqrt(n-3)). 45 pairs over 10 variables. Strongest: income vs productivity 0.97, agriculture share vs productivity -0.88, income vs agriculture share -0.86. All carry the not-causal copy.

## Narratives
`narratives.json` holds nine template families (level, three growth windows, index base 2000, convergence residual, structure, inflation, trade, concentration, peers) and per-country numeric inputs; text is produced only by substituting inputs (`{key|fmt}`); a null input means the template is not shown. The convergence residual uses the primary 2000 to 2025 PPP fit. Python rendering (`analytics/narratives.py::render`) is the reference for browser parity; `examples` are reference outputs for 6 countries.

## Validation
`validation.json` (all 9 checks pass): planted-slope recovery, independent OLS cross-check (diff 1e-14), 25/25 raw spot checks, unit guard, clustering reproducibility, no aggregates, rankings only countries with data, value-added shares sum (median 92.1; remainder is net product taxes), PPP/constant-USD rank sanity (rho 0.97).

## Latest-year rule
Per indicator, the latest year (from 2010) with a country count >= 90 percent of that indicator's peak count over 2010 to 2022: GDP per capita PPP 2025 (185 countries), constant USD 2024 (199), trade 2024 (172), export shares and hhi5 2022 to 2023 (147 to 163).

## Artifact sizes (gzip)
Largest: panel_structure 140 KB, panel_income 120 KB, convergence 34 KB; all under the 400 KB budget (`meta.json.artifact_bytes`).
