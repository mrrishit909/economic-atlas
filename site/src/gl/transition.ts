/**
 * The seed transition model (MOTION_SYSTEM 4). A state is a keyed set of seeds in world units; a
 * transition is one per-instance attribute buffer evaluated on the GPU (gl/seeds.ts) and, with this
 * exact arithmetic, on the CPU (retargeting, the Canvas2D fallback, debug hooks).
 * Positions are mix(from, to, e(t)) on straight lines; colour SWITCHES (never blends); fades are
 * opacity windows. Keys: grains are `${iso3}:${k}`, country seeds `${iso3}:0`.
 */
import { cubicBezier } from "../motion/ease";
import { clamp } from "../lib/math";

/** bin: 0..6 Spectral, -1 neutral dust #5A5A5A, -2 white (outline overlay). */
export interface SeedState {
  key: string[];
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  bin: Int8Array;
  hollow: Float32Array;
  alpha: Float32Array;
}

export function makeState(n: number): SeedState {
  return { key: new Array<string>(n), x: new Float32Array(n), y: new Float32Array(n), r: new Float32Array(n), bin: new Int8Array(n), hollow: new Float32Array(n), alpha: new Float32Array(n) };
}

export type Bez = readonly [number, number, number, number];
export const BEZ = {
  premium: [0.5, 0, 0, 1] as Bez,
  symmetric: [0.5, 0, 0.5, 1] as Bez,
  smooth: [0.33, 1, 0.68, 1] as Bez,
  linear: [0, 0, 1, 1] as Bez,
};

/** Per-instance layout, 16 floats: from.xy to.xy r.from r.to bin.from bin.to hollow.from hollow.to alpha.from alpha.to fadeA fadeB delay switch */
export const STRIDE = 16;
export interface Transition {
  n: number;
  data: Float32Array;
  key: string[];
  t0: number;
  dur: number;
  bez: Bez;
  /** largest delay (ms): the transition is at rest after t0 + maxDelay + dur */
  maxDelay: number;
  /** bumped on every rebuild so the GPU re-uploads */
  version: number;
}

let version = 0;
const bezCache = new Map<string, (t: number) => number>();
export function easeOf(b: Bez) {
  const k = b.join(",");
  let f = bezCache.get(k);
  if (!f) { f = cubicBezier(b[0], b[1], b[2], b[3]); bezCache.set(k, f); }
  return f;
}

/** A transition that holds one state (no motion). */
export function staticOf(s: SeedState): Transition {
  return between(s, s, { dur: 0, t0: 0 });
}

export interface BetweenOpts {
  dur: number;
  t0: number;
  bez?: Bez;
  /** per seed delay in ms, by output index and key */
  delay?: (key: string, i: number) => number;
  /** fraction of the seed's own time at which the colour (and nothing else) switches: 1 = on landing */
  switchAt?: number;
  /**
   * Coalesce / burst: a grain without a partner travels to (or emerges from) its country's
   * `iso3:0` seed and fades over the last (first) 25%, instead of fading in place.
   */
  absorb?: boolean;
}

const iso = (k: string) => k.slice(0, k.indexOf(":"));

