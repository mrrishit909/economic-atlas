/**
 * Seed Head director: ONE fixed canvas draws every seed in every scene (VISUAL_DESIGN 3.2). Each
 * frame it locates the active scene and asks that scene's plan for a camera (G-states, log-space s)
 * and a target: a DISC target (indicator, PEOPLE/COUNTRIES, year, set aside, selection) or a FREE
 * keyed state (the catch-up plane, group discs, relations). Changes run as legs:
 * - mode change: keyed coalesce/burst within one year; year change: 200ms crossfade of real layouts;
 * - free state: keyed straight travel 1200ms (seeds by `${iso3}:0`);
 * - a change of colour basis (lab BASIS, ATLAS indicator): neutral -> move -> recolour, so no frame
 *   carries two palettes and the DOM unit swaps only inside the neutral phase.
 * The S04 flight is scrubbed: one transition evaluated at now = flight progress.
 */
import { SeedsGL, Seeds2D, paintState, type Cam, type LayerDraw, type SeedDrawer } from "../gl/seeds";
import { BEZ, atRest, between, evalSeed, makeState, stateAt, staticOf, type SeedState, type Transition } from "../gl/transition";
import { centroids, hash01, knn6, shuffle, vogelX, vogelY, type Layout } from "../model/layout";
import { countriesState, peopleState, slotDust, R_IN } from "../model/seedstates";
import { binOf } from "../model/bins";
import { domainOf, fitAt, pointsFor, recordId, type BetaRecord, type Domain } from "../model/plane";
import { groupsFor, relationFor, type Clusters, type Correlations } from "../model/likeness";
import { addFrame } from "../motion/loop";
import { easePremium, easeSymmetric, DUR } from "../motion/ease";
import { stepState, windowed } from "../motion/progress";
import { clamp } from "../lib/math";
import { locate } from "../scroll/engine";
import { motionEnabled } from "../state/motion";
import { getStore } from "../data/loader";
import {
  CLUSTERS, CONVERGENCE, CORRELATIONS, COUNTRIES, FACTS, INDICATORS, PANEL, PANEL_STRUCT, SEED_LATEST, SEED_YEARS, factNum, seedheadOf, toLayout,
  type Convergence, type Facts, type IndicatorFull, type PanelIncome, type PanelStructure,
} from "../data/artifacts";
import { cssClass, stageH, stageW } from "../graphics/canvas";
import { camLerp, g4b, gstate, LABEL_MIN, type GName } from "./geometry";
import { groupsState, neutral, planePx, planeState, rankBins, relationState } from "./freestates";
import { SCENES } from "../app/scenes";
import { atlas, catchup, inspector, lab, likeness, view, weight, years as yearsStore, type Basis, type Count } from "../state/scenes";
import { d1, d2, int, money, unitOf } from "../data/copy";

export const INTRO_MS = 4600;
const SEED = 20261010;
const SCENE_IDS = SCENES.map((s) => s.id);
const PPP = "gdppc_ppp";

// ------------------------------------------------------------------ quality tiers (MOTION_SYSTEM 9.2)
export type Tier = "high" | "low" | "nogl";
const forced = (() => {
  const m = /[?&]quality=(low|high|nogl)/.exec(typeof location === "undefined" ? "" : location.search);
  return m ? (m[1] as Tier) : null;
})();
export const quality = { tier: (forced ?? "high") as Tier, median: 0, samples: [] as number[] };

// ------------------------------------------------------------------ S00 intro clock (shared with useIntro)
export const intro = { playing: false, start: 0, completeFrom: -1, completeAt: 0, frozen: -1, minR: Infinity, lastR: 0, monotonic: true };
export function introTime(now: number) {
  if (intro.frozen >= 0) return intro.frozen;
  if (!intro.playing) return INTRO_MS;
  if (!intro.start) intro.start = now;
  const t = now - intro.start;
  if (intro.completeFrom < 0) return Math.min(INTRO_MS, t);
  const k = easePremium(clamp((now - intro.completeAt) / DUR.standard));
  return intro.completeFrom + (INTRO_MS - intro.completeFrom) * k;
}
export function resetIntro() {
  Object.assign(intro, { playing: true, start: 0, completeFrom: -1, completeAt: 0, minR: Infinity, lastR: 0, monotonic: true });
  ic.phases = null; ic.readyAt = -1; ic.done = false; ic.finish = null; ic.dust = null; ic.ran = true;
}

// ------------------------------------------------------------------ data
const D = {
  facts: null as Facts | null,
  latest: null as Layout | null,
  lay: new Map<string, Map<number, Layout>>(),
  panel: null as PanelIncome | null,
  panelS: null as PanelStructure | null,
  ind: new Map<string, IndicatorFull>(),
  names: new Map<string, string>(),
  conv: null as Convergence | null,
  clusters: null as Clusters | null,
  corr: null as Correlations | null,
  pppBins: new Map<number, Map<string, number>>(),
};
export const dataView = D;

export function layoutFor(year: number, ind = PPP): Layout | null {
  if (ind === PPP && D.latest && year === D.latest.year) return D.latest;
  return D.lay.get(ind)?.get(year) ?? null;
}
export const latestYear = () => D.latest?.year ?? 0;
export function yearsOf(ind: string): number[] {
  const m = D.lay.get(ind);
  const ys = m ? [...m.keys()] : [];
  if (ind === PPP && D.latest && !ys.includes(D.latest.year)) ys.push(D.latest.year);
  return ys.sort((a, b) => a - b);
}
export const latestOf = (ind: string) => yearsOf(ind).at(-1) ?? 0;

/** DR-9 bins from the layout file; for old files without value_bin, PPP bins from the panel. */
function binsFor(year: number, ind = PPP): Map<string, number> | null {
  const own = layoutFor(year, ind)?.bins;
  if (own) return own;
  if (ind !== PPP) return null;
  const hit = D.pppBins.get(year);
  if (hit) return hit;
  const edges = D.ind.get(PPP)?.display.bins;
  if (!D.panel || !edges) return null;
  const yi = D.panel.years.indexOf(year), v = D.panel.series.gdppc_ppp!.values, m = new Map<string, number>();
  if (yi < 0) return null;
  D.panel.iso3.forEach((iso, ci) => { const x = v[ci]![yi]; if (x !== null && x !== undefined) m.set(iso, binOf(x, edges)); });
  D.pppBins.set(year, m);
  return m;
}

