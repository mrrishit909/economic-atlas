import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { domainOf, fitAt, halfLifeShown, pointsFor, recordId, t975, verdictOf, type BetaRecord } from "./plane";

const panel = JSON.parse(readFileSync(new URL("../../public/data/panel_income.json", import.meta.url), "utf8")) as { iso3: string[]; years: number[]; series: Record<string, { values: (number | null)[][] }> };
const conv = JSON.parse(readFileSync(new URL("../../public/data/convergence.json", import.meta.url), "utf8")) as { beta: BetaRecord[] };

describe("catch-up plane model", () => {
  it("t975 matches scipy within 2e-5", () => {
    const ref: Record<number, number> = { 20: 2.0859634472658644, 30: 2.0422724563012378, 57: 2.002465459291007, 100: 1.983971518523552, 173: 1.9737713368875218, 197: 1.9720790337785026 };
    for (const [d, v] of Object.entries(ref)) expect(Math.abs(t975(Number(d)) - v)).toBeLessThan(2e-5);
  });
  it("all 42 records: the published CI equals beta +- t(n-2) sqrt(V11) from vcov_hc3 (so the drawn band uses the same V)", () => {
    expect(conv.beta).toHaveLength(42);
    for (const r of conv.beta) {
      const half = t975(r.n - 2) * Math.sqrt(r.vcov_hc3[1][1]);
      expect(r.beta - half, r.id).toBeCloseTo(r.ci95[0], 3);
      expect(r.beta + half, r.id).toBeCloseTo(r.ci95[1], 3);
      expect(fitAt(r, 0).y).toBeCloseTo(r.intercept, 9);
    }
  });
  it("half-life only when defined and the CI lies below zero (the 1960 constant-USD window has none)", () => {
    for (const r of conv.beta) expect(halfLifeShown(r), r.id).toBe(r.half_life_years !== null && r.ci95[1] < 0);
    const r60 = conv.beta.find((r) => r.id === "gdppc_const_1960_2024_primary")!;
    expect(r60.half_life_years).not.toBeNull();
    expect(halfLifeShown(r60)).toBe(false);
    expect(verdictOf(r60)).toBe("spans");
    expect(verdictOf(conv.beta.find((r) => r.id === "gdppc_ppp_1990_2025_primary")!)).toBe("below");
  });
  it("every lab combination is a published record id", () => {
    const samples = ["primary", "sensitivity_all", "tercile_low", "tercile_mid", "tercile_high", "pop_weighted", "pop_weighted_ex_chn_ind"];
    const ids = new Set(conv.beta.map((r) => r.id));
    for (const [ind, end, starts] of [["gdppc_ppp", 2025, [1990, 2000, 2010]], ["gdppc_const", 2024, [1960, 1980, 2000]]] as const)
      for (const s of starts) for (const smp of samples) expect(ids.has(recordId(ind, s, end, smp)), `${ind} ${s} ${smp}`).toBe(true);
  });
  it("one domain per basis covers every point of that basis", () => {
    for (const ind of ["gdppc_ppp", "gdppc_const"]) {
      const d = domainOf(conv.beta, ind);
      for (const r of conv.beta.filter((x) => x.indicator === ind && x.points)) for (const x of r.points!.x) { expect(x).toBeGreaterThan(d.x[0]); expect(x).toBeLessThan(d.x[1]); }
    }
  });
  it("derived point sets (terciles, set-aside, sensitivity) have exactly the record's n", () => {
    const sl = (ind: string) => ({ iso3: panel.iso3, years: panel.years, values: panel.series[ind]!.values });
    for (const r of conv.beta) {
      const p = pointsFor(r, conv.beta, sl(r.indicator));
      const unpublishable = r.sample === "sensitivity_all" && r.start < 1990;
      if (unpublishable) { expect(p, r.id).toBeNull(); continue; }
      expect(p, r.id).not.toBeNull();
      expect(p!.iso3.length, r.id).toBe(r.n);
    }
  });
});
