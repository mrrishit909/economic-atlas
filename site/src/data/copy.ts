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

// ------------------------------------------------------------------ Stage B copy (VISUAL_DESIGN 5)
export const S01 = {
  statement: (f: Facts) => `Per person, the richest economy produces ${int(factNum(f, "gdppc_ppp_top_bottom_ratio"))} times what the poorest does.`,
  kicker: (f: Facts, top: string, bottom: string) => `${top.toUpperCase()} AND ${bottom.toUpperCase()}, ${factNum(f, "gdppc_ppp_latest_year")}, PPP`,
  card1From: (f: Facts) => `FROM: WORLD BANK WDI / ${factNum(f, "gdppc_ppp_latest_year")}`,
  card1: (f: Facts) => `HALF THE ${d2(factNum(f, "gdppc_ppp_people_with_data_billion"))} BN PEOPLE WITH DATA LIVE IN COUNTRIES AT OR BELOW ${int(factNum(f, "median_person_gdppc_ppp"))} PER PERSON (${unitOf(PPP_BASIS)}).`,
  card2From: (f: Facts) => `FROM: WORLD BANK WDI / ${int(factNum(f, "gdppc_ppp_countries_latest"))} COUNTRIES`,
  card2: (f: Facts) => `THE MIDDLE COUNTRY: ${int(factNum(f, "gdppc_ppp_median"))} ${unitOf(PPP_BASIS)}. COUNT COUNTRIES OR COUNT PEOPLE, AND THE MIDDLE MOVES.`,
};

export const S02 = {
  kicker: "SOURCES · WHERE THE NUMBERS COME FROM",
  c1Title: (f: Facts) => `${int(factNum(f, "wb_entities"))} entities. ${int(factNum(f, "countries"))} economies.`,
  c1Body: (f: Facts) => `THE WORLD BANK PUBLISHES REGIONS AND INCOME GROUPS NEXT TO COUNTRIES. WE SET ALL ${int(factNum(f, "aggregates"))} ASIDE: THEY ARE NEVER RANKED AGAINST COUNTRIES.`,
  c2Title: "Three different dollars.",
  c3Title: "Missing stays missing.",
  c3Body: "A COUNTRY WITHOUT A NUMBER STAYS WITHOUT ONE. RANKINGS USE ONLY COUNTRIES WITH DATA AND SAY HOW MANY.",
  c3Readout: (f: Facts) => `${d1(factNum(f, "cells_missing_pct_panel"))}% OF CELLS EMPTY · NONE FILLED IN`,
  c4Title: "Two centuries, another dollar.",
  c4Body: "MADDISON'S LONG-RUN SERIES USES 2011 PRICES. IT IS CONTEXT, NEVER MIXED WITH THE WORLD BANK'S NUMBERS.",
  c4Readout: (f: Facts) =>
    `MAX / MIN, SAME ${int(factNum(f, "longrun_balanced_n"))} COUNTRIES: ${d1(factNum(f, "longrun_gdppc_ratio_balanced_1820"))} IN 1820, ${int(factNum(f, "longrun_gdppc_ratio_balanced_2022"))} IN 2022`,
  c4Unit: `${unitOf("maddison_intl_2011")} · NOT COMPARABLE WITH WDI PPP`,
};

