import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./vogel.fixture.json";
import { connectivity, decodeOwner, knn6, ownedCounts, seamMask, shuffle, vogelX, vogelY, NO_SEAM_MAX } from "../model/layout";
import { countriesState, peopleState, R_IN, R_SEAM } from "../model/seedstates";
import { toLayout, type PanelIncome, type Seedhead } from "../data/artifacts";
import { between, evalSeed, stateAt } from "./transition";

const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf8")) as T;
const years = read<Seedhead>("seedhead/gdppc_ppp.json");
const latest = read<Seedhead>("seedhead/gdppc_ppp_latest.json");
const panel = read<PanelIncome>("panel_income.json");
const facts = read<Record<string, { value: number }>>("facts.json");

describe("Vogel lattice parity with analytics/seedhead.py", () => {
  for (const [n, s] of Object.entries(fixture.samples)) {
    it(`positions and 6-NN match the reference for N = ${n}`, () => {
      const N = Number(n), k = Math.sqrt(N), nb = knn6(N);
      s.idx.forEach((i, j) => {
        expect(vogelX(i) / k).toBeCloseTo(s.xy[j]![0]!, 10);
        expect(vogelY(i) / k).toBeCloseTo(s.xy[j]![1]!, 10);
        expect([...nb.subarray(i * 6, i * 6 + 6)].sort((a, b) => a - b)).toEqual(s.nb[j]);
      });
    });
  }
});

describe("slot counts equal the layout's per-country counts", () => {
  const popAt = (iso: string, year: number) => panel.series.population!.values[panel.iso3.indexOf(iso)]![panel.years.indexOf(year)]!;
  for (const y of years.years) {
    it(`${y.year}: owner recount = counts = max(1, round(pop / 1e6)), slots = sum`, () => {
      const L = toLayout(y);
      expect(L.owner.length).toBe(L.slots);
      expect(ownedCounts(L)).toEqual(L.counts);
      expect(L.counts.reduce((a, b) => a + b, 0)).toBe(L.slots);
      L.order.forEach((iso, c) => expect(L.counts[c]).toBe(Math.max(1, Math.floor(popAt(iso, y.year) / 1e6 + 0.5))));
      // area is carried by slots: sum(counts x area_scale) = people / 1M, within area_scale's published 4-decimal rounding
      const area = L.counts.reduce((a, c, i) => a + c * L.areaScale[i]!, 0);
      const tol = L.counts.reduce((a, c) => a + c * 0.5e-4, 0);
      expect(Math.abs(area - L.peopleMillions)).toBeLessThanOrEqual(tol);
    });
  }
  it("the slot totals are the published facts (8005 latest, 5202 in 1990)", () => {
    expect(toLayout(latest.years[0]!).slots).toBe(facts.seedhead_slots_latest!.value);
    expect(toLayout(years.years[0]!).slots).toBe(facts.seedhead_slots_1990!.value);
    expect(latest.years[0]).toEqual(years.years.at(-1));
  });
  it("PEOPLE state has one grain per slot and COUNTRIES one seed per ranked country", () => {
    const L = toLayout(latest.years[0]!);
    expect(peopleState(L, { seams: true }).key.length).toBe(L.slots);
    expect(countriesState(L, null).key.length).toBe(L.order.length);
  });
});

describe("territory ownership comes from the artifact only", () => {
  it("decodes base64 owner bytes exactly", () => {
    expect([...decodeOwner("AAEC/w==")]).toEqual([0, 1, 2, 255]);
  });
  it("every grain's key names the artifact owner of its slot", () => {
    const L = toLayout(latest.years[0]!), s = peopleState(L, { seams: true });
    for (let i = 0; i < L.slots; i++) expect(s.key[i]!.slice(0, 3)).toBe(L.order[L.owner[i]!]);
  });
  for (const y of [years.years[0]!, years.years[17]!, latest.years[0]!]) {
    it(`${y.year}: connectivity recomputed on the TS lattice equals the published value`, () => {
      const c = connectivity(toLayout(y));
      expect(Math.min(...c)).toBeCloseTo(y.connectivity.min, 3);
      expect(c.reduce((a, b) => a + b, 0) / c.length).toBeCloseTo(y.connectivity.mean, 3);
      expect(c.filter((v) => v < 0.95).length).toBe(y.connectivity.below_95);
    });
  }
});

describe("seams and glyph area", () => {
  const L = toLayout(latest.years[0]!), seam = seamMask(L), nb = knn6(L.slots), s = peopleState(L, { seams: true });
  it("seams are symmetric: both sides of every border thin (rank-neutral)", () => {
    for (let i = 0; i < L.slots; i++) for (let k = 0; k < 6; k++) {
      const j = nb[i * 6 + k]!, a = L.owner[i]!, b = L.owner[j]!;
      if (a === b || L.counts[a]! <= NO_SEAM_MAX || L.counts[b]! <= NO_SEAM_MAX) continue;
      expect(seam[i]).toBe(1);
      expect(seam[j]).toBe(1);
    }
  });
  it("glyph area / base area = area_scale for every grain", () => {
    for (let i = 0; i < L.slots; i++) {
      const base = seam[i] ? R_SEAM : R_IN;
      expect((s.r[i]! / base) ** 2).toBeCloseTo(L.areaScale[L.owner[i]!]!, 6);
    }
  });
});

