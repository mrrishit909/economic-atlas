"""Build every artifact in site/public/data/ from data/interim + analytics (deterministic: fixed seeds, no wall-clock in analytics)."""
from __future__ import annotations

import gzip
import json
import math
import re
from collections import defaultdict

import numpy as np

from analytics import clustering, convergence, correlations, longrun, narratives
from analytics.boundaries import BREAKS, ROWS as BROWS, breaks_in_window
from analytics.data import IDS, Panel, latest_year, load
from analytics.units import BASIS, assert_same_basis
from pipelines import validation
from pipelines.common import EXPORT_IDS, INTERIM, LEDGER, MANIFESTS, PIPELINE_VERSION, PUBLIC, RAW, WDI, YEAR_FIRST, YEAR_PANEL0, write_json

OBS, DER, PRED = "OBSERVED", "DERIVED", "PREDICTED"
DEC = {"gdppc_ppp": 0, "gdppc_const": 0, "gdppc_nominal": 0, "productivity": 0, "population": 0, "hhi5": 4}
PANEL_INCOME = ["gdp_growth", "gdppc_ppp", "gdppc_const", "gdppc_nominal", "productivity", "population"]
PANEL_STRUCT = ["agr_share", "ind_share", "srv_share", "inflation", "trade_open", *EXPORT_IDS, "hhi5"]
ATTR_WDI = "Source: World Bank, World Development Indicators (CC BY 4.0)."
ATTR_OWID = "Source: Bolt and van Zanden, Maddison Project Database 2023 (CC BY 4.0), via Our World in Data."
NOT_CAUSAL = correlations.NOT_CAUSAL


