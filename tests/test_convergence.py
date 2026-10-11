import numpy as np
import pytest

from analytics import convergence as cv
from analytics.boundaries import BREAKS, breaks_in_window


def test_planted_beta_recovery():
    rng = np.random.default_rng(3)
    x = rng.normal(8.5, 1.2, 400)
    y = 3.0 - 0.5 * x + rng.normal(0, 0.8, 400)
    f = cv.fit_beta(x, y, reps=300)
    assert f["ci95"][0] < -0.5 < f["ci95"][1] and f["ci95_boot"][0] < -0.5 < f["ci95_boot"][1]
    a, b = cv.ols_numpy(x, y)
    assert b == pytest.approx(f["beta"], abs=1e-10) and a == pytest.approx(f["intercept"], abs=1e-10)


def test_no_relation_gives_ci_covering_zero():
    rng = np.random.default_rng(4)
    x, y = rng.normal(8, 1, 300), rng.normal(2, 1, 300)
    f = cv.fit_beta(x, y, reps=200)
    assert f["ci95"][0] < 0 < f["ci95"][1]


def test_half_life_formula():
    # b = -(1-exp(-lam T))/T with lam=0.02, T=25 -> half life ln2/0.02
    T, lam = 25, 0.02
    b_pct = 100 * -(1 - np.exp(-lam * T)) / T
    assert cv.half_life(b_pct, T) == pytest.approx(np.log(2) / lam, rel=1e-9)
    assert cv.half_life(0.1, 25) is None


@pytest.mark.slow
def test_published_records_sane(art):
    beta = art("convergence")["beta"]
    assert len(beta) == 36
    for b in beta:
        assert b["ci95"][0] <= b["beta"] <= b["ci95"][1]
        assert abs(b["beta"]) < 5 and b["n"] >= 30
        assert b["tag"] == "DERIVED"
    prim = {b["id"]: b for b in beta if b["sample"] == "primary"}
    for b in prim.values():
        assert b["n"] == len(b["points"]["iso3"]) == len(b["points"]["x"])
        assert not set(b["excluded_territory_changes"]) & set(b["points"]["iso3"])
        sens = next(s for s in beta if s["id"] == b["id"].replace("primary", "sensitivity_all"))
        assert sens["n"] >= b["n"]
    # the 1960 window must exclude the flagged territory-change countries
    b60 = prim["gdppc_const_1960_2024_primary"]
    assert {"DEU", "PAK", "BGD", "YEM", "SDN", "ETH", "SRB"} <= set(b60["excluded_territory_changes"])
    # tercile samples partition the primary sample
    for k, b in prim.items():
        t = [x for x in beta if x["id"] == k.replace("primary", "") + "tercile_low" or x["id"].startswith(k.replace("primary", "tercile_"))]
        assert sum(x["n"] for x in t) == b["n"]


@pytest.mark.slow
def test_sigma_sane(art):
    for s in art("convergence")["sigma"]:
        v = [x for x in s["sd_log"] if x is not None]
        assert all(0.2 < x < 2.5 for x in v)
        assert len(s["years"]) == len(s["sd_log"]) == len(s["n"])


def test_breaks_in_window():
    assert breaks_in_window(1990, 2025) == ["DEU", "ETH", "SDN", "SRB"]
    assert set(BREAKS) >= {"SDN", "ETH", "SRB"}
