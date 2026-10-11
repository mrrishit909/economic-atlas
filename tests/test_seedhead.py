"""DR-1/DR-2: exact slot counts, determinism, same inputs as the readouts."""
import base64
import hashlib
import json

import numpy as np
import pytest
from scipy.stats import spearmanr

from analytics import seedhead as sh
from pipelines.common import PUBLIC


def test_counts_rule_half_up_min_one_order_independent():
    pops = np.array([100_000.0, 499_999.0, 500_000.0, 1_499_999.0, 1_500_000.0, 2_500_000.0, 1.4e9])
    c = sh.counts_for(pops)
    assert c.tolist() == [1, 1, 1, 1, 2, 3, 1400]
    perm = np.random.default_rng(1).permutation(len(pops))
    assert (sh.counts_for(pops[perm]) == c[perm]).all()


def _synthetic():
    rng = np.random.default_rng(5)
    pops = rng.integers(400_000, 40_000_000, 25).astype(float)
    return [f"C{i:02d}" for i in range(25)], sh.counts_for(pops)


def test_layout_exact_counts_and_deterministic():
    iso, c = _synthetic()
    a = sh.layout(iso, c, iters=80)
    b = sh.layout(iso, c, iters=80)
    assert (np.bincount(a[1], minlength=len(c)) == c).all()
    assert a[1].astype(np.uint8).tobytes() == b[1].astype(np.uint8).tobytes()
    assert np.array_equal(a[2], b[2])


def test_warm_start_keeps_counts():
    iso, c = _synthetic()
    _, _, sites, _ = sh.layout(iso, c, iters=80)
    c2 = c.copy()
    c2[3] += 2
    c2[7] -= 1 if c2[7] > 1 else 0
    G, own, *_ = sh.layout(iso, c2, warm=dict(zip(iso, sites)), iters=60)
    assert (np.bincount(own, minlength=len(c2)) == c2).all()


def _files():
    return sorted((PUBLIC / "seedhead").glob("*.json"))


@pytest.mark.slow
def test_slot_counts_equal_rounded_populations(art):
    pan = art("panel_income")
    pop = pan["series"]["population"]["values"]
    ppp = pan["series"]["gdppc_ppp"]["values"]
    assert len(_files()) == 18
    for f in _files():
        d = json.loads(f.read_text())
        for y in d["years"]:
            col = pan["years"].index(y["year"])
            by = {c: pop[k][col] for k, c in enumerate(pan["iso3"])}
            assert y["counts"] == [max(1, int(np.floor(by[c] / 1e6 + 0.5))) for c in y["order"]], (f.name, y["year"])
            assert y["slots"] == sum(y["counts"])
            own = np.frombuffer(base64.b64decode(y["owner"]), dtype=np.uint8)
            assert len(own) == y["slots"]
            assert np.bincount(own, minlength=len(y["order"])).tolist() == y["counts"]
            assert len(set(y["order"])) == y["n"] == len(y["counts"]) == len(y["area_scale"])
            assert abs(y["people_millions"] - sum(by[c] for c in y["order"]) / 1e6) < 0.01
            for a, c, pp in zip(y["area_scale"], y["counts"], [by[c] for c in y["order"]]):
                assert abs(a - pp / (c * 1e6)) < 1e-4
            agg = {a["code"] for a in art("countries")["aggregates"]}
            assert not agg & set(y["order"])
            assert {n["iso3"] for n in y["no_data"]}.isdisjoint(y["order"])


@pytest.mark.slow
def test_layout_inputs_are_the_readout_panel(art):
    """DR-2: order equals rankings (same year) and the files pin the sha256 of panel_income.json."""
    sha = hashlib.sha256((PUBLIC / "panel_income.json").read_bytes()).hexdigest()
    rk = art("rankings")["indicators"]
    for f in _files():
        d = json.loads(f.read_text())
        assert d["source"]["panel_income_sha256"] == sha
        if f.name.endswith("_latest.json"):
            continue
        for y in d["years"]:
            for r in rk[d["indicator"]].values():
                if r["year"] == y["year"]:
                    assert r["order"] == y["order"] and r["n"] == y["n"]
    ppp = json.loads((PUBLIC / "seedhead" / "gdppc_ppp.json").read_text())
    assert [y["year"] for y in ppp["years"]] == list(range(1990, art("indicators")["indicators"][1]["latest_year"] + 1))
    latest = json.loads((PUBLIC / "seedhead" / "gdppc_ppp_latest.json").read_text())
    assert latest["years"] == [ppp["years"][-1]]


@pytest.mark.slow
def test_layout_byte_identical_on_rerun(panel):
    from pipelines import seedhead as sp
    d = json.loads((PUBLIC / "seedhead" / "gdppc_ppp.json").read_text())
    r1, s1 = sp.one_year(panel, "gdppc_ppp", 1990, None)
    r2, _ = sp.one_year(panel, "gdppc_ppp", 1991, s1)
    for new, old in ((r1, d["years"][0]), (r2, d["years"][1])):
        assert json.dumps(sp.py(new), sort_keys=True) == json.dumps(old, sort_keys=True)


@pytest.mark.slow
def test_connectivity_published_and_reported():
    tot = below = 0
    for f in _files():
        if f.name.endswith("_latest.json"):
            continue
        for y in json.loads(f.read_text())["years"]:
            c = y["connectivity"]
            assert 0 < c["min"] <= c["mean"] <= 1
            tot += y["n"]
            below += c["below_95"]
    assert below / tot < 0.01  # contiguity repair leaves under 1 percent of territories below 95 percent connected
    lat = json.loads((PUBLIC / "seedhead" / "gdppc_ppp_latest.json").read_text())["years"][0]
    assert lat["connectivity"]["below_95"] <= 2


@pytest.mark.slow
def test_median_person_and_budget(art):
    ppp = json.loads((PUBLIC / "seedhead" / "gdppc_ppp.json").read_text())
    f = art("facts")
    assert ppp["years"][-1]["median_person"]["iso3"] == f["median_person_iso3"]["value"]
    assert abs(ppp["years"][-1]["median_person"]["value"] - f["median_person_gdppc_ppp"]["value"]) < 1e-9
    assert ppp["years"][0]["median_person"]["iso3"] == f["median_person_iso3_1990"]["value"]
    assert ppp["years"][-1]["slots"] == f["seedhead_slots_latest"]["value"] and ppp["years"][0]["slots"] == f["seedhead_slots_1990"]["value"]
    m = art("meta")["seedhead_bytes"]
    assert m["gdppc_ppp.json"] < 150 * 1024 and m["gdppc_ppp_latest.json"] < 6 * 1024 and max(m.values()) < 400 * 1024
    assert all(v < 30 * 1024 for k, v in m.items() if k != "gdppc_ppp.json")
