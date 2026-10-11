"""Indicator display rules (DR-7): fixed colour bins and legend labels per indicator, computed from the published values."""
from __future__ import annotations

import numpy as np

SHORT = {"gdp_growth": "GDP growth", "gdppc_ppp": "GDP per capita (PPP)", "gdppc_const": "GDP per capita (constant US$)", "gdppc_nominal": "GDP per capita (current US$)",
         "productivity": "output per worker (PPP)", "agr_share": "agriculture share", "ind_share": "industry share", "srv_share": "services share", "inflation": "inflation",
         "trade_open": "trade openness", "population": "population", "x_agri": "agricultural raw material exports", "x_food": "food exports", "x_fuel": "fuel exports",
         "x_manf": "manufactures exports", "x_mmtl": "ores and metals exports", "hhi5": "export concentration"}
LOG = {"gdppc_ppp", "gdppc_const", "gdppc_nominal", "productivity", "population"}
INDEXABLE = LOG
BINS = 7


def compact(x: float) -> str:
    a = abs(x)
    if a >= 1e9:
        return f"{x / 1e9:.3g}B"
    if a >= 1e6:
        return f"{x / 1e6:.3g}M"
    if a >= 1e4:
        return f"{x / 1e3:.3g}K"
    if a >= 100:
        return f"{x:.0f}"
    if a >= 1:
        return f"{x:.3g}"
    return f"{x:.2g}"


def rule(ind: str, kind: str, vals: np.ndarray, y0: int, y1: int) -> dict:
    v = vals[np.isfinite(vals)]
    scale = "log" if ind in LOG else "asinh" if ind == "inflation" else "diverging" if ind == "gdp_growth" else "linear"
    if scale == "diverging":
        a = np.abs(v)
        c = np.quantile(a, [0.2, 0.5, 0.85])
        edges = np.array([-c[2], -c[1], -c[0], c[0], c[1], c[2]])
        how = "symmetric_abs_quantile_0.2_0.5_0.85"
    else:
        edges = np.quantile(v, np.arange(1, BINS) / BINS)
        how = "equal_count_quantile_k_over_7"
        if not (np.diff(edges) > 0).all():
            edges = np.linspace(*np.percentile(v, [1, 99]), BINS - 1)
            how = "equal_width_p01_p99"
    edges = np.round(edges, 6)
    assert (np.diff(edges) > 0).all(), ind
    return dict(scale=scale, bins=edges.tolist(), edge_labels=[compact(float(e)) for e in edges], short_label=SHORT[ind], indexable=ind in INDEXABLE,
                core_reads=f"highest {SHORT[ind]} at the core", bins_rule=how, pooled_years=[y0, y1], pooled_n=int(v.size))