/** A country's published value of any indicator in a year (OBSERVED), or null. */
export function valueOfInd(ind: string, iso: string, year: number): number | null {
  const p = D.panel?.series[ind] ? D.panel : D.panelS?.series[ind] ? D.panelS : null;
  if (!p) return null;
  const ci = p.iso3.indexOf(iso), yi = p.years.indexOf(year);
  return ci < 0 || yi < 0 ? null : (p.series[ind]!.values[ci]![yi] ?? null);
}
export const valueOf = (iso: string, year: number) => valueOfInd(PPP, iso, year);

const subscribed = new Set<string>();
function on<T>(spec: Parameters<typeof getStore<T>>[0], fn: (v: T) => void) {
  if (subscribed.has(spec.file)) return;
  subscribed.add(spec.file);
  const s = getStore(spec);
  const run = () => { const st = s.getState(); if (st.status === "ready") { fn(st.data); dirty = true; } };
  s.subscribe(run); run();
}
/** Lazy per-indicator layouts (ATLAS): starts the fetch and decodes when it lands. */
export function ensureIndicator(ind: string) {
  const spec = seedheadOf(ind);
  on(spec, (s) => {
    const m = D.lay.get(ind) ?? new Map<number, Layout>();
    for (const y of s.years) m.set(y.year, toLayout(y));
    D.lay.set(ind, m);
  });
  getStore(spec).prefetch();
}
function connect() {
  on(FACTS, (f) => { D.facts = f; });
  on(SEED_LATEST, (s) => { D.latest = toLayout(s.years[0]!); });
  on(SEED_YEARS, (s) => { const m = D.lay.get(PPP) ?? new Map(); for (const y of s.years) m.set(y.year, toLayout(y)); D.lay.set(PPP, m); });
  on(PANEL, (p) => { D.panel = p; D.pppBins.clear(); });
  on(PANEL_STRUCT, (p) => { D.panelS = p; });
  on(INDICATORS, (i) => { for (const x of i.indicators) D.ind.set(x.id, x as IndicatorFull); D.pppBins.clear(); });
  on(COUNTRIES, (c) => { c.countries.forEach((x) => D.names.set(x.iso3, x.name)); });
  on(CONVERGENCE, (c) => { D.conv = c; });
  on(CLUSTERS, (c) => { D.clusters = c; });
  on(CORRELATIONS, (c) => { D.corr = c; });
}

// ------------------------------------------------------------------ targets
export interface DiscT { ind: string; mode: Count; year: number; setAside: boolean; sel: string }
interface FreeT {
  key: string;
  build: () => SeedState | null;
  dur?: number;
  /** a change of colour basis runs the neutral -> move -> recolour swap; onNeutral swaps the DOM unit */
  basis?: string;
  onNeutral?: () => void;
}
const ASIDE = new Set(["CHN", "IND"]);
const sameDisc = (a: DiscT | null, b: DiscT) => !!a && a.ind === b.ind && a.mode === b.mode && a.year === b.year && a.setAside === b.setAside && a.sel === b.sel;
const basisKey = (ind: string) => { const x = D.ind.get(ind); return x?.price_basis ?? `ind:${ind}`; };

function buildDisc(t: DiscT): SeedState | null {
  const L = layoutFor(t.year, t.ind), bins = binsFor(t.year, t.ind);
  if (!L || !bins) return null;
  const aside = t.setAside ? ASIDE : undefined;
  const s = t.mode === "people" ? peopleState(L, { seams: true, bins, setAside: aside }) : countriesState(L, bins, aside);
  if (t.sel) {
    const sel = new Set(t.sel.split(","));
    for (let i = 0; i < s.key.length; i++) if (!sel.has(s.key[i]!.slice(0, 3))) s.alpha[i] = 0.3;
  }
  return s;
}

/** S03b scroll steps (VISUAL_DESIGN 3.4): thresholds and the state each step shows. */
export const WEIGHT_THRESHOLDS = [0.32, 0.54, 0.65, 0.76, 0.82, 0.88];
export const weightStep = (k: number, latest: number): { count: Count; year: number; setAside: boolean } => {
  const S: [Count, number, boolean][] = [["people", latest, false], ["countries", latest, false], ["countries", 1990, false], ["countries", latest, false],
    ["people", 1990, false], ["people", latest, false], ["people", latest, true]];
  const [count, year, setAside] = S[k]!;
  return { count, year, setAside };
};

// ------------------------------------------------------------------ runtime
let drawer: SeedDrawer | null = null;
let glCanvas: HTMLCanvasElement, c2d: HTMLCanvasElement, labelsEl: HTMLElement, tipEl: HTMLElement;
let main: Transition | null = null;
/** the scrubbed flight evaluates `main` at this time instead of the clock */
let mainNow: number | null = null;
let shown: DiscT | null = null;
let freeKey: string | null = null;
let palette = "";
let xf: { a: Transition; b: Transition; t0: number; dur: number } | null = null;
let seq: { at: number; fn: (now: number) => void }[] = [];
let follow: Transition | null = null, followKey = "";
let flight: { key: string; tr: Transition } | null = null;
let dirty = true, lastKey = "", instantUntil = 0, wStep = 0, cStep = 0, labStep = 0, lkStep = 0, prStep = 0, lastYearAt = 0, lastYear = 0;
let W = 0, H = 0, DPR = 1;
let labelKey = "";
const ic = { ran: false, phases: null as Transition[] | null, dust: null as Transition | null, readyAt: -1, done: false, finish: null as Transition | null, perm: null as Int32Array | null };
export const debug = {
  R: 0, cx: 0, cy: 0, s: 0, slots: 0, n: 0, mode: "people" as Count, year: 0, ind: PPP, mix: 0, scene: "", glFrames: 0, alpha: 1, introDone: false,
  palette: "", free: "" as string, flight: -1, echo: 0,
};
const curNow = (now: number) => mainNow ?? now;

function dprFor() {
  const d = devicePixelRatio || 1;
  return quality.tier === "low" ? 1 : Math.min(d, cssClass() === "D" ? 2 : 1.5);
}

function makeDrawer() {
  if (quality.tier !== "nogl") {
    const gl = SeedsGL.create(glCanvas);
    if (gl) { glCanvas.hidden = false; c2d.hidden = true; return gl; }
    quality.tier = "nogl";
  }
  glCanvas.hidden = true; c2d.hidden = false;
  return new Seeds2D(c2d);
}

