import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** QA L3: honesty tags and colour keys are never hidden with display:none at any width. */
describe("tags and keys are never display:none (QA L3)", () => {
  const css = ["app.css", "scenes.css"].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8")).join("\n");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));
  it("no rule hiding .chip, a tag row or a legend", () => {
    const bad = rules.filter((r) => /display:\s*none/.test(r.body) && /(\.chip|s0[03]-chips|ev-tag|\.legend|col__legend|atlas__legend|story-card__tag|note__tag)\b/.test(r.sel));
    expect(bad.map((r) => r.sel)).toEqual([]);
  });
  it("no text below the 11px floor in CSS (QA L7)", () => {
    const small = [...css.matchAll(/font(?:-size)?:[^;]*?\b(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((v) => v < 11);
    expect(small).toEqual([]);
  });
});
