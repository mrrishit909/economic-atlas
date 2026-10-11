import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fmt, render, renderPair, type Inputs, type Template } from "./narratives";

const n = JSON.parse(readFileSync(new URL("../../public/data/narratives.json", import.meta.url), "utf8")) as {
  templates: Template[]; pair_templates: Template[]; countries: { iso3: string; inputs: Inputs }[];
  examples: { iso3: string; template: string; text: string }[]; pair_examples: { a: string; b: string; template: string; text: string }[];
};
const inputs = new Map(n.countries.map((c) => [c.iso3, c.inputs]));

describe("narrative parity with analytics/narratives.py", () => {
  it(`all ${n.examples.length} single-country reference renderings match exactly`, () => {
    for (const e of n.examples) expect(render(n.templates.find((t) => t.id === e.template)!, inputs.get(e.iso3)!), `${e.iso3} ${e.template}`).toBe(e.text);
  });
  it(`all ${n.pair_examples.length} pair reference renderings match exactly`, () => {
    for (const e of n.pair_examples) expect(renderPair(n.pair_templates.find((t) => t.id === e.template)!, inputs.get(e.a)!, inputs.get(e.b)!), `${e.a}/${e.b} ${e.template}`).toBe(e.text);
  });
  it("a null required input hides the template", () => {
    const t = n.templates.find((x) => x.id === "level")!;
    expect(render(t, { ...inputs.get("USA")!, gdppc_ppp_latest: null })).toBeNull();
  });
  it("formats like Python format(): half-even ties, signs, separators", () => {
    expect(fmt(0.125, "d2")).toBe("0.12");
    expect(fmt(0.375, "d2")).toBe("0.38");
    expect(fmt(2.5, "n0")).toBe("2");
    expect(fmt(1234567.6, "n0")).toBe("1,234,568");
    expect(fmt(-0.04, "s1")).toBe("-0.0");
    expect(fmt(0.04, "s1")).toBe("+0.0");
    expect(fmt(-1234.5, "n0")).toBe("-1,234");
  });
});
