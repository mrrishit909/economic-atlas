/**
 * Country-seed states outside the disc (S04/S05 plane, S06 group discs and relations), built in CSS
 * px for the current viewport composition and converted into the disc's world units through the
 * scene camera, so the same keyed transitions (by `${iso3}:0`) carry seeds from the disc into the
 * plane and back. Builders are pure; rebuild on resize (the key includes the stage size).
 */
import { makeState, type SeedState } from "../gl/transition";
import { vogelX, vogelY } from "../model/layout";
import { binOf } from "../model/bins";
import { sx, sy, type BetaRecord, type Domain, type Points, type Rect } from "../model/plane";
import type { Cam } from "../gl/seeds";
import type { ViewportClass } from "../graphics/canvas";
import { compact, compactX } from "./geometry";

const REF = { D: [1440, 900], T: [768, 1024], M: [390, 844] } as const;
const scaleRect = (cls: ViewportClass, w: number, h: number, r: [number, number, number, number]): Rect => {
  const [W0, H0] = REF[cls];
  return { x0: (r[0] * w) / W0, x1: (r[1] * w) / W0, y0: (r[2] * h) / H0, y1: (r[3] * h) / H0 };
};
/** PL (VISUAL_DESIGN 3.3): the plot box per composition. */
export const planeRect = (cls: ViewportClass, w: number, h: number) => {
  const r = scaleRect(cls, w, h, cls === "D" ? [620, 1344, 150, 740] : cls === "T" ? [48, 720, 540, 880] : [16, 374, 256, 480]);
  return cls === "D" && compact() ? { ...r, x0: compactX(620, w) + 24, x1: compactX(1344, w) } : r;
};
const SEED_PX: Record<ViewportClass, number> = { D: 5.5, T: 4.5, M: 3.2 };

export interface PlaneOpts {
  rec: BetaRecord;
  pts: Points;
  dom: Domain;
  edges: number[];
  /** countries that should stay on screen (the incoming disc's countries); those without points go to the margin set */
  universe: string[];
  /** tercile records: points inside this x range are lit, the rest of the primary points dim to 20% */
  lit?: [number, number] | null;
  hollow?: ReadonlySet<string>;
  /** draw seeds at the plane colour (false = neutral, the basis-swap phase) */
  colour?: boolean;
}

/** Margin set for countries without a point in this record: hollow, in a grid left of the plot. */
function marginXY(rect: Rect, i: number, cls: ViewportClass): [number, number] {
  const pitch = cls === "M" ? 6 : 9, cols = cls === "M" ? 4 : 3;
  return [rect.x0 - 14 - (i % cols) * pitch, rect.y0 + Math.floor(i / cols) * pitch];
}

export function planeState(o: PlaneOpts, cam: Cam, cls: ViewportClass, w: number, h: number): SeedState {
  const rect = planeRect(cls, w, h), idx = new Map(o.pts.iso3.map((iso, i) => [iso, i]));
  const missing = o.universe.filter((iso) => !idx.has(iso));
  const keys = [...o.pts.iso3, ...missing];
  const s = makeState(keys.length);
  const wmax = Math.max(0, ...o.pts.weight.map((v) => v ?? 0));
  const base = SEED_PX[cls] / cam.s;
  keys.forEach((iso, j) => {
    const i = idx.get(iso);
    let px: number, py: number;
    if (i !== undefined) { px = sx(o.dom, rect, o.pts.x[i]!); py = sy(o.dom, rect, o.pts.y[i]!); }
    else [px, py] = marginXY(rect, j - o.pts.iso3.length, cls);
    s.key[j] = `${iso}:0`;
    s.x[j] = (px - cam.cx) / cam.s; s.y[j] = (py - cam.cy) / cam.s;
    const wt = i !== undefined ? o.pts.weight[i] : null;
    // weighted samples: seed AREA proportional to the published weight (initial population)
    s.r[j] = wt !== null && wt !== undefined && wmax > 0 ? Math.max(1.2 / cam.s, base * 2.6 * Math.sqrt(wt / wmax)) : i === undefined ? base * 0.7 : base;
    s.bin[j] = o.colour === false || i === undefined ? -1 : binOf(Math.exp(o.pts.x[i]!), o.edges);
    s.hollow[j] = i === undefined || o.hollow?.has(iso) ? 1 : 0;
    s.alpha[j] = i !== undefined && o.lit && (o.pts.x[i]! < o.lit[0] - 1e-9 || o.pts.x[i]! > o.lit[1] + 1e-9) ? 0.2 : 1;
  });
  return s;
}

/** Plane px of a point (debug hook and SVG overlay share this mapping). */
export const planePx = (dom: Domain, cls: ViewportClass, w: number, h: number, x: number, y: number) => {
  const r = planeRect(cls, w, h);
  return [sx(dom, r, x), sy(dom, r, y)] as const;
};