// ------------------------------------------------------------------ S00 intro and the S08 echo share the sort
function sortPhases(L: Layout, bins: Map<string, number>, perm: Int32Array, t0: number) {
  const dust0 = peopleState(L, { seams: false, bins: null, perm, r: 0.25, alpha: 0 });
  const dust = peopleState(L, { seams: false, bins: null, perm, r: 0.25, alpha: 0.6 });
  const speckle = peopleState(L, { seams: false, bins, perm });
  const sorted = peopleState(L, { seams: true, bins });
  return {
    speckle, sorted,
    phases: [
      between(dust0, dust, { t0: t0 + 400, dur: 600, bez: BEZ.premium }),
      between(dust, speckle, { t0: t0 + 1000, dur: 300, delay: (_, i) => hash01(i, 1) * 300, switchAt: 0 }),
      between(speckle, sorted, { t0: t0 + 1600, dur: 1600, bez: BEZ.symmetric, delay: (_, i) => hash01(i, 2) * 200 }),
    ],
  };
}

function introLayer(t: number, now: number): LayerDraw | null {
  const N = D.latest?.slots ?? (D.facts ? factNum(D.facts, "seedhead_slots_latest") : 0);
  if (!N) return null;
  ic.perm ??= shuffle(N, SEED);
  const bins = binsFor(D.latest?.year ?? -1);
  const L = D.latest;
  if (!L || !bins) {
    // initial / loading / error: neutral dust at full G0 size, never coloured without data
    if (!ic.dust || ic.dust.n !== N) ic.dust = between(slotDust(N, ic.perm, 0), slotDust(N, ic.perm, 0.6), { t0: 400, dur: 600, bez: BEZ.premium });
    return { tr: ic.dust, now: motionEnabled() ? Math.min(t, 1000) : 1000, alpha: 1 };
  }
  const end = peopleState(L, { seams: true, bins });
  if (ic.readyAt < 0) ic.readyAt = t;
  if (intro.playing) ic.ran = true;
  if (!motionEnabled() || (!ic.ran && intro.frozen < 0)) { finishIntro(end); return { tr: main!, now, alpha: 1 }; }
  if (ic.readyAt > 6000 || (!intro.playing && intro.frozen < 0 && !ic.phases)) {
    if (!ic.finish) {
      const from = ic.dust ? stateAt(ic.dust, 1000) : slotDust(N, ic.perm, 0);
      ic.finish = between(peopleState(L, { seams: false, bins: null, perm: ic.perm, r: 0.25, alpha: from.alpha[0] ?? 0 }), end, { t0: now, dur: motionEnabled() ? DUR.standard : 0 });
    }
    if (atRest(ic.finish, now)) finishIntro(end);
    return { tr: ic.finish, now, alpha: 1 };
  }
  ic.phases ??= sortPhases(L, bins, ic.perm, 0).phases;
  const tc = t - Math.max(0, ic.readyAt - 1000);
  if (tc >= 3400 || (!intro.playing && intro.frozen < 0)) { finishIntro(end); return { tr: main!, now, alpha: 1 }; }
  const k = tc < 1000 ? 0 : tc < 1600 ? 1 : 2;
  return { tr: ic.phases[k]!, now: tc, alpha: 1 };
}

function finishIntro(end: SeedState) {
  if (ic.done) return;
  ic.done = true;
  main = staticOf(end);
  shown = { ind: PPP, mode: "people", year: D.latest!.year, setAside: false, sel: "" };
  palette = basisKey(PPP);
  dirty = true;
}
export const introSortT = () => (ic.readyAt < 0 ? -1 : introTime(performance.now()) - Math.max(0, ic.readyAt - 1000));

// ------------------------------------------------------------------ legs
function clearSeq() { seq = []; }

/** neutral -> move -> recolour (MOTION_SYSTEM 5.7): the DOM unit swaps at the start of the move. */
function runSwap(to: SeedState, nextPalette: string, now: number, onNeutral?: () => void) {
  const cur = stateAt(main!, curNow(now));
  mainNow = null;
  main = between(cur, neutral(cur), { t0: now, dur: DUR.fast, switchAt: 0 });
  palette = "none";
  seq = [
    { at: now + DUR.fast, fn: (t) => { onNeutral?.(); main = between(stateAt(main!, t), neutral(to), { t0: t, dur: DUR.scene, delay: (_, i) => hash01(i, 4) * 150 }); } },
    { at: now + DUR.fast + DUR.scene + 160, fn: (t) => { main = between(neutral(to), to, { t0: t, dur: DUR.fast, switchAt: 0 }); palette = nextPalette; } },
  ];
}

/**
 * Disc legs (one per call; called every frame):
 * - from a free state: keyed travel, grains emerging from their country seeds;
 * - a different indicator: the basis swap;
 * - a mode change: keyed coalesce/burst WITHIN one year; a compound change runs the mode leg first;
 * - a year change: 200ms crossfade of two real layouts (never grain travel); S03a hard-steps above 6 years/s;
 * - set aside / selection: hollow or dim switch in place.
 */
function applyDisc(tg: DiscT, now: number, scrub = false) {
  if (!main || sameDisc(shown, tg)) return;
  const instant = !motionEnabled() || now < instantUntil;
  if (shown && !instant && shown.ind === tg.ind) {
    if (shown.mode !== tg.mode && shown.year !== tg.year) tg = { ...tg, year: shown.year };
    else if (shown.mode === tg.mode && shown.year !== tg.year && !atRest(main, now) && !xf) return; // let the mode leg land
  }
  const to = buildDisc(tg);
  if (!to) return;
  clearSeq();
  if (xf) { main = xf.b; xf = null; }
  const nextPal = basisKey(tg.ind);
  if (instant) {
    main = staticOf(to); mainNow = null; palette = nextPal;
  } else if (!shown || shown.ind !== tg.ind) {
    if (shown && shown.ind !== tg.ind) runSwap(to, nextPal, now, () => atlas.set({ shownInd: tg.ind }));
    else {
      main = between(stateAt(main, curNow(now)), to, { t0: now, dur: DUR.scene, absorb: true, delay: (_, i) => hash01(i, 5) * 150 });
      mainNow = null; palette = nextPal;
    }
  } else if (shown.mode === tg.mode && shown.year !== tg.year) {
    const rate = (Math.abs(tg.year - lastYear) / Math.max(1, now - lastYearAt)) * 1000;
    const dur = quality.tier === "low" || (scrub && rate > 6) ? 0 : DUR.fast;
    const b = staticOf(to);
    if (dur > 0) xf = { a: staticOf(stateAt(main, now)), b, t0: now, dur };
    main = b;
  } else if (shown.mode !== tg.mode) {
    const L = layoutFor(tg.year, tg.ind)!, max = Math.max(...L.counts);
    const size = new Map(L.order.map((iso, i) => [iso, L.counts[i]!]));
    main = between(stateAt(main, now), to, { t0: now, dur: DUR.card, absorb: true, delay: (k) => 200 * Math.sqrt((size.get(k.slice(0, 3)) ?? 1) / max) });
  } else {
    main = between(stateAt(main, now), to, { t0: now, dur: tg.sel !== shown.sel ? DUR.standard : DUR.panel });
  }
  if (instant) atlas.set({ shownInd: tg.ind });
  lastYearAt = now; lastYear = tg.year;
  shown = tg; freeKey = null;
  dirty = true;
}

