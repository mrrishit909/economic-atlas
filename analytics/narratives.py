"""Template-ready evidence narratives: per-country numeric inputs are precomputed; text is built only by rendering templates.

Placeholder syntax: {key} or {key|fmt}; fmt in n0 (thousands separator, 0 decimals), d1, d2, d3 (fixed decimals), s1 (signed, 1 decimal).
A template applies to a country only if every key in `requires` is non-null (else the UI shows an empty state, no text).
"""
from __future__ import annotations

import re

import numpy as np

from analytics.data import Panel, latest_year

PERIODS = [(1990, None), (2000, None), (2010, None)]  # end filled with the GDP latest year

TEMPLATES = [
    dict(id="level", requires=["name", "latest_year", "gdppc_ppp_latest", "gdppc_ppp_rank", "gdppc_ppp_n"],
         text="In {latest_year}, {name} had GDP per capita of {gdppc_ppp_latest|n0} (constant 2021 international dollars, PPP), ranking {gdppc_ppp_rank|n0} of {gdppc_ppp_n|n0} countries with data."),
    *[dict(id=f"growth_{y}", requires=["name", "latest_year", f"cagr_{y}", f"cagr_median_{y}", f"cagr_n_{y}"],
           text=f"From {y} to {{latest_year}}, {{name}}'s GDP per capita (PPP) grew {{cagr_{y}|d1}}% per year, against a median of {{cagr_median_{y}|d1}}% across {{cagr_n_{y}|n0}} countries observed in both years.")
      for y in (1990, 2000, 2010)],
    dict(id="index_2000", requires=["name", "latest_year", "index_2000"],
         text="With GDP per capita (PPP) in 2000 set to 100, {name} stood at {index_2000|n0} in {latest_year}."),
    dict(id="convergence_2000", requires=["name", "resid_2000", "beta_2000"],
         text="Since 2000, {name}'s growth differs from what the cross-country line predicts for its starting income (slope {beta_2000|d3}) by {resid_2000|s1} percentage points per year, where positive means faster. This is a descriptive residual, not a causal effect."),
    dict(id="structure", requires=["name", "agr_2000", "agr_latest", "ind_2000", "ind_latest", "srv_2000", "srv_latest", "struct_year"],
         text="Agriculture's share of value added moved from {agr_2000|d1}% in 2000 to {agr_latest|d1}% in {struct_year}; industry from {ind_2000|d1}% to {ind_latest|d1}%; services from {srv_2000|d1}% to {srv_latest|d1}%."),
    dict(id="inflation", requires=["name", "infl_median", "infl_max", "infl_max_year", "infl_window_start", "infl_window_end"],
         text="Median consumer-price inflation in {name} over {infl_window_start} to {infl_window_end} was {infl_median|d1}% a year, with a peak of {infl_max|d1}% in {infl_max_year}."),
    dict(id="trade", requires=["name", "trade_latest", "trade_year", "trade_rank", "trade_n"],
         text="Exports plus imports of goods and services were {trade_latest|d1}% of {name}'s GDP in {trade_year}, ranking {trade_rank|n0} of {trade_n|n0} countries with data."),
    dict(id="concentration", requires=["name", "hhi5_latest", "hhi5_year"],
         text="{name}'s coarse export concentration index across five broad merchandise groups was {hhi5_latest|d2} in {hhi5_year} (0.2 means evenly spread, 1 means a single group). It understates product-level concentration."),
    dict(id="peers", requires=["name", "cluster", "cluster_k", "cluster_signature", "cluster_size"],
         text="On standardized indicators {name} falls in peer group {cluster|n0} of {cluster_k|n0}, a group of {cluster_size|n0} countries whose average profile is {cluster_signature}. Individual members can differ from that average; peer groups are descriptive, not causal."),
]
_PH = re.compile(r"\{(\w+)(?:\|(\w+))?\}")


def fmt(v, f):
    if f == "n0":
        return f"{v:,.0f}"
    if f in ("d1", "d2", "d3"):
        return f"{v:.{f[1]}f}"
    if f == "s1":
        return f"{v:+.1f}"
    return str(v)


def render(template: dict, inputs: dict) -> str | None:
    if any(inputs.get(k) is None for k in template["requires"]):
        return None
    return _PH.sub(lambda m: fmt(inputs[m.group(1)], m.group(2)) if m.group(2) else str(inputs[m.group(1)]), template["text"])


def _rank(v: np.ndarray, i: int) -> tuple[int | None, int]:
    m = np.isfinite(v)
    if not m[i]:
        return None, int(m.sum())
    return int(1 + (v[m] > v[i]).sum()), int(m.sum())


