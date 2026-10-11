"""PPP vs nominal separation: the guard raises, and no published result mixes money bases."""
import pytest

from analytics.clustering import FEATURES
from analytics.units import BASIS, MixedBasisError, assert_same_basis


def test_guard_raises_ppp_vs_nominal():
    with pytest.raises(MixedBasisError):
        assert_same_basis("gdppc_ppp", "gdppc_nominal")
    with pytest.raises(MixedBasisError):
        assert_same_basis("gdppc_ppp", "gdppc_const")
    with pytest.raises(MixedBasisError):
        assert_same_basis("gdppc_const", "gdppc_nominal")
    with pytest.raises(MixedBasisError):
        assert_same_basis("gdppc_ppp", "gdppc_maddison")


def test_guard_allows_same_basis_and_non_money():
    assert assert_same_basis("gdppc_ppp", "productivity") == "ppp_constant_intl_2021"
    assert assert_same_basis("gdp_growth", "agr_share") is None
    assert assert_same_basis("gdppc_ppp", "agr_share") == "ppp_constant_intl_2021"


def test_every_money_level_has_basis():
    for k, (_c, _l, unit, _q, basis, kind) in __import__("pipelines.common", fromlist=["WDI"]).WDI.items():
        if kind == "level":
            assert basis is not None, k
        else:
            assert basis is None, k


def test_cluster_features_single_basis():
    bases = {BASIS[f[3]] for f in FEATURES} - {None}
    assert bases == {"ppp_constant_intl_2021"}


def test_published_results_single_basis(art):
    ind = {i["id"]: i for i in art("indicators")["indicators"]}
    for b in art("convergence")["beta"]:
        assert b["price_basis"] == ind[b["indicator"]]["price_basis"]
    for s in art("convergence")["sigma"]:
        assert s["price_basis"] == ind[s["indicator"]]["price_basis"]
    # beta records for PPP and constant-USD are separate records, never pooled
    assert {b["price_basis"] for b in art("convergence")["beta"]} == {"ppp_constant_intl_2021", "constant_usd_2015"}
    assert {b["price_basis"] for b in art("convergence")["beta"] if b["indicator"] == "gdppc_ppp"} == {"ppp_constant_intl_2021"}
    for f in art("clusters")["features"]:
        assert f["price_basis"] in (None, "ppp_constant_intl_2021")
    for pr in art("correlations")["pairs"]:
        assert len(pr["money_bases"]) <= 1
    assert len([i for i in ind.values() if i["price_basis"] == "current_usd"]) == 1


def test_base_year_matches_basis(art):
    for i in art("indicators")["indicators"]:
        if i["price_basis"] and i["price_basis"] != "current_usd":
            assert str(i["base_year"]) == i["price_basis"][-4:]
