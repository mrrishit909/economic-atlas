/**
 * Narrative rendering (narratives.json rule + pair_rule): text is produced ONLY by substituting
 * published per-country inputs into published templates; a pair may use a - b ({diff.k}) or a / b
 * ({ratio.k}) of two published inputs and nothing else. A template with a null required input is not
 * shown. The formatter mirrors Python's format() (analytics/narratives.py fmt): half-even on exact
 * binary ties, thousands separators for n0, an explicit sign for s1 (including -0.0).
 */
export type Inputs = Record<string, number | string | null>;
export interface Template { id: string; requires: string[]; text: string }

function fixed(v: number, d: number): string {
  let s = Math.abs(v).toFixed(d);
  const scaled = Math.abs(v) * 10 ** d;
  // exact binary tie (x.5 after scaling): JS rounds away from zero, Python to even
  if (!Number.isInteger(scaled) && Number.isInteger(scaled * 2)) {
    const down = Math.floor(scaled);
    s = (down % 2 === 0 ? down : down + 1).toString();
    s = d ? `${s.slice(0, -d) || "0"}.${s.slice(-d).padStart(d, "0")}` : s;
  }
  const neg = v < 0 || Object.is(v, -0);
  return neg ? `-${s}` : s;
}

export function fmt(v: number | string, f: string | undefined): string {
  if (typeof v === "string" || !f) return String(v);
  if (f === "n0") {
    const s = fixed(v, 0), neg = s.startsWith("-"), body = neg ? s.slice(1) : s;
    return (neg ? "-" : "") + body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  if (f === "d1" || f === "d2" || f === "d3") return fixed(v, Number(f[1]));
  if (f === "s1") { const s = fixed(v, 1); return s.startsWith("-") ? s : `+${s}`; }
  return String(v);
}

export function render(t: Template, inputs: Inputs): string | null {
  if (t.requires.some((k) => inputs[k] === null || inputs[k] === undefined)) return null;
  return t.text.replace(/\{(\w+)(?:\|(\w+))?\}/g, (_, k: string, f?: string) => fmt(inputs[k]!, f));
}

function pairValue(side: string, key: string, a: Inputs, b: Inputs): number | string | null {
  if (side === "a") return a[key] ?? null;
  if (side === "b") return b[key] ?? null;
  const x = a[key], y = b[key];
  if (typeof x !== "number" || typeof y !== "number" || (side === "ratio" && y === 0)) return null;
  return side === "diff" ? x - y : x / y;
}

export function renderPair(t: Template, a: Inputs, b: Inputs): string | null {
  for (const r of t.requires) { const [side, key] = r.split(".", 2) as [string, string]; if (pairValue(side, key, a, b) === null) return null; }
  return t.text.replace(/\{(\w+)\.(\w+)(?:\|(\w+))?\}/g, (_, s: string, k: string, f?: string) => fmt(pairValue(s, k, a, b)!, f));
}
