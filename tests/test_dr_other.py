"""DR-3..DR-8."""
import numpy as np
import pytest
from scipy.stats import spearmanr

from analytics import narratives

pytestmark = pytest.mark.slow


def test_dr3_facts(art):
    f = art("facts")
    assert f["gdppc_ppp_top_bottom_ratio"]["value"] == pytest.approx(f["gdppc_ppp_top_value"]["value"] / f["gdppc_ppp_bottom_value"]["value"], rel=1e-3)
    assert f["gdppc_ppp_nodata_countries"]["value"] + f["gdppc_ppp_countries_latest"]["value"] == 217
    assert 7.5 < f["gdppc_ppp_people_with_data_billion"]["value"] + f["gdppc_ppp_nodata_people_billion"]["value"] < 9
    assert f["gdppc_ppp_top_iso3"]["value"] != f["gdppc_ppp_bottom_iso3"]["value"]
    assert 0.9 < f["ppp_const_rank_rho"]["value"] <= 1


def test_dr4_values_reproduce_rho(art):
    c = art("correlations")
    assert len(c["iso3"]) == 217 and set(c["values"]) == set(c["indicators"]) and set(c["transforms"]) == set(c["values"])
    for p in c["pairs"]:
        a = np.array([np.nan if v is None else v for v in c["values"][p["a"]]])
        b = np.array([np.nan if v is None else v for v in c["values"][p["b"]]])
        m = np.isfinite(a) & np.isfinite(b)
        assert m.sum() == p["n"]
        assert spearmanr(a[m], b[m])[0] == pytest.approx(p["rho"], abs=1e-5)


def test_dr5_ward_matching(art):
    c = art("clusters")
    h, a = c["hierarchical"], c["assignments"]
    assert len(h["labels_matched"]) == len(a["cluster"]) == len(a["silhouette"]) == len(a["iso3"])
    assert h["disagree_count"] == sum(x != y for x, y in zip(h["labels_matched"], a["cluster"]))
    assert set(h["labels_matched"]) <= set(range(c["chosen_k"]))
    # matching is the best of all permutations
    import itertools
    k = c["chosen_k"]
    best = max(sum(perm[w] == m for w, m in zip(h["labels"], a["cluster"])) for perm in itertools.permutations(range(k)))
    assert len(a["cluster"]) - h["disagree_count"] == best


def test_dr6_vcov(art):
    for b in art("convergence")["beta"]:
        v = b["vcov_hc3"]
        assert v[0][1] == pytest.approx(v[1][0], rel=1e-9)
        assert v[1][1] == pytest.approx(b["se_hc3"] ** 2, rel=1e-9)
        assert np.linalg.eigvalsh(np.array(v)).min() > 0
        if "points" in b:
            xs = b["points"]["x"]
            assert b["x_domain"] == [pytest.approx(min(xs)), pytest.approx(max(xs))]
            assert len(b["points"]["population_start"]) == len(xs) and min(b["points"]["population_start"]) > 0


def test_dr7_display_rules(art):
    for i in art("indicators")["indicators"]:
        d = i["display"]
        assert len(d["bins"]) == 6 and all(x < y for x, y in zip(d["bins"], d["bins"][1:]))
        assert len(d["edge_labels"]) == 6 and d["core_reads"].startswith("highest ")
        assert d["indexable"] == (i["price_basis"] is not None or i["id"] == "population")
        if d["scale"] == "diverging":
            assert d["bins"] == [-x for x in reversed(d["bins"])]
    assert {i["id"]: i["display"]["scale"] for i in art("indicators")["indicators"]}["gdp_growth"] == "diverging"


def test_dr8_pair_templates(art):
    n = art("narratives")
    tpl = {t["id"]: t for t in narratives.PAIR_TEMPLATES}
    assert set(tpl) == {t["id"] for t in n["pair_templates"]} == {"compare_level", "compare_growth_1990", "compare_growth_2000", "compare_growth_2010", "compare_index_2000"}
    by = {c["iso3"]: c["inputs"] for c in n["countries"]}
    assert len({(e["a"], e["b"]) for e in n["pair_examples"]}) >= 3
    for e in n["pair_examples"]:
        assert narratives.render_pair(tpl[e["template"]], by[e["a"]], by[e["b"]]) == e["text"]
        assert "{" not in e["text"] and "nan" not in e["text"].lower()
    # difference is a plain subtraction of two published inputs
    t = tpl["compare_growth_2000"]
    a, b = by["USA"], by["CHN"]
    assert f"{a['cagr_2000'] - b['cagr_2000']:+.1f}" in narratives.render_pair(t, a, b)
    assert narratives.render_pair(t, dict(a, cagr_2000=None), b) is None
    # PPP only: no pair template names a non-PPP key
    for t in n["pair_templates"]:
        assert not any("gdppc_const" in r or "gdppc_nominal" in r for r in t["requires"]) and "gdppc_const" not in t["text"] and "gdppc_nominal" not in t["text"]
