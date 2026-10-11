# Problem definition: "The World, Explained Through Economic Forces"

## The question
How do countries differ in income, growth and economic structure, are poorer countries catching up, and which
countries look alike once several indicators are standardized and compared on one footing? The atlas answers with
World Bank WDI annual data for 217 countries (1990 to the latest published year) and a one-series long-run
context (Maddison via Our World in Data), as a comparison engine a visitor can drive in a browser with no backend:
countries x indicators x period x index base, with evidence narratives built only from computed values.

## Who it is for
A hiring manager or an economics-curious reader who wants to compare two economies fairly and see, honestly, what the
data can and cannot say. It is an educational explainer, not a forecast and not policy advice.

## Scope decisions (and why)
| Decision | Reason |
|---|---|
| **Sources: World Bank WDI (API) and one OWID series (Maddison). IMF WEO is excluded.** | WDI is CC BY 4.0. IMF terms forbid automated bulk download without written permission, so no IMF endpoint is ever called. |
| **Window: 1990 to the latest year, published at 1990+.** | Successor states of the USSR and Yugoslavia start about 1990 to 1995; PPP series start 1990. Constant-USD series exist from 1960 and are used (separately) for longer beta windows. |
| **Countries only in analysis; WB aggregates kept out of every ranking, regression and cluster.** | 296 WB entities minus 79 aggregates = 217 countries/economies. Aggregates are flagged and listed, never mixed. |
| **PPP, constant-USD and current-USD GDP per capita are three different quantities.** | Each carries `price_basis`; one function `assert_same_basis` guards every level comparison, ranking, regression and cluster feature. Convergence is estimated per basis, never pooled. |
| **Trade concentration: a coarse 5-group export HHI (DERIVED) from WDI merchandise-export shares.** | WDI has no product-level HHI. Five broad groups (agricultural raw materials, food, fuel, ores/metals, manufactures) give an index between 0.2 and 1; it understates product-level concentration and is labelled so. No UNCTAD/Comtrade pull. |
| **Convergence is unconditional (absolute) beta and sigma, with a pop-weighted variant.** | Conditional convergence needs controls beyond this scope; the limitation is stated, not hidden. |
| **Correlations are descriptive cross-sections.** | Every correlation record carries "not causal" copy. |
| **No interpolation anywhere in published series.** | Missing is `null`. Rankings and statistics use only countries with data and publish `n`. |

## Honesty rules
- Tags per field: OBSERVED (as published by WDI/OWID), DERIVED (deterministic computation on observed data), PREDICTED (model assignment/fit, e.g. cluster membership), SIMULATED and SYNTHETIC (not used).
- Every number in site copy comes from `facts.json` or `narratives.json`, never typed by hand.
- The WDI vintage (`lastupdated`) and retrieval time are in `meta.json` and must be shown by the site.
- Latest-year values can be provisional estimates; WDI revises history on each release. This is a snapshot, not a live feed.

## Differs from
pulse-economic-activity and atlas-development-intel: those present indicators; this one is a multi-indicator comparison
engine with convergence analysis, unit-safe PPP/nominal separation and coverage accounting.

## Success criteria for the data phases (P05-DATA-001)
- Raw rows = aggregate rows + country rows; country rows = null + observed, exactly, per indicator (tested).
- 217 countries; zero aggregates in any ranking/regression/cluster (tested).
- PPP and nominal/constant money can't be compared through the analytics API (tested to raise).
- Beta estimator recovers a planted coefficient (tested); k-means is reproducible and cluster stability is reported.
- All artifacts validate against `data/contracts/*.schema.json`; each is under 400 KB gzip.
