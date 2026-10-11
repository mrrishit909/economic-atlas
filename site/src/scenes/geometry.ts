/**
 * Disc geometry states (VISUAL_DESIGN 3.3), in CSS px for the three reference viewports, scaled to
 * the actual stage (centre by width/height, spacing by the smaller ratio). The disc radius is
 * R = s x sqrt(N), so G0 is giant on every viewport (D 640, T 620, M 510 at N = 8,005).
 * Camera moves interpolate the centre linearly and s in log space; they never animate data.
 */
import { viewportClass, type ViewportClass } from "../graphics/canvas";
import type { Cam } from "../gl/seeds";

type Row = [number, number, number];
const TABLE: Record<ViewportClass, { W: number; H: number; G0: Row; G1: Row; G2: Row; G3: Row }> = {
  D: { W: 1440, H: 900, G0: [900, 470, 7.15], G1: [1030, 450, 3.9], G2: [1010, 460, 4.4], G3: [1010, 450, 3.8] },
  T: { W: 768, H: 1024, G0: [300, 420, 6.93], G1: [384, 700, 3.2], G2: [384, 600, 3.9], G3: [384, 640, 3.4] },
  M: { W: 390, H: 844, G0: [195, 270, 5.7], G1: [195, 610, 2.3], G2: [195, 440, 2.6], G3: [195, 420, 2.3] },
};
export type GName = "G0" | "G1" | "G2" | "G3";

export function gstate(g: GName, w: number, h: number): Cam {
  const t = TABLE[viewportClass(w)], [cx, cy, s] = t[g];
  return { cx: (cx * w) / t.W, cy: (cy * h) / t.H, s: s * Math.min(w / t.W, h / t.H) };
}

export function camLerp(a: Cam, b: Cam, t: number): Cam {
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * t) };
}

/** Label thresholds in million people (VISUAL_DESIGN section 0, Labels). */
export const LABEL_MIN: Record<ViewportClass, number> = { D: 90, T: 150, M: 250 };
