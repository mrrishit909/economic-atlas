import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ATLAS_COPY, CAUSAL, HERO, LABEL, PPP_BASIS, S00, S01, S02, S03A, S03B, S04, S05, S06, S08_COPY, copyS07, d1, d2, int, limit1960, noData, unitOf } from "./copy";
import { factNum, type Convergence, type Facts, type Indicators, type Seedhead } from "./artifacts";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf8")) as T;
const facts = read<Facts>("facts.json");
const conv = read<Convergence>("convergence.json");
const ind = read<Indicators>("indicators.json").indicators.find((i) => i.id === "gdppc_ppp")!;
const years = read<Seedhead>("seedhead/gdppc_ppp.json").years;
const aside = conv.beta.find((b) => b.id === "gdppc_ppp_1990_2025_pop_weighted_ex_chn_ind")!;
/** Every number printed in a string, as written. */
const numbers = (s: string) => (s.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => n.replace(/,$/, ""));

/** Every fact rendered in every format the copy uses: a printed number must be one of these. */
const fromFacts = new Set<string>();
for (const k of Object.keys(facts)) {
  const v = (facts[k] as { value?: unknown })?.value;
  if (typeof v !== "number") continue;
  for (const f of [int, d2, d1]) fromFacts.add(f(Math.abs(v)));
  fromFacts.add(String(v));
}
// design literals, not data: the 1-seed unit, the 500,000 glyph threshold, the 95% CI level, the PPP base
// year (indicators.base_year, checked below), the window start year 1990 (facts.year_first, checked below),
// the constant-USD base year 2015 and Maddison's 2011 prices (unitOf bases), the Maddison benchmark years
// 1820 and 2022 (longrun.benchmark_years, the facts' own key names), the 20 clustering seeds (clusters.seeds.n),
// the 1960 window start (facts beta_const_1960_*), the 2024 constant-USD end year (convergence ids)
const LITERALS = ["1", "500,000", "95", String(ind.base_year), String(factNum(facts, "year_first")), "2015", "2011", "1820", "2022", "20", "1960", "2024"];
const allowed = new Set([...fromFacts, ...LITERALS, ...[aside.ci95[0], aside.ci95[1]].map((v) => d2(Math.abs(v)))]);

const staticTexts = [
  HERO, S00.line1(facts), S00.line2, S00.chip, S00.layoutChip, S00.legendNote, S00.legendUnit, S00.noDataLatest(facts),
  S03A.statement, S03A.kicker,
  S03B.statement, S03B.spreadHead(facts), S03B.spreadCountries(facts), S03B.spreadPeople(facts), S03B.slopeHead(facts),
  S03B.slopeAll(facts), S03B.slopeAside(facts, aside.ci95), S03B.weightPct(facts), S03B.unitNote, S03B.setAsideLabel,
  S01.statement(facts), S01.card1From(facts), S01.card1(facts), S01.card2From(facts), S01.card2(facts),
  S02.kicker, S02.c1Title(facts), S02.c1Body(facts), S02.c2Title, S02.c3Title, S02.c3Body, S02.c3Readout(facts), S02.c4Title, S02.c4Body, S02.c4Readout(facts), S02.c4Unit,
  S04.statement, S04.encodingDisc, S04.yUnit, S04.noHalfLife, S05.statement1, S05.statement2, S05.notPublished, S05.weighted, ...Object.values(S05.samples),
  S06.statement1, S06.statement2, S06.colourNote, ATLAS_COPY.line, ATLAS_COPY.note, ATLAS_COPY.indexOff, ATLAS_COPY.pppOnly, S08_COPY.paragraph, ...S08_COPY.links,
  ...copyS07(facts, "x", "y", "z").filter((e) => !["SO THE POOR WILL CATCH UP?", "DOESN'T INCOME CAUSE PRODUCTIVITY?", "WHERE IS THE IMF?"].includes(e.q)).flatMap((e) => [e.q, e.a]),
  limit1960(facts),
];
// published strings quoted verbatim (artifact copy, not ours): exempt from the causal-verb lint, checked for presence instead
const QUOTED = [conv.copy.not_causal!, facts.strings.not_causal!, facts.strings.imf_excluded!];

