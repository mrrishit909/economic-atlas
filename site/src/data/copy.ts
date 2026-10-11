/**
 * All prototype copy (VISUAL_DESIGN section 5). Every number comes from facts.json, meta.json or a
 * DR-1 layout field, formatted here and nowhere else (copy.test.ts checks parity and the causal-verb
 * and dash rules). Money always carries its basis, produced by one formatter so a view can never
 * hold two bases.
 */
import { factNum, type Facts } from "./artifacts";

export const HERO = "The world, explained through economic forces.";
export const HERO_ALT =
  "Animated introduction: the world's people drawn as about eight thousand grains, one per million people, first mixed together, then sorted by the income of their country so the highest incomes gather at the centre and the lowest at the edge. Each country becomes one patch of grains.";
/** indicators.json gdppc_ppp label, uppercased (copy.test.ts checks it against the artifact). */
export const LABEL = "GDP PER CAPITA, PPP";
export const PPP_BASIS = "ppp_constant_intl_2021";

export const int = (v: number) => Math.round(v).toLocaleString("en-US");
export const d2 = (v: number) => v.toFixed(2);
export const d1 = (v: number) => v.toFixed(1);

/** The one basis formatter (MOTION_SYSTEM 2 unit guard). */
export function unitOf(basis: string | null): string {
  if (!basis) return "";
  let m = /^ppp_constant_intl_(\d{4})$/.exec(basis);
  if (m) return `CONSTANT ${m[1]} INTL $ (PPP)`;
  m = /^constant_usd_(\d{4})$/.exec(basis);
  if (m) return `CONSTANT ${m[1]} US$`;
  if (basis === "current_usd") return "CURRENT US$";
  if (basis === "maddison_intl_2011") return "INTERNATIONAL-$ IN 2011 PRICES (MADDISON)";
  throw new Error(`unknown price basis ${basis}`);
}
/** Every basis string the formatter can produce (the e2e "never two bases" check greps for these). */
export const BASIS_PATTERNS = ["INTL $ (PPP)", "US$", "CURRENT US$", "(MADDISON)"];
export const money = (v: number, basis: string) => `${int(v)} ${unitOf(basis)}`;

export const S00 = {
  wordmark: "ECONOMIC ATLAS",
  line1: (f: Facts) =>
    `${factNum(f, "gdppc_ppp_latest_year")} · ${d2(factNum(f, "gdppc_ppp_people_with_data_billion"))} BN OF ${d2(factNum(f, "world_pop_billion_latest"))} BN PEOPLE · ${int(factNum(f, "gdppc_ppp_countries_latest"))} COUNTRIES`,
  line2: `SORTED BY ${LABEL} · ${unitOf(PPP_BASIS)}`,
  chip: "WORLD BANK WDI · 1 SEED ≈ 1 MILLION PEOPLE · HIGHEST INCOME AT THE CORE",
  layoutChip: "OBSERVED VALUES · DERIVED LAYOUT",
  legendNote: "1 SEED ≈ 1 MILLION PEOPLE · SMALLEST SEEDS: COUNTRIES UNDER 500,000",
  legendUnit: `${unitOf(PPP_BASIS)} PER PERSON`,
  noDataLatest: (f: Facts) => noData(factNum(f, "gdppc_ppp_nodata_countries"), factNum(f, "gdppc_ppp_nodata_people_billion")),
};
export const noData = (n: number, bn: number) => `NO ${LABEL} VALUE: ${int(n)} COUNTRIES · ${d2(bn)} BN PEOPLE (NOT RANKED)`;

export const S03A = {
  statement: "Thirty-five years: the disc grew, and its middle moved.",
  kicker: `YEARS · ${LABEL} · ${unitOf(PPP_BASIS)} · 1 SEED ≈ 1 MILLION PEOPLE`,
  seeds: (slots: number, peopleMillions: number) => `${int(slots)} SEEDS · ${d2(peopleMillions / 1000)} BN PEOPLE WITH DATA`,
  middle: (iso3: string, value: number) => `MIDDLE PERSON'S COUNTRY: ${iso3} · ${money(value, PPP_BASIS)}`,
  spread: (c: number | null, p: number | null) => `SPREAD (SD LN INCOME): COUNTRIES ${c === null ? "N/A" : d2(c)} · PEOPLE ${p === null ? "N/A" : d2(p)}`,
  note: (year: number, a: string, b: string) => `THE MIDDLE PERSON'S COUNTRY CHANGED IN ${year}: ${a} → ${b}.`,
  follow: (name: string, rank: number, n: number, value: number) => `${name.toUpperCase()} · RANK ${rank} OF ${n} · ${money(value, PPP_BASIS)}`,
  followNone: (name: string, year: number) => `${name.toUpperCase()} · NO DATA FOR ${year}`,
  notPublished: (year: number) => `${year} NOT PUBLISHED`,
};

export const S03B = {
  statement: "Count people, not countries.",
  spreadHead: (f: Facts) => `SPREAD OF LN INCOME (SD), 1990 → ${factNum(f, "gdppc_ppp_latest_year")}`,
  spreadCountries: (f: Facts) => `COUNTRIES ${d2(factNum(f, "sigma_ppp_1990"))} → ${d2(factNum(f, "sigma_ppp_latest"))}`,
  spreadPeople: (f: Facts) => `PEOPLE ${d2(factNum(f, "sigma_ppp_popweighted_1990"))} → ${d2(factNum(f, "sigma_ppp_popweighted_latest"))}`,
  slopeHead: (f: Facts) => `CATCH-UP SLOPE 1990 → ${factNum(f, "gdppc_ppp_latest_year")}, PEOPLE-WEIGHTED`,
  slopeAll: (f: Facts) =>
    `ALL ${d2(factNum(f, "beta_ppp_1990_popweighted"))} (95% CI ${d2(factNum(f, "beta_ppp_1990_popweighted_ci_low"))} TO ${d2(factNum(f, "beta_ppp_1990_popweighted_ci_high"))})`,
  /** CI of the set-aside fit from convergence.beta[gdppc_ppp_1990_2025_pop_weighted_ex_chn_ind].ci95 */
  slopeAside: (f: Facts, ci: [number, number]) => `SET ASIDE ${d2(factNum(f, "beta_ppp_1990_popweighted_ex_chn_ind"))} (95% CI ${d2(ci[0])} TO ${d2(ci[1])})`,
  weightPct: (f: Facts) => `CHINA + INDIA = ${d1(factNum(f, "beta_ppp_1990_popweighted_chn_ind_weight_pct"))}% OF 1990 WEIGHT`,
  unitNote: "PP / YR PER LN UNIT OF STARTING INCOME (PPP)",
  setAsideLabel: "CHINA + INDIA",
};

/** Phrases banned in copy about relations, slopes and groups (VISUAL_DESIGN section 5). */
export const CAUSAL = /\b(causes|caused|drives|driven by|leads to|because of|makes)\b/i;
