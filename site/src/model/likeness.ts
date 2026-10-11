/**
 * S06 Likeness (VISUAL_DESIGN 3.4): peer groups are DESCRIPTIVE (weak silhouette), drawn as three
 * discs ordered by how well each member fits (silhouette, best at the core); relations order seeds by
 * the rank of A and colour them by the rank of B (Spearman is a rank statistic).
 */
export interface Clusters {
  assignments: { iso3: string[]; cluster: number[]; silhouette: number[] };
  clusters: { id: number; size: number; signature: string; members: string[] }[];
  hierarchical: { labels_matched: number[]; disagree_count: number; ari_vs_kmeans: number };
  stability: { bootstrap_ari_mean: number };
  k_scan: { k: number; silhouette: number }[];
  chosen_k: number;
  inclusion: { complete_cases: number; countries: number; excluded: unknown[] };
  tag_detail?: string;
}
export interface Pair { a: string; b: string; rho: number; ci95: [number, number]; n: number }
export interface Correlations { iso3: string[]; indicators: string[]; values: Record<string, (number | null)[]>; pairs: Pair[]; not_causal: string; window?: unknown; transforms: Record<string, string> }

export function groupsFor(c: Clusters, method: "kmeans" | "ward", allIso: string[]) {
  const a = c.assignments, at = new Map(a.iso3.map((iso, i) => [iso, i]));
  const groups = c.clusters.map((g) => ({
    id: g.id,
    members: [...g.members].sort((x, y) => a.silhouette[at.get(y)!]! - a.silhouette[at.get(x)!]! || (x < y ? -1 : 1)),
  }));
  const hollow = new Set(a.iso3.filter((_, i) => (method === "ward" ? c.hierarchical.labels_matched[i] !== a.cluster[i] : a.silhouette[i]! < 0)));
  const ungrouped = allIso.filter((iso) => !at.has(iso)).sort();
  return { groups, hollow, ungrouped };
}

export const pairOf = (c: Correlations, a: string, b: string) => c.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)) ?? null;

/** Countries with both A and B, ordered by A descending (ties by iso3), with B values. */
export function relationFor(c: Correlations, a: string, b: string) {
  const A = c.values[a]!, B = c.values[b]!;
  const isos = c.iso3.filter((_, i) => A[i] !== null && B[i] !== null);
  const va = new Map(c.iso3.map((iso, i) => [iso, A[i]!])), vb = new Map(c.iso3.map((iso, i) => [iso, B[i]!]));
  const order = [...isos].sort((x, y) => va.get(y)! - va.get(x)! || (x < y ? -1 : 1));
  return { order, vb };
}

/** Spearman rho with average ranks (for the parity test). */
export function spearman(x: number[], y: number[]) {
  const rank = (v: number[]) => {
    const o = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]), r = new Array<number>(v.length);
    for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1]![0] === o[i]![0]) j++; for (let k = i; k <= j; k++) r[o[k]![1]] = (i + j) / 2; i = j + 1; }
    return r;
  };
  const rx = rank(x), ry = rank(y), n = x.length, mx = (n - 1) / 2;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i]! - mx) * (ry[i]! - mx); sxx += (rx[i]! - mx) ** 2; syy += (ry[i]! - mx) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
