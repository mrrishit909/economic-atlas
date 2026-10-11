#!/usr/bin/env node
/**
 * Stage A evidence (P05-FE-001): real screenshots of the PRODUCTION build (dist/, served in-process by
 * vite preview on 4343), never the dev server. S00 at 4 frozen intro times + the end, S03a at 3 years
 * (one with FOLLOW), S03b at 3 states (+ COUNTRIES 1990), error + RETRY, the no-WebGL tier and reduced
 * motion, at 1440x900, 768x1024 and 390x844. Frame pacing of the live S00 sort is measured on this machine.
 * Usage: npm run build && node tests/stage-a-capture.mjs ; python3 tests/contact-sheet.py ../artifacts/evidence/stage-a
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", "stage-a");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const BASE = "http://localhost:4343/economic-atlas/";
const VIEWPORTS = [[1440, 900], [768, 1024], [390, 844]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
  .filter((v) => !only || only.includes(v.label));
const NY = 36, yearP = (k) => 0.06 + (0.88 * (k + 0.5)) / NY;

const hook = (page, f, a) => page.evaluate(([fn, arg]) => window.__eca[fn](...(arg ?? [])), [f, a]);

async function run() {
  const server = await preview({ root: join(HERE, ".."), preview: { port: 4343, strictPort: true } });
  const browser = await chromium.launch();
  const log = [];
  for (const vp of VIEWPORTS) {
    const dir = join(OUT, vp.label);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const external = [];
    page.on("request", (r) => { if (!/^http:\/\/(localhost|127\.0\.0\.1):43\d\d\//.test(r.url()) && !r.url().startsWith("data:")) external.push(r.url()); });
    page.on("pageerror", (e) => log.push(`${vp.label} pageerror ${e.message}`));
    const shot = async (name, p = page) => { await p.screenshot({ path: join(dir, `${name}.png`) }); log.push(`${vp.label}/${name}.png`); };

    // S00: frozen intro clock (the same clock the grains and the DOM read)
    await page.goto(`${BASE}?quality=high`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.__eca?.debug().glFrames > 2, null, { timeout: 20000 });
    for (const t of [600, 1300, 2500, 3600]) {
      await hook(page, "freeze", [t]);
      await page.waitForTimeout(500);
      await shot(`01-s00-t${String(t).padStart(4, "0")}`);
    }
    await hook(page, "freeze", [-1]);
    // frame pacing: rAF deltas while the intro plays out from the frozen point (stated device: this Mac, headless Chromium)
    const pacing = await page.evaluate(() => new Promise((ok) => { const d = []; let last = 0; const f = (t) => { if (last) d.push(t - last); last = t; if (d.length < 90) requestAnimationFrame(f); else ok(d); }; requestAnimationFrame(f); }));
    const s = [...pacing].sort((a, b) => a - b);
    log.push(`${vp.label} S00 frame pacing (90 frames, headless Chromium, ${process.platform}) p50 ${s[45].toFixed(1)}ms p95 ${s[85].toFixed(1)}ms`);
    await page.waitForFunction(() => !window.__eca.introStats().playing && window.__eca.debug().introDone, null, { timeout: 20000 });
    await page.waitForTimeout(700);
    await shot("01-s00-t4600-end");
    const st = await hook(page, "introStats");
    const d0 = await hook(page, "debug");
    log.push(`${vp.label} S00 radius min ${st.minR.toFixed(1)} (end ${d0.R.toFixed(1)}, c ${d0.cx.toFixed(0)},${d0.cy.toFixed(0)}) monotonic ${st.monotonic}`);

    await hook(page, "jumpTo", ["eight-billion", 0.6]); await page.waitForTimeout(700); await shot("02-s01-p60");

    // S03a: three integer years; FOLLOW on the last
    for (const [k, follow] of [[0, null], [18, null], [NY - 1, "India"]]) {
      await hook(page, "jumpTo", ["years", yearP(k)]);
      await page.waitForFunction((y) => document.querySelector("[data-year]")?.textContent === String(y), 1990 + k, { timeout: 20000 });
      if (follow) await page.fill("#follow-input", follow);
      await page.waitForTimeout(900);
      await shot(`03-s03a-${1990 + k}${follow ? "-follow-ind" : ""}`);
    }
    await page.fill("#follow-input", "");

    // S03b: PEOPLE latest, COUNTRIES latest, COUNTRIES 1990, PEOPLE latest with China + India set aside
    for (const [p, name] of [[0.2, "people-2025"], [0.43, "countries-2025"], [0.6, "countries-1990"], [0.93, "people-2025-setaside"]]) {
      await hook(page, "jumpTo", ["weight", p]);
      await page.waitForTimeout(1900);
      await shot(`04-s03b-${name}`);
      const d = await hook(page, "debug");
      log.push(`${vp.label} S03b p ${p}: mode ${d.mode} year ${d.year} seeds ${d.n} R ${d.R.toFixed(1)}`);
    }
    if (vp.width < 1024) {
      await page.locator(".nav-pill.is-fixed .menu-pill").click(); await page.waitForTimeout(450); await shot("05-menu-open");
      await page.keyboard.press("Escape");
    }

    // error + RETRY: a real 404 for the 36-year layouts, then the same fetch succeeds
    const err = await ctx.newPage();
    let block = true;
    await err.route("**/seedhead/gdppc_ppp.json", (r) => (block ? r.fulfill({ status: 404, body: "" }) : r.continue()));
    await err.goto(`${BASE}?quality=high`); await err.keyboard.press("Escape");
    await err.waitForTimeout(600);
    await err.evaluate(() => window.__eca.jumpTo("years", 0.5));
    await err.waitForSelector(".years-readout [role=alert]", { timeout: 20000 });
    await err.waitForTimeout(400);
    await shot("06-state-error", err);
    block = false;
    await err.locator(".years-readout [role=alert] button").click();
    await err.waitForSelector("[data-year]", { timeout: 20000 });
    await err.waitForTimeout(900);
    await shot("06-state-after-retry", err);
    await err.close();

    // no-WebGL tier (Canvas2D sprite fallback)
    const ng = await ctx.newPage();
    await ng.goto(`${BASE}?quality=nogl`); await ng.evaluate(() => document.fonts.ready);
    await ng.keyboard.press("Escape"); await ng.waitForTimeout(1500);
    await shot("07-nogl-s00", ng);
    await ng.evaluate(() => window.__eca.jumpTo("weight", 0.43)); await ng.waitForTimeout(2000);
    await shot("07-nogl-s03b", ng);
    await ng.close();
    log.push(`${vp.label} external requests: ${external.length ? external.join(", ") : "none"}`);
    await ctx.close();

    // reduced motion: static frames in normal flow
    const rctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const rp = await rctx.newPage();
    await rp.goto(BASE, { waitUntil: "networkidle" }); await rp.evaluate(() => document.fonts.ready);
    await rp.waitForTimeout(1200);
    await shot("08-reduced-s00", rp);
    for (const [sel, name] of [[".scene-years .static-row", "08-reduced-s03a"], [".scene-weight .static-row", "08-reduced-s03b"]]) {
      await rp.waitForSelector(`${sel} canvas`, { timeout: 20000 });
      await rp.evaluate((q) => document.querySelector(q).scrollIntoView({ block: "start" }), sel);
      await rp.waitForTimeout(800);
      await shot(name, rp);
    }
    await rctx.close();
  }
  await browser.close();
  await server.close();
  writeFileSync(join(OUT, "capture-log.txt"), log.join("\n") + "\n");
  console.log(log.filter((l) => !l.endsWith(".png")).join("\n"));
}
run().catch((e) => { console.error(e); process.exit(1); });