describe("copy parity: numbers come from facts.json (VISUAL_DESIGN 5, 6)", () => {
  it("contains no number that is not bound to a fact or a named literal", () => {
    for (const t of staticTexts) for (const n of numbers(t)) expect(allowed, `"${n}" in "${t}"`).toContain(n);
  });
  it("renders the bound values exactly", () => {
    expect(S00.line1(facts)).toBe("2025 · 7.98 BN OF 8.19 BN PEOPLE · 185 COUNTRIES");
    expect(S00.noDataLatest(facts)).toBe("NO GDP PER CAPITA, PPP VALUE: 32 COUNTRIES · 0.21 BN PEOPLE (NOT RANKED)");
    expect(S03B.spreadCountries(facts)).toBe("COUNTRIES 1.17 → 1.13");
    expect(S03B.spreadPeople(facts)).toBe("PEOPLE 1.20 → 0.89");
    expect(S03B.slopeAll(facts)).toBe("ALL -1.60 (95% CI -3.05 TO -0.15)");
    expect(S03B.slopeAside(facts, aside.ci95)).toBe("SET ASIDE -0.56 (95% CI -0.88 TO -0.23)");
    expect(S03B.weightPct(facts)).toBe("CHINA + INDIA = 38.8% OF 1990 WEIGHT");
  });
  it("the label and basis match the artifacts", () => {
    expect(ind.label.toUpperCase()).toBe(LABEL);
    expect(ind.price_basis).toBe(PPP_BASIS);
    expect(unitOf(PPP_BASIS)).toContain(String(ind.base_year));
    expect(factNum(facts, "year_first")).toBe(1990);
  });
  it("layout-bound readouts print DR-1 fields (slots, people, median person, no-data)", () => {
    const y = years.at(-1)!;
    expect(S03A.seeds(y.slots, y.people_millions)).toBe(`${int(factNum(facts, "seedhead_slots_latest"))} SEEDS · 7.98 BN PEOPLE WITH DATA`);
    expect(S03A.middle(y.median_person.iso3, y.median_person.value)).toBe(`MIDDLE PERSON'S COUNTRY: ${factNum(facts, "median_person_iso3")} · 15,091 CONSTANT 2021 INTL $ (PPP)`);
    const bn = y.no_data.reduce((a, c) => a + c.population, 0) / 1e9;
    expect(noData(y.no_data.length, bn)).toBe(S00.noDataLatest(facts));
  });
});

describe("copy rules", () => {
  const src = readdirSync(new URL("../", import.meta.url), { recursive: true })
    .map(String).filter((f) => /\.(ts|tsx|css)$/.test(f) && !f.endsWith(".test.ts"))
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
  it("no causal verbs in our copy", () => {
    for (const t of staticTexts) expect(t, t).not.toMatch(CAUSAL);
  });
  it("no overclaiming universal words in our copy (QA L10): never 'live', 'every', 'all' without a bound count", () => {
    for (const t of staticTexts.filter((x) => !x.endsWith("?"))) { // the skeptic's questions may say anything
      expect(t, t).not.toMatch(/\bLIVE\b(?! IN)|\bEVERY\b|\bALWAYS\b|\bNEVER FAILS\b/i);
      for (const m of t.matchAll(/\bALL\b(?! \d)/gi)) expect(t.slice(m.index!, m.index! + 20), t).toMatch(/^ALL (-?\d|THREE)/i);
    }
    expect(QUOTED.every((q) => q.length > 20)).toBe(true);
  });
  it("S07 answers quote the published not-causal and IMF strings verbatim", () => {
    const ex = copyS07(facts, conv.copy.not_causal!, conv.copy.absolute_only!, "v");
    expect(ex[1]!.a).toBe(conv.copy.not_causal!.toUpperCase());
    expect(ex[4]!.a).toBe(facts.strings.not_causal!.toUpperCase());
    expect(ex[6]!.a).toBe(facts.strings.imf_excluded!.toUpperCase());
  });
  it("S04 verdict branches", () => {
    expect(S04.verdict.below(1990)).toBe("Since 1990, poorer countries grew a little faster.");
    expect(S04.verdict.spans(1960)).toBe("Since 1960, no clear catch-up.");
    expect(S04.verdict.above(2000)).toBe("Since 2000, richer countries grew faster.");
    expect(S04.verdictSub.spans(-0.03, -0.22, 0.17)).toContain("THE INTERVAL INCLUDES ZERO");
  });
  it("no U+2014 or U+2015 dash in any source file or copy", () => {
    const bad = new RegExp("[\\u2014\\u2015]");
    for (const t of [...staticTexts, ...src]) expect(bad.test(t)).toBe(false);
  });
  it("one basis formatter: each basis has exactly one string and they never collide", () => {
    const all = ["ppp_constant_intl_2021", "constant_usd_2015", "current_usd", "maddison_intl_2011"].map(unitOf);
    expect(new Set(all).size).toBe(4);
    expect(() => unitOf("dollars")).toThrow();
  });
});
