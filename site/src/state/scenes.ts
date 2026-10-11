/**
 * Visitor-set scene parameters (interactions 2 and 3). Tiny external stores: the director writes the
 * scroll-driven parts, controls write the visitor's choices, React reads through useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";

export function store<T extends object>(init: T) {
  let v = init;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set(p: Partial<T>) {
      const n = { ...v, ...p };
      if (Object.keys(p).every((k) => Object.is(n[k as keyof T], v[k as keyof T]))) return;
      v = n;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => { subs.add(f); return () => void subs.delete(f); },
    init,
  };
}
export type Store<T extends object> = ReturnType<typeof store<T>>;
export const useStore = <T extends object>(s: Store<T>) => useSyncExternalStore(s.subscribe, s.get, s.get);

/** S03a: integer year (0 until the years file is ready) and FOLLOW. */
export const years = store({ year: 0, follow: null as string | null });

export type Count = "people" | "countries";
/** S03b: the weight state. `user` marks a visitor override that holds until the next scroll step. */
export const weight = store({ count: "people" as Count, year: 0, setAside: false, step: 0, user: false });

/** S00 intro + renderer status shown in the DOM. */
export const view = store({ tier: "high" as "high" | "low" | "nogl", lost: false, slots: 0, mode: "people" as Count, scene: "" });

/** S04: the window step shown (0 = 1990, 1 = 2000, 2 = 2010) and the scrubbed flight 0..1. */
export const catchup = store({ step: 0, flight: 0 });

export type Basis = "ppp" | "const";
export const LAB_DEFAULT = { basis: "ppp" as Basis, start: 1990, sample: "primary" };
/** S05: the visitor's lab choice (tour sets it below p 0.3) and the basis currently drawn (swaps at the neutral phase). */
/** S05: the visitor's lab choice and the record actually drawn. Every unit-bearing element reads `shownId`, which
 * flips in one store update inside the neutral phase of a basis swap (QA L18). */
export const lab = store({ ...LAB_DEFAULT, live: false, shownBasis: "ppp" as Basis, shownId: "gdppc_ppp_1990_2025_primary" });

/** S06: part 1 groups (method) / part 2 relations (a, b). */
export const likeness = store({ part: 1, method: "kmeans" as "kmeans" | "ward", a: "ln_gdppc_ppp", b: "ln_productivity", free: false });

/** ATLAS store (VISUAL_DESIGN 3.4 cross-filter contract). `shownInd` is the indicator the canvas/legend show (after a swap). */
export const ATLAS_DEFAULT = { ind: "gdppc_ppp", year: 0, period: [2000, 0] as [number, number], values: "level" as "level" | "index", count: "people" as Count, selected: [] as string[] };
export const atlas = store({ ...ATLAS_DEFAULT, shownInd: "gdppc_ppp", touched: false });

/** Country inspector (interaction 9): the inspected country and the element focus returns to. */
export const inspector = store({ iso: null as string | null, returnTo: null as HTMLElement | null });
