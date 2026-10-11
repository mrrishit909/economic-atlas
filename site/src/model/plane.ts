/**
 * The catch-up plane (VISUAL_DESIGN 3.3 PL, 3.4 S04/S05): x = ln income in the window's start year,
 * y = growth in % per year. Domains come from all records of one basis, so a window or sample change
 * never rescales the axes; a basis change swaps domains only inside the neutral phase.
 * The fit is drawn from the record's own intercept and beta (never tweened); its 95% band is
 * y_hat +- t(n-2) sqrt(x' V x) with V = the record's vcov_hc3 (DR-6).
 */
export interface Points { iso3: string[]; x: number[]; y: number[]; weight: (number | null)[]; population_start?: (number | null)[] }
export interface BetaRecord {
  id: string; indicator: string; price_basis: string; start: number; end: number; sample: string;
  beta: number; intercept: number; ci95: [number, number]; ci95_boot: [number, number]; n: number; r2: number;
  half_life_years: number | null; vcov_hc3: [[number, number], [number, number]]; x_domain: [number, number];
  points?: Points; dropped_no_start_data: number; excluded_territory_changes: string[];
}

export interface Rect { x0: number; x1: number; y0: number; y1: number }
export interface Domain { x: [number, number]; y: [number, number] }

/** One domain per basis, over every record of that basis (padded 4%). */
export function domainOf(records: BetaRecord[], indicator: string): Domain {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const r of records) {
    if (r.indicator !== indicator) continue;
    if (!r.points) continue;
    for (let i = 0; i < r.points.x.length; i++) {
      x0 = Math.min(x0, r.points.x[i]!); x1 = Math.max(x1, r.points.x[i]!);
      y0 = Math.min(y0, r.points.y[i]!); y1 = Math.max(y1, r.points.y[i]!);
    }
  }
  const px = (x1 - x0) * 0.04, py = (y1 - y0) * 0.04;
  return { x: [x0 - px, x1 + px], y: [y0 - py, y1 + py] };
}

export const sx = (d: Domain, r: Rect, x: number) => r.x0 + ((x - d.x[0]) / (d.x[1] - d.x[0])) * (r.x1 - r.x0);
export const sy = (d: Domain, r: Rect, y: number) => r.y1 - ((y - d.y[0]) / (d.y[1] - d.y[0])) * (r.y1 - r.y0);

/**
 * Student t 97.5% quantile by the Cornish-Fisher expansion around z = 1.959964 (Abramowitz and Stegun
 * 26.7.5); error under 1e-5 for df >= 20 (every published fit has n >= 30). Tested against scipy.
 */
export function t975(df: number): number {
  const z = 1.959963984540054, z3 = z ** 3, z5 = z ** 5, z7 = z ** 7, z9 = z ** 9;
  return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3)
    + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92160 * df ** 4);
}

/** The fitted value and its 95% band half-width at x. */
export function fitAt(r: BetaRecord, x: number) {
  const V = r.vcov_hc3, se = Math.sqrt(V[0][0] + 2 * x * V[0][1] + x * x * V[1][1]);
  return { y: r.intercept + r.beta * x, half: t975(r.n - 2) * se };
}

/** Verdict branch (copy deck S04): the interval below, across or above zero. */
export const verdictOf = (r: BetaRecord): "below" | "spans" | "above" => (r.ci95[1] < 0 ? "below" : r.ci95[0] > 0 ? "above" : "spans");
/** The half-life is shown only when it is defined AND the CI lies below zero (section 2 graft). */
export const halfLifeShown = (r: BetaRecord) => r.half_life_years !== null && r.ci95[1] < 0;

/** Record id for a lab choice (all 42 combinations are published). */
export const recordId = (indicator: string, start: number, end: number, sample: string) => `${indicator}_${start}_${end}_${sample}`;

/** x labels at 1K, 3K, 10K, 30K, 100K that fall inside the domain. */
export function xTicks(d: Domain) {
  return [1e3, 3e3, 1e4, 3e4, 1e5].map((v) => ({ v, x: Math.log(v), label: v >= 1e3 ? `${v / 1e3}K` : String(v) })).filter((t) => t.x >= d.x[0] && t.x <= d.x[1]);
}

/** Panel values used only to complete sensitivity_all points: series[ci][yi] in the indicator's basis. */
export interface PanelSlice { iso3: string[]; years: number[]; values: (number | null)[][] }

/**
 * Points of any record. Only primary and pop_weighted records publish points; the others are exact
 * subsets or supersets of them (checked against each record's n in plane.test.ts):
 * terciles = primary points inside the record's x_domain; *_ex_chn_ind = pop_weighted minus CHN and IND;
 * sensitivity_all = primary plus the territory-change countries, computed with the published growth
 * formula 100 (ln y_end - ln y_start) / T from panel values (DERIVED).
 */
export function pointsFor(r: BetaRecord, all: BetaRecord[], panel: PanelSlice | null): Points | null {
  if (r.points) return r.points;
  const base = (sample: string) => all.find((x) => x.indicator === r.indicator && x.start === r.start && x.end === r.end && x.sample === sample)?.points;
  const pick = (p: Points, keep: (i: number) => boolean): Points => {
    const idx = p.iso3.map((_, i) => i).filter(keep);
    return { iso3: idx.map((i) => p.iso3[i]!), x: idx.map((i) => p.x[i]!), y: idx.map((i) => p.y[i]!), weight: idx.map((i) => p.weight[i] ?? null) };
  };
  if (r.sample.startsWith("tercile")) {
    const p = base("primary");
    return p ? pick(p, (i) => p.x[i]! >= r.x_domain[0] - 1e-9 && p.x[i]! <= r.x_domain[1] + 1e-9) : null;
  }
  if (r.sample === "pop_weighted_ex_chn_ind") {
    const p = base("pop_weighted");
    return p ? pick(p, (i) => p.iso3[i] !== "CHN" && p.iso3[i] !== "IND") : null;
  }
  if (r.sample === "sensitivity_all") {
    const prim = all.find((x) => x.indicator === r.indicator && x.start === r.start && x.end === r.end && x.sample === "primary"), p = prim?.points;
    if (!p || !panel) return null;
    const out: Points = { iso3: [...p.iso3], x: [...p.x], y: [...p.y], weight: p.iso3.map(() => null) };
    const ys = panel.years.indexOf(r.start), ye = panel.years.indexOf(r.end);
    for (const iso of prim!.excluded_territory_changes) {
      const ci = panel.iso3.indexOf(iso), a = panel.values[ci]?.[ys], b = panel.values[ci]?.[ye];
      if (!a || !b) continue;
      out.iso3.push(iso); out.x.push(Math.log(a)); out.y.push((100 * (Math.log(b) - Math.log(a))) / (r.end - r.start)); out.weight.push(null);
    }
    // the panel starts in 1990: constant-USD windows from 1960/1980 cannot be completed (DR-10 requested)
    return out.iso3.length === r.n ? out : null;
  }
  return null;
}
