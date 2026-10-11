/**
 * Seed Head director: ONE fixed canvas draws every seed in every scene (VISUAL_DESIGN 3.2). Each
 * frame it locates the active scene, computes the camera (G-states, log-space s) and the data
 * target, starts a keyed transition or a year crossfade when the target changes, and draws only
 * when something changed. Stepped parts (intro clock, year crossfades, weight steps) live here;
 * scrubbed parts are pure functions of progress.
 */
import { SeedsGL, Seeds2D, type Cam, type LayerDraw, type SeedDrawer } from "../gl/seeds";
import { BEZ, atRest, between, makeState, stateAt, staticOf, type SeedState, type Transition } from "../gl/transition";
import { centroids, hash01, knn6, shuffle, type Layout } from "../model/layout";
import { countriesState, peopleState, slotDust, R_IN } from "../model/seedstates";
import { binOf } from "../model/bins";
import { addFrame } from "../motion/loop";
import { easePremium, easeSymmetric, DUR } from "../motion/ease";
import { stepState, windowed } from "../motion/progress";
import { clamp } from "../lib/math";
import { locate } from "../scroll/engine";
import { motionEnabled } from "../state/motion";
import { getStore } from "../data/loader";
import { CONVERGENCE, COUNTRIES, FACTS, INDICATORS, PANEL, SEED_LATEST, SEED_YEARS, factNum, toLayout, type Facts, type PanelIncome } from "../data/artifacts";
import { stageH, stageW, viewportClass } from "../graphics/canvas";
import { camLerp, gstate, LABEL_MIN } from "./geometry";
import { SCENES } from "../app/scenes";
import { view, weight, years as yearsStore, type Count } from "../state/scenes";
import { int, money, PPP_BASIS } from "../data/copy";

export const INTRO_MS = 4600;
const SEED = 20261010;
const SCENE_IDS = SCENES.map((s) => s.id);

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
  years: new Map<number, Layout>(),
  panel: null as PanelIncome | null,
  edges: null as number[] | null,
  names: new Map<string, string>(),
  bins: new Map<number, Map<string, number>>(),
};
export const dataView = D;

function binsFor(year: number): Map<string, number> | null {
  const hit = D.bins.get(year);
  if (hit) return hit;
  if (!D.panel || !D.edges) return null;
  const yi = D.panel.years.indexOf(year), v = D.panel.series.gdppc_ppp!.values, m = new Map<string, number>();
  if (yi < 0) return null;
  D.panel.iso3.forEach((iso, ci) => { const x = v[ci]![yi]; if (x !== null && x !== undefined) m.set(iso, binOf(x, D.edges!)); });
  D.bins.set(year, m);
  return m;
}
/** The PPP value of a country in a year (OBSERVED, published rounding), or null. */
export function valueOf(iso: string, year: number): number | null {
  const p = D.panel;
  if (!p) return null;
  const ci = p.iso3.indexOf(iso), yi = p.years.indexOf(year);
  return ci < 0 || yi < 0 ? null : (p.series.gdppc_ppp!.values[ci]![yi] ?? null);
}
export const layoutFor = (year: number) => (D.latest && year === D.latest.year ? D.latest : D.years.get(year) ?? null);
export const latestYear = () => D.latest?.year ?? 0;

function connect() {
  const on = <T,>(spec: Parameters<typeof getStore<T>>[0], fn: (v: T) => void) => {
    const s = getStore(spec);
    const run = () => { const st = s.getState(); if (st.status === "ready") fn(st.data); };
    s.subscribe(run); run();
  };
  on(FACTS, (f) => { D.facts = f; dirty = true; });
  on(SEED_LATEST, (s) => { D.latest = toLayout(s.years[0]!); dirty = true; });
  on(SEED_YEARS, (s) => { for (const y of s.years) D.years.set(y.year, toLayout(y)); dirty = true; });
  on(PANEL, (p) => { D.panel = p; D.bins.clear(); dirty = true; });
  on(INDICATORS, (i) => { D.edges = i.indicators.find((x) => x.id === "gdppc_ppp")!.display.bins; D.bins.clear(); dirty = true; });
  on(COUNTRIES, (c) => { c.countries.forEach((x) => D.names.set(x.iso3, x.name)); });
}

// ------------------------------------------------------------------ targets
interface Target { mode: Count; year: number; setAside: boolean }
const ASIDE = new Set(["CHN", "IND"]);
const same = (a: Target | null, b: Target) => !!a && a.mode === b.mode && a.year === b.year && a.setAside === b.setAside;