describe("transitions: straight lines, switched colour, keyed coalesce", () => {
  const L = toLayout(latest.years[0]!);
  const bins = new Map(L.order.map((iso, i) => [iso, i % 7]));
  const sorted = peopleState(L, { seams: false, bins });
  const shuffled = peopleState(L, { seams: false, bins, perm: shuffle(L.slots, 20261010) });
  const tr = between(shuffled, sorted, { t0: 0, dur: 1600 });
  it("t = 0 is the shuffled state, t = end is the owned slot", () => {
    for (const i of [0, 17, 4000, L.slots - 1]) {
      expect(evalSeed(tr, i, 0).x).toBeCloseTo(shuffled.x[i]!, 5);
      expect(evalSeed(tr, i, 1600).x).toBeCloseTo(sorted.x[i]!, 5);
      expect(evalSeed(tr, i, 1600).y).toBeCloseTo(sorted.y[i]!, 5);
    }
  });
  it("paths are straight: every mid-flight point is collinear with its endpoints", () => {
    for (const i of [3, 99, 7000]) {
      const m = evalSeed(tr, i, 700), ax = shuffled.x[i]!, ay = shuffled.y[i]!, bx = sorted.x[i]!, by = sorted.y[i]!;
      expect(Math.abs((bx - ax) * (m.y - ay) - (by - ay) * (m.x - ax))).toBeLessThan(1e-3);
    }
  });
  it("colour switches, never blends (bins are always one of the two endpoint bins)", () => {
    const dust = peopleState(L, { seams: false, bins: null, perm: shuffle(L.slots, 20261010) });
    const t2 = between(dust, shuffled, { t0: 0, dur: 300, switchAt: 0 });
    for (const now of [-1, 0, 150, 299, 300]) {
      const b = evalSeed(t2, 5, now).bin;
      expect([-1, shuffled.bin[5]]).toContain(b);
    }
  });
  it("coalesce: grains k > 0 travel to their country seed and vanish; burst is the inverse", () => {
    const C = countriesState(L, bins), co = between(sorted, C, { t0: 0, dur: 800, absorb: true });
    const end = stateAt(co, 801);
    expect(end.key.length).toBe(L.order.length);
    const i = co.key.indexOf("CHN:500"), host = C.key.indexOf("CHN:0");
    const v = evalSeed(co, i, 800);
    expect(v.x).toBeCloseTo(C.x[host]!, 5);
    expect(v.alpha).toBe(0);
    const burst = stateAt(between(C, sorted, { t0: 0, dur: 800, absorb: true }), 801);
    expect(burst.key.length).toBe(L.slots);
  });
});

describe("DR-9 colour bins and the rank-order bound (P05-DATA-003)", () => {
  const ind = read<{ indicators: { id: string; display: { bins: number[] } }[] }>("indicators.json").indicators.find((i) => i.id === "gdppc_ppp")!;
  const valueAt = (iso: string, year: number) => panel.series.gdppc_ppp!.values[panel.iso3.indexOf(iso)]![panel.years.indexOf(year)]!;
  const has = years.years.every((y) => y.value_bin);
  it.skipIf(!has)("value_bin equals the legend bin of the published value, every country, every year", () => {
    for (const y of years.years) {
      const L = toLayout(y);
      for (const iso of L.order) {
        const v = valueAt(iso, y.year), b = ind.display.bins.filter((e) => e <= v).length;
        expect(L.bins!.get(iso), `${iso} ${y.year}`).toBe(b);
      }
    }
  });
  it.skipIf(!years.years.every((y) => y.rank_order))("rank order: Spearman(rank, centroid radius) recomputed on the TS lattice matches the published value and is >= 0.85", () => {
    const rank = (a: number[]) => { const o = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]); const r = new Array<number>(a.length); o.forEach(([, i], k) => (r[i] = k)); return r; };
    for (const y of [...years.years, latest.years[0]!]) {
      const L = toLayout(y), sum = new Float64Array(L.order.length);
      for (let i = 0; i < L.slots; i++) sum[L.owner[i]!]! += Math.hypot(vogelX(i), vogelY(i));
      const cr = [...sum].map((s, c) => s / L.counts[c]! / Math.sqrt(L.slots));
      const rr = rank(cr), n = cr.length;
      const rho = 1 - (6 * rr.reduce((a, r, i) => a + (r - i) ** 2, 0)) / (n * (n * n - 1));
      expect(rho).toBeCloseTo(y.rank_order!.rank_radius_spearman, 2);
      expect(rho).toBeGreaterThanOrEqual(0.85);
      if (y === latest.years[0]) for (let c = 0; c < 10; c++) expect(cr[c]).toBeLessThanOrEqual(0.25);
    }
  });
});