function applyFree(f: FreeT, now: number) {
  if (!main || freeKey === f.key) return;
  const to = f.build();
  if (!to) return;
  const instant = !motionEnabled() || now < instantUntil;
  clearSeq();
  if (xf) { main = xf.b; xf = null; }
  const nextPal = f.basis ?? palette;
  if (instant) {
    main = staticOf(to); f.onNeutral?.(); palette = nextPal;
  } else if (f.basis && palette !== "none" && f.basis !== palette) {
    runSwap(to, nextPal, now, f.onNeutral);
  } else {
    main = between(stateAt(main, curNow(now)), to, { t0: now, dur: f.dur ?? DUR.scene, absorb: true, delay: (_, i) => hash01(i, 6) * 150 });
    if (f.basis && palette !== "none") f.onNeutral?.();
  }
  mainNow = null;
  freeKey = f.key; shown = null;
  dirty = true;
}

// ------------------------------------------------------------------ scene plans
interface Plan {
  cam: Cam;
  alpha: number;
  disc?: DiscT;
  free?: FreeT;
  /** scrubbed flight: progress 0..1 and how to build its two ends */
  flight?: { t: number; key: string; from: () => SeedState | null; to: () => SeedState | null };
  scrub?: boolean;
  labels?: "six" | "big" | "aside" | "none";
  tip?: (iso: string) => string;
  /** S08 echo state */
  echo?: number;
}

const disc = (ind: string, mode: Count, year: number, setAside = false, sel = ""): DiscT => ({ ind, mode, year, setAside, sel });
const g = (n: GName, N = D.latest?.slots ?? 8005) => gstate(n, W, H, N);

function record(id: string): BetaRecord | null { return D.conv?.beta.find((r) => r.id === id) ?? null; }
export function domain(ind: string): Domain | null { return D.conv ? domainOf(D.conv.beta, ind) : null; }
export const recordOf = (id: string) => record(id);
const panelSlice = (ind: string) => (D.panel?.series[ind] ? { iso3: D.panel.iso3, years: D.panel.years, values: D.panel.series[ind]!.values } : null);

/** The plane state of a record (with the lab's visual rules) on the current G3 camera. */
export function planeFor(rec: BetaRecord, cam: Cam): SeedState | null {
  const dom = domain(rec.indicator), edges = D.ind.get(rec.indicator)?.display.bins, L90 = layoutFor(1990, PPP) ?? D.latest;
  if (!dom || !edges || !D.conv) return null;
  let pts = pointsFor(rec, D.conv.beta, panelSlice(rec.indicator)), lit: [number, number] | null = null, hollow: Set<string> | undefined;
  if (rec.sample.startsWith("tercile")) { pts = pointsFor(record(rec.id.replace(rec.sample, "primary"))!, D.conv.beta, null); lit = rec.x_domain; }
  if (rec.sample === "pop_weighted_ex_chn_ind") { pts = record(rec.id.replace(rec.sample, "pop_weighted"))?.points ?? null; hollow = ASIDE; }
  if (!pts) return null;
  return planeState({ rec, pts, dom, edges, universe: L90?.order ?? [], lit, hollow }, cam, cssClass(), W, H);
}

export const LAB_TOUR = ["primary", "tercile_low", "pop_weighted", "pop_weighted_ex_chn_ind"];
export const labRecordId = (basis: Basis, start: number, sample: string) => (basis === "ppp" ? recordId(PPP, start, 2025, sample) : recordId("gdppc_const", start, 2024, sample));

function planeTip(rec: BetaRecord) {
  return (iso: string) => {
    const pts = pointsFor(rec, D.conv!.beta, panelSlice(rec.indicator)) ?? record(rec.id.replace(rec.sample, "pop_weighted"))?.points;
    const i = pts ? pts.iso3.indexOf(iso) : -1, name = (D.names.get(iso) ?? iso).toUpperCase();
    if (!pts || i < 0) return `${name} · NOT IN THIS SAMPLE`;
    const x = pts.x[i]!, y = pts.y[i]!;
    return `${name} · ${rec.start}: ${money(Math.exp(x), rec.price_basis)} · GROWTH ${d2(y)}% / YR · RESIDUAL ${d2(y - fitAt(rec, x).y)}`;
  };
}
function discTip(t: DiscT) {
  return (iso: string) => {
    const L = layoutFor(t.year, t.ind), ind = D.ind.get(t.ind), v = valueOfInd(t.ind, iso, t.year);
    const r = L ? L.order.indexOf(iso) + 1 : 0;
    const val = v === null ? "NO DATA" : ind?.price_basis ? money(v, ind.price_basis) : `${d1(v)} ${(ind?.unit ?? "").toUpperCase()}`;
    return `${(D.names.get(iso) ?? iso).toUpperCase()} · ${val} · RANK ${int(r)} OF ${int(L?.order.length ?? 0)} · ${t.year}`;
  };
}


function plan(id: string, p: number): Plan {
  if (motionEnabled()) return planAt(id, p);
  // reduced motion: tracks are in flow; the canvas shows the scene in view at its landing state, instantly
  // (S03a/S03b draw their own static discs, so the canvas steps aside there)
  if (id === "years" || id === "weight") return { cam: g("G0"), alpha: 0 };
  if (id === "eight-billion") return { cam: g("G0"), alpha: clamp(1 - scrollY / Math.max(1, H)), disc: disc(PPP, "people", latestYear()), labels: "none" };
  const pl = planAt(id, SCENES.find((s) => s.id === id)?.landing ?? 0);
  return { ...pl, labels: "none" };
}

