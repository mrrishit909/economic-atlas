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
