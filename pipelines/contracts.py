"""Generate JSON Schemas (draft 2020-12) for every published artifact into data/contracts/*.schema.json.

Contract-first: the site is designed against these files. Every artifact carries schema_version "v1" and a `tags` map
(field group -> honesty tag; OBSERVED, DERIVED, PREDICTED, optionally combined with "/"). SIMULATED/SYNTHETIC are valid tags but unused.
"""
from __future__ import annotations

import json

from pipelines.common import CONTRACTS, EXPORT_IDS, WDI

N, I, S, B = {"type": "number"}, {"type": "integer"}, {"type": "string"}, {"type": "boolean"}
NN = {"type": ["number", "null"]}
SN = {"type": ["string", "null"]}
TAG_RE = "^(OBSERVED|DERIVED|PREDICTED|SIMULATED|SYNTHETIC)(/(OBSERVED|DERIVED|PREDICTED|SIMULATED|SYNTHETIC))*$"
TAG = {"type": "string", "pattern": TAG_RE}
TAGS = {"type": "object", "minProperties": 1, "additionalProperties": TAG}
BASIS = {"type": ["string", "null"], "pattern": r"^(current_usd|constant_usd_[0-9]{4}|ppp_constant_intl_[0-9]{4}|maddison_intl_2011)$"}
ISO3 = {"type": "string", "pattern": "^[A-Z]{3}$"}
OBJ = {"type": "object"}
IDS = list(WDI) + ["hhi5"]


def arr(item, n=None, lo=None):
    d = {"type": "array", "items": item}
    if n is not None:
        d["minItems"] = d["maxItems"] = n
    elif lo is not None:
        d["minItems"] = lo
    return d


def obj(props: dict, req: list | None = None, extra: bool = True) -> dict:
    return {"type": "object", "properties": props, "required": req if req is not None else list(props), "additionalProperties": extra}


def top(name: str, props: dict, req: list | None = None) -> dict:
    p = {"schema_version": {"const": "v1"}, "tags": TAGS, **props}
    r = ["schema_version", "tags"] + (req if req is not None else list(props))
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "title": name, **obj(p, r)}


def tv(v):
    """A tagged scalar fact: {value, unit, tag, note?}."""
    return obj({"value": v, "unit": S, "tag": TAG, "note": S}, ["value", "unit", "tag"])


def panel(ids):
    """Country-major matrix per indicator: values[country][year], null = not observed."""
    ser = obj({"unit": S, "price_basis": BASIS, "tag": TAG, "decimals": I, "values": arr(arr(NN))})
    return {"years": arr(I, lo=30), "iso3": arr(ISO3, 217), "series": obj({i: ser for i in ids})}


CI = arr(N, 2)
BETA = obj({
    "id": S, "indicator": S, "price_basis": BASIS, "tag": TAG, "sample": {"enum": ["primary", "sensitivity_all", "tercile_low", "tercile_mid", "tercile_high", "pop_weighted", "pop_weighted_ex_chn_ind"]},
    "start": I, "end": I, "n": I, "beta": N, "se_hc3": N, "ci95": CI, "ci95_boot": CI, "intercept": N, "r2": N, "p_value": N,
    "half_life_years": NN, "excluded_territory_changes": arr(ISO3), "dropped_no_start_data": I,
    "vcov_hc3": arr(arr(N, 2), 2), "x_domain": arr(N, 2),
    "points": obj({"iso3": arr(ISO3), "x": arr(N), "y": arr(N), "weight": arr(NN), "population_start": arr(N)}, ["iso3", "x", "y", "population_start"])}, req=[
    "id", "indicator", "price_basis", "tag", "sample", "start", "end", "n", "beta", "se_hc3", "ci95", "ci95_boot", "intercept", "r2", "p_value", "half_life_years",
    "excluded_territory_changes", "dropped_no_start_data", "vcov_hc3", "x_domain"])
SIGMA = obj({"id": S, "indicator": S, "price_basis": BASIS, "tag": TAG, "sample": {"enum": ["unbalanced", "balanced", "pop_weighted"]},
             "years": arr(I, lo=2), "sd_log": arr(NN), "n": arr(I), "definition": S})
