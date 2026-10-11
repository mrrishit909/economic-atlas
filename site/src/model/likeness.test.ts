import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupsFor, pairOf, relationFor, spearman, type Clusters, type Correlations } from "./likeness";
import { rankBins } from "../scenes/freestates";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf8")) as T;
const cl = read<Clusters>("clusters.json"), co = read<Correlations>("correlations.json");
const all = read<{ countries: { iso3: string }[] }>("countries.json").countries.map((c) => c.iso3);

describe("S06 likeness model", () => {
  it("group sizes equal clusters[].size; members ordered by silhouette, best first", () => {
    const g = groupsFor(cl, "kmeans", all);
    g.groups.forEach((x, i) => expect(x.members.length).toBe(cl.clusters[i]!.size));
    const s = new Map(cl.assignments.iso3.map((iso, i) => [iso, cl.assignments.silhouette[i]!]));
    for (const x of g.groups) for (let k = 1; k < x.members.length; k++) expect(s.get(x.members[k - 1]!)!).toBeGreaterThanOrEqual(s.get(x.members[k]!)!);
    expect(g.hollow.size).toBe(cl.assignments.silhouette.filter((v) => v < 0).length);
    expect(g.ungrouped.length).toBe(all.length - cl.inclusion.complete_cases);
  });
  it("Ward: the hollow count equals the published disagree_count", () => {
    expect(groupsFor(cl, "ward", all).hollow.size).toBe(cl.hierarchical.disagree_count);
  });
  it("the rho readout is the pairs record in either order, and rho recomputed from DR-4 values matches", () => {
    for (const p of co.pairs.slice(0, 12)) {
      expect(pairOf(co, p.b, p.a)).toBe(p);
      const { order, vb } = relationFor(co, p.a, p.b), A = co.values[p.a]!;
      const va = new Map(co.iso3.map((iso, i) => [iso, A[i]!]));
      expect(order.length).toBe(p.n);
      expect(spearman(order.map((i) => va.get(i)!), order.map((i) => vb.get(i)!))).toBeCloseTo(p.rho, 4);
    }
  });
  it("rank sevenths: equal-count bins 0..6 over the plotted countries", () => {
    const { order, vb } = relationFor(co, "ln_gdppc_ppp", "agr_share");
    const b = rankBins(order, vb), counts = [0, 0, 0, 0, 0, 0, 0];
    for (const v of b.values()) counts[v]!++;
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});
