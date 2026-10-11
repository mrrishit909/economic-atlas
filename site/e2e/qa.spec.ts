/**
 * QA lessons L1-L9 (docs/QA_LESSONS.md, workspace root): defects independent QA found on P01-P03.
 * These tests make their own browsers and viewports, so they run once (desktop project).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

const SCENES: [string, number][] = [["eight-billion", 0.78], ["sources", 0.14], ["years", 0.7], ["weight", 0.43], ["catch-up", 0.95], ["lab", 0.4], ["likeness", 0.2], ["evidence", 0.05], ["atlas", 0], ["resorted", 0.9]];
const SCROLLBAR_CSS = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: #555; }";
const BASE = "http://localhost:4341/economic-atlas/";
type W = { __eca: { jumpTo: (i: string, p?: number) => void; debug: () => { introDone: boolean; cls: string } } };

async function openAt(browser: Browser, w: number, h: number, opts: { classic?: boolean; reduced?: boolean } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reduced ? "reduce" : "no-preference", hasTouch: w < 1024 });
  if (opts.classic) await ctx.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }), SCROLLBAR_CSS);
  const page = await ctx.newPage();
  await page.goto(`${BASE}?quality=high`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => (window as unknown as W).__eca?.debug().introDone, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const go = (page: Page, id: string, p: number) => page.evaluate(([i, q]) => (window as unknown as W).__eca.jumpTo(i as string, q as number), [id, p] as const);

/** Visible leaf text/control boxes of a scene (plus the fixed nav and corner button), in the viewport. */
async function boxes(page: Page, id: string) {
  return page.evaluate((sid) => {
    const SEL = "p, h1, h2, h3, button, select, input, figcaption, li, a, .chip, .legend__strip, svg text";
    const root = document.getElementById(sid)!;
    const chrome = sid === "atlas" ? [] : [...document.querySelectorAll<HTMLElement>(".nav-bar.is-fixed, .menu-pill, .corner-btn")]; // ATLAS is normal flow: content scrolls under the fixed nav
    const cand = [...root.querySelectorAll<HTMLElement>(SEL), ...chrome]
      .filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !e.closest(".sr-only, [aria-hidden=true] .seed-label, details:not([open]) > :not(summary)"))
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; });
    const leaves = cand.filter((e) => !cand.some((o) => o !== e && e.contains(o)));
    return leaves.map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent ?? e.tagName).trim().slice(0, 40), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, fs: parseFloat(getComputedStyle(e).fontSize), tag: e.tagName }; });
  }, id);
}
function collisions(b: Awaited<ReturnType<typeof boxes>>) {
  const out: string[] = [];
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const a = b[i]!, c = b[j]!, w = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), h = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
    if (w > 2 && h > 2) out.push(`"${a.t}" x "${c.t}" (${w.toFixed(0)}x${h.toFixed(0)})`);
  }
  return out;
}

