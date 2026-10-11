# Data and analysis limitations (data phases)

- **Not causal.** Convergence slopes, correlations and clusters are descriptive. Copy must keep the "not causal" strings from `convergence.json`, `correlations.json` and `facts.json`.
- **Absolute convergence only.** Conditional convergence (controls) is not estimated. Terciles and population-weighted fits have wide CIs; the 1960 window covers about half the countries and is not a random sample (survivorship in data availability).
- **Clusters are weak.** Silhouette 0.225 at k = 3; Ward vs k-means ARI 0.48. Treat the groups as a summary device. 52 countries lack a feature and are not clustered (complete-case, listed in `clusters.json`).
- **Trade concentration.** `hhi5` uses five broad merchandise groups from WDI/Comtrade shares, not product-level HHI; it covers 147 countries in 2022; coverage is thinner earlier and the unallocated residual ("other") is ignored by renormalising.
- **Boundary changes.** Event years are general historical knowledge, not verified against World Bank documentation. WDI's reconstruction of USSR/Yugoslavia/Czechoslovakia early values is not machine-checkable here; successor states are kept when observed at the window start. Seven countries carry a territory break (SDN, ETH, SRB, DEU, YEM, PAK, BGD) and are excluded from affected primary samples only.
- **Vintage and revisions.** WDI vintage 2026-10-08; values for the latest years are estimates and will be revised. PPP 2021 revisions changed levels versus earlier ICP rounds; never compare to older published PPP numbers.
- **Income groups** are current classifications, applied backwards as labels only.
- **Maddison** long-run data (2011 dollars) has 53 countries in 1820 and 164 in 2022, with Maddison's borders; it is context, not a continuation of WDI.
- **Value-added shares** sum to about 93 percent of GDP at the median (net product taxes); services are not a residual of 100 minus the others.
- **IMF WEO excluded** for licence reasons, so no IMF forecasts or projections appear anywhere.
- **No live data.** The site is a dated snapshot.
