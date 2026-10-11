"""Maddison Project 2023 via OWID: benchmark-year GDP per capita (2011 international dollars). Never combined with WDI PPP (2021)."""
from __future__ import annotations

import csv

import numpy as np

from pipelines.common import OWID_SLUG, RAW

BENCH = [1820, 1870, 1900, 1913, 1950, 1973, 1990, 2000, 2022]


def load(iso3: list[str]) -> dict:
    by: dict[tuple[str, str], dict[int, float]] = {}
    for r in csv.DictReader(open(RAW / "owid" / f"{OWID_SLUG}.data.csv")):
        if r["gdp_per_capita"] and int(r["year"]) in BENCH:
            by.setdefault((r["code"], r["entity"]), {})[int(r["year"])] = round(float(r["gdp_per_capita"]), 1)
    code = {k[0]: v for k, v in by.items() if k[0]}
    ok = [c for c in iso3 if c in code]
    vals = [[code[c].get(y) for y in BENCH] for c in ok]
    hist = [dict(entity=k[1], code=k[0], values=[v.get(y) for y in BENCH], note="Historic entity in Maddison, not one of the 217 WDI countries")
            for k, v in sorted(by.items()) if k[0].startswith("OWID_") and k[0] != "OWID_WRL" and "(Maddison)" not in k[1]]
    M = np.array([[np.nan if v is None else v for v in r] for r in vals], dtype=float)
    n = [int(np.isfinite(M[:, j]).sum()) for j in range(len(BENCH))]
    sd = [float(np.std(np.log(M[np.isfinite(M[:, j]), j]))) if n[j] > 2 else None for j in range(len(BENCH))]
    return dict(iso3=ok, values=vals, sd=sd, n=n, hist=hist, M=M)
