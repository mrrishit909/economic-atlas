/**
 * The Seed Head lattice and DR-1 layouts (VISUAL_DESIGN section 0, MOTION_SYSTEM 4).
 * World units: slot spacing 1, so slot i sits at sqrt(i + 0.5) (cos iG, sin iG) and every slot
 * has area 1 (one million people). This is analytics/seedhead.py lattice(n) scaled by sqrt(n),
 * so ownership decoded from the artifact lands on exactly the slots the pipeline solved on.
 * The browser never solves territories (DR-1): `owner` comes from the artifact only.
 */
export const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** Territories of this many slots or fewer never seam, so small countries never dissolve. */
export const NO_SEAM_MAX = 6;

export interface NoData { iso3: string; population: number }
export interface Layout {
  year: number;
  order: string[];
  counts: number[];
  areaScale: number[];
  /** owner[slot] = index into order */
  owner: Uint8Array;
  slots: number;
  peopleMillions: number;
  noData: NoData[];
  medianPerson: { iso3: string; value: number };
  /** DR-9 colour bin per country (0..6), when the layout file carries value_bin */
  bins?: Map<string, number>;
}

export function vogelX(i: number) { return Math.sqrt(i + 0.5) * Math.cos(i * GOLDEN); }
export function vogelY(i: number) { return Math.sqrt(i + 0.5) * Math.sin(i * GOLDEN); }
/** Disc radius in world units of an n-slot lattice (R = s sqrt(n) in px). */
export const discRadius = (n: number) => Math.sqrt(n);

export function decodeOwner(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const knnCache = new Map<number, Int32Array>();
/** 6 nearest neighbours of every slot of an n-slot lattice (spatial grid, exact). Cached per n. */
export function knn6(n: number): Int32Array {
  const hit = knnCache.get(n);
  if (hit) return hit;
  const K = 6, R = Math.sqrt(n) + 1, cell = 2, side = Math.ceil((2 * R) / cell);
  const head = new Int32Array(side * side).fill(-1), next = new Int32Array(n);
  const xs = new Float64Array(n), ys = new Float64Array(n);
  const ci = (v: number) => Math.min(side - 1, Math.max(0, Math.floor((v + R) / cell)));
  for (let i = 0; i < n; i++) {
    xs[i] = vogelX(i); ys[i] = vogelY(i);
    const c = ci(ys[i]!) * side + ci(xs[i]!);
    next[i] = head[c]!; head[c] = i;
  }
  const out = new Int32Array(n * K);
  const bd = new Float64Array(K), bi = new Int32Array(K);
  for (let i = 0; i < n; i++) {
    bd.fill(Infinity); bi.fill(-1);
    const cx = ci(xs[i]!), cy = ci(ys[i]!);
    // ring 2 (cells of 2 units) always covers the 6-NN: lattice spacing is about 1
    for (let gy = Math.max(0, cy - 2); gy <= Math.min(side - 1, cy + 2); gy++) {
      for (let gx = Math.max(0, cx - 2); gx <= Math.min(side - 1, cx + 2); gx++) {
        for (let j = head[gy * side + gx]!; j >= 0; j = next[j]!) {
          if (j === i) continue;
          const d = (xs[j]! - xs[i]!) ** 2 + (ys[j]! - ys[i]!) ** 2;
          if (d >= bd[K - 1]!) continue;
          let k = K - 1;
          while (k > 0 && bd[k - 1]! > d) { bd[k] = bd[k - 1]!; bi[k] = bi[k - 1]!; k--; }
          bd[k] = d; bi[k] = j;
        }
      }
    }
    out.set(bi, i * K);
  }
  knnCache.set(n, out);
  return out;
}

/**
 * Per slot: 1 when a neighbour in the undirected 6-NN graph belongs to another country (and its own
 * territory can seam). Both ends of every cross-border edge are marked, so seams are symmetric.
 */
export function seamMask(L: Layout): Uint8Array {
  const nb = knn6(L.slots), m = new Uint8Array(L.slots);
  const can = (i: number) => L.counts[L.owner[i]!]! > NO_SEAM_MAX;
  for (let i = 0; i < L.slots; i++) for (let k = 0; k < 6; k++) {
    const j = nb[i * 6 + k]!;
    if (L.owner[j] === L.owner[i]) continue;
    if (can(i)) m[i] = 1;
    if (can(j)) m[j] = 1;
  }
  return m;
}

/** k index of every slot inside its territory, in lattice order (the (iso3, k) key of MOTION_SYSTEM 1.8). */
export function grainIndex(L: Layout): Int32Array {
  const seen = new Int32Array(L.order.length), k = new Int32Array(L.slots);
  for (let i = 0; i < L.slots; i++) k[i] = seen[L.owner[i]!]!++;
  return k;
}

/** Slot count per country index, recounted from the owner array (must equal counts). */
export function ownedCounts(L: Layout): number[] {
  const c = new Array<number>(L.order.length).fill(0);
  for (let i = 0; i < L.slots; i++) c[L.owner[i]!]!++;
  return c;
}

/** Per-country fraction of slots in its largest within-territory 6-NN component (analytics/seedhead.py connectivity). */
export function connectivity(L: Layout): number[] {
  const nb = knn6(L.slots), parent = Int32Array.from({ length: L.slots }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
  for (let i = 0; i < L.slots; i++) for (let k = 0; k < 6; k++) {
    const j = nb[i * 6 + k]!;
    if (L.owner[j] === L.owner[i]) parent[find(i)] = find(j);
  }
  const size = new Map<number, number>(), best = new Array<number>(L.order.length).fill(0);
  for (let i = 0; i < L.slots; i++) { const r = find(i); size.set(r, (size.get(r) ?? 0) + 1); }
  for (const [r, s] of size) { const o = L.owner[r]!; best[o] = Math.max(best[o]!, s); }
  return best.map((b, o) => b / L.counts[o]!);
}

/** Territory centroids in world units (labels, FOLLOW). */
export function centroids(L: Layout): Float64Array {
  const c = new Float64Array(L.order.length * 3);
  for (let i = 0; i < L.slots; i++) {
    const o = L.owner[i]! * 3;
    c[o]! += vogelX(i); c[o + 1]! += vogelY(i); c[o + 2]!++;
  }
  for (let o = 0; o < L.order.length; o++) { c[o * 3]! /= c[o * 3 + 2]!; c[o * 3 + 1]! /= c[o * 3 + 2]!; }
  return c;
}

/** Seeded Fisher-Yates (mulberry32), the S00 dust shuffle (seed 20261010, the pipeline's seed). */
export function shuffle(n: number, seed: number): Int32Array {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const p = Int32Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j]!, p[i]!]; }
  return p;
}

/** Deterministic per-index jitter in [0, 1) (staggers and delays), independent of call order. */
export function hash01(i: number, salt = 0): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