function planAt(id: string, p: number): Plan {
  const latest = latestYear();
  switch (id) {
    case "eight-billion":
      return { cam: camLerp(g("G0"), g("G1"), windowed(p, 0, 0.4, easeSymmetric)), alpha: 1, disc: disc(PPP, "people", latest), labels: p < 0.6 ? "six" : "none", tip: discTip(disc(PPP, "people", latest)) };
    case "sources": {
      const t = windowed(p, 0.85, 1, easeSymmetric);
      const y = p >= 0.97 && layoutFor(1990) ? 1990 : latest;
      return { cam: camLerp(g("G1"), g("G2"), t), alpha: 0.2 + 0.8 * t, disc: disc(PPP, "people", y), labels: "none" };
    }
    case "years": {
      const ys = yearsOf(PPP);
      const k = Math.min(ys.length - 1, Math.floor(clamp((p - 0.06) / 0.88) * ys.length));
      const y = ys.length > 1 ? ys[k]! : latest;
      if (yearsStore.get().year !== y) yearsStore.set({ year: y });
      const t = disc(PPP, "people", y);
      return { cam: camLerp(g("G2"), g("G3"), windowed(p, 0.94, 1, easeSymmetric)), alpha: 1, disc: t, scrub: true, labels: "big", tip: discTip(t) };
    }
    case "weight": {
      const k = stepState(wStep, p, WEIGHT_THRESHOLDS);
      if (k !== wStep || (weight.get().year === 0 && !weight.get().user)) { wStep = k; weight.set({ ...weightStep(k, latest), step: k, user: false }); }
      const w = weight.get();
      // p 0.94-1: COUNT forces COUNTRIES, ready to fly
      const t = disc(PPP, p > 0.94 ? "countries" : w.count, w.year || latest, p > 0.94 ? false : w.setAside);
      return { cam: g("G3"), alpha: 1, disc: layoutFor(t.year) ? t : undefined, labels: t.mode === "countries" ? "aside" : "big", tip: discTip(t) };
    }
    case "catch-up": {
      const cam = g("G3"), d0 = disc(PPP, "countries", 1990);
      if (!D.conv || !layoutFor(1990)) return { cam, alpha: 1, disc: layoutFor(1990) ? d0 : undefined };
      const k = stepState(cStep, p, [0.55, 0.7, 0.85]);
      cStep = k;
      const start = [1990, 1990, 2000, 2010][k]!, rec = record(recordId(PPP, start, 2025, "primary"))!;
      const f = p < 0.08 ? 0 : windowed(p, 0.08, 0.4, easeSymmetric);
      if (catchup.get().step !== k || catchup.get().flight !== f) catchup.set({ step: k, flight: f });
      if (p < 0.08) return { cam, alpha: 1, disc: d0, labels: "none", tip: discTip(d0) };
      if (p < 0.4) {
        const r90 = record(recordId(PPP, 1990, 2025, "primary"))!;
        return { cam, alpha: 1, flight: { t: f, key: `flight:${W}x${H}`, from: () => buildDisc(d0), to: () => planeFor(r90, cam) }, labels: "none", tip: planeTip(r90) };
      }
      return { cam, alpha: 1, free: { key: `plane:${rec.id}:${W}x${H}`, build: () => planeFor(rec, cam), basis: rec.price_basis }, labels: "none", tip: planeTip(rec) };
    }
    case "lab": {
      const cam = g("G3");
      if (!D.conv) return { cam, alpha: 1 };
      if (p < 0.3) {
        const k = stepState(labStep, p, [0.075, 0.15, 0.225]);
        labStep = k;
        lab.set({ basis: "ppp", start: 1990, sample: LAB_TOUR[k]!, live: false });
      } else if (!lab.get().live) lab.set({ live: true });
      const L = lab.get(), rec = record(labRecordId(L.basis, L.start, L.sample));
      if (!rec) return { cam, alpha: 1 };
      return {
        cam, alpha: 1, labels: "none", tip: planeTip(rec),
        free: { key: `plane:${rec.id}:${W}x${H}`, build: () => planeFor(rec, cam), basis: rec.price_basis, onNeutral: () => lab.set({ shownBasis: L.basis }) },
      };
    }
    case "likeness": {
      const cam = g("G3");
      const part = p < 0.5 ? 1 : 2;
      if (likeness.get().part !== part) likeness.set({ part });
      if (!D.clusters || !D.corr) return { cam, alpha: 1 };
      const bins = D.latest?.bins ?? binsFor(latest) ?? new Map<string, number>();
      if (p < 0.5) {
        const k = stepState(lkStep, p, [0.3]);
        if (k !== lkStep) { lkStep = k; likeness.set({ method: k ? "ward" : "kmeans" }); }
        if (likeness.get().part !== 1) likeness.set({ part: 1 });
        const m = likeness.get().method, gr = groupsFor(D.clusters, m, [...D.names.keys()]);
        const sil = new Map(D.clusters.assignments.iso3.map((iso, i) => [iso, i]));
        return {
          cam, alpha: 1, labels: "none",
          free: { key: `groups:${m}:${W}x${H}`, build: () => groupsState({ ...gr, bins }, cam, cssClass(), W, H), dur: m === "ward" || freeKey?.startsWith("groups") ? DUR.panel : DUR.scene },
          tip: (iso) => {
            const i = sil.get(iso), name = (D.names.get(iso) ?? iso).toUpperCase();
            return i === undefined ? `${name} · NOT GROUPED (MISSING A FEATURE)` : `${name} · GROUP ${D.clusters!.assignments.cluster[i]! + 1} OF ${D.clusters!.chosen_k} · SILHOUETTE ${d2(D.clusters!.assignments.silhouette[i]!)}`;
          },
        };
      }
      const PAIRS: [string, string][] = [["ln_gdppc_ppp", "ln_productivity"], ["ln_gdppc_ppp", "agr_share"], ["agr_share", "ind_share"]];
      if (p < 0.92) {
        const k = stepState(prStep, p, [0.68, 0.8]);
        prStep = k;
        const [a, b] = PAIRS[k]!;
        likeness.set({ part: 2, a, b, free: false });
      } else if (!likeness.get().free) likeness.set({ part: 2, free: true });
      const { a, b } = likeness.get(), rel = relationFor(D.corr, a, b), bb = rankBins(rel.order, rel.vb), geo = g4b(W, H);
      return {
        cam, alpha: 1, labels: "none",
        free: { key: `rel:${a}:${b}:${W}x${H}`, build: () => relationState(rel.order, bb, geo.R, geo.c, cam) },
        tip: (iso) => { const r = rel.order.indexOf(iso); return `${(D.names.get(iso) ?? iso).toUpperCase()} · RANK ${r + 1} OF ${rel.order.length} BY ${a.toUpperCase()} · B BIN ${bb.get(iso)! + 1} OF 7`; },
      };
    }
    case "evidence":
      return { cam: camLerp(g("G3"), g("G1"), windowed(p, 0, 0.1, easeSymmetric)), alpha: 1 - 0.85 * windowed(p, 0, 0.1) };
    case "atlas": {
      const a = atlas.get(), ys = yearsOf(a.ind), y = a.year && ys.includes(a.year) ? a.year : ys.at(-1) ?? 0;
      const N = layoutFor(y, a.ind)?.slots ?? 8005;
      const t = disc(a.ind, a.count, y, false, a.selected.join(","));
      return { cam: g("G5", N), alpha: 1, disc: y ? t : undefined, labels: "none", tip: discTip(t) };
    }
    case "resorted": {
      const a = atlas.get(), useAtlas = a.touched && layoutFor(a.year || latestOf(a.shownInd), a.shownInd);
      const ind = useAtlas ? a.shownInd : PPP, y = useAtlas ? (a.year || latestOf(ind)) : latest;
      const N = layoutFor(y, ind)?.slots ?? 8005;
      const t = disc(ind, "people", y);
      return { cam: camLerp(g("G5", N), g("G0", N), windowed(p, 0, 0.35, easeSymmetric)), alpha: 1, disc: t, labels: "none", echo: p, tip: discTip(t) };
    }
    default:
      return { cam: g("G1"), alpha: 0.15 };
  }
}