function buildState(t: Target): SeedState | null {
  const L = layoutFor(t.year), bins = binsFor(t.year);
  if (!L || !bins) return null;
  const aside = t.setAside ? ASIDE : undefined;
  return t.mode === "people" ? peopleState(L, { seams: true, bins, setAside: aside }) : countriesState(L, bins, aside);
}

/** S03b scroll steps (VISUAL_DESIGN 3.4): thresholds and the state each step shows. */
export const WEIGHT_THRESHOLDS = [0.32, 0.54, 0.65, 0.76, 0.82, 0.88];
export const weightStep = (k: number, latest: number): Omit<Target, "mode"> & { count: Count } => {
  const S: [Count, number, boolean][] = [["people", latest, false], ["countries", latest, false], ["countries", 1990, false], ["countries", latest, false],
    ["people", 1990, false], ["people", latest, false], ["people", latest, true]];
  const [count, year, setAside] = S[k]!;
  return { count, year, setAside };
};

// ------------------------------------------------------------------ runtime
let drawer: SeedDrawer | null = null;
let glCanvas: HTMLCanvasElement, c2d: HTMLCanvasElement, labelsEl: HTMLElement, tipEl: HTMLElement;
let main: Transition | null = null;
let shown: Target | null = null;
let xf: { a: Transition; b: Transition; t0: number; dur: number } | null = null;
let follow: Transition | null = null, followKey = "";
let dirty = true, lastKey = "", instantUntil = 0, wStep = 0, lastYearAt = 0, lastYear = 0;
let W = 0, H = 0, DPR = 1;
let labelKey = "";
const ic = { ran: false, phases: null as Transition[] | null, dust: null as Transition | null, readyAt: -1, done: false, finish: null as Transition | null, perm: null as Int32Array | null };
export const debug = { R: 0, cx: 0, cy: 0, s: 0, slots: 0, n: 0, mode: "people" as Count, year: 0, mix: 0, scene: "", glFrames: 0, alpha: 1, introDone: false };

function dprFor() {
  const d = devicePixelRatio || 1, cls = viewportClass(W);
  return quality.tier === "low" ? 1 : Math.min(d, cls === "D" ? 2 : 1.5);
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

// ------------------------------------------------------------------ S00
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
  if (!motionEnabled() || (!ic.ran && intro.frozen < 0)) { finishIntro(end); return { tr: main!, now, alpha: 1 }; } // reduced motion / seen this session: the end state at once
  if (ic.readyAt > 6000 || (!intro.playing && intro.frozen < 0 && !ic.phases)) {
    // data later than 6s, or after the intro finished: the end state fades in over 350ms (5.1 States)
    if (!ic.finish) {
      const from = ic.dust ? stateAt(ic.dust, 1000) : slotDust(N, ic.perm, 0);
      ic.finish = between(peopleState(L, { seams: false, bins: null, perm: ic.perm, r: 0.25, alpha: from.alpha[0] ?? 0 }), end, { t0: now, dur: motionEnabled() ? DUR.standard : 0 });
    }
    if (atRest(ic.finish, now)) finishIntro(end);
    return { tr: ic.finish, now, alpha: 1 };
  }
  if (!ic.phases) {
    const perm = ic.perm;
    const dust0 = peopleState(L, { seams: false, bins: null, perm, r: 0.25, alpha: 0 });
    const dust = peopleState(L, { seams: false, bins: null, perm, r: 0.25, alpha: 0.6 });
    const speckle = peopleState(L, { seams: false, bins, perm });
    const sorted = peopleState(L, { seams: false, bins });
    ic.phases = [
      between(dust0, dust, { t0: 400, dur: 600, bez: BEZ.premium }),
      between(dust, speckle, { t0: 1000, dur: 300, delay: (_, i) => hash01(i, 1) * 300, switchAt: 0 }),
      between(speckle, sorted, { t0: 1600, dur: 1600, bez: BEZ.symmetric, delay: (_, i) => hash01(i, 2) * 200 }),
      between(sorted, end, { t0: 3400, dur: 300 }),
    ];
  }
  const tc = t - Math.max(0, ic.readyAt - 1000);
  if (tc >= 3700 || (!intro.playing && intro.frozen < 0)) { finishIntro(end); return { tr: main!, now, alpha: 1 }; }
  const k = tc < 1000 ? 0 : tc < 1600 ? 1 : tc < 3400 ? 2 : 3;
  return { tr: ic.phases[k]!, now: tc, alpha: 1 };
}

