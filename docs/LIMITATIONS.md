# Limitations

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
- **Maddison is a different dollar basis.** International dollars in 2011 prices (ICP 2011) are never combined with WDI PPP (constant 2021 international dollars) in any computation, chart or comparison; the long-run view is context only, with Maddison's own borders.

## Added at release (frontend and layouts)

- **Clusters are weak.** Silhouette 0.225 at k = 3 (k = 2 scores higher but only redraws the rich/poor line). The site treats the groups as a summary device and shows where Ward and k-means disagree.
- **Boundary event years are unverified.** They come from general historical knowledge (tagged GENERAL_KNOWLEDGE), not from World Bank documentation.
- **The 1960 window is thin.** Constant-USD 1960 to 2024 covers n = 102 countries (about half), and its beta (-0.03) has a 95% CI of -0.22 to 0.17, which spans zero. Data availability, not chance, decides who is in it.
- **The weighted beta is driven by China and India.** They hold 38.8 percent of the 1990 population weight; refitting without them moves the 1990 to 2025 PPP weighted slope from -1.60 to -0.56 (n 173).
- **Seed-head layouts are a visual encoding, not a map.** Territories are solved offline (not in the browser), seeded by income rank so the rank-radius relation holds (Spearman 0.87 to 0.99 across layouts). That bound costs year-to-year reflow (mean displacement 0.391 radii), so year changes crossfade between real layouts instead of animating grains. 9 of 20,367 territory-layouts are under 95 percent connected; connectivity is published per layout. Position inside a disc is not geography.
- **Constant-USD 1960 and 1980 sensitivity points are not published,** so those options in the lab are disabled and labelled NOT PUBLISHED. Terciles, set-aside and PPP sensitivity points are derived exactly in the browser from the published panel.
- **hhi5 understates product-level concentration** (five broad merchandise groups, 147 countries in 2022).
- **Value-added shares sum to about 93 percent of GDP at the median** (net product taxes); services are not a residual.
- **Frame pacing** was measured only on software GL (no GPU) by the builder; real-device pacing, and the builder's Lighthouse figures, are pending independent QA. The site has quality tiers (high, low, no-GL) and a reduced-motion rendering, but their cost on real hardware is unmeasured.