/** FOLLOW outline: the territory's border grains (all grains of a territory of 6 or fewer) as white 1px rings. */
export function followState(year: number, iso: string): SeedState | null {
  const L = layoutFor(year);
  if (!L) return null;
  const c = L.order.indexOf(iso);
  if (c < 0) return null;
  const nb = knn6(L.slots), idx: number[] = [];
  for (let i = 0; i < L.slots; i++) {
    if (L.owner[i] !== c) continue;
    let edge = L.counts[c]! <= 6;
    for (let k = 0; k < 6 && !edge; k++) edge = L.owner[nb[i * 6 + k]!] !== c;
    if (edge) idx.push(i);
  }
  const base = peopleState(L, { seams: false, bins: null }), s = makeState(idx.length);
  idx.forEach((i, j) => { s.key[j] = base.key[i]!; s.x[j] = base.x[i]!; s.y[j] = base.y[i]!; s.r[j] = R_IN * 1.15; s.bin[j] = -2; s.hollow[j] = 1; s.alpha[j] = 1; });
  return s;
}

function followLayer(id: string): Transition | null {
  const iso = yearsStore.get().follow;
  if (id !== "years" || !iso || !shown || shown.mode !== "people") return null;
  const key = `${iso}:${shown.year}`;
  if (key !== followKey) { followKey = key; const s = followState(shown.year, iso); follow = s ? staticOf(s) : null; }
  return follow;
}

// ------------------------------------------------------------------ S08 echo: dissolve to the S00 shuffle, then the S00 sort (MOTION_SYSTEM 5.13)
let echoStep = 0;
function runEcho(p: number, now: number) {
  const k = stepState(echoStep, p, [0.7]);
  if (k === echoStep) return;
  echoStep = k;
  if (!shown) return;
  const L = layoutFor(shown.year, shown.ind), bins = binsFor(shown.year, shown.ind);
  if (!L || !bins || !main) return;
  clearSeq();
  if (k === 0 || !motionEnabled() || now < instantUntil) { main = staticOf(peopleState(L, { seams: true, bins })); debug.echo = 0; return; } // reverse: sorted, no replay
  const perm = shuffle(L.slots, SEED), ph = sortPhases(L, bins, perm, 0);
  main = between(stateAt(main, now), ph.speckle, { t0: now, dur: DUR.scene, bez: BEZ.symmetric });
  debug.echo = 1;
  seq = [{ at: now + DUR.scene + 100, fn: (t) => { main = between(ph.speckle, ph.sorted, { t0: t, dur: 1600, bez: BEZ.symmetric, delay: (_, i) => hash01(i, 2) * 200 }); debug.echo = 2; } }];
}

// ------------------------------------------------------------------ labels and picking
function placeLabels(cam: Cam, mode: Plan["labels"]) {
  if (!labelsEl) return;
  const t = shown, L = t ? layoutFor(t.year, t.ind) : D.latest;
  const show = !!L && mode !== "none" && mode !== undefined && (!main || atRest(main, performance.now())) && !xf && motionEnabled();
  labelsEl.classList.toggle("is-on", show || (!ic.done && introSortT() >= 3400));
  if (!L) return;
  const min = LABEL_MIN[cssClass()];
  const m = ic.done ? mode : "six";
  const key = `${t?.ind}:${L.year}:${t?.mode}:${m}:${min}`;
  if (key !== labelKey) {
    labelKey = key;
    const byCount = L.order.map((iso, i) => ({ iso, i, c: L.counts[i]! })).sort((a, b) => b.c - a.c);
    const pick = m === "aside" ? byCount.filter((x) => ASIDE.has(x.iso)) : m === "six" ? byCount.slice(0, 6) : m === "big" ? byCount.filter((x) => x.c > min) : [];
    const cen = centroids(L), sp = Math.sqrt(L.slots / L.order.length);
    labelsEl.replaceChildren(...pick.map((x) => {
      const el = document.createElement("span");
      el.className = "seed-label";
      el.textContent = x.iso;
      const j = L.order.indexOf(x.iso);
      const [wx, wy] = t?.mode === "countries" ? [sp * vogelX(j), sp * vogelY(j)] : [cen[x.i * 3]!, cen[x.i * 3 + 1]!];
      el.dataset.wx = String(wx); el.dataset.wy = String(wy);
      return el;
    }));
  }
  for (const el of labelsEl.children as HTMLCollectionOf<HTMLElement>) {
    el.style.transform = `translate(${cam.cx + Number(el.dataset.wx) * cam.s}px, ${cam.cy + Number(el.dataset.wy) * cam.s}px) translate(-50%, -50%)`;
  }
}