/** Keyed transition between two states (MOTION_SYSTEM 4 keyed mapping). */
export function between(a: SeedState, b: SeedState, o: BetweenOpts): Transition {
  const ai = new Map<string, number>(), bi = new Map<string, number>();
  a.key.forEach((k, i) => ai.set(k, i));
  b.key.forEach((k, i) => bi.set(k, i));
  const keys: string[] = [], pairs: [number, number][] = [];
  for (let i = 0; i < a.key.length; i++) { keys.push(a.key[i]!); pairs.push([i, bi.get(a.key[i]!) ?? -1]); }
  for (let j = 0; j < b.key.length; j++) if (!ai.has(b.key[j]!)) { keys.push(b.key[j]!); pairs.push([-1, j]); }
  const n = keys.length, d = new Float32Array(n * STRIDE);
  let maxDelay = 0;
  const sw = o.switchAt ?? 1;
  for (let i = 0; i < n; i++) {
    const [p, q] = pairs[i]!, k = keys[i]!, o16 = i * STRIDE;
    let fx: number, fy: number, tx: number, ty: number, fr: number, tr: number, fb: number, tb: number, fh: number, th: number, fa: number, ta: number, wa = 0, wb = 1;
    if (p >= 0 && q >= 0) {
      fx = a.x[p]!; fy = a.y[p]!; tx = b.x[q]!; ty = b.y[q]!; fr = a.r[p]!; tr = b.r[q]!;
      fb = a.bin[p]!; tb = b.bin[q]!; fh = a.hollow[p]!; th = b.hollow[q]!; fa = a.alpha[p]!; ta = b.alpha[q]!;
    } else if (p >= 0) {
      // leaving: absorbed into its country seed, or faded out in place
      const host = o.absorb ? bi.get(`${iso(k)}:0`) : undefined;
      fx = a.x[p]!; fy = a.y[p]!; fr = a.r[p]!; fb = a.bin[p]!; fh = a.hollow[p]!; fa = a.alpha[p]!;
      tb = fb; th = fh; ta = 0;
      if (host !== undefined) { tx = b.x[host]!; ty = b.y[host]!; tr = b.r[host]!; tb = b.bin[host]!; wa = 0.75; wb = 1; }
      else { tx = fx; ty = fy; tr = fr; wa = 0; wb = 0.3; }
    } else {
      const host = o.absorb ? ai.get(`${iso(k)}:0`) : undefined;
      tx = b.x[q]!; ty = b.y[q]!; tr = b.r[q]!; tb = b.bin[q]!; th = b.hollow[q]!; ta = b.alpha[q]!;
      fb = tb; fh = th; fa = 0;
      if (host !== undefined) { fx = a.x[host]!; fy = a.y[host]!; fr = a.r[host]!; fb = a.bin[host]!; wa = 0; wb = 0.25; }
      else { fx = tx; fy = ty; fr = tr; wa = 0.7; wb = 1; }
    }
    const dl = o.delay ? o.delay(k, i) : 0;
    if (dl > maxDelay) maxDelay = dl;
    d[o16] = fx; d[o16 + 1] = fy; d[o16 + 2] = tx; d[o16 + 3] = ty;
    d[o16 + 4] = fr; d[o16 + 5] = tr; d[o16 + 6] = fb; d[o16 + 7] = tb;
    d[o16 + 8] = fh; d[o16 + 9] = th; d[o16 + 10] = fa; d[o16 + 11] = ta;
    d[o16 + 12] = wa; d[o16 + 13] = wb; d[o16 + 14] = dl; d[o16 + 15] = sw;
  }
  return { n, data: d, key: keys, t0: o.t0, dur: o.dur, bez: o.bez ?? BEZ.smooth, maxDelay, version: ++version };
}

export const atRest = (t: Transition, now: number) => now >= t.t0 + t.maxDelay + t.dur;

/** Raw (unclamped) local time of seed i: the shader's `lt`. */
function rawT(t: Transition, i: number, now: number) {
  return t.dur > 0 ? (now - t.t0 - t.data[i * STRIDE + 14]!) / t.dur : 1;
}

/** Evaluate seed i at `now` (the vertex shader, on the CPU). */
export function evalSeed(t: Transition, i: number, now: number) {
  const d = t.data, o = i * STRIDE, raw = rawT(t, i, now), lt = clamp(raw), e = easeOf(t.bez)(lt);
  const fade = (lt - d[o + 12]!) / Math.max(1e-6, d[o + 13]! - d[o + 12]!);
  const sm = clamp(fade);
  const w = sm * sm * (3 - 2 * sm);
  return {
    x: d[o]! + (d[o + 2]! - d[o]!) * e,
    y: d[o + 1]! + (d[o + 3]! - d[o + 1]!) * e,
    r: d[o + 4]! + (d[o + 5]! - d[o + 4]!) * e,
    bin: raw >= d[o + 15]! ? d[o + 7]! : d[o + 6]!,
    hollow: d[o + 8]! + (d[o + 9]! - d[o + 8]!) * e,
    alpha: d[o + 10]! + (d[o + 11]! - d[o + 10]!) * w,
  };
}

/** The current state of a transition at `now` (retargeting: the new transition starts from here). Invisible seeds are dropped. */
export function stateAt(t: Transition, now: number): SeedState {
  const keep: number[] = [];
  const vals: ReturnType<typeof evalSeed>[] = [];
  for (let i = 0; i < t.n; i++) {
    const v = evalSeed(t, i, now);
    if (v.alpha <= 1e-3) continue;
    keep.push(i); vals.push(v);
  }
  const s = makeState(keep.length);
  keep.forEach((i, j) => {
    const v = vals[j]!;
    s.key[j] = t.key[i]!; s.x[j] = v.x; s.y[j] = v.y; s.r[j] = v.r; s.bin[j] = v.bin; s.hollow[j] = v.hollow; s.alpha[j] = v.alpha;
  });
  return s;
}
