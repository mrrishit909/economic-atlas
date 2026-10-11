#!/usr/bin/env node
/**
 * Stage B evidence (P05-FE-003): production build (dist/, vite preview in-process on 4344). Every new
 * scene at 2-4 states at 1440x900, 768x1024 and 390x844, reduced motion, and the classic-scrollbar
 * check at 1024x768 / 768x1024 (ED #39). Usage: npm run build && node tests/stage-b-capture.mjs [--only WxH]
 * then python3 tests/contact-sheet.py ../artifacts/evidence/stage-b
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", "stage-b");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const BASE = "http://localhost:4344/economic-atlas/";
const VIEWPORTS = [[1440, 900], [768, 1024], [390, 844]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
  .filter((v) => !only || only.includes(v.label));
const SCROLLBAR_CSS = "html { overflow-y: scroll; } ::-webkit-scrollbar { width: 15px; } ::-webkit-scrollbar-thumb { background: #555; }";

const jump = (page, id, p) => page.evaluate(([i, q]) => window.__eca.jumpTo(i, q), [id, p]);
async function run() {
  const server = await preview({ root: join(HERE, ".."), preview: { port: 4344, strictPort: true } });
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
    const at = async (name, id, p, wait = 1800) => { await jump(page, id, p); await page.waitForTimeout(wait); await shot(name); };

    await page.goto(`${BASE}?quality=high`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.__eca?.debug().glFrames > 2, null, { timeout: 20000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__eca.debug().introDone, null, { timeout: 20000 });
    await page.waitForTimeout(2500); // idle wave of artifacts
    await at("10-s01-p50", "eight-billion", 0.5);
    await at("11-s01-p85-cards", "eight-billion", 0.85, 2400);
    for (const [i, p] of [[1, 0.124], [2, 0.314], [3, 0.504], [4, 0.694]]) await at(`12-s02-card${i}`, "sources", p, 1400);
    await at("20-s04-disc", "catch-up", 0.04);
    await at("21-s04-flight-mid", "catch-up", 0.24, 1200);
    await at("22-s04-plane-1990", "catch-up", 0.6, 2200);
    await at("23-s04-2010-verdict", "catch-up", 0.95, 2400);
    log.push(`${vp.label} S04 debug ${JSON.stringify(await page.evaluate(() => window.__eca.debug()))}`);
    await at("30-s05-tour-tercile", "lab", 0.12, 2200);
    await at("31-s05-tour-weighted-ex", "lab", 0.27, 2200);
    await jump(page, "lab", 0.5); await page.waitForTimeout(1500);
    await page.getByRole("radio", { name: "CONSTANT US$" }).click(); await page.waitForTimeout(3000);
    await shot("32-s05-const-1960");
    await page.getByRole("radio", { name: "PEOPLE-WEIGHTED", exact: true }).click(); await page.waitForTimeout(2200);
    await shot("33-s05-const-weighted");
    await page.getByRole("button", { name: "RESET" }).first().click(); await page.waitForTimeout(3000);
    await at("40-s06-kmeans", "likeness", 0.2, 2400);
    await at("41-s06-ward", "likeness", 0.4, 1800);
    await at("42-s06-rel-income-prod", "likeness", 0.62, 2400);
    await at("43-s06-rel-agr-ind", "likeness", 0.86, 2400);
    await at("50-s07-ex2", "evidence", 0.2, 1200);
    await at("51-s07-all", "evidence", 0.95, 1500);
    await at("60-atlas-default", "atlas", 0, 2500);
    const add = async (n) => { await page.fill("#atlas-country", n); await page.waitForTimeout(250); };
    await add("India"); await add("China");
    await page.selectOption("#atlas-ind", "agr_share"); await page.waitForTimeout(4000);
    await jump(page, "atlas", 0); await page.waitForTimeout(600);
    await shot("61-atlas-agr-two");
    await page.selectOption("#atlas-ind", "gdppc_ppp"); await page.waitForTimeout(3500);
    await page.getByRole("radio", { name: /INDEX = 100/ }).click(); await page.waitForTimeout(800);
    await shot("62-atlas-ppp-index");
    await page.locator(".chipsel__name").first().click(); await page.waitForTimeout(900);
    await shot("63-inspector");
    await page.keyboard.press("Escape");
    await at("70-s08-return", "resorted", 0.3, 1500);
    await at("71-s08-paragraph", "resorted", 0.6, 1200);
    await page.evaluate(() => window.__eca.scrollToProgress("resorted", 0.75)); await page.waitForTimeout(1500);
    await shot("72a-s08-echo-dissolve");
    await page.evaluate(() => window.__eca.scrollToProgress("resorted", 0.9)); await page.waitForTimeout(4500);
    await shot("72-s08-echo-end");
    log.push(`${vp.label} S08 debug ${JSON.stringify(await page.evaluate(() => window.__eca.debug()))}`);
    log.push(`${vp.label} external requests: ${external.length ? external.join(", ") : "none"}`);
    await ctx.close();

    const rctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const rp = await rctx.newPage();
    await rp.goto(BASE, { waitUntil: "networkidle" }); await rp.waitForTimeout(1500);
    for (const [sel, name] of [[".scene-catchup", "80-reduced-s04"], [".scene-likeness", "81-reduced-s06"], [".scene-evidence", "82-reduced-s07"], [".scene-atlas", "83-reduced-atlas"]]) {
      await rp.evaluate((q) => document.querySelector(q).scrollIntoView({ block: "start" }), sel);
      await rp.waitForTimeout(900);
      await shot(name, rp);
    }
    await rctx.close();
  }
  // classic scrollbars (ED #39): JS and CSS agree on the composition
  if (!only) {
    const classic = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
    for (const [w, h] of [[1024, 768], [768, 1024]]) {
      const ctx = await classic.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await ctx.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }), SCROLLBAR_CSS);
      const p = await ctx.newPage();
      await p.goto(`${BASE}?quality=high`); await p.keyboard.press("Escape");
      await p.waitForFunction(() => window.__eca?.debug().introDone, null, { timeout: 20000 }); await p.waitForTimeout(800);
      mkdirSync(join(OUT, "classic"), { recursive: true });
      await p.screenshot({ path: join(OUT, "classic", `s00-${w}x${h}.png`) });
      log.push(`classic ${w}x${h}: ${JSON.stringify(await p.evaluate(() => ({ cw: document.documentElement.clientWidth, iw: innerWidth, R: window.__eca.debug().R, cx: window.__eca.debug().cx, h1: getComputedStyle(document.querySelector("h1")).fontSize })))}`);
      await ctx.close();
    }
    await classic.close();
  }
  await browser.close();
  await server.close();
  writeFileSync(join(OUT, "capture-log.txt"), log.join("\n") + "\n");
  console.log(log.filter((l) => !l.endsWith(".png")).join("\n"));
}
run().catch((e) => { console.error(e); process.exit(1); });
