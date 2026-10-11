/**
 * Seed states built from DR-1 layouts (VISUAL_DESIGN section 0 encoding), in world units:
 * - PEOPLE: one grain per slot, keyed (iso3, k); glyph radius r_base x sqrt(area_scale) with
 *   r_base 0.40 inside a territory and 0.30 on a seam (both sides of every border).
 * - COUNTRIES: one equal seed per country on an n-slot Vogel lattice over the same disc radius.
 * - Dust: every grain at a seeded shuffled slot, neutral, before the sort.
 * Ownership comes only from the artifact's owner array.
 */
import { grainIndex, seamMask, vogelX, vogelY, type Layout } from "./layout";
import { makeState, type SeedState } from "../gl/transition";

// ?seam=<r> overrides the seam radius for evidence comparison only (a parameter ruling, VISUAL_DESIGN section 0 fixes 0.30)
const seamQ = typeof location === "undefined" ? null : /[?&]seam=(0\.\d+)/.exec(location.search);
export const R_IN = 0.4, R_SEAM = seamQ ? Number(seamQ[1]) : 0.3, R_DUST = 0.25;

export interface PeopleOpts {
  seams: boolean;
  /** S00 dust/speckle: grain at slot i is drawn at slot perm[i] */
  perm?: Int32Array;
  bins?: Map<string, number> | null;
  setAside?: ReadonlySet<string>;
  alpha?: number;
  /** radius override (dust) */
  r?: number;
}

export function peopleState(L: Layout, o: PeopleOpts): SeedState {
  const s = makeState(L.slots), k = grainIndex(L), seam = o.seams ? seamMask(L) : null;
  for (let i = 0; i < L.slots; i++) {
    const c = L.owner[i]!, iso = L.order[c]!, at = o.perm ? o.perm[i]! : i;
    s.key[i] = `${iso}:${k[i]}`;
    s.x[i] = vogelX(at); s.y[i] = vogelY(at);
    s.r[i] = o.r ?? (seam?.[i] ? R_SEAM : R_IN) * Math.sqrt(L.areaScale[c]!);
    s.bin[i] = o.bins ? (o.bins.get(iso) ?? -1) : -1;
    s.hollow[i] = o.setAside?.has(iso) ? 1 : 0;
    s.alpha[i] = o.alpha ?? 1;
  }
  return s;
}

/** COUNTRIES mode: rank j at sqrt(Np / n) x vogel(j), so n equal seeds fill the PEOPLE disc's radius. */
export function countriesState(L: Layout, bins: Map<string, number> | null, setAside?: ReadonlySet<string>): SeedState {
  const n = L.order.length, sp = Math.sqrt(L.slots / n), s = makeState(n);
  for (let j = 0; j < n; j++) {
    const iso = L.order[j]!;
    s.key[j] = `${iso}:0`;
    s.x[j] = sp * vogelX(j); s.y[j] = sp * vogelY(j);
    s.r[j] = R_IN * sp;
    s.bin[j] = bins ? (bins.get(iso) ?? -1) : -1;
    s.hollow[j] = setAside?.has(iso) ? 1 : 0;
    s.alpha[j] = 1;
  }
  return s;
}

/** Neutral dust for n slots before any layout is known (the honest shape of "people, unsorted"). */
export function slotDust(n: number, perm: Int32Array | null, alpha: number): SeedState {
  const s = makeState(n);
  for (let i = 0; i < n; i++) {
    const at = perm ? perm[i]! : i;
    s.key[i] = `#${i}`; s.x[i] = vogelX(at); s.y[i] = vogelY(at); s.r[i] = R_DUST; s.bin[i] = -1; s.alpha[i] = alpha;
  }
  return s;
}

/** Glyph area over its base slot area equals area_scale (MOTION_SYSTEM 2 area rule), per grain. */
export function glyphAreaRatio(s: SeedState, L: Layout, i: number, seam: boolean) {
  const base = seam ? R_SEAM : R_IN;
  return (s.r[i]! / base) ** 2 / L.areaScale[L.owner[i]!]!;
}

