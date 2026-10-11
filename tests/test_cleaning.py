"""Ingestion/cleaning accounting, ISO3 validity, aggregate exclusion."""
import pycountry
import pytest

from pipelines.common import WDI

pytestmark = pytest.mark.slow
NONSTD = {"XKX", "CHI"}  # documented in countries.json.nonstandard_iso3


def test_ledger_invariants(ledger):
    assert len(ledger["rows"]) == len(WDI)
    for r in ledger["rows"]:
        assert r["raw_rows"] == r["aggregate_rows"] + r["country_rows"]
        assert r["country_rows"] == r["null_value"] + r["invalid_range"] + r["observed"]
        # the data endpoint returns 266 entities (217 countries + 49 of the 79 listed aggregates) x 66 years (1960..2025)
        assert (r["aggregate_rows"], r["country_rows"]) == (49 * 66, 217 * 66)


def test_entity_counts(ledger, art):
    c = art("countries")
    assert (c["counts"]["raw_entities"], c["counts"]["aggregates"], c["counts"]["countries"]) == (296, 79, 217)
    assert ledger["countries"] == 217


def test_iso3_valid_or_documented(art):
    iso = {x.alpha_3 for x in pycountry.countries}
    c = art("countries")
    codes = [x["iso3"] for x in c["countries"]]
    assert len(set(codes)) == 217 and codes == sorted(codes)
    assert {x for x in codes if x not in iso} == NONSTD == {n["code"] for n in c["nonstandard_iso3"]}


def test_no_aggregate_in_any_analysis(art):
    agg = {a["code"] for a in art("countries")["aggregates"]}
    assert len(agg) == 79 and "WLD" in agg and "EUU" in agg
    codes = set(x["iso3"] for x in art("countries")["countries"])
    assert not agg & codes
    assert not agg & set(art("clusters")["assignments"]["iso3"])
    for b in art("convergence")["beta"]:
        if "points" in b:
            assert not agg & set(b["points"]["iso3"])
    for ind in art("rankings")["indicators"].values():
        for r in ind.values():
            assert not agg & set(r["order"])


def test_reconciliation_published_matches_raw(art, panel):
    import numpy as np
    for r in art("reconciliation")["rows"]:
        assert r["raw_rows"] == r["aggregate_rows"] + r["country_rows"]
        assert r["observed"] == r["pre_1990_trimmed"] + r["published"]
        assert r["observed"] == int(np.isfinite(panel.a[r["indicator"]]).sum())


def test_no_interpolation(art):
    """Published null counts equal raw null counts: nothing is filled."""
    c = art("panel_income")
    rec = {r["indicator"]: r for r in art("reconciliation")["rows"]}
    for k, s in c["series"].items():
        nonnull = sum(v is not None for row in s["values"] for v in row)
        assert nonnull == rec[k]["published"]