export const S04 = {
  statement: "Did the poor grow faster?",
  encodingDisc: "CORE = HIGHEST INCOME",
  encodingPlane: (start: number, end: number) => `ACROSS = INCOME IN ${start} · UP = GROWTH ${start} TO ${end}`,
  yUnit: "GROWTH OF GDP PER CAPITA, % PER YEAR",
  dropped: (n: number, start: number, t: number) => `${n} NO ${start} VALUE · ${t} TERRITORY CHANGES`,
  slope: (beta: number, lo: number, hi: number, blo: number, bhi: number, n: number, r2: number) =>
    `SLOPE ${d2(beta)} PP / YR PER LN UNIT (95% CI ${d2(lo)} TO ${d2(hi)}, HC3; BOOTSTRAP ${d2(blo)} TO ${d2(bhi)}) · N ${int(n)} · R² ${d2(r2)}`,
  halfLife: (y: number) => `AT THIS PACE, HALF THE GAP CLOSES IN ${int(y)} YEARS`,
  noHalfLife: "NO HALF-LIFE: NO CLEAR CATCH-UP IN THIS WINDOW",
  verdict: { below: (s: number) => `Since ${s}, poorer countries grew a little faster.`, spans: (s: number) => `Since ${s}, no clear catch-up.`, above: (s: number) => `Since ${s}, richer countries grew faster.` },
  verdictSub: {
    below: (b: number, lo: number, hi: number, h: number | null) => `SLOPE ${d2(b)} (95% CI ${d2(lo)} TO ${d2(hi)}).${h === null ? "" : ` AT THIS PACE HALF THE GAP CLOSES IN ${int(h)} YEARS.`}`,
    spans: (b: number, lo: number, hi: number) => `SLOPE ${d2(b)} (95% CI ${d2(lo)} TO ${d2(hi)}). THE INTERVAL INCLUDES ZERO.`,
    above: (b: number, lo: number, hi: number) => `SLOPE ${d2(b)} (95% CI ${d2(lo)} TO ${d2(hi)}).`,
  },
  table: "DATA TABLE FOR THIS WINDOW",
};

export const S05 = {
  statement1: "Change the window, change the answer.",
  statement2: "Same data. Different questions.",
  samples: {
    primary: "PRIMARY", sensitivity_all: "WITH TERRITORY CHANGES", tercile_low: "LOWER THIRD", tercile_mid: "MIDDLE THIRD", tercile_high: "UPPER THIRD",
    pop_weighted: "PEOPLE-WEIGHTED", pop_weighted_ex_chn_ind: "PEOPLE-WEIGHTED WITHOUT CHINA + INDIA",
  } as Record<string, string>,
  notPublished: "POINTS NOT PUBLISHED FOR THIS WINDOW",
  weighted: "SEED AREA = POPULATION AT THE START (THE WLS WEIGHT)",
};

export const S06 = {
  statement1: "Three loose groups, not three kinds of country.",
  statement2: "Some things travel together. That is not a reason.",
  caption: (i: number, k: number, size: number, sig: string) => `GROUP ${i + 1} OF ${k} · ${size} COUNTRIES · "${sig.toUpperCase()}"`,
  notGrouped: (n: number) => `NOT GROUPED: ${n} COUNTRIES MISSING A FEATURE`,
  ward: (n: number, of: number) => `${n} OF ${of} COUNTRIES CHANGE GROUP UNDER A DIFFERENT METHOD`,
  ledger: (sil: number, stab: number, hier: number) => `SILHOUETTE ${d2(sil)} (WEAK) · SAME GROUPS ACROSS 20 SEEDS (ARI ${d2(stab)}) · WARD AGREEMENT ARI ${d2(hier)}`,
  rho: (rho: number, lo: number, hi: number, n: number) => `SPEARMAN RHO ${d2(rho)} (95% CI ${d2(lo)} TO ${d2(hi)}) · N ${n}`,
  order: (a: string, b: string) => `ORDER BY ${a} · LIGHT BY ${b} (RANK SEVENTHS)`,
  colourNote: "SEED COLOUR = INCOME (PPP, LATEST): GROUPS ARE READ BY POSITION",
};

export const ATLAS_COPY = {
  line: "Compare any economies, on one footing.",
  note: "ONE INDICATOR, ONE UNIT AT A TIME. COUNTRIES ONLY: REGIONS AND INCOME GROUPS ARE NEVER RANKED. SEE LIMITATIONS.",
  indexOff: "INDEXING A RATE OR A SHARE IS NOT MEANINGFUL",
  noData: (y: number) => `NO DATA FOR ${y}`,
  few: (n: number, y: number) => `ONLY ${n} COUNTRIES HAVE DATA IN ${y}`,
  pppOnly: "NARRATIVES ARE PUBLISHED IN PPP ONLY: NONE FOR THIS INDICATOR",
};

