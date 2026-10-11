/**
 * Artifact specs with hand-written guards at the trust boundary (MOTION_SYSTEM 10), mirroring the
 * fields this prototype reads from data/contracts/*.schema.json. Anything else in a file is ignored.
 */
import type { ArtifactSpec } from "./loader";
import { decodeOwner, type Layout } from "../model/layout";

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = Array.isArray;
const str = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export type Tag = "OBSERVED" | "DERIVED" | "PREDICTED" | "SIMULATED" | "SYNTHETIC";
export interface Fact { value: number | string; unit: string; tag: string; note?: string }
export interface Facts { [k: string]: unknown; strings: Record<string, string> }
export interface Meta { vintage: { text: string; wdi_lastupdated: string } }
export interface Country { iso3: string; name: string; region: string; income_group: string; territory_flag: boolean }
export interface Countries { countries: Country[] }
export interface SeedheadYear {
  year: number; order: string[]; counts: number[]; area_scale: number[]; owner: string; slots: number;
  people_millions: number; n: number; value_bin?: string; rank_order?: { rank_radius_spearman: number; max_radius_deviation: number; solved_cold: boolean }; connectivity: { min: number; mean: number; below_95: number }; no_data: { iso3: string; population: number }[]; median_person: { iso3: string; value: number };
}
export interface Seedhead { indicator: string; price_basis: string | null; seed: number; tags: Record<string, string>; years: SeedheadYear[] }
export interface Series { unit: string; price_basis: string | null; values: (number | null)[][] }
export interface PanelIncome { iso3: string[]; years: number[]; series: Record<string, Series> }
export interface IndicatorDisplay { bins: number[]; edge_labels: string[]; scale: string; short_label: string }
export interface Indicator { id: string; label: string; unit: string; price_basis: string | null; base_year: number | null; latest_year: number; display: IndicatorDisplay }
export interface Indicators { indicators: Indicator[] }
export interface Sigma { id: string; sd_log: (number | null)[]; n: number[]; years?: number[] }
export interface Beta { id: string; beta: number; ci95: [number, number]; n: number; price_basis: string }
export interface Convergence { sigma: Sigma[]; beta: import("../model/plane").BetaRecord[]; copy: Record<string, string> }

export const FACTS: ArtifactSpec<Facts> = {
  file: "facts.json",
  guard: (v): v is Facts => obj(v) && obj(v.strings) && obj(v.seedhead_slots_latest) && obj(v.gdppc_ppp_latest_year),
};
export const META: ArtifactSpec<Meta> = {
  file: "meta.json",
  guard: (v): v is Meta => obj(v) && obj(v.vintage) && str(v.vintage.text),
};
export const COUNTRIES: ArtifactSpec<Countries> = {
  file: "countries.json",
  guard: (v): v is Countries => obj(v) && arr(v.countries) && v.countries.every((c) => obj(c) && str(c.iso3) && str(c.name)),
};
const seedYear = (y: unknown): y is SeedheadYear =>
  obj(y) && num(y.year) && arr(y.order) && arr(y.counts) && arr(y.area_scale) && str(y.owner) && num(y.slots) &&
  y.order.length === y.counts.length && y.counts.length === y.area_scale.length && arr(y.no_data) && obj(y.median_person);
const seedhead = (file: string, ind = "gdppc_ppp"): ArtifactSpec<Seedhead> => ({
  file,
  guard: (v): v is Seedhead => obj(v) && v.indicator === ind && arr(v.years) && v.years.length > 0 && v.years.every(seedYear),
  isEmpty: (v) => v.years.length === 0,
});
const seedSpecs = new Map<string, ArtifactSpec<Seedhead>>();
/** Per-indicator layouts (DR-1), lazy on first ATLAS selection. gdppc_ppp uses the 36-year file. */
export const seedheadOf = (ind: string): ArtifactSpec<Seedhead> => {
  if (ind === "gdppc_ppp") return SEED_YEARS;
  let s = seedSpecs.get(ind);
  if (!s) { s = seedhead(`seedhead/${ind}.json`, ind); seedSpecs.set(ind, s); }
  return s;
};
/** First-paint layout (latest year only, 4.6 KB gz) and the 36-year file (121 KB gz, lazy at S03a). */
export const SEED_LATEST = seedhead("seedhead/gdppc_ppp_latest.json");
export const SEED_YEARS = seedhead("seedhead/gdppc_ppp.json");
export const PANEL: ArtifactSpec<PanelIncome> = {
  file: "panel_income.json",
  guard: (v): v is PanelIncome => obj(v) && arr(v.iso3) && arr(v.years) && obj(v.series) && obj(v.series.gdppc_ppp) && obj(v.series.population),
};
export const INDICATORS: ArtifactSpec<Indicators> = {
  file: "indicators.json",
  guard: (v): v is Indicators => obj(v) && arr(v.indicators) && v.indicators.some((i) => obj(i) && i.id === "gdppc_ppp" && obj(i.display) && arr(i.display.bins) && i.display.bins.length === 6),
};
export const CONVERGENCE: ArtifactSpec<Convergence> = {
  file: "convergence.json",
  guard: (v): v is Convergence => obj(v) && arr(v.sigma) && arr(v.beta) && obj(v.copy) && str(v.copy.not_causal),
};