let pointer: { x: number; y: number } | null = null;
let lastCam: Cam = { cx: 0, cy: 0, s: 1 };
let lastTip: Plan["tip"];
let restCache: { v: number; s: SeedState } | null = null;
/** The seed under a screen point in the current resting state (CPU, no GPU picking: MOTION_SYSTEM 9.1). */
export function pick(x: number, y: number): string | null {
  if (!main || !ic.done) return null;
  if (!restCache || restCache.v !== main.version) restCache = { v: main.version, s: stateAt(main, Infinity) };
  const s = restCache.s, wx = (x - lastCam.cx) / lastCam.s, wy = (y - lastCam.cy) / lastCam.s;
  let best = Infinity, bi = -1;
  for (let i = 0; i < s.key.length; i++) {
    if (s.key[i]![0] === "#") continue;
    const d = (s.x[i]! - wx) ** 2 + (s.y[i]! - wy) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  if (bi < 0) return null;
  const reach = Math.max(s.r[bi]! * 1.8, 7 / lastCam.s);
  return best <= reach * reach ? s.key[bi]!.slice(0, 3) : null;
}
function hover() {
  if (!tipEl) return;
  const iso = pointer && lastTip && main && atRest(main, curNow(performance.now())) ? pick(pointer.x, pointer.y) : null;
  if (!iso || !pointer) { tipEl.hidden = true; return; }
  tipEl.textContent = lastTip!(iso);
  tipEl.hidden = false;
  tipEl.style.transform = `translate(${Math.min(pointer.x + 12, W - tipEl.offsetWidth - 8)}px, ${pointer.y + 12}px)`;
}

// ------------------------------------------------------------------ S00/S08 glow (VISUAL_DESIGN 3.2, MOTION_SYSTEM 9.1)
/**
 * The seed pass drawn once at 1/4 resolution into its own canvas, blurred 24px by CSS and composited
 * at 14% under the grains. It is the grains' own light (it follows the territories), never a disc;
 * rendered once per S00/S08 entry after the sort settles, then only its opacity changes.
 */
let glowEl: HTMLCanvasElement | null = null, glowKey = "";
function glow(id: string, p: number, cam: Cam) {
  if (!glowEl) return;
  const s08 = id === "resorted" && debug.echo === 2 && !!main && atRest(main, performance.now());
  const s00 = id === "eight-billion" && (ic.done || introSortT() >= 3400);
  const t = s08 && shown ? shown : { ind: PPP, year: D.latest?.year ?? 0 };
  const L = layoutFor(t.year, t.ind), bins = binsFor(t.year, t.ind);
  const on = quality.tier === "high" && motionEnabled() && (s00 || s08) && !!L && !!bins;
  const g0 = gstate("G0", W, H, L?.slots ?? 8005);
  if (on) {
    const key = `${W}x${H}:${t.ind}:${t.year}`;
    if (key !== glowKey) {
      glowKey = key;
      const q = 4, c = glowEl;
      c.width = Math.ceil(W / q); c.height = Math.ceil(H / q);
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      paintState(ctx, { cx: g0.cx / q, cy: g0.cy / q, s: g0.s / q }, peopleState(L!, { seams: true, bins: bins! }));
    }
  }
  const atG0 = Math.abs(cam.s - g0.s) < 1e-3 && Math.abs(cam.cx - g0.cx) < 0.5;
  glowEl.style.opacity = on && atG0 ? String(0.14 * (s00 ? 1 - windowed(p, 0, 0.02) : 1)) : "0";
}

// ------------------------------------------------------------------ frame
function frame(now: number, dt: number) {
  const w = stageW(), h = stageH();
  if (w !== W || h !== H || !drawer) {
    W = w; H = h;
    drawer ??= makeDrawer();
    DPR = dprFor();
    drawer.resize(W, H, DPR);
    dirty = true; labelKey = "";
  }
  const loc = locate(SCENE_IDS);
  const id = loc?.id ?? SCENE_IDS[0]!, p = loc?.p ?? 0;
  const t = introTime(now);
  const pl = plan(id, p);
  const cam = pl.cam;
  let layers: LayerDraw[] = [];
  if (!ic.done) {
    const L = introLayer(t, now);
    if (L) layers = [L];
    if (intro.playing && t >= 400) {
      const N = D.latest?.slots ?? (D.facts ? factNum(D.facts, "seedhead_slots_latest") : 0);
      const R = cam.s * Math.sqrt(N);
      if (N) { if (R < intro.lastR - 1e-6) intro.monotonic = false; intro.minR = Math.min(intro.minR, R); intro.lastR = R; }
    }
  }
  if (ic.done && main) {
    while (seq.length && now >= seq[0]!.at) seq.shift()!.fn(now);
    if (pl.flight) {
      if (!flight || flight.key !== pl.flight.key || freeKey !== "flight") {
        const a = pl.flight.from(), b = pl.flight.to();
        if (a && b) { clearSeq(); xf = null; flight = { key: pl.flight.key, tr: between(a, b, { t0: 0, dur: 1000, bez: BEZ.linear }) }; main = flight.tr; freeKey = "flight"; shown = null; palette = basisKey(PPP); }
      }
      if (freeKey === "flight") mainNow = 1000 * pl.flight.t;
    } else if (pl.free) applyFree(pl.free, now);
    else if (pl.disc) applyDisc(pl.disc, now, pl.scrub);
    if (pl.echo !== undefined) runEcho(pl.echo, now);
    else if (echoStep) { echoStep = 0; debug.echo = 0; }
    if (xf && now >= xf.t0 + xf.dur) xf = null;
    const m = xf ? clamp((now - xf.t0) / xf.dur) : 1;
    layers = xf ? [{ tr: xf.a, now, alpha: 1 - m }, { tr: xf.b, now, alpha: m }] : [{ tr: main, now: curNow(now), alpha: 1 }];
    const f = followLayer(id);
    if (f) layers.push({ tr: f, now, alpha: 1 });
    debug.mix = xf ? m : 0;
  }
  const Nd = shown && ic.done ? layoutFor(shown.year, shown.ind)?.slots ?? 0 : D.latest?.slots ?? (D.facts ? factNum(D.facts, "seedhead_slots_latest") : 0);
  cam.rw = shown || !ic.done ? Math.sqrt(Nd) : 0; // the ramp belongs to the disc, not to the plane or group discs
  glow(id, p, cam);
  layers.forEach((l) => (l.alpha *= pl.alpha));
  const busy = layers.some((l) => !atRest(l.tr, l.now)) || !!xf || seq.length > 0;
  const key = `${cam.cx.toFixed(2)}|${cam.cy.toFixed(2)}|${cam.s.toFixed(4)}|${cam.rw}|${layers.map((l) => `${l.tr.version}:${l.alpha.toFixed(3)}:${atRest(l.tr, l.now) ? "r" : l.now}`).join(",")}`;
  if (drawer && (busy || dirty || key !== lastKey)) {
    drawer.draw(cam, layers);
    lastKey = key; dirty = false;
  }
  lastCam = cam; lastTip = pl.tip;
  placeLabels(cam, pl.labels);
  hover();
  const n0 = layers[layers.length > 1 && xf ? 1 : 0];
  Object.assign(debug, {
    R: cam.s * Math.sqrt(Nd), cx: cam.cx, cy: cam.cy, s: cam.s, slots: Nd, n: n0?.tr.n ?? 0, mode: shown?.mode ?? "free", year: shown?.year ?? 0, ind: shown?.ind ?? "",
    scene: id, glFrames: drawer?.frames ?? 0, alpha: pl.alpha, introDone: ic.done, palette, free: freeKey ?? "", flight: freeKey === "flight" ? mainNow! / 1000 : -1,
  });
  const v = view.get();
  if (v.slots !== Nd || v.mode !== (shown?.mode ?? v.mode) || v.scene !== id) view.set({ slots: Nd, mode: shown?.mode ?? v.mode, scene: id });
  tierCheck(dt);
}

function tierCheck(dt: number) {
  if (forced || quality.tier !== "high" || !ic.done || quality.samples.length >= 60) return;
  quality.samples.push(dt);
  if (quality.samples.length === 60) {
    const s = [...quality.samples].sort((a, b) => a - b);
    quality.median = s[30]!;
    if (quality.median > (cssClass() === "D" ? 22 : 40)) { quality.tier = "low"; DPR = dprFor(); drawer?.resize(W, H, DPR); dirty = true; }
    document.documentElement.dataset.tier = quality.tier;
    view.set({ tier: quality.tier });
  }
}

let started = false;
export function startDirector(gl: HTMLCanvasElement, flat: HTMLCanvasElement, labels: HTMLElement, tip: HTMLElement, glowCanvas?: HTMLCanvasElement) {
  glowEl = glowCanvas ?? null;
  if (started) return;
  started = true;
  glCanvas = gl; c2d = flat; labelsEl = labels; tipEl = tip;
  document.documentElement.dataset.tier = quality.tier;
  view.set({ tier: quality.tier });
  connect();
  gl.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    drawer = new Seeds2D(c2d); gl.hidden = true; c2d.hidden = false; drawer.resize(W, H, DPR); dirty = true;
    view.set({ lost: true });
  });
  gl.addEventListener("webglcontextrestored", () => { if (quality.tier !== "nogl") { drawer = null; W = 0; view.set({ lost: false }); } });
  addEventListener("eca:jump", () => { instantUntil = performance.now() + 120; });
  addEventListener("eca:snap", () => {
    // resize: transitions snap to their ends; free states are rebuilt for the new composition by key
    if (main) { main = staticOf(stateAt(main, curNow(Infinity))); xf = null; clearSeq(); dirty = true; }
    instantUntil = performance.now() + 120;
  });
  addEventListener("pointermove", (e) => {
    const t = e.target as Element | null;
    pointer = e.pointerType === "mouse" && !t?.closest?.("button, a, input, select, .panel, .nav-bar, .nav-pill, .inspector, .col, .rail") ? { x: e.clientX, y: e.clientY } : null;
  }, { passive: true });
  addEventListener("pointerleave", () => { pointer = null; });
  addEventListener("click", (e) => {
    const t = e.target as Element | null;
    if (t?.closest?.("button, a, input, select, label, .inspector, .nav-bar, .nav-pill, [role=dialog]")) return;
    const iso = pick(e.clientX, e.clientY);
    if (iso && ["years", "weight", "catch-up", "lab", "likeness", "atlas"].includes(debug.scene)) inspector.set({ iso, returnTo: null });
  });
  addFrame(frame, 50);
}

