"""Build validation.json: executable checks recorded with their results (the same properties are asserted again in pytest)."""
from __future__ import annotations

import json

import numpy as np

from analytics import clustering, convergence
from analytics.units import MixedBasisError, assert_same_basis
from pipelines.common import RAW, WDI


def check(cid, desc, passed, detail=""):
    return dict(id=cid, description=desc, passed=bool(passed), detail=str(detail))


def planted_beta(true=-0.5, n=200, seed=7):
    rng = np.random.default_rng(seed)
    x = rng.normal(8.5, 1.2, n)
    y = 3.0 + true * x + rng.normal(0, 1.0, n)
    return true, convergence.fit_beta(x, y, reps=500)


def raw_value(code, iso3, year):
    for r in json.loads((RAW / "wdi" / f"{code}.data.json").read_text())["rows"]:
        if r["countryiso3code"] == iso3 and r["date"] == str(year):
            return r["value"]
    return None


def run(p, out, beta, clu) -> dict:
    ch, lim = [], []
    true, f = planted_beta()
    ch.append(check("planted_beta", "OLS+HC3 recovers a planted slope of -0.5 within its own 95% CI", f["ci95"][0] <= true <= f["ci95"][1], f"est {f['beta']:.3f} CI {f['ci95'][0]:.3f}..{f['ci95'][1]:.3f}"))
    prim = next(b for b in beta if b["id"].startswith("gdppc_ppp_2000") and b["sample"] == "primary")
    pts = prim["points"]
    a, b = convergence.ols_numpy(np.array(pts["x"]), np.array(pts["y"]))
    ch.append(check("ols_crosscheck", "statsmodels beta equals an independent normal-equation OLS on the published scatter", abs(b - prim["beta"]) < 1e-9 and abs(a - prim["intercept"]) < 1e-9, f"diff {abs(b - prim['beta']):.2e}"))
    rng = np.random.default_rng(11)
    ids = [i for i in WDI]
    bad, n = 0, 0
    pan = {**{k: out["panel_income"]["series"][k] for k in out["panel_income"]["series"]}, **out["panel_structure"]["series"]}
    iso = out["panel_income"]["iso3"]
    years = out["panel_income"]["years"]
    while n < 25:
        i = ids[int(rng.integers(len(ids)))]
        c = iso[int(rng.integers(len(iso)))]
        y = int(rng.choice(years))
        pub = pan[i]["values"][iso.index(c)][years.index(y)]
        raw = raw_value(WDI[i][0], c, y)
        n += 1
        if (pub is None) != (raw is None) or (pub is not None and abs(pub - raw) > 0.5 * 10 ** (-pan[i]["decimals"]) + 1e-9):
            bad += 1
    ch.append(check("raw_spot_check", "25 random published country-year values equal the raw WDI value (after rounding) or both are null", bad == 0, f"{n - bad}/{n}"))
    ok = False
    try:
        assert_same_basis("gdppc_ppp", "gdppc_nominal")
    except MixedBasisError:
        ok = True
    ch.append(check("unit_guard", "assert_same_basis raises for PPP vs current-USD and PPP vs constant-USD", ok and _raises("gdppc_ppp", "gdppc_const"), "MixedBasisError"))
    c2 = clustering.run(p)
    ch.append(check("cluster_reproducible", "a second clustering run gives identical assignments", c2["assignments"] == clu["assignments"], f"k={clu['chosen_k']}"))
    agg = {a["code"] for a in out["countries"]["aggregates"]}
    ch.append(check("no_aggregates", "no aggregate code appears in any panel, ranking, regression point or cluster", not (agg & set(iso)) and not (agg & set(clu["assignments"]["iso3"]))
                    and not any(agg & set(r["order"]) for ind in out["rankings"]["indicators"].values() for r in ind.values()), f"{len(agg)} aggregates"))
    rk_ok = True
    for ind, d in out["rankings"]["indicators"].items():
        src = out["panel_income"] if ind in out["panel_income"]["series"] else out["panel_structure"]
        for r in d.values():
            if r["year"] in src["years"]:
                col = src["years"].index(r["year"])
                have = {c for k, c in enumerate(src["iso3"]) if src["series"][ind]["values"][k][col] is not None}
                rk_ok &= set(r["order"]) == have
    ch.append(check("rankings_only_with_data", "every ranking contains exactly the countries with a value that year", rk_ok, ""))
    s3 = np.array([out["panel_structure"]["series"][k]["values"] for k in ("agr_share", "ind_share", "srv_share")], dtype=float)
    tot = np.nansum(s3, 0)
    full = np.isfinite(s3).all(0)
    t = tot[full]
    share_ok = float(np.mean((t >= 70) & (t <= 110)))
    med = float(np.median(t))
    ch.append(check("shares_sum", "agriculture+industry+services value-added shares sum to 70..110 percent in at least 97 percent of complete country-years, median 88..100 (value added is at basic prices, so the gap to 100 is net product taxes, not an error)",
                    share_ok >= 0.97 and 88 <= med <= 100, f"{100 * share_ok:.1f} percent in range, median sum {med:.1f}"))
    ppp, cst = p.at("gdppc_ppp", 2019), p.at("gdppc_const", 2019)
    m = np.isfinite(ppp) & np.isfinite(cst)
    from scipy.stats import spearmanr
    r = spearmanr(ppp[m], cst[m])[0]
    ch.append(check("series_sanity", "2019 PPP and constant-USD GDP per capita rank-correlate above 0.9 (different bases, same economies; sanity only, never compared as levels)", r > 0.9, f"rho {r:.3f}, n {int(m.sum())}"))
    lim += ["Unconditional beta: poor-country growth depends on factors absent here; conditional convergence is not estimated.",
            "Terciles and pop-weighted fits have wide CIs; early-window samples (1960) cover about half the countries and are not a random sample.",
            "Cluster silhouette is low (weak separation); groups are descriptive and the k choice is rule-based, not a discovery of natural classes.",
            "Value-added shares sum to about 93 percent of GDP at the median (net product taxes make up the rest); they are not a full decomposition of GDP.",
            "hhi5 uses five broad export groups; product-level concentration is higher.",
            "WDI revises history and later years are estimates; successor-state early values are reconstructions."]
    return dict(schema_version="v1", tags={"checks": "DERIVED"}, checks=ch, all_passed=all(c["passed"] for c in ch), limitations_observed=lim)


def _raises(*ids):
    try:
        assert_same_basis(*ids)
    except MixedBasisError:
        return True
    return False