test.describe("QA lessons", () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "own viewports"));

  for (const [w, h] of [[1024, 768], [768, 1024]] as const) for (const classic of [false, true]) {
    test(`L1/L2: ${w}x${h}${classic ? " classic scrollbars" : ""}: JS class = CSS class, no text collides in any scene`, async ({ browser, playwright }) => {
      // headless Chromium hides scrollbars; this browser keeps them, so the page gets a 15px gutter (P01 D-033)
      const b = classic ? await playwright.chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] }) : browser;
      const { ctx, page } = await openAt(b, w, h, { classic });
      const m = await page.evaluate(() => ({ js: (window as unknown as W).__eca.debug().cls, css: matchMedia("(max-width: 767px)").matches ? "M" : matchMedia("(max-width: 1023px)").matches ? "T" : "D", cw: document.documentElement.clientWidth }));
      if (classic) expect(m.cw, "a classic scrollbar takes layout width").toBeLessThan(w);
      expect(m.js).toBe(m.css);
      const all: string[] = [];
      for (const [id, p] of SCENES) { await go(page, id, p); await page.waitForTimeout(900); all.push(...collisions(await boxes(page, id)).map((c) => `${id}: ${c}`)); }
      await ctx.close();
      if (classic) await b.close();
      expect(all).toEqual([]);
    });
  }

  test("L2: 390x844 phone: no text collides in any scene", async ({ browser }) => {
    const { ctx, page } = await openAt(browser, 390, 844);
    const all: string[] = [];
    for (const [id, p] of SCENES) { await go(page, id, p); await page.waitForTimeout(900); all.push(...collisions(await boxes(page, id)).map((c) => `${id}: ${c}`)); }
    expect(all).toEqual([]);
    await ctx.close();
  });

  test("L2: 1280x720 compact desktop: no text collides in any scene", async ({ browser }) => {
    const { ctx, page } = await openAt(browser, 1280, 720);
    const all: string[] = [];
    for (const [id, p] of SCENES) { await go(page, id, p); await page.waitForTimeout(900); all.push(...collisions(await boxes(page, id)).map((c) => `${id}: ${c}`)); }
    expect(all).toEqual([]);
    await ctx.close();
  });

  for (const w of [360, 375, 390, 768]) {
    test(`L3/L5/L7/L8/L9 at ${w}px: tags visible, no sideways scroll, 11px floor, corner clear of pill, controls hit-testable`, async ({ browser }) => {
      const h = w === 768 ? 1024 : 800;
      const { ctx, page } = await openAt(browser, w, h);
      const bad: string[] = [];
      for (const [id, p] of SCENES) {
        for (const q of [Math.max(0, p - 0.2), p, Math.min(1, p + 0.05)]) {
          await go(page, id, q); await page.waitForTimeout(700);
          const r = await page.evaluate((sid) => {
            const root = document.getElementById(sid)!;
            const vis = (e: Element) => (e as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }) && (() => { const b = e.getBoundingClientRect(); return b.width > 0 && b.bottom > 0 && b.top < innerHeight; })();
            const small = [...root.querySelectorAll("p, span, h2, h3, button, a, li, figcaption, label, text, td, th, summary")].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11)
              .map((e) => `${e.tagName}:${e.textContent!.trim().slice(0, 30)} ${getComputedStyle(e).fontSize}`);
            const tags = [...root.querySelectorAll(".chip")].filter(vis).length;
            const ctrls = [...root.querySelectorAll<HTMLElement>("button, select, input")].filter(vis).filter((c) => { const b = c.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false; const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return hit && !c.contains(hit) && !hit.contains(c) && !(sid === "atlas" && hit.closest(".nav-pill, .nav-bar, .corner-btn")); })
              .map((c) => `${c.textContent?.trim().slice(0, 20) || c.id} under ${document.elementFromPoint(c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2, c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2)?.className}`);
            return { small, tags, ctrls, sw: document.documentElement.scrollWidth, iw: innerWidth };
          }, id);
          if (r.sw > r.iw) bad.push(`${id}@${q}: L5 scrollWidth ${r.sw} > ${r.iw}`);
          if (r.small.length) bad.push(`${id}@${q}: L7 ${r.small.slice(0, 3).join(" | ")}`);
          if (q === p && id !== "evidence" && r.tags === 0) bad.push(`${id}: L3 no visible honesty tag`);
          if (r.ctrls.length) bad.push(`${id}@${q}: L9 ${r.ctrls.slice(0, 3).join(" | ")}`);
        }
      }
      // L8: the corner button clears the pill by 8px
      const gap = await page.evaluate(() => { const a = document.querySelector(".corner-btn")!.getBoundingClientRect(), b = document.querySelector(".nav-pill.is-fixed")!.getBoundingClientRect(); return Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom); });
      if (gap < 8) bad.push(`L8 corner button to pill ${gap.toFixed(1)}px`);
      expect(bad).toEqual([]);
      await ctx.close();
    });
  }

  for (const w of [360, 390, 768]) {
    test(`L5 reduced motion at ${w}px: no sideways scroll anywhere on the page`, async ({ browser }) => {
      const { ctx, page } = await openAt(browser, w, w === 768 ? 1024 : 800, { reduced: true });
      for (const [id] of SCENES) {
        await page.evaluate((i) => document.getElementById(i)!.scrollIntoView(), id);
        await page.waitForTimeout(150);
        const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
        expect(r.sw, id).toBeLessThanOrEqual(r.iw);
      }
      await ctx.close();
    });
  }
});