/** Visitor sets the S03b weight state (holds until the next scroll step). */
export function setWeight(p: Partial<{ count: Count; year: number; setAside: boolean }>) {
  weight.set({ year: weight.get().year || latestYear(), ...p, user: true });
}
export const WEIGHT_DEFAULT = () => weightStep(0, latestYear());
/** For tests: the state the grains are heading to now. */
export const restState = () => (main ? stateAt(main, Infinity) : null);
export const conv = () => getStore(CONVERGENCE);

/** Current px of a country seed (`${iso3}:0`) as drawn now (the flight test hook). */
export function seedPx(iso: string): [number, number] | null {
  if (!main) return null;
  const i = main.key.indexOf(`${iso}:0`);
  if (i < 0) return null;
  const v = evalSeed(main, i, curNow(performance.now()));
  return [lastCam.cx + v.x * lastCam.s, lastCam.cy + v.y * lastCam.s];
}
/** Where a country seed sits in the plane for a record (px), or its COUNTRIES-disc slot (px) at G3. */
export function expectedPx(iso: string, where: "disc" | string): [number, number] | null {
  const cam = gstate("G3", W, H);
  if (where === "disc") {
    const L = layoutFor(1990);
    if (!L) return null;
    const j = L.order.indexOf(iso), sp = Math.sqrt(L.slots / L.order.length);
    return j < 0 ? null : [cam.cx + sp * vogelX(j) * cam.s, cam.cy + sp * vogelY(j) * cam.s];
  }
  const rec = record(where), dom = rec ? domain(rec.indicator) : null;
  if (!rec?.points || !dom) return null;
  const i = rec.points.iso3.indexOf(iso);
  return i < 0 ? null : [...planePx(dom, cssClass(), W, H, rec.points.x[i]!, rec.points.y[i]!)] as [number, number];
}

/** Mean of ln(value) over the layout's countries, people-weighted or not: the sigma bracket's centre (graphic only). */
export function meanLn(year: number, weighted: boolean): number | null {
  const L = layoutFor(year), p = D.panel;
  if (!L || !p) return null;
  const yi = p.years.indexOf(year);
  let s = 0, w = 0;
  for (const iso of L.order) {
    const ci = p.iso3.indexOf(iso), v = p.series.gdppc_ppp!.values[ci]?.[yi], pop = p.series.population!.values[ci]?.[yi];
    if (!v || !pop) continue;
    const k = weighted ? pop : 1;
    s += k * Math.log(v); w += k;
  }
  return w ? s / w : null;
}

/** A resting state for the reduced-motion static discs (same builders as the live canvas). */
export function staticState(t: { mode: Count; year: number; setAside: boolean; ind?: string }): SeedState | null {
  return buildDisc({ ind: t.ind ?? PPP, mode: t.mode, year: t.year, setAside: t.setAside, sel: "" });
}
/** Reduced-motion figures of free states (plane, groups, relations) on a given box. */
export function staticPlane(rec: BetaRecord, w: number, h: number): { state: SeedState; cam: Cam } | null {
  const cam = { cx: w / 2, cy: h / 2, s: 1 };
  const W0 = W, H0 = H;
  W = w; H = h;
  const s = planeFor(rec, cam);
  W = W0; H = H0;
  return s ? { state: s, cam } : null;
}
export const followIso = (iso: string | null) => yearsStore.set({ follow: iso });
export { unitOf };
