import numpy as np
import pytest

from analytics.data import latest_year

pytestmark = pytest.mark.slow


def test_rankings_only_countries_with_data(art):
    src = {"income": art("panel_income"), "structure": art("panel_structure")}
    for ind, d in art("rankings")["indicators"].items():
        p = src["income"] if ind in src["income"]["series"] else src["structure"]
        for r in d.values():
            col = p["years"].index(r["year"]) if r["year"] in p["years"] else None
            if col is None:
                continue
            vals = {c: p["series"][ind]["values"][k][col] for k, c in enumerate(p["iso3"])}
            have = [c for c, v in vals.items() if v is not None]
            assert set(r["order"]) == set(have) and r["n"] == len(have)
            vv = [vals[c] for c in r["order"]]
            assert vv == sorted(vv, reverse=True)


def test_coverage_matches_panel(art, panel):
    cov = art("coverage")
    assert cov["iso3"] == panel.iso3
    c0 = panel.col(1990)
    for ind, d in cov["indicators"].items():
        M = np.isfinite(panel.a[ind][:, c0:])
        assert d["n_by_year"] == M.sum(0).tolist()
        assert d["n_obs"] == M.sum(1).tolist()
        assert d["missing_share_panel"] == pytest.approx(1 - M.mean())
        assert d["latest_year"] == latest_year(panel, ind)[0]
        assert d["latest_year_n"] >= 0.9 * d["peak_n"]


def test_hhi_range_and_coverage_claim(art):
    s = art("panel_structure")["series"]["hhi5"]["values"]
    vals = [v for r in s for v in r if v is not None]
    assert 0.2 - 1e-3 <= min(vals) and max(vals) <= 1.0 + 1e-3
    assert len(vals) > 3000


def test_latest_year_rule(art):
    for i in art("indicators")["indicators"]:
        assert i["latest_year_n"] >= 0.9 * art("coverage")["indicators"][i["id"]]["peak_n"]