function finishIntro(end: SeedState) {
  if (ic.done) return;
  ic.done = true;
  main = staticOf(end);
  shown = { mode: "people", year: D.latest!.year, setAside: false };
  dirty = true;
}
export const introSortT = () => (ic.readyAt < 0 ? -1 : introTime(performance.now()) - Math.max(0, ic.readyAt - 1000));

// ------------------------------------------------------------------ scenes
function applyTarget(tg: Target, now: number, via: "xfade" | "keyed") {
  if (same(shown, tg) || !main) return;
  const to = buildState(tg);
  if (!to) return;
  const instant = !motionEnabled() || now < instantUntil;
  if (xf) { main = xf.b; xf = null; }
  if (instant) {
    main = staticOf(to);
  } else if (via === "xfade" && shown && shown.mode === "people" && tg.mode === "people" && shown.setAside === tg.setAside) {
    // year scrub: 200ms crossfade between two real layouts in place; hard step above 6 years/s or on LOW
    const rate = (Math.abs(tg.year - lastYear) / Math.max(1, now - lastYearAt)) * 1000;
    const dur = quality.tier === "low" || rate > 6 ? 0 : DUR.fast;
    const b = staticOf(to);
    if (dur > 0) xf = { a: main, b, t0: now, dur };
    main = b;
  } else {
    const from = stateAt(main, now);
    if (shown && shown.mode !== tg.mode) {
      // coalesce / burst: 800ms, staggered by territory size (largest last, 0-200ms)
      const L = layoutFor(tg.mode === "countries" ? shown.year : tg.year)!, max = Math.max(...L.counts);
      const size = new Map(L.order.map((iso, i) => [iso, L.counts[i]!]));
      main = between(from, to, { t0: now, dur: DUR.card, absorb: true, delay: (k) => 200 * Math.sqrt((size.get(k.slice(0, 3)) ?? 1) / max) });
    } else if (shown && shown.year !== tg.year) {
      main = between(from, to, { t0: now, dur: DUR.scene, delay: (_, i) => hash01(i, 3) * 150 });
    } else {
      main = between(from, to, { t0: now, dur: DUR.panel });
    }
  }
  lastYearAt = now; lastYear = tg.year;
  shown = tg;
  dirty = true;
}

function sceneTarget(id: string, p: number): { tg: Target; via: "xfade" | "keyed" } | null {
  const latest = latestYear();
  if (!latest) return null;
  if (id === "eight-billion" || (id === "sources" && p < 0.97)) return { tg: { mode: "people", year: latest, setAside: false }, via: "keyed" };
  if (id === "sources" || id === "years") {
    const ys = [...D.years.keys()].sort((a, b) => a - b);
    if (!ys.length) return { tg: { mode: "people", year: latest, setAside: false }, via: "keyed" };
    const k = id === "sources" ? 0 : Math.min(ys.length - 1, Math.floor(clamp((p - 0.06) / 0.88) * ys.length));
    const y = ys[k]!;
    if (yearsStore.get().year !== y) yearsStore.set({ year: y });
    return { tg: { mode: "people", year: y, setAside: false }, via: "xfade" };
  }
  if (id === "weight") {
    const k = stepState(wStep, p, WEIGHT_THRESHOLDS);
    if (k !== wStep || (weight.get().year === 0 && !weight.get().user)) {
      wStep = k;
      weight.set({ ...weightStep(k, latest), step: k, user: false });
    }
    const w = weight.get();
    if (w.year !== latest && !layoutFor(w.year)) return null;
    return { tg: { mode: w.count, year: w.year, setAside: w.setAside }, via: "keyed" };
  }
  return null; // later scenes hold the last state (built in Stage B)
}

