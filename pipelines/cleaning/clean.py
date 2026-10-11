"""Raw WDI JSON -> data/interim/{panel_long,countries}.parquet + data/manifests/cleaning_ledger.json.

Every dropped row is counted by reason; invariants (raw = aggregate + country; country = null + observed + invalid) hold per indicator.
No interpolation. hhi5 (DERIVED) is computed here from the five export-share series.
"""
from __future__ import annotations

import json

import polars as pl

from pipelines.common import EXPORT_IDS, INTERIM, MANIFESTS, RAW, WDI, write_json

# plausible-range rules: reject (and count) only values that are impossible, not merely extreme
RANGE = {"share": (0.0, 100.0), "level": (1e-9, None), "count": (1.0, None)}
RANGE_OVERRIDE = {"trade_open": (0.0, 1500.0)}  # trade can exceed 100% of GDP (Singapore, Luxembourg, ...)


def load_entities() -> tuple[dict, set]:
    rows = json.loads((RAW / "wdi" / "countries.json").read_text())["rows"]
    ents = {r["id"]: r for r in rows}
    agg = {i for i, r in ents.items() if r["region"]["value"] == "Aggregates"}
    return ents, agg


def clean() -> dict:
    ents, agg = load_entities()
    agg_iso2 = {r["iso2Code"] for i, r in ents.items() if i in agg}
    out, ledger = [], []
    for ind, (code, _l, _u, _q, _b, kind) in WDI.items():
        d = json.loads((RAW / "wdi" / f"{code}.data.json").read_text())["rows"]
        lo_hi = RANGE_OVERRIDE.get(ind) or RANGE.get(kind)
        led = dict(indicator=ind, wdi_code=code, raw_rows=len(d), aggregate_rows=0, country_rows=0, null_value=0, invalid_range=0, observed=0, pre_1990_trimmed=0)
        for r in d:
            iso3 = r["countryiso3code"]
            if not iso3 or iso3 in agg or r["country"]["id"] in agg_iso2:
                led["aggregate_rows"] += 1
                continue
            led["country_rows"] += 1
            v = r["value"]
            if v is None:
                led["null_value"] += 1
                continue
            if lo_hi and ((lo_hi[0] is not None and v < lo_hi[0]) or (lo_hi[1] is not None and v > lo_hi[1])):
                led["invalid_range"] += 1
                continue
            led["observed"] += 1
            out.append((iso3, int(r["date"]), ind, float(v)))
        assert led["raw_rows"] == led["aggregate_rows"] + led["country_rows"]
        assert led["country_rows"] == led["null_value"] + led["invalid_range"] + led["observed"]
        ledger.append(led)
    df = pl.DataFrame(out, schema=["iso3", "year", "indicator", "value"], orient="row")
    # --- hhi5: Herfindahl over 5 broad export groups, renormalised to their allocated total; needs all five and allocated >= 80 percent
    w = df.filter(pl.col("indicator").is_in(EXPORT_IDS)).pivot(on="indicator", index=["iso3", "year"], values="value").drop_nulls()
    if w.height:
        alloc = pl.sum_horizontal([pl.col(c) for c in EXPORT_IDS])
        h = (w.with_columns(alloc.alias("_a")).filter(pl.col("_a") >= 80)
             .with_columns((pl.sum_horizontal([(pl.col(c) / pl.col("_a")) ** 2 for c in EXPORT_IDS])).alias("value"))
             .select("iso3", "year", pl.lit("hhi5").alias("indicator"), "value"))
        df = pl.concat([df, h])
    led_h = dict(indicator="hhi5", derived_rows=int(h.height), rule="all five export groups present and allocated share >= 80 percent; HHI over shares renormalised to allocated total")
    df = df.sort("iso3", "indicator", "year")
    INTERIM.mkdir(parents=True, exist_ok=True)
    df.write_parquet(INTERIM / "panel_long.parquet", compression="zstd")
    ctry = [dict(iso3=i, iso2=r["iso2Code"], name=r["name"], region=r["region"]["value"].strip(), income_group=r["incomeLevel"]["value"], capital=r["capitalCity"])
            for i, r in sorted(ents.items()) if i not in agg]
    pl.DataFrame(ctry).write_parquet(INTERIM / "countries.parquet")
    res = dict(rows=ledger, hhi5=led_h, entities=len(ents), aggregates=len(agg), countries=len(ctry), interim_rows=df.height)
    write_json(MANIFESTS / "cleaning_ledger.json", res, compact=False)
    return res


if __name__ == "__main__":
    r = clean()
    print(r["entities"], r["aggregates"], r["countries"], r["interim_rows"], [(x["indicator"], x["invalid_range"]) for x in r["rows"] if x["invalid_range"]], r["hhi5"]["derived_rows"])
