/**
 * The 7-bin Spectral ramp (VISUAL_DESIGN section 0, colour semantics). Edges come from DR-7
 * (`indicators[].display.bins`, 6 strictly increasing edges); a value v falls in bin
 * #{edges <= v}, so bin 0 is below the first edge and bin 6 at or above the last.
 */
export const BIN_COLORS = ["#9A3CE0", "#C21FD6", "#FF2F7A", "#FF4F3F", "#FF6A2B", "#FFB26B", "#FFE6C9"] as const;
export const NEUTRAL = "#5A5A5A";

export function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function binOf(v: number, edges: readonly number[]): number {
  let b = 0;
  while (b < edges.length && v >= edges[b]!) b++;
  return b;
}

/**
 * Position of a value on the 7-swatch legend strip, in swatch units (0..7), log-linear inside a bin
 * (the PPP scale is "log"). The open end bins borrow their neighbour's log width. Used only to place
 * the sigma bracket, never to colour a seed.
 */
export function legendPos(v: number, edges: readonly number[]): number {
  const L = edges.map(Math.log), x = Math.log(v), n = L.length;
  const b = binOf(v, edges);
  const lo = b === 0 ? L[0]! - (L[1]! - L[0]!) : L[b - 1]!;
  const hi = b === n ? L[n - 1]! + (L[n - 1]! - L[n - 2]!) : L[b]!;
  return Math.min(7, Math.max(0, b + (x - lo) / (hi - lo)));
}