export function toLayout(y: SeedheadYear): Layout {
  // DR-9: value_bin is one uint8 per country aligned with order (bins from the legend's own edges)
  const vb = y.value_bin ? decodeOwner(y.value_bin) : null;
  return {
    bins: vb ? new Map(y.order.map((iso, i) => [iso, vb[i]!])) : undefined,
    year: y.year, order: y.order, counts: y.counts, areaScale: y.area_scale, owner: decodeOwner(y.owner), slots: y.slots,
    peopleMillions: y.people_millions, noData: y.no_data, medianPerson: y.median_person,
  };
}

export function fact(f: Facts, key: string): Fact {
  const v = f[key];
  if (!obj(v) || !("value" in v)) throw new Error(`facts.${key} missing`);
  return v as unknown as Fact;
}
export const factNum = (f: Facts, key: string) => fact(f, key).value as number;

export interface Validation { all_passed: boolean; checks: { id: string; description: string; detail: string; passed: boolean }[]; limitations_observed: string[] }
export interface Boundaries { note: string; rows: { iso3: string; entity: string; event: string; event_year: number; event_evidence: string; territory_break_year: number | null; treatment: string; sensitivity_only: boolean }[] }
export interface Coverage { indicators: Record<string, { n_by_year: number[]; latest_year: number; latest_year_n: number; missing_share_panel: number }>; rule?: unknown }
export interface Reconciliation { rows: { indicator: string; raw_rows: number; aggregate_rows: number; country_rows: number; null_value: number; observed: number; published: number }[]; invariants: string[]; totals: Record<string, number> }
export interface Longrun { benchmark_years: number[]; sigma: { years: number[]; sd_log: number[]; n: number[] }; attribution: string; unit: string; price_basis: string; note: string }
export interface MetaFull extends Meta { pipeline_version: string; disclaimers: string[]; sources: unknown; excluded_sources: { name: string; reason: string }[]; latest_year_rule: { text: string }; years?: unknown; artifact_bytes: Record<string, number> }
export interface Narratives { templates: { id: string; requires: string[]; text: string }[]; pair_templates: { id: string; requires: string[]; text: string }[]; countries: { iso3: string; inputs: Record<string, number | string | null> }[] }
export interface PanelStructure { iso3: string[]; years: number[]; series: Record<string, Series> }
export interface IndicatorFull extends Indicator { kind: string; latest_year: number; latest_year_n: number; first_year: number; display: IndicatorDisplay & { indexable: boolean; core_reads: string } }

const has = (...k: string[]) => (v: unknown) => obj(v) && k.every((x) => x in v);
export const CLUSTERS: ArtifactSpec<import("../model/likeness").Clusters> = { file: "clusters.json", guard: (v): v is import("../model/likeness").Clusters => has("assignments", "clusters", "hierarchical")(v) };
export const CORRELATIONS: ArtifactSpec<import("../model/likeness").Correlations> = { file: "correlations.json", guard: (v): v is import("../model/likeness").Correlations => has("pairs", "values", "iso3", "not_causal")(v) };
export const VALIDATION: ArtifactSpec<Validation> = { file: "validation.json", guard: (v): v is Validation => has("checks", "limitations_observed")(v) };
export const BOUNDARIES: ArtifactSpec<Boundaries> = { file: "boundaries.json", guard: (v): v is Boundaries => has("rows", "note")(v) };
export const COVERAGE: ArtifactSpec<Coverage> = { file: "coverage.json", guard: (v): v is Coverage => has("indicators")(v) };
export const RECONCILIATION: ArtifactSpec<Reconciliation> = { file: "reconciliation.json", guard: (v): v is Reconciliation => has("rows", "totals")(v) };
export const LONGRUN: ArtifactSpec<Longrun> = { file: "longrun.json", guard: (v): v is Longrun => has("sigma", "attribution", "price_basis")(v) };
export const NARRATIVES: ArtifactSpec<Narratives> = { file: "narratives.json", guard: (v): v is Narratives => has("templates", "pair_templates", "countries")(v) };
export const PANEL_STRUCT: ArtifactSpec<PanelStructure> = { file: "panel_structure.json", guard: (v): v is PanelStructure => has("iso3", "years", "series")(v) };

export const dataUrlOf = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;