export const S08_COPY = {
  paragraph: "Eight billion people, sorted by one number. Change the number and the world re-sorts; count countries instead of people and the story turns. The data can show who grew. It cannot say why.",
  links: ["→ OPEN THE ATLAS", "→ REPLAY THE INTRO", "→ READ THE METHODOLOGY", "→ SOURCE CODE"],
};

export interface Exchange { q: string; a: string; extra?: string; receipt: string; tag: "OBSERVED" | "DERIVED" }
/** S07 (VISUAL_DESIGN 5 S07): every answer bound to facts or a published string. */
export function copyS07(f: Facts, notCausalConv: string, absoluteOnly: string, vintage: string): Exchange[] {
  return [
    { q: "ISN'T PPP JUST A FUDGE?", a: `THREE DOLLARS, THREE MEANINGS, NEVER MIXED. RANKED BOTH WAYS, COUNTRIES AGREE (RHO ${d2(factNum(f, "ppp_const_rank_rho"))}).`, receipt: "validation.json", tag: "DERIVED" },
    { q: "SO THE POOR WILL CATCH UP?", a: notCausalConv.toUpperCase(), extra: absoluteOnly.toUpperCase(), receipt: "convergence.json", tag: "DERIVED" },
    { q: "ISN'T IT ALL CHINA AND INDIA?", a: `FOR THE PEOPLE-WEIGHTED SLOPE, MOSTLY: ${d2(factNum(f, "beta_ppp_1990_popweighted"))} WITH THEM, ${d2(factNum(f, "beta_ppp_1990_popweighted_ex_chn_ind"))} WITHOUT. COUNTED BY COUNTRY, THEY ARE TWO OF ${int(factNum(f, "beta_ppp_1990_n"))}.`, receipt: "convergence.json", tag: "DERIVED" },
    { q: "ARE THESE GROUPS REAL?", a: `LOOSELY. SILHOUETTE ${d2(factNum(f, "cluster_silhouette"))}. THE SAME GROUPS COME BACK ACROSS 20 RANDOM SEEDS (ARI ${d2(factNum(f, "cluster_stability_ari"))}), BUT ANOTHER METHOD AGREES ONLY IN PART (ARI ${d2(factNum(f, "cluster_hier_ari"))}).`, receipt: "clusters.json", tag: "DERIVED" },
    { q: "DOESN'T INCOME CAUSE PRODUCTIVITY?", a: f.strings.not_causal!.toUpperCase(), receipt: "correlations.json", tag: "DERIVED" },
    { q: "WHAT ABOUT THE GAPS?", a: `${d1(factNum(f, "cells_missing_pct_panel"))}% OF CELLS ARE EMPTY. WE NEVER FILL THEM IN.`, receipt: "coverage.json", tag: "DERIVED" },
    { q: "WHERE IS THE IMF?", a: f.strings.imf_excluded!.toUpperCase(), extra: vintage.toUpperCase(), receipt: "meta.json", tag: "OBSERVED" },
  ];
}
/** Limitations shown with the stack (coordinator: boundary years unverified; the 1960 window). */
export const limit1960 = (f: Facts) =>
  `THE 1960 TO 2024 CONSTANT-USD WINDOW COVERS ${int(factNum(f, "beta_const_1960_n"))} COUNTRIES; ITS SLOPE ${d2(factNum(f, "beta_const_1960_beta"))} HAS A 95% CI OF ${d2(factNum(f, "beta_const_1960_ci_low"))} TO ${d2(factNum(f, "beta_const_1960_ci_high"))}, WHICH SPANS ZERO.`;