def country_inputs(p: Panel, beta2000: dict, clusters: dict) -> list[dict]:
    ly, _, _ = latest_year(p, "gdppc_ppp")
    ppp_l = p.at("gdppc_ppp", ly)
    out = []
    cagr = {}
    for y in (1990, 2000, 2010):
        a, b = p.at("gdppc_ppp", y), ppp_l
        ok = np.isfinite(a) & np.isfinite(b)
        g = np.where(ok, 100 * (np.log(np.where(ok, b, 1)) - np.log(np.where(ok, a, 1))) / (ly - y), np.nan)
        cagr[y] = (g, float(np.nanmedian(g)), int(ok.sum()))
    ty, _, _ = latest_year(p, "trade_open")
    hy, _, _ = latest_year(p, "hhi5")
    assign = dict(zip(clusters["assignments"]["iso3"], clusters["assignments"]["cluster"]))
    csize = {c["id"]: c for c in clusters["clusters"]}
    wy = (2014, 2023)
    for i, iso in enumerate(p.iso3):
        name = str(p.countries["name"][i])
        d = dict(name=name, latest_year=ly)
        r, n = _rank(ppp_l, i)
        d.update(gdppc_ppp_latest=_f(ppp_l[i]), gdppc_ppp_rank=r, gdppc_ppp_n=n)
        for y in (1990, 2000, 2010):
            g, med, nn = cagr[y]
            d.update({f"cagr_{y}": _f(g[i]), f"cagr_median_{y}": med, f"cagr_n_{y}": nn})
        a0 = p.at("gdppc_ppp", 2000)[i]
        d["index_2000"] = _f(100 * ppp_l[i] / a0) if np.isfinite(a0) and np.isfinite(ppp_l[i]) else None
        d["beta_2000"] = beta2000["beta"]
        g = cagr[2000][0][i]
        d["resid_2000"] = _f(g - (beta2000["intercept"] + beta2000["beta"] * np.log(a0))) if np.isfinite(g) and i_in(beta2000, iso) else None
        # structure: latest year >= 2015 where all three shares exist
        sy = None
        for y in range(int(p.years[-1]), 2014, -1):
            if all(np.isfinite(p.at(k, y)[i]) for k in ("agr_share", "ind_share", "srv_share")):
                sy = y
                break
        for k, key in (("agr_share", "agr"), ("ind_share", "ind"), ("srv_share", "srv")):
            v0 = p.at(k, 2000)[i]
            d[f"{key}_2000"] = _f(v0)
            d[f"{key}_latest"] = _f(p.at(k, sy)[i]) if sy else None
        d["struct_year"] = sy
        M = p.window("inflation", *wy)[i]
        if np.isfinite(M).sum() >= 5:
            d.update(infl_median=_f(np.nanmedian(M)), infl_max=_f(np.nanmax(M)), infl_max_year=int(wy[0] + np.nanargmax(M)), infl_window_start=wy[0], infl_window_end=wy[1])
        else:
            d.update(infl_median=None, infl_max=None, infl_max_year=None, infl_window_start=wy[0], infl_window_end=wy[1])
        tv = p.at("trade_open", ty)
        tr, tn = _rank(tv, i)
        d.update(trade_latest=_f(tv[i]), trade_year=ty if np.isfinite(tv[i]) else None, trade_rank=tr, trade_n=tn)
        hv = p.at("hhi5", hy)[i]
        d.update(hhi5_latest=_f(hv, 4), hhi5_year=hy if np.isfinite(hv) else None)
        if iso in assign:
            c = assign[iso]
            d.update(cluster=c + 1, cluster_k=clusters["chosen_k"], cluster_signature=csize[c]["signature"], cluster_size=csize[c]["size"])
        else:
            d.update(cluster=None, cluster_k=clusters["chosen_k"], cluster_signature=None, cluster_size=None)
        out.append(dict(iso3=iso, inputs=d))
    return out


def i_in(rec, iso):
    return iso not in rec["excluded_territory_changes"]


def _f(v, nd=4):
    return None if v is None or not np.isfinite(v) else round(float(v), nd)


# ---------------------------------------------------------------- pairwise (DR-8)
# {a.key|fmt}, {b.key|fmt}: per-country inputs; {diff.key|fmt} = a - b; {ratio.key|fmt} = a / b. Nothing else is computed.
PAIR_TEMPLATES = [
    dict(id="compare_level", requires=["a.name", "b.name", "a.latest_year", "a.gdppc_ppp_latest", "b.gdppc_ppp_latest", "a.gdppc_ppp_rank", "b.gdppc_ppp_rank", "a.gdppc_ppp_n", "ratio.gdppc_ppp_latest"],
         text="In {a.latest_year}, GDP per capita in {a.name} ({a.gdppc_ppp_latest|n0}, rank {a.gdppc_ppp_rank|n0} of {a.gdppc_ppp_n|n0}) was {ratio.gdppc_ppp_latest|d2} times that of {b.name} ({b.gdppc_ppp_latest|n0}, rank {b.gdppc_ppp_rank|n0}); both in constant 2021 international dollars (PPP)."),
    *[dict(id=f"compare_growth_{y}", requires=["a.name", "b.name", "a.latest_year", f"a.cagr_{y}", f"b.cagr_{y}", f"diff.cagr_{y}"],
           text=f"From {y} to {{a.latest_year}}, GDP per capita (PPP) grew {{a.cagr_{y}|d1}}% per year in {{a.name}} and {{b.cagr_{y}|d1}}% in {{b.name}}, a difference of {{diff.cagr_{y}|s1}} percentage points per year (positive means {{a.name}} grew faster).")
      for y in (1990, 2000, 2010)],
    dict(id="compare_index_2000", requires=["a.name", "b.name", "a.latest_year", "a.index_2000", "b.index_2000"],
         text="With GDP per capita (PPP) in 2000 set to 100, {a.name} stood at {a.index_2000|n0} and {b.name} at {b.index_2000|n0} in {a.latest_year}."),
]
_PAIR_OPS = {"diff": lambda x, y: x - y, "ratio": lambda x, y: x / y}
_PH2 = re.compile(r"\{(\w+)\.(\w+)(?:\|(\w+))?\}")


def pair_value(side: str, key: str, a: dict, b: dict):
    if side == "a":
        return a.get(key)
    if side == "b":
        return b.get(key)
    x, y = a.get(key), b.get(key)
    if x is None or y is None or (side == "ratio" and y == 0):
        return None
    return _PAIR_OPS[side](x, y)


def render_pair(template: dict, a: dict, b: dict) -> str | None:
    for r in template["requires"]:
        side, key = r.split(".", 1)
        if pair_value(side, key, a, b) is None:
            return None
    return _PH2.sub(lambda m: fmt(pair_value(m.group(1), m.group(2), a, b), m.group(3)) if m.group(3) else str(pair_value(m.group(1), m.group(2), a, b)), template["text"])
