"""Build site/public/data/seedhead/*.json (DR-1) from the published panel values. Runs after pipelines.publish."""
from __future__ import annotations

import base64
import gzip
import hashlib
import json

import numpy as np

from analytics import seedhead as sh
from analytics.data import IDS, Panel, load
from analytics.units import BASIS
from pipelines.common import PUBLIC, SCHEMA_VERSION, write_json
from pipelines.publish import DEC, py

SEED = 20261010
OUT = PUBLIC / "seedhead"


def year_inputs(p: Panel, ind: str, y: int):
    """Countries in rank order for (indicator, year) using the published (rounded) values and populations."""
    v = np.round(p.at(ind, y), DEC.get(ind, 2))
    pop = np.round(p.at("population", y), 0)
    ok = np.isfinite(v) & np.isfinite(pop)
    idx = sorted(np.flatnonzero(ok), key=lambda k: (-v[k], p.iso3[k]))
    nodata = [dict(iso3=p.iso3[k], population=float(pop[k])) for k in range(len(p.iso3)) if not ok[k] and np.isfinite(pop[k])]
    return idx, v, pop, nodata


def one_year(p: Panel, ind: str, y: int, warm: dict | None, edges: list[float] | None = None):
    idx, v, pop, nodata = year_inputs(p, ind, y)
    iso = [p.iso3[k] for k in idx]
    pops = pop[idx]
    counts = sh.counts_for(pops)
    G, own, sites, cf, (rho, dev, cold) = sh.layout(iso, counts, warm=warm)
    assert (np.bincount(own, minlength=len(iso)) == counts).all()
    # median person: ascending by value, first country where cumulative people reaches half
    asc = np.argsort(-np.arange(len(iso)), kind="stable")  # order is descending by value; reverse for ascending
    cum = np.cumsum(pops[asc])
    mi = int(asc[int(np.searchsorted(cum, cum[-1] / 2))])
    vb = np.searchsorted(np.asarray(edges), v[idx], side="right").astype(np.uint8) if edges else np.zeros(len(idx), np.uint8)
    rec = dict(year=int(y), n=len(iso), order=iso, counts=counts.tolist(), area_scale=np.round(pops / (counts * sh.UNIT_PEOPLE), 4).tolist(),
               owner=base64.b64encode(own.astype(np.uint8).tobytes()).decode(), value_bin=base64.b64encode(vb.tobytes()).decode(), slots=int(counts.sum()), people_millions=round(float(pops.sum()) / 1e6, 3),
               no_data=nodata, median_person=dict(iso3=iso[mi], value=float(v[idx[mi]])),
               rank_order=dict(rank_radius_spearman=round(rho, 4), max_radius_deviation=round(dev, 4), solved_cold=bool(cold)),
               connectivity=dict(min=round(float(cf.min()), 4), mean=round(float(cf.mean()), 4), below_95=int((cf < 0.95).sum())))
    return rec, dict(zip(iso, sites))


def build(p: Panel, inds=None, years_override=None) -> dict:
    rk = json.loads((PUBLIC / "rankings.json").read_text())["indicators"]
    disp = {i["id"]: i["display"]["bins"] for i in json.loads((PUBLIC / "indicators.json").read_text())["indicators"]}
    sha = hashlib.sha256((PUBLIC / "panel_income.json").read_bytes()).hexdigest()
    head = dict(schema_version=SCHEMA_VERSION, tags={"layout": "DERIVED"}, lattice=dict(rule="vogel", golden_angle_deg=137.50776, slot_area=1), unit_people=sh.UNIT_PEOPLE, seed=SEED,
                rounding="slots = max(1, floor(population / 1e6 + 0.5)) per country (half-up); population = published panel_income value of that year",
                method="capacity-constrained power assignment on a Vogel lattice (design/sketches/territories.py) with a rank-radius anchor (0.5) and a count-preserving contiguity repair; iterations 600 cold, 200 warm (warm keeps the previous direction, takes the radius from the current rank); layouts below rank-radius Spearman 0.85 are re-solved cold",
                value_bins="value_bin[i] = number of indicators[].display.bins edges <= value of order[i] (0..6); uint8, base64, aligned with order",
                source=dict(panel_income_sha256=sha, population_indicator="population", values_decimals=0))
    sizes = {}
    for ind in inds or IDS:
        keys = rk[ind]
        if ind == "gdppc_ppp":
            years = list(range(1990, keys["latest"]["year"] + 1))
        else:
            years = sorted({r["year"] for r in keys.values()})
        if years_override:
            years = years_override
        recs, warm = [], None
        for y in years:
            rec, sites = one_year(p, ind, y, warm if ind == "gdppc_ppp" else None, disp[ind])
            recs.append(rec)
            warm = sites
        doc = dict(head, indicator=ind, price_basis=BASIS[ind], years=recs)
        write_json(OUT / f"{ind}.json", py(doc))
        sizes[f"{ind}.json"] = len(gzip.compress((OUT / f"{ind}.json").read_bytes(), 9))
        if ind == "gdppc_ppp":
            write_json(OUT / "gdppc_ppp_latest.json", py(dict(doc, years=[recs[-1]])))
            sizes["gdppc_ppp_latest.json"] = len(gzip.compress((OUT / "gdppc_ppp_latest.json").read_bytes(), 9))
    return sizes


def run() -> dict:
    sizes = build(load())
    mp = PUBLIC / "meta.json"
    m = json.loads(mp.read_text())
    m["seedhead_bytes"] = dict(sorted(sizes.items()))
    write_json(mp, m)
    return sizes


if __name__ == "__main__":
    s = run()
    tot = sum(v for k, v in s.items() if k != "gdppc_ppp_latest.json")
    print(json.dumps(s, indent=1))
    print(f"total gzip {tot / 1024:.0f} KB; latest file {s['gdppc_ppp_latest.json'] / 1024:.1f} KB")
