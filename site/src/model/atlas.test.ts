import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GROUPS, atlasView, basesIn, narrativeFamilies, pairsAllowed, pathOf, unitFor, type Ind } from "./atlas";

const inds = (JSON.parse(readFileSync(new URL("../../public/data/indicators.json", import.meta.url), "utf8")) as { indicators: Ind[] }).indicators;
const narr = JSON.parse(readFileSync(new URL("../../public/data/narratives.json", import.meta.url), "utf8")) as { templates: { id: string; text: string }[]; pair_templates: { id: string; text: string }[] };

describe("ATLAS unit guard (basisOf, the TS mirror of assert_same_basis)", () => {
  it("every indicator is in exactly one picker group and aggregates are not indicators", () => {
    const ids = GROUPS.flatMap((g) => g.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(inds.map((i) => i.id).sort());
  });
  it("for every indicator, the view's unit strings and its narratives hold at most one basis, and it is the indicator's own", () => {
    for (const i of inds) {
      const texts = [unitFor(i), ...narrativeFamilies(i.id).map((f) => narr.templates.find((t) => t.id === f)!.text.toUpperCase())];
      if (pairsAllowed(i)) texts.push(...narr.pair_templates.map((t) => t.text.toUpperCase()));
      const found = basesIn(texts);
      expect(found.length, i.id).toBeLessThanOrEqual(1);
      if (i.price_basis) expect(basesIn([unitFor(i)]), i.id).toEqual([i.price_basis]);
    }
  });
  it("every (indicator, LEVEL/INDEX, 1-4 countries) view holds one basis across status, legend, paths and narratives (QA D-009)", () => {
    for (const i of inds) for (const values of ["level", "index"] as const) for (const n of [1, 2, 4]) {
      const v = atlasView(i, values, 2000, n);
      expect(v.statusUnit, i.id).toBe(v.legendUnit);
      const texts = [v.statusUnit, v.legendUnit, v.pathsUnit, ...v.families.map((f) => narr.templates.find((t) => t.id === f)!.text.toUpperCase())];
      if (v.pairs) texts.push(...narr.pair_templates.map((t) => t.text.toUpperCase()));
      expect(basesIn(texts).length, `${i.id} ${values} ${n}`).toBeLessThanOrEqual(1);
      if (v.pairs) expect(i.id).toBe("gdppc_ppp");
      if (i.id === "agr_share") expect(v.families).toEqual(["structure"]);
    }
  });
  it("INDEX is enabled only for indexable indicators (DR-7)", () => {
    for (const i of inds) expect(i.display.indexable, i.id).toBe(["level", "count"].includes(i.kind) && i.id !== "gdp_growth");
  });
  it("paths: index = 100 at the start year; nulls stay gaps", () => {
    const p = pathOf([10, null, 20, 30], [2000, 2001, 2002, 2003], [2000, 2003], true);
    expect(p.map((x) => x.v)).toEqual([100, null, 200, 300]);
    expect(pathOf([null, 5], [2000, 2001], [2000, 2001], true).map((x) => x.v)).toEqual([null, null]);
  });
});
