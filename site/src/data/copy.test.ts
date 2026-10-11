import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAUSAL, HERO, LABEL, PPP_BASIS, S00, S03A, S03B, d1, d2, int, noData, unitOf } from "./copy";
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
// year (indicators.base_year, checked below) and the window start year 1990 (facts.year_first, checked below)
const LITERALS = ["1", "500,000", "95", String(ind.base_year), String(factNum(facts, "year_first"))];
const allowed = new Set([...fromFacts, ...LITERALS, ...[aside.ci95[0], aside.ci95[1]].map((v) => d2(Math.abs(v)))]);

const staticTexts = [
  HERO, S00.line1(facts), S00.line2, S00.chip, S00.layoutChip, S00.legendNote, S00.legendUnit, S00.noDataLatest(facts),
  S03A.statement, S03A.kicker,
  S03B.statement, S03B.spreadHead(facts), S03B.spreadCountries(facts), S03B.spreadPeople(facts), S03B.slopeHead(facts),
  S03B.slopeAll(facts), S03B.slopeAside(facts, aside.ci95), S03B.weightPct(facts), S03B.unitNote, S03B.setAsideLabel,
];

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
