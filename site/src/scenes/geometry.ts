/**
 * Disc geometry states (VISUAL_DESIGN 3.3), in CSS px for the three reference viewports, scaled to
 * the actual stage (centre by width/height, spacing by the smaller ratio). The disc radius is
 * R = s x sqrt(N), so G0 is giant on every viewport (D 640, T 620, M 510 at N = 8,005).
 * Camera moves interpolate the centre linearly and s in log space; they never animate data.
 */
import { cssClass, type ViewportClass } from "../graphics/canvas";
import type { Cam } from "../gl/seeds";

type Row = [number, number, number];
/** G5 (ATLAS) is specified by radius: its third value is R in px, so s = R / sqrt(N). */
const TABLE: Record<ViewportClass, { W: number; H: number; G0: Row; G1: Row; G2: Row; G3: Row; G5: Row }> = {
  D: { W: 1440, H: 900, G0: [900, 470, 7.15], G1: [1030, 450, 3.9], G2: [1010, 460, 4.4], G3: [1010, 450, 3.8], G5: [560, 470, 360] },
  T: { W: 768, H: 1024, G0: [300, 420, 6.93], G1: [384, 700, 3.2], G2: [384, 600, 3.9], G3: [384, 640, 3.4], G5: [384, 380, 300] },
  M: { W: 390, H: 844, G0: [195, 270, 5.7], G1: [195, 610, 2.3], G2: [195, 432, 2.25], G3: [195, 420, 2.3], G5: [195, 330, 170] },
};
export type GName = "G0" | "G1" | "G2" | "G3" | "G5";

/**
 * w, h: the stage box (canvas pixels). The composition class comes from the same width source as the
 * CSS media queries (innerWidth, ED #39), never from clientWidth, so classic scrollbars cannot split them.
 * G0 keeps its giant floor on any viewport: diameter >= 1.2 x height at N slots (criterion 19).
 */
export function gstate(g: GName, w: number, h: number, n = 8005): Cam {
  const t = TABLE[cssClass()], [cx, cy, s] = t[g];
  const k = (g === "G5" ? s / Math.sqrt(n) : s) * Math.min(w / t.W, h / t.H);
  if (compact() && (g === "G1" || g === "G2" || g === "G3")) {
    // 1024-1279 (QA L2): the disc takes the space right of the 380px text column, never under it
    const Rmax = (w - COMPACT_COL - 24) / 2, sk = Math.min(k, Rmax / Math.sqrt(8005));
    return { cx: COMPACT_COL + Rmax, cy: (cy * h) / t.H, s: sk };
  }
  return { cx: (cx * w) / t.W, cy: (cy * h) / t.H, s: g === "G0" ? Math.max(k, (0.6 * h) / Math.sqrt(n)) : k };
}

/** The compact desktop composition (1024-1279, QA L2), from the same width source as CSS. */
export const compact = () => cssClass() === "D" && (typeof innerWidth === "number" ? innerWidth : 1440) < 1280;
/** Right edge of the compact text column (margin 56 + column 380 + gap 24). */
export const COMPACT_COL = 460;
/** Map a D x coordinate of the right-hand stage band (620..1344 of 1440) into the compact band (COMPACT_COL..w-40). */
export const compactX = (x: number, w: number) => COMPACT_COL + ((x - 620) / (1344 - 620)) * (w - 40 - COMPACT_COL);

export function camLerp(a: Cam, b: Cam, t: number): Cam {
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * t) };
}

/** Label thresholds in million people (VISUAL_DESIGN section 0, Labels). */
export const LABEL_MIN: Record<ViewportClass, number> = { D: 90, T: 150, M: 250 };

/** G4b (S06 relations) centre and radius in px. */
export function g4b(w: number, h: number): { c: [number, number]; R: number } {
  const t = TABLE[cssClass()], k = Math.min(w / t.W, h / t.H);
  const [cx, cy, R] = cssClass() === "D" ? [1010, 460, 330] : cssClass() === "T" ? [384, 660, 260] : [195, 560, 150];
  if (compact()) { const Rm = Math.min(R * k, (w - COMPACT_COL - 24) / 2); return { c: [COMPACT_COL + Rm, (cy * h) / t.H], R: Rm }; }
  return { c: [(cx * w) / t.W, (cy * h) / t.H], R: R * k };
}