NARR_IN = obj({k: NN for k in ["gdppc_ppp_latest", "gdppc_ppp_rank", "gdppc_ppp_n", "growth_cagr_1990", "growth_cagr_2000", "growth_cagr_2010", "growth_resid_2000"]}, req=[])

SCHEMAS = {
    "meta": top("meta", {
        "pipeline_version": S, "retrieved_at": S, "vintage": obj({"wdi_lastupdated": S, "wdi_source_id": S, "owid_maddison_last_updated": S, "text": S}),
        "years": obj({"first": I, "last": I, "fetch_first": I}),
        "counts": obj({"wb_entities": I, "aggregates": I, "countries": I, "indicators": I}),
        "sources": arr(obj({"id": S, "publisher": S, "dataset": S, "url": S, "licence": S, "licence_url": S, "attribution": S, "role": S}), lo=2),
        "excluded_sources": arr(obj({"name": S, "reason": S}), lo=1),
        "latest_year_rule": obj({"text": S, "peak_window": arr(I, 2), "min_share_of_peak": N}),
        "assumptions": arr(S, lo=1), "disclaimers": arr(S, lo=1), "artifact_tags": OBJ, "artifact_bytes": OBJ, "seedhead_bytes": OBJ}),
    "facts": top("facts", {
        **{k: tv(N) for k in [
            "wb_entities", "aggregates", "countries", "indicators", "year_first", "year_last", "gdppc_ppp_countries_latest",
            "gdppc_ppp_latest_year", "gdppc_ppp_top_value", "gdppc_ppp_median", "gdppc_ppp_p90_p10_ratio", "gdppc_ppp_bottom_value",
            "world_pop_billion_latest", "beta_ppp_1990_beta", "beta_ppp_1990_ci_low", "beta_ppp_1990_ci_high", "beta_ppp_1990_n", "beta_ppp_1990_popweighted", "beta_ppp_1990_popweighted_ci_low", "beta_ppp_1990_popweighted_ci_high", "beta_ppp_1990_popweighted_ex_chn_ind", "beta_ppp_1990_popweighted_chn_ind_weight_pct",
            "beta_const_1960_beta", "beta_const_1960_ci_low", "beta_const_1960_ci_high", "beta_const_1960_n",
            "sigma_ppp_1990", "sigma_ppp_latest", "sigma_ppp_popweighted_1990", "sigma_ppp_popweighted_latest",
            "cluster_k", "cluster_silhouette", "cluster_stability_ari", "cluster_hier_ari", "cluster_complete_cases",
            "corr_pairs", "hhi5_countries_latest", "cells_missing_pct_panel", "territory_flagged_countries",
            "gdppc_ppp_top_bottom_ratio", "gdppc_ppp_people_with_data_billion", "gdppc_ppp_nodata_countries", "gdppc_ppp_nodata_people_billion", "median_person_gdppc_ppp",
            "median_person_gdppc_ppp_1990", "seedhead_slots_1990", "seedhead_slots_latest", "ppp_const_rank_rho", "longrun_balanced_n", "longrun_gdppc_ratio_balanced_1820", "longrun_gdppc_ratio_balanced_2022"]},
        **{k: tv(S) for k in ["gdppc_ppp_top_iso3", "gdppc_ppp_bottom_iso3", "median_person_iso3", "median_person_iso3_1990"]},
        "strings": obj({k: S for k in ("title", "attribution_wdi", "attribution_owid", "vintage_label", "not_causal", "not_advice", "ppp_vs_nominal", "hhi_caveat", "imf_excluded")})}),
    "indicators": top("indicators", {
        "indicators": arr(obj({
            "id": {"enum": IDS}, "wdi_code": SN, "label": S, "unit": S, "quantity": S, "kind": {"enum": ["rate", "level", "share", "count", "index"]}, "price_basis": BASIS,
            "base_year": {"type": ["integer", "null"]}, "source_org": S, "licence": S, "attribution": S, "tag": TAG, "wdi_name": SN, "wdi_lastupdated": SN,
            "first_year": I, "last_year": I, "latest_year": I, "latest_year_n": I, "ever_observed_countries": I,
            "display": obj({"scale": {"enum": ["log", "linear", "diverging", "asinh"]}, "bins": arr(N, 6), "edge_labels": arr(S, 6), "short_label": S, "indexable": B,
                            "core_reads": S, "bins_rule": S, "pooled_years": arr(I, 2), "pooled_n": I})}), 17)}),
    "countries": top("countries", {
        "countries": arr(obj({"iso3": ISO3, "iso2": SN, "name": S, "region": S, "income_group": S, "income_group_note": S, "territory_flag": B, "in_maddison": B}), 217),
        "aggregates": arr(obj({"code": S, "name": S}), lo=1),
        "counts": obj({"raw_entities": I, "aggregates": I, "countries": I}),
        "nonstandard_iso3": arr(obj({"code": S, "name": S, "reason": S}))}),
    "boundaries": top("boundaries", {
        "rows": arr(obj({"iso3": S, "entity": S, "event": S, "event_year": I, "event_evidence": {"const": "GENERAL_KNOWLEDGE"}, "first_year_observed": {"type": ["integer", "null"]},
                         "first_year_evidence": {"const": "DATA"}, "territory_break_year": {"type": ["integer", "null"]}, "treatment": S, "sensitivity_only": B}), lo=8),
        "windows": arr(obj({"start": I, "end": I, "excluded": arr(S)})), "note": S}),
    "panel_income": top("panel_income", panel(["gdp_growth", "gdppc_ppp", "gdppc_const", "gdppc_nominal", "productivity", "population"])),
    "panel_structure": top("panel_structure", panel(["agr_share", "ind_share", "srv_share", "inflation", "trade_open", *EXPORT_IDS, "hhi5"])),
    "coverage": top("coverage", {
        "years": arr(I, lo=30), "iso3": arr(ISO3, 217),
        "indicators": obj({i: obj({"n_by_year": arr(I), "first_year": arr({"type": ["integer", "null"]}), "last_year": arr({"type": ["integer", "null"]}),
                                   "n_obs": arr(I), "missing_share_panel": N, "latest_year": I, "latest_year_n": I, "peak_n": I, "countries_ever": I}) for i in IDS}),
        "missing_by_region": arr(obj({"region": S, "n_countries": I, "share_missing": obj({i: N for i in IDS})})),
        "rule": S}),
    "rankings": top("rankings", {
        "snapshot_years": arr(I, lo=2),
        "ordering": S,
        "indicators": obj({i: {"type": "object", "additionalProperties": obj({"n": I, "year": I, "order": arr(ISO3)})} for i in IDS})}),
    "convergence": top("convergence", {
        "method": S, "copy": obj({"not_causal": S, "absolute_only": S, "interpretation": S}),
        "beta": arr(BETA, lo=7), "sigma": arr(SIGMA, lo=3)}),
    "clusters": top("clusters", {
        "method": S, "features": arr(obj({"id": S, "label": S, "transform": S, "source": S, "mean": N, "sd": N, "price_basis": BASIS})),
        "feature_window": obj({"level": arr(I, 2), "growth": arr(I, 2), "min_obs": I}),
        "inclusion": obj({"complete_cases": I, "countries": I, "excluded": arr(obj({"iso3": ISO3, "missing": arr(S)}))}),
        "k_scan": arr(obj({"k": I, "silhouette": N, "inertia": N, "stability_ari": N, "min_cluster_size": I}), lo=5),
        "chosen_k": I, "choice_rule": S, "seeds": obj({"n": I, "base": I}),
        "stability": obj({"seed_ari_mean": N, "seed_ari_min": N, "bootstrap_ari_mean": N, "bootstrap_reps": I}),
        "hierarchical": obj({"linkage": S, "cophenetic_corr": N, "ari_vs_kmeans": N, "labels": arr(I), "labels_matched": arr(I), "disagree_count": I, "match_rule": S, "leaf_order": arr(ISO3)}),
        "clusters": arr(obj({"id": I, "size": I, "centroid": OBJ, "centroid_z": OBJ, "signature": S, "members": arr(ISO3)})),
        "assignments": obj({"iso3": arr(ISO3), "cluster": arr(I), "silhouette": arr(N)}),
        "tag_detail": S}),
    "correlations": top("correlations", {
        "method": S, "window": arr(I, 2), "not_causal": S, "indicators": arr(S, lo=5),
        "pairs": arr(obj({"a": S, "b": S, "n": I, "rho": N, "ci95": CI, "p_value": N, "money_bases": arr(S)}), lo=10),
        "iso3": arr(ISO3, 217), "values": OBJ, "transforms": OBJ}),
    "narratives": top("narratives", {
        "templates": arr(obj({"id": S, "text": S, "requires": arr(S)}), lo=4),
        "periods": arr(arr(I, 2)),
        "countries": arr(obj({"iso3": ISO3, "inputs": OBJ}), 217),
        "examples": arr(obj({"iso3": ISO3, "template": S, "text": S}), lo=3), "rule": S,
        "pair_templates": arr(obj({"id": S, "text": S, "requires": arr(S)}), lo=5),
        "pair_examples": arr(obj({"a": ISO3, "b": ISO3, "template": S, "text": S}), lo=15), "pair_rule": S}),
    "longrun": top("longrun", {
        "attribution": S, "price_basis": {"const": "maddison_intl_2011"}, "unit": S, "benchmark_years": arr(I, lo=5),
        "iso3": arr(ISO3), "values": arr(arr(NN)), "sigma": obj({"years": arr(I), "sd_log": arr(NN), "n": arr(I)}),
        "historic_entities": arr(obj({"entity": S, "code": S, "values": arr(NN), "note": S})), "note": S}),
    "reconciliation": top("reconciliation", {
        "invariants": arr(S, lo=2),
        "rows": arr(obj({"indicator": S, "wdi_code": S, "raw_rows": I, "aggregate_rows": I, "country_rows": I, "null_value": I, "observed": I, "pre_1990_trimmed": I,
                         "published": I, "sha256": S, "lastupdated": S}), 16),
        "totals": obj({"raw_rows": I, "aggregate_rows": I, "country_rows": I, "observed": I, "published": I})}),
    "validation": top("validation", {
        "checks": arr(obj({"id": S, "description": S, "passed": B, "detail": S}), lo=6), "all_passed": B,
        "limitations_observed": arr(S, lo=1)}),
}