/** G4a (VISUAL_DESIGN 3.3): three touching-close group discs, country spacing per composition. */
export function groupCentres(cls: ViewportClass, w: number, h: number) {
  const [W0, H0] = REF[cls];
  const c = cls === "D" ? { pts: [[700, 470], [975, 470], [1265, 470]], sp: 18 } : cls === "T" ? { pts: [[140, 660], [384, 660], [628, 660]], sp: 11 } : { pts: [[150, 196], [150, 300], [150, 408]], sp: 6.5 };
  const k = Math.min(w / W0, h / H0);
  if (cls === "D" && compact()) return { pts: c.pts.map(([x, y]) => [compactX(x!, w) + (x === 700 ? 40 : x === 1265 ? -30 : 0), (y! * h) / H0] as const), sp: c.sp * k };
  return { pts: c.pts.map(([x, y]) => [(x! * w) / W0, (y! * h) / H0] as const), sp: c.sp * k };
}

/** Origin of the hollow "not grouped" set (shared with its caption). */
export function ungroupedXY(cls: ViewportClass, w: number, h: number): [number, number] {
  if (cls === "M") return [0.3 * w, 0.595 * h];
  if (cls === "T") return [0.1 * w, 0.88 * h];
  return [cls === "D" && compact() ? compactX(620, w) + 30 : 0.45 * w, 0.85 * h];
}

export interface GroupOpts {
  /** per cluster id: members ordered by silhouette, best first */
  groups: { id: number; members: string[] }[];
  hollow: ReadonlySet<string>;
  ungrouped: string[];
  bins: Map<string, number>;
}
export function groupsState(o: GroupOpts, cam: Cam, cls: ViewportClass, w: number, h: number): SeedState {
  const { pts, sp } = groupCentres(cls, w, h);
  const n = o.groups.reduce((a, g) => a + g.members.length, 0) + o.ungrouped.length, s = makeState(n);
  let j = 0;
  o.groups.forEach((g, gi) => g.members.forEach((iso, k) => {
    const [cx, cy] = pts[gi]!;
    s.key[j] = `${iso}:0`; s.x[j] = (cx + sp * vogelX(k) - cam.cx) / cam.s; s.y[j] = (cy + sp * vogelY(k) - cam.cy) / cam.s;
    s.r[j] = (0.4 * sp) / cam.s; s.bin[j] = o.bins.get(iso) ?? -1; s.hollow[j] = o.hollow.has(iso) ? 1 : 0; s.alpha[j] = 1; j++;
  }));
  // not grouped (missing a feature): a hollow set under the discs
  const [x0, y0] = ungroupedXY(cls, w, h);
  const pitch = cls === "M" ? 7 : 11, cols = cls === "M" ? 18 : 26;
  o.ungrouped.forEach((iso, k) => {
    s.key[j] = `${iso}:0`; s.x[j] = (x0 + (k % cols) * pitch - cam.cx) / cam.s; s.y[j] = (y0 + Math.floor(k / cols) * pitch - cam.cy) / cam.s;
    s.r[j] = (0.32 * pitch) / cam.s; s.bin[j] = o.bins.get(iso) ?? -1; s.hollow[j] = 1; s.alpha[j] = 1; j++;
  });
  return s;
}

/** ORDER BY A, LIGHT BY B: one COUNTRIES disc, rank of A from the core, colour = rank-seventh of B (DERIVED). */
export function relationState(order: string[], binsB: Map<string, number>, radiusPx: number, centre: readonly [number, number], cam: Cam): SeedState {
  const n = order.length, sp = radiusPx / Math.sqrt(n), s = makeState(n);
  order.forEach((iso, j) => {
    s.key[j] = `${iso}:0`; s.x[j] = (centre[0] + sp * vogelX(j) - cam.cx) / cam.s; s.y[j] = (centre[1] + sp * vogelY(j) - cam.cy) / cam.s;
    s.r[j] = (0.4 * sp) / cam.s; s.bin[j] = binsB.get(iso) ?? -1; s.hollow[j] = 0; s.alpha[j] = 1;
  });
  return s;
}

/** Equal-count sevenths by rank of B among the plotted countries (ties by iso3): a rank colouring for a rank statistic. */
export function rankBins(isos: string[], vals: Map<string, number>): Map<string, number> {
  const sorted = [...isos].sort((a, b) => vals.get(a)! - vals.get(b)! || (a < b ? -1 : 1));
  return new Map(sorted.map((iso, i) => [iso, Math.min(6, Math.floor((i * 7) / sorted.length))]));
}

/** Neutral copy of a state (the basis-swap phase: no colour belongs to two bases). */
export function neutral(s: SeedState): SeedState {
  return { ...s, bin: new Int8Array(s.bin.length).fill(-1) };
}
