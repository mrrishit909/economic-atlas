"""Load the cleaned long panel into dense arrays (countries x years), NaN = not observed."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import polars as pl

from pipelines.common import INTERIM, WDI, YEAR_FIRST

IDS = list(WDI) + ["hhi5"]


@dataclass
class Panel:
    iso3: list[str]
    years: np.ndarray           # YEAR_FIRST..last
    a: dict[str, np.ndarray]    # indicator -> (C, Y)
    countries: pl.DataFrame

    def col(self, year: int) -> int:
        return int(year - self.years[0])

    def at(self, ind: str, year: int) -> np.ndarray:
        return self.a[ind][:, self.col(year)]

    def window(self, ind: str, y0: int, y1: int) -> np.ndarray:
        return self.a[ind][:, self.col(y0): self.col(y1) + 1]


def load() -> Panel:
    ctry = pl.read_parquet(INTERIM / "countries.parquet").sort("iso3")
    iso3 = ctry["iso3"].to_list()
    long = pl.read_parquet(INTERIM / "panel_long.parquet")
    y1 = int(long["year"].max())
    years = np.arange(YEAR_FIRST, y1 + 1)
    idx = {c: i for i, c in enumerate(iso3)}
    a = {}
    for ind in IDS:
        m = np.full((len(iso3), len(years)), np.nan)
        d = long.filter(pl.col("indicator") == ind)
        ci = np.array([idx[c] for c in d["iso3"]], dtype=int)
        m[ci, d["year"].to_numpy() - YEAR_FIRST] = d["value"].to_numpy()
        a[ind] = m
    return Panel(iso3, years, a, ctry)


def latest_year(p: Panel, ind: str, lo: int = 2010, hi: int = 2022, share: float = 0.9) -> tuple[int, int, int]:
    """(latest_year, n at latest, peak n): latest year with >= share of the indicator's peak yearly country count in [lo, hi]."""
    n = np.isfinite(p.a[ind]).sum(0)
    peak = int(n[p.col(lo): p.col(hi) + 1].max())
    ok = [int(y) for y, c in zip(p.years, n) if c >= share * peak and y >= lo]
    ly = max(ok)
    return ly, int(n[p.col(ly)]), peak
