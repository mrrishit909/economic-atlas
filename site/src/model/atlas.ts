/**
 * ATLAS selectors (VISUAL_DESIGN 3.4 cross-filter contract). One store -> pure selectors; every
 * view holds exactly one price basis (basisOf: the TS mirror of analytics/units.py assert_same_basis).
 */
import { unitOf } from "../data/copy";

export interface Ind { id: string; label: string; unit: string; price_basis: string | null; kind: string; first_year?: number; latest_year: number; display: { indexable: boolean; bins: number[]; edge_labels: string[] } }

/** Indicator groups for the picker; the header names the basis. */
export const GROUPS: { head: string; ids: string[] }[] = [
  { head: "INCOME (PPP)", ids: ["gdppc_ppp"] },
  { head: "INCOME (CONSTANT 2015 US$)", ids: ["gdppc_const"] },
  { head: "INCOME (CURRENT US$)", ids: ["gdppc_nominal"] },
  { head: "PRODUCTIVITY (PPP)", ids: ["productivity"] },
  { head: "GROWTH", ids: ["gdp_growth"] },
  { head: "STRUCTURE (SHARE OF GDP)", ids: ["agr_share", "ind_share", "srv_share"] },
  { head: "PRICES", ids: ["inflation"] },
  { head: "TRADE", ids: ["trade_open"] },
  { head: "EXPORT CONCENTRATION", ids: ["hhi5", "x_agri", "x_food", "x_fuel", "x_manf", "x_mmtl"] },
  { head: "PEOPLE", ids: ["population"] },
];

/** The unit line of any ATLAS view: money through the one basis formatter, everything else from indicators.unit. */
export const unitFor = (i: Ind) => (i.price_basis ? unitOf(i.price_basis) : i.unit.toUpperCase());
export const indexUnit = (start: number) => `INDEX, ${start} = 100`;
/** basisOf(view): the single price basis a view may hold (null for non-money views). */
export const basisOf = (i: Ind) => i.price_basis;

/** Every price basis named anywhere in a set of view texts (formatter strings or prose); the unit guard needs at most one. */
export function basesIn(texts: string[]): string[] {
  const all = texts.join(" | ").toUpperCase();
  const found: string[] = [];
  if (/\bPPP\b/.test(all)) found.push("ppp_constant_intl_2021");
  if (/CONSTANT 2015 US/.test(all)) found.push("constant_usd_2015");
  if (/CURRENT US/.test(all)) found.push("current_usd");
  if (/MADDISON/.test(all)) found.push("maddison_intl_2011");
  return found;
}

/** Single-country narrative families that fit the indicator. Money narratives are published in PPP only. */
export function narrativeFamilies(id: string): string[] {
  if (id === "gdppc_ppp" || id === "productivity") return ["level", "growth_1990", "growth_2000", "growth_2010", "index_2000", "convergence_2000", "peers"];
  if (id === "gdp_growth") return ["growth_1990", "growth_2000", "growth_2010"];
  if (["agr_share", "ind_share", "srv_share"].includes(id)) return ["structure"];
  if (id === "inflation") return ["inflation"];
  if (id === "trade_open") return ["trade"];
  if (id === "hhi5" || id.startsWith("x_")) return ["concentration"];
  return ["peers"];
}
/** Pair narratives compare GDP per capita PPP inputs (levels, growth, index), so they fit only that indicator (QA D-009). */
export const pairsAllowed = (i: Ind) => i.id === "gdppc_ppp";

/**
 * The ATLAS view's text, from the store: one unit string shared by the status line and the legend (the disc
 * always shows levels in the active year), the paths caption (INDEX keeps the same basis), and the
 * narrative families that fit the indicator. Pure, so the unit guard can be tested over every combination.
 */
export function atlasView(i: Ind, values: "level" | "index", start: number, nSelected: number) {
  const unit = unitFor(i);
  const index = values === "index" && i.display.indexable;
  return {
    statusUnit: unit,
    legendUnit: unit,
    pathsUnit: index ? `${indexUnit(start)} · FROM ${unit}` : unit,
    pairs: nSelected >= 2 && pairsAllowed(i),
    families: narrativeFamilies(i.id),
  };
}

/** One path: values over the period, LEVEL or INDEX = 100 at the start year; nulls stay gaps (never joined). */
export function pathOf(values: (number | null)[], years: number[], period: [number, number], index: boolean): { year: number; v: number | null }[] {
  const out: { year: number; v: number | null }[] = [];
  const base = values[years.indexOf(period[0])] ?? null;
  for (let y = period[0]; y <= period[1]; y++) {
    const yi = years.indexOf(y), v = yi < 0 ? null : values[yi] ?? null;
    out.push({ year: y, v: v === null ? null : index ? (base === null || base === 0 ? null : (100 * v) / base) : v });
  }
  return out;
}
