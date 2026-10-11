/**
 * QA lessons L1-L18 (docs/QA_LESSONS.md, workspace root) and the P05 QA register (D-001..D-019).
 * These tests make their own browsers and viewports, so they run once (desktop project).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

const SCENES: [string, number][] = [["eight-billion", 0.78], ["sources", 0.14], ["years", 0.7], ["weight", 0.43], ["catch-up", 0.95], ["lab", 0.4], ["likeness", 0.2], ["evidence", 0.05], ["atlas", 0], ["resorted", 0.9]];
/** Extra positions QA used: every S02 card, the flight, the lab live, WARD, relations, the stack end, the echo. */
const EXTRA: [string, number][] = [["eight-billion", 0], ["sources", 0.314], ["sources", 0.504], ["sources", 0.694], ["catch-up", 0.24], ["lab", 0.5], ["likeness", 0.4], ["likeness", 0.62], ["evidence", 0.95], ["lab", 0.12], ["lab", 0.27]];
const VIEWPORTS: [number, number][] = [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]];
const SCROLLBAR_CSS = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: #555; }";
const BASE = "http://localhost:4341/economic-atlas/";
type W = { __eca: { jumpTo: (i: string, p?: number) => void; debug: () => { introDone: boolean; cls: string; cx: number; cy: number; R: number; palette: string; scene: string } } };

async function openAt(browser: Browser, w: number, h: number, opts: { classic?: boolean; reduced?: boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reduced ? "reduce" : "no-preference", hasTouch: w < 1024, isMobile: w < 768 });
  if (opts.classic) await ctx.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }), SCROLLBAR_CSS);
  const page = await ctx.newPage();
  await page.goto(`${BASE}?quality=high`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => (window as unknown as W).__eca?.debug().introDone, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const go = (page: Page, id: string, p: number) => page.evaluate(([i, q]) => (window as unknown as W).__eca.jumpTo(i as string, q as number), [id, p] as const);

/**
 * DOM-generated boxes (L19): every visible run of text in the scene (each element's own text nodes, measured as a Range),
 * every visible control and chip, the fixed nav and corner button, and the visible seed labels (L13). No selector list
 * decides what text counts, so a new class name cannot slip past.
 */
async function boxes(page: Page, id: string, flow = false) {
  return page.evaluate(([sid, flowMode]) => {
    const CONTROL = "button, select, input, a, summary, .chip, [role=radio], [role=button]";
    const root = document.getElementById(sid)!;
    // normal-flow content (ATLAS always, every scene under reduced motion) scrolls under the fixed nav: that is scrolling, not layout
    const chrome = sid === "atlas" || flowMode ? [] : [...document.querySelectorAll<HTMLElement>(".nav-bar.is-fixed, .menu-pill, .corner-btn")];
    // clip a rect by every overflow-clipping ancestor of e (scrolled-away text is clipped, not overprinted)
    const clip = (e: Element, r: { left: number; top: number; right: number; bottom: number }) => {
      let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a).overflowY;
        if (o === "auto" || o === "hidden" || o === "scroll") { const q = a.getBoundingClientRect(); x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom); }
      }
      return { x0, y0, x1, y1 };
    };
    const shown = (e: Element) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !e.closest(".sr-only, details:not([open]) > :not(summary), .rail__controls:not(.is-open) .rail__block");
    const out: { t: string; x0: number; y0: number; x1: number; y1: number }[] = [];
    const push = (e: Element, t: string, r: { left: number; top: number; right: number; bottom: number }) => {
      const v = clip(e, r);
      if (v.x1 - v.x0 > 1 && v.y1 - v.y0 > 1 && v.y1 > 0 && v.x1 > 0 && v.y0 < innerHeight && v.x0 < innerWidth) out.push({ t: t.trim().slice(0, 40), ...v });
    };
    // controls, chips and fixed chrome as whole boxes (outermost control only)
    const ctrls = [...root.querySelectorAll(CONTROL), ...chrome].filter((e) => shown(e) && !e.parentElement?.closest(CONTROL));
    for (const e of ctrls) push(e, e.textContent || e.getAttribute("aria-label") || e.tagName, e.getBoundingClientRect());
    // every other visible text node, as its own range
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const el = n.parentElement!;
      if (!n.textContent?.trim() || el.closest(CONTROL) || !shown(el)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      // one box per line fragment, inset to the glyph core (font content boxes of adjacent tight lines overlap by design)
      for (const r of rg.getClientRects()) { const k = r.height * 0.18; push(el, n.textContent, { left: r.left, right: r.right, top: r.top + k, bottom: r.bottom - k }); }
    }
    for (const l of document.querySelectorAll<HTMLElement>(".seed-labels.is-on .seed-label")) if (l.style.visibility !== "hidden" && shown(l)) push(l, l.textContent ?? "", l.getBoundingClientRect());
    // graphic marks that carry meaning without text: the legend strip
    for (const g of root.querySelectorAll(".legend__strip")) if (shown(g)) push(g, "legend strip", g.getBoundingClientRect());
    return out;
  }, [id, flow] as const);
}
function collisions(b: Awaited<ReturnType<typeof boxes>>) {
  const out: string[] = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const a = b[i]!, c = b[j]!, w = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), h = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
    if (w > 2 && h > 2) out.push(`"${a.t}" x "${c.t}" (${w.toFixed(0)}x${h.toFixed(0)})`);
  }
  return out;
}
/** S02 cards: nothing spills out of a card's visual zone or body (QA D-003: DOM boxes miss text that overflows a fixed zone). */
const cardSpill = (page: Page) => page.evaluate(() => [...document.querySelectorAll("[data-card]")].flatMap((c) => {
  const v = c.querySelector(".story-card__visual")!, b = c.querySelector(".story-card__body")!;
  const bad: string[] = [];
  if (v.scrollHeight > v.clientHeight + 2) bad.push(`card ${c.getAttribute("data-card")} visual ${v.scrollHeight}/${v.clientHeight}`);
  if (b.scrollHeight > b.clientHeight + 2) bad.push(`card ${c.getAttribute("data-card")} body ${b.scrollHeight}/${b.clientHeight}`);
  return bad;
}));

