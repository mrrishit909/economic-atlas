# Data sources

Retrieved 2026-10-10/11 UTC by `pipelines/ingestion/fetch.py`. Raw responses are cached under `data/raw/` (gitignored); hashes,
byte counts and retrieval times are in `data/manifests/raw_manifest.json` (committed after ingestion). Verification evidence: `~/data-frontier/research/P05-sources.md`.

## 1. World Bank World Development Indicators (primary)
| Item | Value |
|---|---|
| Endpoint | `https://api.worldbank.org/v2/country/all/indicator/<CODE>?format=json&per_page=20000&date=1960:2025` (all pages merged); `/v2/country` for the entity list; `/v2/indicator/<CODE>` for metadata |
| Key | none |
| Licence | Creative Commons Attribution 4.0 (WDI dataset page, https://datacatalog.worldbank.org/search/dataset/0037712). WDI is a Data Catalog dataset, so its own terms apply rather than the general non-commercial clause of the World Bank site terms. |
| Attribution (shown on site) | "Source: World Bank, World Development Indicators (CC BY 4.0)." plus indicator code, WDI vintage and retrieval date |
| Vintage | The API header `lastupdated` (2026-10-08 at retrieval) is stored per indicator in the manifest and in `meta.json.vintage`. The site must show it. |
| Cadence | Revised on each WDI release; history can change. The published artifacts are a dated snapshot. |
| Quirks handled | errors arrive as HTTP 200 with `[{"message": ...}]` (raised); multiple pages (merged); aggregate rows have `region.value == "Aggregates"`; some entities have a blank `countryiso3code` (WB 2-letter aggregate ids XD, XM, XN, XY, XT) and are dropped as aggregates |

### Indicators (codes and base years verified from the live indicator names, recorded in `indicators.json`)
| id | WDI code | Unit / price basis | Type |
|---|---|---|---|
| gdp_growth | NY.GDP.MKTP.KD.ZG | % per year (real, constant prices) | rate |
| gdppc_ppp | NY.GDP.PCAP.PP.KD | constant 2021 international $ (PPP) | level, `ppp_constant_intl_2021` |
| gdppc_const | NY.GDP.PCAP.KD | constant 2015 US$ (market exchange rates) | level, `constant_usd_2015` |
| gdppc_nominal | NY.GDP.PCAP.CD | current US$ | level, `current_usd` |
| productivity | SL.GDP.PCAP.EM.KD | GDP per person employed, constant 2021 PPP $ (WB staff estimates built on ILO employment) | level, `ppp_constant_intl_2021` |
| agr_share, ind_share, srv_share | NV.AGR.TOTL.ZS, NV.IND.TOTL.ZS, NV.SRV.TOTL.ZS | % of GDP value added | share |
| inflation | FP.CPI.TOTL.ZG | CPI, % per year | rate |
| trade_open | NE.TRD.GNFS.ZS | exports + imports of goods and services, % of GDP | share |
| population | SP.POP.TOTL | persons (UN WPP based) | count, used for weights |
| x_agri, x_food, x_fuel, x_manf, x_mmtl | TX.VAL.{AGRI,FOOD,FUEL,MANF,MMTL}.ZS.UN | % of merchandise exports (UN Comtrade based) | share; input to `hhi5` |
| hhi5 (DERIVED) | computed | 0.2 to 1, Herfindahl index over the 5 export groups, renormalised to the allocated total | derived |

Per-indicator source organisation and notes are stored in `indicators.json` from the live metadata (not paraphrased from memory). Some WDI series
are third-party (UN, ILO, IMF IFS, Comtrade) redistributed under the WDI CC BY 4.0 catalogue entry; the per-indicator `source_org` field keeps the credit.

## 2. Our World in Data (secondary, one series)
| Item | Value |
|---|---|
| File | `https://ourworldindata.org/grapher/gdp-per-capita-maddison.csv?v=1&csvType=full&useColumnShortNames=true` (+ `.metadata.json`, + `https://api.ourworldindata.org/v1/indicators/900793.metadata.json`) |
| Series | GDP per capita, Maddison Project Database 2023 (Bolt and van Zanden), "international-$ in 2011 prices" |
| Licence | The origin record in the full metadata states `CC BY 4.0` for the Maddison Project Database (recorded verbatim in `meta.json`). OWID's own CC BY covers only OWID-produced data; the third-party series keeps the provider licence. |
| Attribution | "Bolt and van Zanden, Maddison Project Database 2023, via Our World in Data." |
| Use | Long-run context only (1820 to 2022 benchmark years). **Maddison dollars (2011 prices, ICP 2011 benchmark) are a different basis from WDI PPP (2021 prices) and never meet it in any computation.** |
| Why only this series | WDI covers every other need. OWID is used only where WDI lacks history before 1960 or before the Soviet/Yugoslav breakups. |

## 3. Excluded
- **IMF WEO / DataMapper:** automated bulk download needs written permission (copyright@imf.org). No IMF endpoint is called. Concepts it would add (growth, inflation, GDP per capita) are covered by WDI.
- UNCTAD, Comtrade, Penn World Table: not used (product-level HHI would need Comtrade; not licensed or verified here).

## 4. Harmonization
- ISO3: WDI `countryiso3code` / country `id`. Two kinds of non-ISO or special codes exist and are allowlisted with reasons in `countries.json.nonstandard_iso3` (checked against `pycountry` in tests): XKX (Kosovo, user-assigned code), CHI (Channel Islands, WB code), and any others the check finds.
- Aggregates: `region.value == "Aggregates"`. 296 entities - 79 aggregates = 217 countries/economies, asserted.
- Boundary changes: table in `boundaries.json` (see DATA_CONTRACTS). Event years are from general historical knowledge (tagged `GENERAL_KNOWLEDGE`); first observed years are computed from the data (tagged `DATA`).
- Income groups are the **current** WB classification (taken from the country endpoint at retrieval), not the historical one. They are a label, never used to split convergence samples (selection on the outcome).

## 5. Unverified items (declared)
- Which WDI series were revised in the 2026-10-08 release: not checkable; vintage only.
- WDI's own treatment of pre-1991 Germany/Yemen/Russia etc. series: WDI documentation was not machine-readable here. Treatment in `boundaries.json` is conservative (flag, exclude from the primary sample).