function camera(id: string, p: number, after: number): { cam: Cam; alpha: number } {
  const g = (n: "G0" | "G1" | "G2" | "G3") => gstate(n, W, H);
  if (!motionEnabled()) return { cam: g("G0"), alpha: clamp(1 - scrollY / Math.max(1, H)) };
  switch (id) {
    case "eight-billion": return { cam: camLerp(g("G0"), g("G1"), windowed(p, 0, 0.4, easeSymmetric)), alpha: 1 };
    case "sources": {
      const t = windowed(p, 0.85, 1, easeSymmetric);
      return { cam: camLerp(g("G1"), g("G2"), t), alpha: 0.2 + 0.8 * t };
    }
    case "years": return { cam: camLerp(g("G2"), g("G3"), windowed(p, 0.94, 1, easeSymmetric)), alpha: 1 };
    case "weight": return { cam: g("G3"), alpha: 1 - 0.85 * clamp(after / Math.max(1, H)) };
    default: return { cam: g("G1"), alpha: 0.15 };
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
  if (key !== followKey) {
    followKey = key;
    const s = followState(shown.year, iso);
    follow = s ? staticOf(s) : null;
  }
  return follow;
}

// ------------------------------------------------------------------ labels and hover
function placeLabels(cam: Cam, id: string, show: boolean) {
  const L = shown ? layoutFor(shown.year) : D.latest;
  if (!L || !labelsEl) return;
  const intro6 = !ic.done || id === "eight-billion";
  const min = LABEL_MIN[viewportClass(W)];
  const key = `${L.year}:${shown?.mode}:${intro6}:${min}`;
  if (key !== labelKey) {
    labelKey = key;
    const byCount = L.order.map((iso, i) => ({ iso, i, c: L.counts[i]! })).sort((a, b) => b.c - a.c);
    const pick = shown?.mode === "countries" ? byCount.filter((x) => ASIDE.has(x.iso)) : intro6 ? byCount.slice(0, 6) : byCount.filter((x) => x.c > min);
    const cen = centroids(L), sp = Math.sqrt(L.slots / L.order.length);
    labelsEl.replaceChildren(...pick.map((x) => {
      const el = document.createElement("span");
      el.className = "seed-label";
      el.textContent = x.iso;
      const [wx, wy] = shown?.mode === "countries" ? (() => { const j = L.order.indexOf(x.iso); return [sp * Math.sqrt(j + 0.5) * Math.cos(j * 2.399963229728653), sp * Math.sqrt(j + 0.5) * Math.sin(j * 2.399963229728653)]; })() : [cen[x.i * 3]!, cen[x.i * 3 + 1]!];
      el.dataset.wx = String(wx); el.dataset.wy = String(wy);
      return el;
    }));
  }
  for (const el of labelsEl.children as HTMLCollectionOf<HTMLElement>) {
    el.style.transform = `translate(${cam.cx + Number(el.dataset.wx) * cam.s}px, ${cam.cy + Number(el.dataset.wy) * cam.s}px) translate(-50%, -50%)`;
  }
  labelsEl.classList.toggle("is-on", show && motionEnabled());
}

let pointer: { x: number; y: number } | null = null;
let lastCam: Cam = { cx: 0, cy: 0, s: 1 };
function hover() {
  if (!tipEl) return;
  const id = debug.scene;
  const L = shown ? layoutFor(shown.year) : null;
  if (!pointer || !L || !ic.done || !["eight-billion", "years", "weight"].includes(id) || (main && !atRest(main, performance.now()))) { tipEl.hidden = true; return; }
  const wx = (pointer.x - lastCam.cx) / lastCam.s, wy = (pointer.y - lastCam.cy) / lastCam.s;
  let iso: string | null = null;
  if (shown!.mode === "people") {
    if (wx * wx + wy * wy > L.slots + 2) { tipEl.hidden = true; return; }
    let best = Infinity, bi = -1;
    for (let i = 0; i < L.slots; i++) {
      const dx = Math.sqrt(i + 0.5) * Math.cos(i * 2.399963229728653) - wx, dy = Math.sqrt(i + 0.5) * Math.sin(i * 2.399963229728653) - wy, d = dx * dx + dy * dy;
      if (d < best) { best = d; bi = i; }
    }
    iso = L.order[L.owner[bi]!]!;
  } else {
    const n = L.order.length, sp = Math.sqrt(L.slots / n);
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      const dx = sp * Math.sqrt(j + 0.5) * Math.cos(j * 2.399963229728653) - wx, dy = sp * Math.sqrt(j + 0.5) * Math.sin(j * 2.399963229728653) - wy, d = dx * dx + dy * dy;
      if (d < best && d < sp * sp) { best = d; iso = L.order[j]!; }
    }
  }
  if (!iso) { tipEl.hidden = true; return; }
  const v = valueOf(iso, L.year), r = L.order.indexOf(iso) + 1;
  tipEl.textContent = `${(D.names.get(iso) ?? iso).toUpperCase()} · ${v === null ? "NO DATA" : money(v, PPP_BASIS)} · RANK ${int(r)} OF ${int(L.order.length)} · ${L.year}`;
  tipEl.hidden = false;
  tipEl.style.transform = `translate(${Math.min(pointer.x + 12, W - tipEl.offsetWidth - 8)}px, ${pointer.y + 12}px)`;
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
  const { cam, alpha } = camera(id, p, loc?.after ?? 0);
  let layers: LayerDraw[] = [];
  let showLabels = false;
  if (!ic.done) {
    const L = introLayer(t, now);
    if (L) layers = [L];
    showLabels = ic.done || introSortT() >= 3400;
    if (intro.playing && t >= 400) {
      const N = D.latest?.slots ?? (D.facts ? factNum(D.facts, "seedhead_slots_latest") : 0);
      const R = cam.s * Math.sqrt(N);
      if (N) { if (R < intro.lastR - 1e-6) intro.monotonic = false; intro.minR = Math.min(intro.minR, R); intro.lastR = R; }
    }
  }
  if (ic.done && main) {
    const tgt = sceneTarget(id, p);
    if (tgt) applyTarget(tgt.tg, now, tgt.via);
    if (xf && now >= xf.t0 + xf.dur) xf = null;
    const m = xf ? clamp((now - xf.t0) / xf.dur) : 1;
    layers = xf ? [{ tr: xf.a, now, alpha: 1 - m }, { tr: xf.b, now, alpha: m }] : [{ tr: main, now, alpha: 1 }];
    const f = followLayer(id);
    if (f) layers.push({ tr: f, now, alpha: 1 });
    showLabels = atRest(main, now) && !xf && ["eight-billion", "years", "weight"].includes(id) && (id !== "eight-billion" || p < 0.6);
    debug.mix = xf ? m : 0;
  }
  layers.forEach((l) => (l.alpha *= alpha));
  const busy = layers.some((l) => !atRest(l.tr, l.now)) || !!xf;
  const key = `${cam.cx.toFixed(2)}|${cam.cy.toFixed(2)}|${cam.s.toFixed(4)}|${layers.map((l) => `${l.tr.version}:${l.alpha.toFixed(3)}:${atRest(l.tr, l.now) ? "r" : l.now}`).join(",")}`;
  if (drawer && (busy || dirty || key !== lastKey)) {
    drawer.draw(cam, layers);
    lastKey = key; dirty = false;
  }
  lastCam = cam;
  placeLabels(cam, id, showLabels);
  hover();
  // debug hook (e2e + evidence): the disc as drawn
  const n0 = layers[layers.length > 1 && xf ? 1 : 0];
  const N = shown && ic.done ? layoutFor(shown.year)?.slots ?? 0 : D.latest?.slots ?? 0;
  Object.assign(debug, { R: cam.s * Math.sqrt(N), cx: cam.cx, cy: cam.cy, s: cam.s, slots: N, n: n0?.tr.n ?? 0, mode: shown?.mode ?? "people", year: shown?.year ?? 0, scene: id, glFrames: drawer?.frames ?? 0, alpha, introDone: ic.done });
  if (view.get().slots !== N || view.get().mode !== debug.mode || view.get().scene !== id) view.set({ slots: N, mode: debug.mode, scene: id });
  tierCheck(dt);
}