SCHEMAS["meta"]["required"].remove("seedhead_bytes")  # optional: present once the seedhead stage has run

SEED_YEAR = obj({
    "year": I, "n": I, "order": arr(ISO3), "counts": arr(I), "area_scale": arr(N), "owner": {"type": "string", "pattern": "^[A-Za-z0-9+/]*={0,2}$"},
    "value_bin": {"type": "string", "pattern": "^[A-Za-z0-9+/]*={0,2}$"},
    "rank_order": obj({"rank_radius_spearman": N, "max_radius_deviation": N, "solved_cold": B}),
    "slots": I, "people_millions": N, "no_data": arr(obj({"iso3": ISO3, "population": N})),
    "median_person": obj({"iso3": ISO3, "value": N}),
    "connectivity": obj({"min": N, "mean": N, "below_95": I})})
SCHEMAS["seedhead"] = top("seedhead", {
    "indicator": S, "price_basis": BASIS, "lattice": obj({"rule": {"const": "vogel"}, "golden_angle_deg": N, "slot_area": N}), "unit_people": {"const": 1000000}, "seed": I,
    "rounding": S, "method": S, "value_bins": S, "source": obj({"panel_income_sha256": S, "population_indicator": {"const": "population"}, "values_decimals": I}),
    "years": arr(SEED_YEAR, lo=1)})
# seedhead files live in site/public/data/seedhead/<indicator>.json (+ gdppc_ppp_latest.json), all validated by the one schema


def run() -> None:
    CONTRACTS.mkdir(parents=True, exist_ok=True)
    for name, sc in SCHEMAS.items():
        (CONTRACTS / f"{name}.schema.json").write_text(json.dumps(sc, indent=1, sort_keys=True) + "\n")
    print(f"{len(SCHEMAS)} schemas written")


if __name__ == "__main__":
    run()