test.describe("QA lessons", () => {
  test.describe.configure({ timeout: 300_000 });
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "own viewports"));

  for (const [w, h] of [[1024, 768], [768, 1024]] as const) {
    test(`L1: ${w}x${h} with classic scrollbars: JS class = CSS class, no text collides`, async ({ playwright }) => {
      const b = await playwright.chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
      const { ctx, page } = await openAt(b, w, h, { classic: true });
      const m = await page.evaluate(() => ({ js: (window as unknown as W).__eca.debug().cls, css: matchMedia("(max-width: 767px)").matches ? "M" : matchMedia("(max-width: 1023px)").matches ? "T" : "D", cw: document.documentElement.clientWidth }));
      expect(m.cw, "a classic scrollbar takes layout width").toBeLessThan(w);
      expect(m.js).toBe(m.css);
      const all: string[] = [];
      for (const [id, p] of SCENES) { await go(page, id, p); await page.waitForTimeout(800); all.push(...collisions(await boxes(page, id)).map((c) => `${id}: ${c}`)); }
      await ctx.close(); await b.close();
      expect(all).toEqual([]);
    });
  }

  for (const [w, h] of VIEWPORTS) {
    test(`L2/L11/L13: ${w}x${h}: no text, control or seed label collides in any scene position; S02 cards never spill`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, h);
      const all: string[] = [];
      for (const [id, p] of [...SCENES, ...EXTRA]) {
        await go(page, id, p); await page.waitForTimeout(900);
        all.push(...collisions(await boxes(page, id)).map((c) => `${id}@${p}: ${c}`));
        if (id === "sources") all.push(...(await cardSpill(page)).map((c) => `${id}@${p}: ${c}`));
      }
      await ctx.close();
      expect(all).toEqual([]);
    });
  }

  for (const [w, h] of VIEWPORTS.filter(([w]) => w !== 1280)) {
    test(`D-001 reduced motion ${w}x${h}: normal flow, nothing overprints (first paint and every scene top)`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, h, { reduced: true });
      const all: string[] = [];
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
      all.push(...collisions(await boxes(page, "eight-billion", true)).map((c) => `first paint: ${c}`));
      for (const [id] of SCENES) {
        const tops = await page.evaluate((i) => { const s = document.getElementById(i)!; const t = s.getBoundingClientRect().top + scrollY; return [t, t + Math.max(0, s.offsetHeight - window.innerHeight)]; }, id);
        for (const y of [...new Set(tops.map((t) => Math.round(t)))].concat(Math.round(tops[0]! + h * 0.9))) {
          await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(250);
          all.push(...collisions(await boxes(page, id, true)).map((c) => `${id}@${y}: ${c}`));
        }
      }
      await ctx.close();
      expect(all).toEqual([]);
    });
  }

  for (const w of [360, 375, 390, 768]) {
    test(`L3/L5/L7/L8/L9/L14 at ${w}px: tags visible, no sideways scroll (vs the configured width), 11px floor, corner clear of pill, controls hit-testable`, async ({ browser }) => {
      const h = w === 768 ? 1024 : 800;
      const { ctx, page } = await openAt(browser, w, h);
      const bad: string[] = [];
      for (const [id, p] of [...SCENES, ["catch-up", 0.24] as [string, number]]) {
        for (const q of [Math.max(0, p - 0.2), p, Math.min(1, p + 0.05)]) {
          await go(page, id, q); await page.waitForTimeout(700);
          const r = await page.evaluate((sid) => {
            const root = document.getElementById(sid)!;
            const vis = (e: Element) => (e as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }) && (() => { const b = e.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.top < innerHeight; })();
            const small = [...root.querySelectorAll("p, span, h2, h3, button, a, li, figcaption, label, text, td, th, summary")].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11)
              .map((e) => `${e.tagName}:${e.textContent!.trim().slice(0, 30)} ${getComputedStyle(e).fontSize}`);
            const tags = [...root.querySelectorAll(".chip")].filter(vis).length;
            const ctrls = [...root.querySelectorAll<HTMLElement>("button, select, input")].filter(vis).filter((c) => {
              const b = c.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
              if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
              const hit = document.elementFromPoint(cx, cy);
              return hit && !c.contains(hit) && !hit.contains(c) && !(sid === "atlas" && hit.closest(".nav-pill, .nav-bar, .corner-btn"));
            }).map((c) => `${c.textContent?.trim().slice(0, 20) || c.id}`);
            return { small, tags, ctrls, sw: document.documentElement.scrollWidth };
          }, id);
          if (r.sw > w) bad.push(`${id}@${q}: L14 scrollWidth ${r.sw} > configured ${w}`);
          if (r.small.length) bad.push(`${id}@${q}: L7 ${r.small.slice(0, 3).join(" | ")}`);
          if ((q === p || id === "catch-up") && id !== "evidence" && r.tags === 0) bad.push(`${id}@${q}: L3 no visible honesty tag`);
          if (r.ctrls.length) bad.push(`${id}@${q}: L9 ${r.ctrls.slice(0, 3).join(" | ")}`);
        }
      }
      const gap = await page.evaluate(() => { const a = document.querySelector(".corner-btn")!.getBoundingClientRect(), b = document.querySelector(".nav-pill.is-fixed")!.getBoundingClientRect(); return Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom); });
      if (gap < 8) bad.push(`L8 corner button to pill ${gap.toFixed(1)}px`);
      // D-007: legend edge numerals never run together (4px minimum gap)
      for (const [id, p] of [["eight-billion", 0], ["years", 0.7], ["weight", 0.43]] as const) {
        await go(page, id, p); await page.waitForTimeout(600);
        const g = await page.evaluate((sid) => [...document.querySelectorAll(`#${sid} .legend__edges`)].filter((e) => (e as HTMLElement).checkVisibility()).map((e) => {
          const r = [...e.querySelectorAll("span")].map((s) => s.getBoundingClientRect()).sort((a, b) => a.left - b.left);
          return Math.min(...r.slice(1).map((x, i) => x.left - r[i]!.right));
        }), id);
        for (const v of g) if (v < 4) bad.push(`${id}: D-007 legend edge labels ${v.toFixed(1)}px apart`);
      }
      await ctx.close();
      expect(bad).toEqual([]);
    });
  }

  for (const w of [360, 390, 768]) {
    test(`L5/L14 reduced motion at ${w}px: no sideways scroll anywhere on the page`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, w === 768 ? 1024 : 800, { reduced: true });
      for (const [id] of SCENES) {
        await page.evaluate((i) => document.getElementById(i)!.scrollIntoView(), id);
        await page.waitForTimeout(150);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(w);
      }
      await ctx.close();
    });
  }

  /** L18: every unit-bearing element of a view agrees with every other one, and with the canvas palette, in every frame of a basis swap. */
  async function sampleSwap(page: Page, scene: string, act: () => Promise<void>) {
    await page.evaluate((sid) => {
      const s = window as unknown as { __frames: { bases: string[]; pal: string }[] } & W;
      s.__frames = [];
      const basesOf = (t: string) => { const u = t.toUpperCase(), o: string[] = []; if (/\bPPP\b/.test(u)) o.push("ppp_constant_intl_2021"); if (/CONSTANT 2015 US/.test(u)) o.push("constant_usd_2015"); if (/CURRENT US/.test(u)) o.push("current_usd"); return o; };
      const t0 = performance.now();
      const f = () => {
        const root = document.getElementById(sid)!;
        const text = [...root.querySelectorAll(".plane text, .plane-read, .verdict-ledger, .s03-chips, .atlas__status, .legend, .paths figcaption, .data-table tbody tr:first-child")].map((e) => e.textContent ?? "").join(" | ");
        s.__frames.push({ bases: basesOf(text), pal: s.__eca.debug().palette });
        if (performance.now() - t0 < 2600) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }, scene);
    await act();
    await page.waitForTimeout(2800);
    return page.evaluate(() => (window as unknown as { __frames: { bases: string[]; pal: string }[] }).__frames);
  }
  for (const w of [1440, 390]) {
    test(`L18 at ${w}: S05 BASIS swap and ATLAS indicator swap never show two bases in any frame`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, w === 1440 ? 900 : 844);
      await go(page, "lab", 0.5); await page.waitForTimeout(1500);
      const toggle = page.locator("#lab .sheet-toggle");
      if (await toggle.isVisible()) { const b = (await toggle.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400); }
      const btn = page.locator("#lab").getByRole("radio", { name: "CONSTANT US$" });
      const frames = await sampleSwap(page, "lab", async () => { const b = (await btn.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); });
      expect(frames.length).toBeGreaterThan(20);
      for (const [i, f] of frames.entries()) {
        expect(f.bases.length, `S05 frame ${i}: ${f.bases.join(",")}`).toBeLessThanOrEqual(1);
        if (f.pal !== "none" && f.bases[0]) expect(f.pal, `S05 frame ${i}`).toBe(f.bases[0]);
      }
      expect(frames.some((f) => f.pal === "none")).toBe(true);
      expect(frames.at(-1)!.bases).toEqual(["constant_usd_2015"]);
      await go(page, "atlas", 0); await page.waitForTimeout(1800);
      const sheet = page.locator("#atlas .atlas-sheet-toggle");
      if (await sheet.isVisible()) { await sheet.scrollIntoViewIfNeeded(); const b = (await sheet.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400); }
      const af = await sampleSwap(page, "atlas", async () => { await page.selectOption("#atlas-ind", "gdppc_nominal"); });
      for (const [i, f] of af.entries()) {
        expect(f.bases.length, `ATLAS frame ${i}: ${f.bases.join(",")}`).toBeLessThanOrEqual(1);
        if (f.pal !== "none" && f.bases[0]) expect(f.pal, `ATLAS frame ${i}`).toBe(f.bases[0]);
      }
      expect(af.at(-1)!.bases).toEqual(["current_usd"]);
      await ctx.close();
    });
  }

  for (const w of [1440, 390]) {
    test(`L17/L12 at ${w}: the inspector closes when its scene is left; CLOSE is in view; S08 links take a real pointer`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, w === 1440 ? 900 : 844);
      await go(page, "atlas", 0); await page.waitForTimeout(1500);
      const sheet = page.locator("#atlas .atlas-sheet-toggle");
      if (await sheet.isVisible()) { await sheet.scrollIntoViewIfNeeded(); const b = (await sheet.boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400); }
      await page.fill("#atlas-country", "Germany"); await page.waitForTimeout(400);
      // on phones the chip lives in the sheet: opening the inspector from it closes the sheet
      await page.locator(".chipsel__name").first().scrollIntoViewIfNeeded();
      const chip = (await page.locator(".chipsel__name").first().boundingBox())!;
      await page.mouse.click(chip.x + chip.width / 2, chip.y + chip.height / 2);
      await expect(page.getByRole("dialog")).toBeVisible();
      const close = await page.evaluate(() => { const b = document.querySelector(".inspector__close")!.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; return { inView: y > 0 && y < innerHeight && x > 0 && x < innerWidth, hit: document.elementFromPoint(x, y)?.closest(".inspector__close") !== null }; });
      expect(close).toEqual({ inView: true, hit: true });
      await go(page, "resorted", 0.95); await page.waitForTimeout(1500);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const link = page.locator("#resorted .s08-link").first();
      const b = (await link.boundingBox())!;
      expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest(".s08-link") !== null, [b.x + b.width / 2, b.y + b.height / 2])).toBe(true);
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page).toHaveURL(/#atlas$/);
      await ctx.close();
    });
  }

  test("D-008: on phones ATLAS has a CONTROLS sheet and the ATLAS and S03a discs are at least half visible", async ({ browser }) => {
    const { ctx, page } = await openAt(browser, 390, 844);
    const visible = (sid: string) => page.evaluate((s) => {
      const d = (window as unknown as W).__eca.debug(), pts: [number, number][] = [];
      for (let a = 0; a < 24; a++) for (const k of [0.2, 0.5, 0.8]) pts.push([d.cx + d.R * k * Math.cos((a * Math.PI) / 12), d.cy + d.R * k * Math.sin((a * Math.PI) / 12)]);
      const inView = pts.filter(([x, y]) => x > 0 && y > 0 && x < innerWidth && y < innerHeight);
      const clear = inView.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !e || !e.closest(`#${s} .panel-glass, #${s} .col > *, #${s} .years-readout, #${s} .legend, #${s} .rail, .nav-pill, #${s} .statuses`); });
      return clear.length / Math.max(1, pts.length);
    }, sid);
    await go(page, "atlas", 0); await page.waitForTimeout(2000);
    expect(await visible("atlas")).toBeGreaterThanOrEqual(0.5);
    const t = page.locator("#atlas .atlas-sheet-toggle");
    await t.scrollIntoViewIfNeeded();
    const b = (await t.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator("#atlas-controls")).toHaveClass(/is-open/);
    await expect(page.locator("#atlas-ind")).toBeVisible();
    await page.locator(".rail__sheet-close").click();
    await go(page, "years", 0.7); await page.waitForTimeout(1500);
    expect(await visible("years")).toBeGreaterThanOrEqual(0.5);
    await ctx.close();
  });

  test("D-006/D-010/D-016: S05 weighted slope with its set-aside counterpart; EVIDENCE lands on a card; receipts bound", async ({ browser }) => {
    const { ctx, page } = await openAt(browser, 1440, 900);
    await go(page, "lab", 0.5); await page.waitForTimeout(1500);
    await page.locator("#lab").getByRole("radio", { name: "PEOPLE-WEIGHTED", exact: true }).click(); await page.waitForTimeout(1500);
    // rendered text (innerText): the phone short labels are in the DOM but not displayed at 1440
    const pairText = await page.locator("#lab [data-weighted-pair]").evaluate((e) => (e as HTMLElement).innerText);
    expect(pairText).toContain("CHINA + INDIA SET ASIDE: -0.56");
    expect(pairText).toContain("PEOPLE-WEIGHTED, ALL: -1.60");
    await page.evaluate(() => (window as unknown as W).__eca.jumpTo("evidence"));
    await page.waitForTimeout(1200);
    const card = await page.evaluate(() => [...document.querySelectorAll(".ev-ex")].some((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight && r.bottom > 0; }));
    expect(card).toBe(true);
    await go(page, "evidence", 0.95); await page.waitForTimeout(1000);
    await expect(page.locator("#evidence .receipt")).not.toContainText(" 0 BYTES");
    await ctx.close();
  });

  /** Counts fit-line and CI-hatch pixels in a real screenshot of the plane's fit region (QA D-023: pixels, not DOM). */
  async function fitPixels(page: Page, scene: string) {
    const box = await page.evaluate((sc) => { const g = document.querySelector(`#${sc} svg.plane .plane__fit polygon`); if (!g) return null; const r = g.getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(innerWidth, r.right) - Math.max(0, r.left), height: Math.min(innerHeight, r.bottom) - Math.max(0, r.top) }; }, scene);
    if (!box || box.width < 10 || box.height < 4) return { line: 0, hatch: 0 };
    const png = (await page.screenshot({ clip: box })).toString("base64");
    return page.evaluate(async (b64) => {
      const im = new Image(); im.src = `data:image/png;base64,${b64}`; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d")!; x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let line = 0, hatch = 0;
      for (let k = 0; k < d.length; k += 4) {
        const r = d[k]!, g = d[k + 1]!, bl = d[k + 2]!;
        if (Math.abs(r - 88) < 30 && Math.abs(g - 184) < 30 && Math.abs(bl - 225) < 30) line++;
        else if (bl > r + 30 && g > r + 15 && bl < 190 && bl > 50) hatch++;
      }
      return { line, hatch };
    }, png);
  }
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]] as [number, number][]) {
    test(`D-023 reduced motion ${w}: the S04 and S05 planes draw axes, unit line, zero line, fit and CI band (pixels), and a basis change swaps them`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, h, { reduced: true });
      for (const sc of ["catch-up", "lab"]) {
        await go(page, sc, 0.5); await page.waitForTimeout(1500);
        const dom = await page.evaluate((id) => { const s = document.querySelector(`#${id} svg.plane`); return s ? { x: s.querySelectorAll(".plane__x > text:not(.plane__unit)").length, unit: s.querySelectorAll(".plane__unit").length, zero: !!s.querySelector(".plane__zero"), fit: !!s.querySelector(".plane__fit"), fixed: getComputedStyle(s).position } : null; }, sc);
        expect(dom, `${sc} svg.plane`).toEqual({ x: expect.any(Number), unit: 2, zero: true, fit: true, fixed: "fixed" });
        expect(dom!.x, `${sc} x labels`).toBeGreaterThanOrEqual(3);
        const px = await fitPixels(page, sc);
        expect(px.line, `${sc} fit-line pixels`).toBeGreaterThan(40);
        expect(px.hatch, `${sc} CI-hatch pixels`).toBeGreaterThan(40);
      }
      // S05: a basis change swaps the overlay's basis (L18 under reduced motion)
      const sheet = page.locator("#lab .sheet-toggle");
      if (await sheet.isVisible()) await sheet.click();
      await page.locator("#lab [role=radio]", { hasText: /^CONSTANT US\$$/ }).click(); await page.waitForTimeout(1200);
      if (await page.locator("#lab .sheet-toggle[aria-expanded=true]").isVisible()) await page.locator("#lab .sheet-toggle").click();
      await go(page, "lab", 0.5); await page.waitForTimeout(1200); // on phones the toggle sits above the fold in flow; reaching it scrolls S04 into view
      await expect(page.locator("#lab svg.plane")).toHaveAttribute("data-basis", /^constant_usd_/);
      await expect(page.locator("#lab svg.plane .plane__unit").first()).toContainText(/CONSTANT \d{4} US\$/);
      await ctx.close();
    });
  }

  test("D-024 768: the S05 guided tour (p 0.05 to 0.30) collides nowhere and its honesty chip is fully visible", async ({ browser }) => {
    const { ctx, page } = await openAt(browser, 768, 1024);
    const all: string[] = [];
    for (let p = 0.05; p <= 0.301; p += 0.025) {
      await go(page, "lab", p); await page.waitForTimeout(900);
      all.push(...collisions(await boxes(page, "lab")).map((c) => `lab@${p.toFixed(3)}: ${c}`));
      const chip = await page.evaluate(() => {
        const c = document.querySelector<HTMLElement>("#lab .plane-read .chip"); if (!c) return "none";
        const r = c.getBoundingClientRect();
        return [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]].every(([x, y]) => c.contains(document.elementFromPoint(x!, y!))) ? "visible" : "covered";
      });
      if (chip !== "visible") all.push(`lab@${p.toFixed(3)}: tour chip ${chip}`);
    }
    expect(all).toEqual([]);
    await ctx.close();
  });

  test("L19: the DOM-generated collision helper catches an overlapping element with a class name nobody listed", async ({ browser }) => {
    const { ctx, page } = await openAt(browser, 768, 1024);
    await go(page, "lab", 0.12); await page.waitForTimeout(900);
    expect(collisions(await boxes(page, "lab"))).toEqual([]);
    await page.evaluate(() => {
      const chip = document.querySelector("#lab .plane-read .chip")!.getBoundingClientRect();
      const d = document.createElement("div"); d.className = "zz-never-listed"; d.textContent = "OVERPRINT";
      Object.assign(d.style, { position: "fixed", left: `${chip.left}px`, top: `${chip.top}px`, font: "16px monospace", zIndex: "50" });
      document.getElementById("lab")!.appendChild(d);
    });
    expect((await collisions(await boxes(page, "lab"))).some((c) => c.includes("OVERPRINT"))).toBe(true);
    await ctx.close();
  });

  /**
   * L16 pixel contrast (QA D-011, D-028): every small text run in view, its p95-luminance background sampled from a
   * screenshot with all text hidden, its colour (alpha and ancestor opacity) composited on that pixel; >= 4.5:1.
   * Text under the fixed nav, pill or corner button is hidden by opaque chrome, not low contrast, and is skipped.
   */
  async function lowContrast(page: Page, sid: string) {
    const tg = await page.evaluate((id) => {
      const chrome = [...document.querySelectorAll(".nav-bar.is-fixed, .menu-pill, .corner-btn, .nav-pill.is-fixed")].map((e) => e.getBoundingClientRect()).filter((r) => r.width);
      const els = new Set<Element>();
      const tw = document.createTreeWalker(document.getElementById(id)!, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.textContent?.trim()) els.add(n.parentElement!);
      for (const l of document.querySelectorAll(".seed-labels.is-on .seed-label")) els.add(l);
      return [...els].filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !e.closest(".sr-only, .nav-bar, .menu-pill, .menu-panel, button, select, input, [role=radio], details:not([open]) > :not(summary)") && (e as HTMLElement).style?.visibility !== "hidden").map((e) => {
        const cs = getComputedStyle(e), r = e.getBoundingClientRect();
        let op = 1; for (let n: Element | null = e; n && n !== document.documentElement; n = n.parentElement) op *= +getComputedStyle(n).opacity;
        return { t: (e.textContent ?? "").trim().slice(0, 30), color: e instanceof SVGElement ? cs.fill : cs.color, op, x: r.left, y: r.top, w: r.width, h: r.height, fs: parseFloat(cs.fontSize) };
      }).filter((b) => b.fs < 20 && b.w > 2 && b.y >= 0 && b.x >= 0 && b.y + b.h <= innerHeight && b.x + b.w <= innerWidth
        && !chrome.some((c) => b.x < c.right && b.x + b.w > c.left && b.y < c.bottom && b.y + b.h > c.top));
    }, sid);
    const h = await page.addStyleTag({ content: "*{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important} text,tspan{fill:transparent!important;stroke:transparent!important}" });
    await page.waitForTimeout(80);
    const png = (await page.screenshot()).toString("base64");
    await h.evaluate((el) => (el as Element).remove());
    return page.evaluate(async ([b64, boxes]) => {
      const im = new Image(); im.src = `data:image/png;base64,${b64}`; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d")!; x.drawImage(im, 0, 0);
      const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
      const L = (p: number[]) => 0.2126 * lin(p[0]!) + 0.7152 * lin(p[1]!) + 0.0722 * lin(p[2]!);
      const out: string[] = [];
      for (const b of boxes) {
        const m = (b.color.match(/[\d.]+/g) ?? []).map(Number); if (m.length < 3) continue;
        const a = (m.length > 3 ? m[3]! : 1) * b.op; if (a < 0.05) continue;
        const d = x.getImageData(Math.floor(b.x), Math.floor(b.y), Math.max(1, Math.floor(b.w)), Math.max(1, Math.floor(b.h))).data, px: number[][] = [];
        for (let k = 0; k < d.length; k += 8) px.push([d[k]!, d[k + 1]!, d[k + 2]!]);
        px.sort((p, q) => L(p) - L(q)); const bg = px[Math.floor(px.length * 0.95)]!;
        const fg = [0, 1, 2].map((k) => a * m[k]! + (1 - a) * bg[k]!);
        const lb = L(bg), lf = L(fg), ratio = (Math.max(lb, lf) + 0.05) / (Math.min(lb, lf) + 0.05);
        if (ratio < 4.5) out.push(`${ratio.toFixed(2)}:1 '${b.t}' fs ${b.fs} bg rgb(${bg.join(",")})`);
      }
      return out;
    }, [png, tg] as const);
  }
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]] as [number, number][]) for (const reduced of [false, true]) {
    test(`L16 pixel contrast ${w}${reduced ? " reduced" : ""}: every small text run in view is >= 4.5:1 on its sampled background`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, h, { reduced });
      const all: string[] = [];
      for (const [id, p] of [...SCENES, ["eight-billion", 0] as [string, number], ["sources", 0.314] as [string, number], ["evidence", 0.35] as [string, number], ["evidence", 0.95] as [string, number]]) {
        await go(page, id, p); await page.waitForTimeout(1300);
        all.push(...(await lowContrast(page, id)).map((c) => `${id}@${p}: ${c}`));
      }
      expect(all).toEqual([]);
      await ctx.close();
    });
  }
});
