import gzip
import json
import re

import pytest

from analytics import narratives
from pipelines.common import CONTRACTS, PUBLIC
from pipelines.validate_artifacts import run as validate_all

pytestmark = pytest.mark.slow


def test_all_artifacts_validate():
    assert validate_all() == []


def test_every_schema_has_artifact_and_budget():
    for sc in CONTRACTS.glob("*.schema.json"):
        f = PUBLIC / sc.name.replace(".schema", "")
        assert f.exists(), sc.name
        assert len(gzip.compress(f.read_bytes())) < 400 * 1024, f.name


def test_no_nan_tokens():
    for f in PUBLIC.glob("*.json"):
        assert not re.search(r"\bNaN\b|\bInfinity\b", f.read_text()), f.name


def test_validation_all_passed(art):
    v = art("validation")
    assert v["all_passed"], [c for c in v["checks"] if not c["passed"]]


def test_meta_vintage_and_licence(art):
    m = art("meta")
    assert re.match(r"\d{4}-\d{2}-\d{2}$", m["vintage"]["wdi_lastupdated"])
    wdi = next(s for s in m["sources"] if s["id"] == "wdi")
    assert wdi["licence"] == "CC BY 4.0" and "World Development Indicators" in wdi["attribution"]
    assert any("IMF" in e["name"] for e in m["excluded_sources"])
    assert set(m["artifact_bytes"]) | {"meta"} == {f.stem for f in PUBLIC.glob("*.json")}
    assert m["counts"] == {"wb_entities": 296, "aggregates": 79, "countries": 217, "indicators": 17}


def test_correlations_carry_not_causal(art):
    c = art("correlations")
    assert "do not show that one variable causes" in c["not_causal"]
    assert len(c["pairs"]) == 45
    for p in c["pairs"]:
        assert p["ci95"][0] <= p["rho"] <= p["ci95"][1] and p["n"] >= 30


def test_no_imf_endpoint_called():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1]
    for f in list((root / "pipelines").rglob("*.py")) + list((root / "analytics").rglob("*.py")):
        t = f.read_text()
        assert "imf.org/external" not in t and "datamapper" not in t.lower()


def test_facts_cover_copy_numbers(art):
    f = art("facts")
    for k, v in f.items():
        if isinstance(v, dict) and "value" in v:
            assert v["value"] is not None and v["tag"]
    assert f["countries"]["value"] == 217


def test_narratives_render_only_from_inputs(art):
    n = art("narratives")
    tpl = {t["id"]: t for t in narratives.TEMPLATES}
    assert {t["id"] for t in n["templates"]} == set(tpl)
    by = {c["iso3"]: c["inputs"] for c in n["countries"]}
    assert len(by) == 217
    assert len(n["examples"]) >= 30
    for e in n["examples"]:
        assert narratives.render(tpl[e["template"]], by[e["iso3"]]) == e["text"]
    # a template with a null required input renders nothing (empty state), never fabricated text
    bad = dict(by["USA"], cagr_1990=None)
    assert narratives.render(tpl["growth_1990"], bad) is None
    # no unresolved placeholder or NaN in any rendered text
    for e in n["examples"]:
        assert "{" not in e["text"] and "nan" not in e["text"].lower()


def test_boundary_table(art):
    b = art("boundaries")
    codes = {r["iso3"] for r in b["rows"]}
    assert {"SSD", "SDN", "XKX", "SRB", "MNE", "CZE", "SVK", "RUS", "HRV", "DEU"} <= codes
    c = {x["iso3"]: x for x in art("countries")["countries"]}
    for r in b["rows"]:
        assert c[r["iso3"]]["territory_flag"] == (r["territory_break_year"] is not None)
    assert art("longrun")["price_basis"] == "maddison_intl_2011"


def test_deterministic_rebuild(art, tmp_path):
    """Re-running the publisher reproduces identical convergence/cluster artifacts (seeded)."""
    from analytics import data, clustering
    p = data.load()
    assert clustering.run(p)["assignments"] == art("clusters")["assignments"]
