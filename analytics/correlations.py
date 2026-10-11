"""Descriptive cross-sectional Spearman correlations. Never causal. One money basis per pair (assert_same_basis)."""
from __future__ import annotations

import itertools

import numpy as np
from scipy import stats

from analytics.clustering import GROWTH_WIN, LEVEL_WIN, MIN_OBS, _mean, raw_features
from analytics.data import Panel
from analytics.units import assert_same_basis, basis_of

NOT_CAUSAL = ("These are descriptive rank correlations across countries. They do not show that one variable causes another; "
              "common drivers, reverse causation and composition effects are all consistent with the same number.")
# id -> source indicator (for the money-basis guard)
VARS = {"ln_gdppc_ppp": "gdppc_ppp", "growth": "gdp_growth", "agr_share": "agr_share", "ind_share": "ind_share", "srv_share": "srv_share",
        "ln_trade": "trade_open", "infl_asinh": "inflation", "ln_productivity": "productivity", "hhi5": "hhi5", "ln_population": "population"}

TRANSFORMS = {
    "ln_gdppc_ppp": "mean of ln(GDP per capita, PPP constant 2021 intl $) over the level window", "growth": "mean annual real GDP growth (percent) over the growth window",
    "agr_share": "mean agriculture value added, % of GDP, level window", "ind_share": "mean industry value added, % of GDP, level window",
    "srv_share": "mean services value added, % of GDP, level window", "ln_trade": "mean of ln(trade % of GDP), level window",
    "infl_asinh": "asinh of the median CPI inflation (percent) over the growth window", "ln_productivity": "mean of ln(GDP per person employed, constant 2021 PPP $), level window",
    "hhi5": "mean 5-group export concentration index, level window", "ln_population": "mean of ln(population), level window"}


def variables(p: Panel) -> dict[str, np.ndarray]:
    v = dict(raw_features(p))
    L = LEVEL_WIN
    v["srv_share"] = _mean(p.window("srv_share", *L))
    v["ln_productivity"] = _mean(p.window("productivity", *L), np.log)
    v["hhi5"] = _mean(p.window("hhi5", *L))
    v["ln_population"] = _mean(p.window("population", *L), np.log)
    return v


def run(p: Panel) -> dict:
    v = variables(p)
    pairs = []
    for a, b in itertools.combinations(VARS, 2):
        bs = assert_same_basis(VARS[a], VARS[b])
        m = np.isfinite(v[a]) & np.isfinite(v[b])
        n = int(m.sum())
        if n < 30:
            continue
        rho, pv = stats.spearmanr(v[a][m], v[b][m])
        z, se = np.arctanh(rho), 1.06 / np.sqrt(n - 3)  # Fieller et al. SE for Spearman
        pairs.append(dict(a=a, b=b, n=n, rho=float(rho), ci95=[float(np.tanh(z - 1.96 * se)), float(np.tanh(z + 1.96 * se))], p_value=float(pv),
                          money_bases=sorted({basis_of(VARS[a]), basis_of(VARS[b])} - {None})))
    vals = {k: [None if not np.isfinite(x) else round(float(x), 6) for x in v[k]] for k in VARS}
    tr = {k: t for k, t in TRANSFORMS.items()}
    return dict(iso3=list(p.iso3), values=vals, transforms=tr, method="Spearman rank correlation across countries, pairwise complete cases, 95% CI by Fisher z with SE 1.06/sqrt(n-3).",
                window=list(LEVEL_WIN), not_causal=NOT_CAUSAL, indicators=list(VARS), pairs=pairs)