def py(o, nd=None):
    if isinstance(o, dict):
        return {str(k): py(v, nd) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [py(v, nd) for v in o]
    if isinstance(o, np.ndarray):
        return py(o.tolist(), nd)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return None if not math.isfinite(f) else (round(f, nd) if nd is not None else f)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def F(value, unit, tag, note=None):
    d = dict(value=py(value), unit=unit, tag=tag)
    if note:
        d["note"] = note
    return d


def wmeta(code):
    return json.loads((RAW / "wdi" / f"{code}.meta.json").read_text())


def base_year(name: str):
    m = re.search(r"(?:constant|PPP)\s*\(?(?:constant\s+)?(\d{4})", name) or re.search(r"constant (\d{4})", name)
    return int(m.group(1)) if m else None


def panel_art(p: Panel, ids, tags) -> dict:
    c0 = p.col(YEAR_PANEL0)
    years = [int(y) for y in p.years[c0:]]
    ser = {}
    for i in ids:
        nd = DEC.get(i, 2)
        u = {"hhi5": "index 0.2 to 1"}.get(i) or WDI[i][2]
        ser[i] = dict(unit=u, price_basis=BASIS[i], tag=DER if i == "hhi5" else OBS, decimals=nd, values=py(np.round(p.a[i][:, c0:], nd)))
    return dict(schema_version="v1", tags=tags, years=years, iso3=p.iso3, series=ser)


def run() -> dict:
    p = load()
    ledger = json.loads(LEDGER.read_text())
    raw_mf = json.loads((MANIFESTS / "raw_manifest.json").read_text())
    ly_all = {i: latest_year(p, i) for i in IDS}
    E = ly_all["gdppc_ppp"][0]
    Ec = ly_all["gdppc_const"][0]
    out: dict[str, dict] = {}

    # ---------------- indicators
    files = {f.get("code"): f for f in raw_mf["files"] if f.get("kind") == "indicator_data"}
    rows = []
    for i in IDS:
        n = np.isfinite(p.a[i])
        yrs_any = np.where(n.any(0))[0]
        if i == "hhi5":
            rows.append(dict(id=i, wdi_code=None, label="Export concentration, 5 broad groups (HHI)", unit="index, 0.2 (even) to 1 (one group)", quantity="export_concentration", kind="index",
                             price_basis=None, base_year=None, source_org="Derived from the five WDI export-share series (UN Comtrade based)", licence="CC BY 4.0 (derived from WDI)", attribution=ATTR_WDI + " Derived by this project.",
                             tag=DER, wdi_name=None, wdi_lastupdated=None))
        else:
            code, label, unit, qty, basis, kind = WDI[i]
            m = wmeta(code)
            rows.append(dict(id=i, wdi_code=code, label=label, unit=unit, quantity=qty, kind=kind, price_basis=basis, base_year=base_year(m["name"]) if basis else None,
                             source_org=" ".join(m["sourceOrganization"].split())[:400], licence="CC BY 4.0 (WDI dataset)", attribution=ATTR_WDI, tag=OBS, wdi_name=m["name"],
                             wdi_lastupdated=files[code]["lastupdated"]))
        ly, lyn, _ = ly_all[i]
        rows[-1].update(first_year=int(p.years[yrs_any[0]]), last_year=int(p.years[yrs_any[-1]]), latest_year=ly, latest_year_n=lyn, ever_observed_countries=int(n.any(1).sum()))
    # base year must match the declared basis (e.g. constant_usd_2015); fail loudly otherwise
    for r in rows:
        if r["price_basis"] and r["price_basis"] != "current_usd":
            assert str(r["base_year"]) == r["price_basis"][-4:], (r["id"], r["base_year"], r["price_basis"])
    out["indicators"] = dict(schema_version="v1", tags={"indicators": "OBSERVED/DERIVED"}, indicators=rows)

    # ---------------- countries, boundaries
    lr = longrun.load(p.iso3)
    ents = json.loads((RAW / "wdi" / "countries.json").read_text())["rows"]
    aggs = [dict(code=e["id"], name=e["name"]) for e in ents if e["region"]["value"] == "Aggregates"]
    import pycountry
    iso = {c.alpha_3 for c in pycountry.countries}
    nonstd = [dict(code=c, name=str(p.countries["name"][p.iso3.index(c)]), reason=r) for c, r in
              (("XKX", "Kosovo: user-assigned code used by the World Bank; not an ISO 3166-1 alpha-3 code"), ("CHI", "Channel Islands: World Bank code for Jersey and Guernsey together; not an ISO 3166-1 code"))]
    assert {c for c in p.iso3 if c not in iso} == {n["code"] for n in nonstd}, "unexpected non-ISO3 codes"
    out["countries"] = dict(
        schema_version="v1", tags={"countries": OBS},
        countries=[dict(iso3=c, iso2=str(p.countries["iso2"][k]), name=str(p.countries["name"][k]), region=str(p.countries["region"][k]), income_group=str(p.countries["income_group"][k]),
                        income_group_note="Current World Bank classification at retrieval, not historical; label only, never used to split convergence samples",
                        territory_flag=c in BREAKS, in_maddison=c in lr["iso3"]) for k, c in enumerate(p.iso3)],
        aggregates=aggs, counts=dict(raw_entities=len(ents), aggregates=len(aggs), countries=len(p.iso3)), nonstandard_iso3=nonstd)
    first_ppp = {c: (int(p.years[np.where(np.isfinite(p.a["gdppc_const"][k]))[0][0]]) if np.isfinite(p.a["gdppc_const"][k]).any() else None) for k, c in enumerate(p.iso3)}
    wins = [(1990, E), (2000, E), (2010, E), (1960, Ec), (1980, Ec), (2000, Ec)]
    out["boundaries"] = dict(
        schema_version="v1", tags={"rows": DER}, windows=[dict(start=s, end=e, excluded=breaks_in_window(s, e)) for s, e in wins],
        rows=[dict(iso3=r[0], entity=r[1], event=r[2], event_year=r[3], event_evidence="GENERAL_KNOWLEDGE", first_year_observed=first_ppp[r[0]], first_year_evidence="DATA",
                   territory_break_year=r[4], treatment=r[6], sensitivity_only=r[5]) for r in BROWS],
        note="Event years come from general historical knowledge and are not verified against World Bank documentation (UNVERIFIED). First observed years are computed from gdppc_const.")

    # ---------------- panels
    out["panel_income"] = panel_art(p, PANEL_INCOME, {"gdp_growth": OBS, "gdppc_ppp": OBS, "gdppc_const": OBS, "gdppc_nominal": OBS, "productivity": OBS, "population": OBS})
    out["panel_structure"] = panel_art(p, PANEL_STRUCT, {"shares_and_rates": OBS, "hhi5": DER})

    # ---------------- coverage
    c0 = p.col(YEAR_PANEL0)
    years = [int(y) for y in p.years[c0:]]
    regions = sorted(set(p.countries["region"].to_list()))
    cov = {}
    for i in IDS:
        M = p.a[i][:, c0:]
        ok = np.isfinite(M)
        first = [int(years[np.where(r)[0][0]]) if r.any() else None for r in ok]
        last = [int(years[np.where(r)[0][-1]]) if r.any() else None for r in ok]
        ly, lyn, peak = ly_all[i]
        cov[i] = dict(n_by_year=ok.sum(0).tolist(), first_year=first, last_year=last, n_obs=ok.sum(1).tolist(), missing_share_panel=float(1 - ok.mean()),
                      latest_year=ly, latest_year_n=lyn, peak_n=peak, countries_ever=int(ok.any(1).sum()))
    reg_col = np.array(p.countries["region"].to_list())
    mbr = [dict(region=r, n_countries=int((reg_col == r).sum()), share_missing={i: float(1 - np.isfinite(p.a[i][reg_col == r][:, c0:]).mean()) for i in IDS}) for r in regions]
    rule = ("Latest year per indicator = the latest year (from 2010) with a country count of at least 90 percent of that indicator's peak yearly count over 2010 to 2022. "
            "Missing values are never interpolated; rankings and statistics use only countries with data and publish n.")
    out["coverage"] = dict(schema_version="v1", tags={"indicators": DER, "missing_by_region": DER}, years=years, iso3=p.iso3, indicators=cov, missing_by_region=mbr, rule=rule)

    # ---------------- rankings
    snaps = [1990, 2000, 2010, 2020]
    rk = {}
    for i in IDS:
        rk[i] = {}
        for key, y in [(str(s), s) for s in snaps] + [("latest", ly_all[i][0])]:
            v = p.at(i, y)
            idx = [k for k in range(len(p.iso3)) if np.isfinite(v[k])]
            if len(idx) < 30:
                continue
            idx.sort(key=lambda k: (-v[k], p.iso3[k]))
            rk[i][key] = dict(n=len(idx), year=int(y), order=[p.iso3[k] for k in idx])
    out["rankings"] = dict(schema_version="v1", tags={"indicators": DER}, snapshot_years=snaps, ordering="Descending by value; ties by iso3; only countries with a value that year (n published). Aggregates never ranked.", indicators=rk)

    # ---------------- convergence
    beta = []
    for ind, ws, end in (("gdppc_ppp", (1990, 2000, 2010), E), ("gdppc_const", (1960, 1980, 2000), Ec)):
        for s in ws:
            beta += convergence.beta_records(p, ind, s, end)
    sigma = convergence.sigma_records(p, "gdppc_ppp", 1990, E) + convergence.sigma_records(p, "gdppc_const", 1960, Ec)
    out["convergence"] = dict(
        schema_version="v1", tags={"beta": DER, "sigma": DER},
        method=("Absolute beta-convergence: regress 100*(ln y_end - ln y_start)/T (percent per year) on ln y_start across countries with both endpoints; HC3 standard errors, t(n-2) 95% CI, "
                "plus a seeded case-bootstrap percentile CI (2000 draws). Samples: primary (excludes countries with a territory break in the window), sensitivity_all (includes them), "
                "initial-income terciles, and a population-weighted fit (initial population). Sigma: population SD of ln income across countries. PPP and constant-USD are estimated separately and never pooled."),
        copy=dict(not_causal="A negative slope means poorer countries grew faster on average in this window. It does not show that initial income causes faster growth, or that any single country will catch up.",
                  absolute_only="Only absolute (unconditional) convergence is estimated. Conditional convergence needs controls (investment, schooling, institutions) that this atlas does not include.",
                  interpretation="Tercile fits split on initial income (the regressor), not on current income or current World Bank income group, to avoid selecting on the outcome; they have fewer observations and wide intervals."),
        beta=beta, sigma=sigma)

    # ---------------- clusters
    clu = clustering.run(p)
    out["clusters"] = dict(schema_version="v1", tags={"features": DER, "assignments": PRED, "stability": DER}, **clu)

    # ---------------- correlations
    cor = correlations.run(p)
    out["correlations"] = dict(schema_version="v1", tags={"pairs": DER}, **cor)

    # ---------------- narratives
    b2000 = next(b for b in beta if b["id"] == f"gdppc_ppp_2000_{E}_primary")
    nin = narratives.country_inputs(p, b2000, clu)
    ex_iso = ["USA", "CHN", "IND", "NGA", "POL", "KOR"]
    examples = []
    for e in nin:
        if e["iso3"] in ex_iso:
            for t in narratives.TEMPLATES:
                txt = narratives.render(t, e["inputs"])
                if txt:
                    examples.append(dict(iso3=e["iso3"], template=t["id"], text=txt))
    out["narratives"] = dict(
        schema_version="v1", tags={"countries": DER, "templates": DER},
        templates=[dict(id=t["id"], text=t["text"], requires=t["requires"]) for t in narratives.TEMPLATES], periods=[[y, E] for y in (1990, 2000, 2010)],
        countries=py(nin, 4), examples=examples,
        rule="Copy is rendered only from the numeric inputs in `countries[].inputs` with the placeholder syntax {key|fmt} (fmt: n0, d1, d2, d3, s1). A template with any null required input is not shown. "
             "Cross-country differences shown in a comparison are simple subtractions or ratios of two published inputs.")

    # ---------------- longrun
    out["longrun"] = dict(schema_version="v1", tags={"values": OBS, "sigma": DER}, attribution=ATTR_OWID, price_basis="maddison_intl_2011", unit="international-$ in 2011 prices (Maddison Project 2023)",
                          benchmark_years=longrun.BENCH, iso3=lr["iso3"], values=lr["values"], sigma=dict(years=longrun.BENCH, sd_log=py(lr["sd"], 4), n=lr["n"]), historic_entities=lr["hist"],
                          note="Maddison dollars (2011 prices) are a different basis from WDI PPP (2021 prices) and are never combined with WDI. Early benchmark years cover far fewer countries (n per year in sigma.n); borders are Maddison's.")

    # ---------------- reconciliation
    rrows, tot = [], defaultdict(int)
    for r in ledger["rows"]:
        ind = r["indicator"]
        pub = int(np.isfinite(p.a[ind][:, p.col(YEAR_PANEL0):]).sum())
        trimmed = int(np.isfinite(p.a[ind][:, :p.col(YEAR_PANEL0)]).sum())
        rrows.append(dict(indicator=ind, wdi_code=r["wdi_code"], raw_rows=r["raw_rows"], aggregate_rows=r["aggregate_rows"], country_rows=r["country_rows"], null_value=r["null_value"] + r["invalid_range"],
                          observed=r["observed"], pre_1990_trimmed=trimmed, published=pub, sha256=files[r["wdi_code"]]["sha256"], lastupdated=files[r["wdi_code"]]["lastupdated"]))
        for k in ("raw_rows", "aggregate_rows", "country_rows", "observed"):
            tot[k] += r[k]
        tot["published"] += pub
    for r in rrows:
        assert r["observed"] == r["pre_1990_trimmed"] + r["published"], r["indicator"]
    out["reconciliation"] = dict(
        schema_version="v1", tags={"rows": OBS},
        invariants=["raw_rows = aggregate_rows + country_rows", "country_rows = null_value + observed (null_value includes rows rejected by range rules, counted in cleaning_ledger.json)", "observed = pre_1990_trimmed + published"],
        rows=rrows, totals=dict(tot))

    # ---------------- facts (single source for site copy numbers)
    ppp = p.at("gdppc_ppp", E)
    pm = np.isfinite(ppp)
    pv = np.sort(ppp[pm])
    bk = lambda s: next(b for b in beta if b["id"] == s)
    b90, bc60 = bk(f"gdppc_ppp_1990_{E}_primary"), bk(f"gdppc_const_1960_{Ec}_primary")
    bw90 = bk(f"gdppc_ppp_1990_{E}_pop_weighted")
    sg = {s["id"]: s for s in sigma}
    su, sw = sg[f"gdppc_ppp_1990_{E}_unbalanced"], sg[f"gdppc_ppp_1990_{E}_pop_weighted"]
    pop_latest = np.nansum(p.at("population", ly_all["population"][0]))
    miss_all = 1 - np.mean([np.isfinite(p.a[i][:, c0:]).mean() for i in IDS])
    lr_m = lr["M"]
    ratio = lambda j: float(np.nanmax(lr_m[:, j]) / np.nanmin(lr_m[:, j]))
    facts = dict(
        wb_entities=F(len(ents), "entities", OBS), aggregates=F(len(aggs), "entities", OBS), countries=F(len(p.iso3), "countries", OBS), indicators=F(len(IDS), "series", DER),
        year_first=F(YEAR_PANEL0, "year", OBS), year_last=F(int(p.years[-1]), "year", OBS),
        gdppc_ppp_countries_latest=F(int(pm.sum()), "countries", OBS), gdppc_ppp_latest_year=F(E, "year", OBS),
        gdppc_ppp_top_value=F(pv[-1], "constant 2021 international $", OBS), gdppc_ppp_median=F(np.median(pv), "constant 2021 international $", DER),
        gdppc_ppp_p90_p10_ratio=F(np.percentile(pv, 90) / np.percentile(pv, 10), "ratio", DER), gdppc_ppp_bottom_value=F(pv[0], "constant 2021 international $", OBS),
        world_pop_billion_latest=F(pop_latest / 1e9, "billion persons", DER, "sum over the 217 countries, not the WB World aggregate"),
        beta_ppp_1990_beta=F(b90["beta"], "pp per year per ln unit", DER), beta_ppp_1990_ci_low=F(b90["ci95"][0], "pp per year per ln unit", DER), beta_ppp_1990_ci_high=F(b90["ci95"][1], "pp per year per ln unit", DER),
        beta_ppp_1990_n=F(b90["n"], "countries", DER), beta_ppp_1990_popweighted=F(bw90["beta"], "pp per year per ln unit", DER),
        beta_const_1960_beta=F(bc60["beta"], "pp per year per ln unit", DER), beta_const_1960_ci_low=F(bc60["ci95"][0], "pp per year per ln unit", DER), beta_const_1960_ci_high=F(bc60["ci95"][1], "pp per year per ln unit", DER),
        beta_const_1960_n=F(bc60["n"], "countries", DER),
        sigma_ppp_1990=F(su["sd_log"][0], "sd of ln income", DER), sigma_ppp_latest=F(su["sd_log"][-1], "sd of ln income", DER),
        sigma_ppp_popweighted_1990=F(sw["sd_log"][0], "sd of ln income", DER), sigma_ppp_popweighted_latest=F(sw["sd_log"][-1], "sd of ln income", DER),
        cluster_k=F(clu["chosen_k"], "groups", PRED), cluster_silhouette=F(next(s["silhouette"] for s in clu["k_scan"] if s["k"] == clu["chosen_k"]), "silhouette", DER),
        cluster_stability_ari=F(clu["stability"]["seed_ari_mean"], "ARI", DER), cluster_hier_ari=F(clu["hierarchical"]["ari_vs_kmeans"], "ARI", DER),
        cluster_complete_cases=F(clu["inclusion"]["complete_cases"], "countries", DER), corr_pairs=F(len(cor["pairs"]), "pairs", DER),
        hhi5_countries_latest=F(ly_all["hhi5"][1], "countries", DER, f"year {ly_all['hhi5'][0]}"), cells_missing_pct_panel=F(100 * miss_all, "percent", DER, "mean over the 17 series, 217 countries, 1990 to last year"),
        territory_flagged_countries=F(len(BREAKS), "countries", DER),
        longrun_gdppc_ratio_top_bottom_1820=F(ratio(0), "ratio", DER, f"max/min over {lr['n'][0]} countries with data"), longrun_gdppc_ratio_top_bottom_2022=F(ratio(len(longrun.BENCH) - 1), "ratio", DER, f"max/min over {lr['n'][-1]} countries"))
    out["facts"] = dict(schema_version="v1", tags={"facts": "OBSERVED/DERIVED/PREDICTED"}, **facts, strings=dict(
        title="The World, Explained Through Economic Forces", attribution_wdi=ATTR_WDI, attribution_owid=ATTR_OWID,
        vintage_label=f"World Bank WDI vintage {files['NY.GDP.PCAP.PP.KD']['lastupdated']}, retrieved {raw_mf['retrieved_at'][:10]}",
        not_causal=NOT_CAUSAL, not_advice="Educational use only. Not investment, policy or economic advice.",
        ppp_vs_nominal="PPP (constant 2021 international dollars), constant 2015 US dollars and current US dollars are different measures. The atlas never compares them with each other.",
        hhi_caveat="The export concentration index uses only five broad merchandise groups, so it understates product-level concentration.",
        imf_excluded="IMF World Economic Outlook data is not used: its terms prohibit automated bulk download without written permission."))

    # ---------------- validation
    out["validation"] = validation.run(p, out, beta, clu)

    # ---------------- meta (last: needs sizes)
    out["meta"] = dict(
        schema_version="v1", tags={"vintage": OBS, "counts": DER}, pipeline_version=PIPELINE_VERSION, retrieved_at=raw_mf["retrieved_at"],
        vintage=dict(wdi_lastupdated=files["NY.GDP.PCAP.PP.KD"]["lastupdated"], wdi_source_id="2", owid_maddison_last_updated="2024-04-26",
                     text=f"World Bank WDI as last updated {files['NY.GDP.PCAP.PP.KD']['lastupdated']}, retrieved {raw_mf['retrieved_at']}. WDI revises history with each release."),
        years=dict(first=YEAR_PANEL0, last=int(p.years[-1]), fetch_first=YEAR_FIRST), counts=dict(wb_entities=len(ents), aggregates=len(aggs), countries=len(p.iso3), indicators=len(IDS)),
        sources=[dict(id="wdi", publisher="The World Bank", dataset="World Development Indicators", url="https://api.worldbank.org/v2/", licence="CC BY 4.0", licence_url="https://datacatalog.worldbank.org/search/dataset/0037712",
                      attribution=ATTR_WDI, role="all indicators except the long-run series"),
                 dict(id="owid_maddison", publisher="Our World in Data / Maddison Project (Bolt and van Zanden)", dataset="GDP per capita, Maddison Project Database 2023", url="https://ourworldindata.org/grapher/gdp-per-capita-maddison",
                      licence="CC BY 4.0 (origin record of the Maddison series, per OWID metadata)", licence_url="https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/maddison-project-database-2023", attribution=ATTR_OWID, role="long-run context only")],
        excluded_sources=[dict(name="IMF World Economic Outlook", reason="Automated bulk download requires written permission (copyright@imf.org); no IMF endpoint is called.")],
        latest_year_rule=dict(text=rule, peak_window=[2010, 2022], min_share_of_peak=0.9),
        assumptions=["Aggregates are identified by region == 'Aggregates' in the World Bank country list and excluded from all analysis.",
                     "No interpolation: a missing country-year stays null. Rankings and statistics use only countries with data.",
                     "Convergence is absolute (unconditional); correlations are descriptive; clusters are unsupervised labels. None is causal.",
                     "Income groups are the current World Bank classification at retrieval.",
                     "hhi5 is a 5-group export concentration index (DERIVED) that understates product-level concentration."],
        disclaimers=["Educational use only. Not investment, policy or economic advice.", "A dated snapshot of WDI, not a live feed; WDI revises history.", "Latest-year values can be provisional estimates.",
                     "Not sponsored, endorsed or approved by the World Bank, Our World in Data or the Maddison Project."],
        artifact_tags={k: ("OBSERVED" if k.startswith("panel") or k in ("countries", "reconciliation") else "DERIVED") for k in out}, artifact_bytes={})
    sizes = {}
    for name, obj in out.items():
        if name != "meta":
            write_json(PUBLIC / f"{name}.json", py(obj))
            sizes[name] = len(gzip.compress((PUBLIC / f"{name}.json").read_bytes(), 9))
    out["meta"]["artifact_bytes"] = sizes
    write_json(PUBLIC / "meta.json", py(out["meta"]))
    sizes["meta"] = len(gzip.compress((PUBLIC / "meta.json").read_bytes(), 9))
    return sizes


if __name__ == "__main__":
    s = run()
    print(json.dumps(s, indent=1))
    print("max gzip KB:", max(s.values()) / 1024)