function tierCheck(dt: number) {
  if (forced || quality.tier !== "high" || !ic.done || quality.samples.length >= 60) return;
  quality.samples.push(dt);
  if (quality.samples.length === 60) {
    const s = [...quality.samples].sort((a, b) => a - b);
    quality.median = s[30]!;
    if (quality.median > (viewportClass(W) === "D" ? 22 : 40)) { quality.tier = "low"; DPR = dprFor(); drawer?.resize(W, H, DPR); dirty = true; }
    document.documentElement.dataset.tier = quality.tier;
    view.set({ tier: quality.tier });
  }
}

let started = false;
export function startDirector(gl: HTMLCanvasElement, flat: HTMLCanvasElement, labels: HTMLElement, tip: HTMLElement) {
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
  addEventListener("eca:snap", () => { if (main) { main = staticOf(stateAt(main, Infinity)); xf = null; dirty = true; } });
  addEventListener("pointermove", (e) => {
    const t = e.target as Element | null;
    pointer = e.pointerType === "mouse" && !t?.closest?.("button, a, input, select, .panel, .nav-bar, .nav-pill") ? { x: e.clientX, y: e.clientY } : null;
  }, { passive: true });
  addEventListener("pointerleave", () => { pointer = null; });
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
export function staticState(t: { mode: Count; year: number; setAside: boolean }): SeedState | null {
  return buildState(t);
}
export const followIso = (iso: string | null) => yearsStore.set({ follow: iso });
