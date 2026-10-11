"""Shared paths, indicator catalogue and JSON writer for the Economic Atlas pipeline."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
MANIFESTS = ROOT / "data" / "manifests"
CONTRACTS = ROOT / "data" / "contracts"
PUBLIC = ROOT / "site" / "public" / "data"
LEDGER = MANIFESTS / "cleaning_ledger.json"
SCHEMA_VERSION = "v1"
PIPELINE_VERSION = "1.0.0"
WB = "https://api.worldbank.org/v2"
YEAR_FIRST = 1960   # fetch window start
YEAR_PANEL0 = 1990  # published panel start (post-Soviet/Yugoslav successor data starts here)
MIN_COV = 0.60      # "latest year" rule: latest year with >= 60% of the indicator's ever-observed countries

# id -> (WDI code, short label, unit, quantity, price_basis, kind). price_basis: null for non-money series.
# base years are verified against the live indicator names by pipelines/ingestion/fetch.py (stored in the manifest).
WDI = {
    "gdp_growth":     ("NY.GDP.MKTP.KD.ZG", "GDP growth", "percent per year", "growth", None, "rate"),
    "gdppc_ppp":      ("NY.GDP.PCAP.PP.KD", "GDP per capita, PPP", "constant 2021 international $", "gdp_per_capita", "ppp_constant_intl_2021", "level"),
    "gdppc_const":    ("NY.GDP.PCAP.KD", "GDP per capita, constant USD", "constant 2015 US$", "gdp_per_capita", "constant_usd_2015", "level"),
    "gdppc_nominal":  ("NY.GDP.PCAP.CD", "GDP per capita, current USD", "current US$", "gdp_per_capita", "current_usd", "level"),
    "productivity":   ("SL.GDP.PCAP.EM.KD", "GDP per person employed", "constant 2021 PPP $", "labour_productivity", "ppp_constant_intl_2021", "level"),
    "agr_share":      ("NV.AGR.TOTL.ZS", "Agriculture value added", "percent of GDP", "share", None, "share"),
    "ind_share":      ("NV.IND.TOTL.ZS", "Industry value added", "percent of GDP", "share", None, "share"),
    "srv_share":      ("NV.SRV.TOTL.ZS", "Services value added", "percent of GDP", "share", None, "share"),
    "inflation":      ("FP.CPI.TOTL.ZG", "Inflation, consumer prices", "percent per year", "inflation", None, "rate"),
    "trade_open":     ("NE.TRD.GNFS.ZS", "Trade openness", "percent of GDP", "trade_openness", None, "share"),
    "population":     ("SP.POP.TOTL", "Population", "persons", "population", None, "count"),
    "x_agri":         ("TX.VAL.AGRI.ZS.UN", "Agricultural raw materials exports", "percent of merchandise exports", "export_share", None, "share"),
    "x_food":         ("TX.VAL.FOOD.ZS.UN", "Food exports", "percent of merchandise exports", "export_share", None, "share"),
    "x_fuel":         ("TX.VAL.FUEL.ZS.UN", "Fuel exports", "percent of merchandise exports", "export_share", None, "share"),
    "x_manf":         ("TX.VAL.MANF.ZS.UN", "Manufactures exports", "percent of merchandise exports", "export_share", None, "share"),
    "x_mmtl":         ("TX.VAL.MMTL.ZS.UN", "Ores and metals exports", "percent of merchandise exports", "export_share", None, "share"),
}
EXPORT_IDS = ["x_agri", "x_food", "x_fuel", "x_manf", "x_mmtl"]

OWID_SLUG = "gdp-per-capita-maddison"


def write_json(path: Path, obj, compact: bool = True) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    s = json.dumps(obj, separators=(",", ":"), sort_keys=True, allow_nan=False) if compact else json.dumps(obj, indent=2, sort_keys=True, allow_nan=False)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(s + "\n")
    os.replace(tmp, path)
    return len(s) + 1
