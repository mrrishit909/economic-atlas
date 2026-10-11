// P05-QA-001 extra probes: basis-swap sampling (S05 + ATLAS), L4 for per-indicator seedheads + inspector + S02 cards,
// facts deep-link screenshot, L15 reduced figures, L14 fixture, L12 real-pointer sweep, S08 radius at p 0.75, criterion 7.
// Usage: node extra.mjs [base] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json");
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] ?? "http://localhost:4341/economic-atlas/";
const OUT = process.argv[3] ?? "extra";
mkdirSync(OUT, { recursive: true });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v).slice(0, 600)); };
const browser = await chromium.launch();
const open = async (w = 1440, h = 900, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768, deviceScaleFactor: 1, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  if (opts.route) await opts.route(page);
  await page.goto(`${BASE}?quality=high${opts.hash ?? ""}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__eca, null, { timeout: 30000 });
  if (!opts.noEsc) await page.keyboard.press("Escape");
  await page.waitForTimeout(3000);
  return { ctx, page };
};
// QA pass 2 copy (P05-QA-002): sheet toggles use real-pointer clicks. Previously: FIX-A copy: on phones the ATLAS controls live in a CONTROLS sheet (D-008), so the probe opens it before using a control
// and closes it after picking an indicator (as a reader would, to see the map). Otherwise identical to qa/probes/extra.mjs.
const sheetOn = async (page) => { const t = page.locator(".atlas-sheet-toggle"); if (await t.isVisible() && (await t.getAttribute("aria-expanded")) !== "true") { await realClick(page, t, page.viewportSize().width < 1024); await page.waitForTimeout(400); } };
const sheetOff = async (page) => { const c = page.locator(".rail__sheet-close"); if (await c.isVisible()) { await realClick(page, c, page.viewportSize().width < 1024); await page.waitForTimeout(400); } };
const jump = (page, s, p) => page.evaluate(([a, b]) => window.__eca.jumpTo(a, b), [s, p]);
const realClick = async (page, loc, touch) => {
  const b = await loc.boundingBox(); if (!b) return "no box";
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.className?.toString?.() || e.tagName).slice(0, 40) + "|" + (e.textContent || "").trim().slice(0, 20) : null; }, [x, y]);
  const own = await loc.evaluate((el, [x, y]) => { const e = document.elementFromPoint(x, y); return !!e && (el === e || el.contains(e)); }, [x, y]);
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  return own ? "ok" : `covered by ${hit}`;
};
const bases = (t) => { const u = t.toUpperCase(), o = new Set(); if (/\bPPP\b|INTL \$/.test(u)) o.add("ppp"); if (/CONSTANT 2015 US|GDPPC_CONST|CONSTANT US\$/.test(u)) o.add("const"); if (/CURRENT US/.test(u)) o.add("nominal"); return [...o]; };

// 1. S05 basis swap: sample plane text + .plane-read + chip every ~30ms
{
  const { ctx, page } = await open();
  await jump(page, "lab", 0.5); await page.waitForTimeout(2500);
  const frames = [];
  const rb = page.locator("#lab [role=radio]", { hasText: /^CONSTANT US\$$/ });
  await realClick(page, rb, false);
  const t0 = Date.now();
  while (Date.now() - t0 < 2200) {
    frames.push(await page.evaluate(() => ({ axis: [...document.querySelectorAll("#lab .plane text")].map((t) => t.textContent).join(" | "), read: document.querySelector("#lab .plane-read")?.innerText ?? "", pal: window.__eca.debug().palette })).then((f) => ({ t: Date.now() - t0, ...f })));
    await page.waitForTimeout(25);
  }
  const mixed = frames.filter((f) => { const a = bases(f.axis), r = bases(f.read); return a.length && r.length && a.join() !== r.join(); });
  log("s05_basis_swap", { samples: frames.length, mixedFrames: mixed.length, firstMixed: mixed[0] && { t: mixed[0].t, axis: bases(mixed[0].axis), read: bases(mixed[0].read), pal: mixed[0].pal, axisText: mixed[0].axis.slice(-80), readText: mixed[0].read.slice(0, 160) }, lastMixedT: mixed.at(-1)?.t });
  // criterion 7: PEOPLE-WEIGHTED shown with its set-aside counterpart?
  await realClick(page, page.locator("#lab [role=radio]", { hasText: /^PEOPLE-WEIGHTED$/ }), false); await page.waitForTimeout(2500);
  log("crit7_weighted_readout", await page.locator("#lab .plane-read").innerText());
  await ctx.close();
}
// 2. ATLAS cross-family indicator change: status + legend + narratives + paths
{
  const { ctx, page } = await open();
  await jump(page, "atlas", 0); await page.waitForTimeout(2500);
  await sheetOn(page); await page.locator("#atlas-country").fill("India"); await page.waitForTimeout(300); await sheetOn(page); await page.locator("#atlas-country").fill("Brazil"); await page.waitForTimeout(800);
  await sheetOn(page); await page.selectOption("#atlas-ind", "gdppc_const"); await sheetOff(page);
  const frames = []; const t0 = Date.now();
  while (Date.now() - t0 < 2500) { frames.push(await page.evaluate(() => ({ status: document.querySelector("#atlas .atlas__status")?.innerText ?? "", legend: document.querySelector("#atlas .legend")?.innerText ?? "", paths: document.querySelector("#atlas .paths")?.innerText ?? "", narr: document.querySelector("#atlas .narr")?.innerText ?? "", pal: window.__eca.debug().palette }))); await page.waitForTimeout(25); }
  const mixed = frames.filter((f) => new Set([...bases(f.status), ...bases(f.legend), ...bases(f.paths)]).size > 1);
  const narrMixed = frames.filter((f) => new Set([...bases(f.status), ...bases(f.narr)]).size > 1);
  log("atlas_swap", { samples: frames.length, mixedStatusLegendPaths: mixed.length, narrativeBasisDiffersFromStatus: narrMixed.length, sample: narrMixed[0] && { status: narrMixed[0].status.slice(0, 80), narr: narrMixed[0].narr.slice(0, 160) } });
  await sheetOn(page); await page.selectOption("#atlas-ind", "agr_share"); await sheetOff(page); await page.waitForTimeout(3500);
  log("atlas_agr_two_countries_narrative", (await page.locator("#atlas .narr").innerText()).slice(0, 300));
  await ctx.close();
}
// 3. L4: per-indicator seedheads (ATLAS) + inspector narratives/boundaries + S02 cards at their own position
const IND = ["agr_share", "gdp_growth", "gdppc_const", "gdppc_nominal", "hhi5", "ind_share", "inflation", "population", "productivity", "srv_share", "trade_open", "x_agri", "x_food", "x_fuel", "x_manf", "x_mmtl"];
const l4 = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const ind of IND) {
    let block = true, hits = 0;
    const { ctx, page } = await open(w, h, { route: (p) => p.route(new RegExp(`/data/seedhead/${ind}\\.json`), async (r) => { hits++; if (block) await r.fulfill({ status: 404, body: "x" }); else await r.continue(); }) });
    await jump(page, "atlas", 0); await page.waitForTimeout(1500);
    const opt = await page.locator(`#atlas-ind option[value="${ind}"]`).count();
    if (!opt) { l4.push({ vp: w, file: `seedhead/${ind}`, note: "not selectable in ATLAS" }); await ctx.close(); continue; }
    await sheetOn(page); await page.selectOption("#atlas-ind", ind); await sheetOff(page); await page.waitForTimeout(2500);
    const al = page.locator("#atlas [role=alert]", { hasText: ind.toUpperCase() }).first();
    const vis = await al.isVisible().catch(() => false);
    let res = "no alert";
    if (vis) { await al.scrollIntoViewIfNeeded(); block = false; const h0 = hits; res = await realClick(page, al.locator("button"), w < 1024); await page.waitForTimeout(2500); res += ` refetch ${hits - h0} recovered ${!(await page.locator("#atlas [role=alert]", { hasText: ind.toUpperCase() }).count())}`; }
    l4.push({ vp: w, file: `seedhead/${ind}`, alertVisible: vis, res });
    await ctx.close();
  }
  for (const f of ["narratives", "boundaries"]) {
    const { ctx, page } = await open(w, h, { route: (p) => p.route(new RegExp(`/data/${f}\\.json`), (r) => r.fulfill({ status: 404, body: "x" })) });
    await jump(page, "atlas", 0); await page.waitForTimeout(1500);
    await sheetOn(page); await page.locator("#atlas-country").fill("Germany"); await page.waitForTimeout(900);
    await page.locator("#atlas .chipsel__name").first().click(); await page.waitForTimeout(1500);
    const insp = page.locator(".inspector");
    const txt = await insp.innerText().catch(() => "");
    l4.push({ vp: w, file: f, consumer: "inspector", alertInInspector: /COULD NOT LOAD/.test(txt), text: txt.slice(0, 200) });
    await page.screenshot({ path: join(OUT, `l4-inspector-${f}-${w}.jpg`), type: "jpeg", quality: 70 });
    await ctx.close();
  }
  for (const [f, p] of [["panel_income", 0.314], ["coverage", 0.504], ["longrun", 0.694], ["reconciliation", 0.124]]) {
    let block = true, hits = 0;
    const { ctx, page } = await open(w, h, { route: (pg) => pg.route(new RegExp(`/data/${f}\\.json`), async (r) => { hits++; if (block) await r.fulfill({ status: 404, body: "x" }); else await r.continue(); }) });
    await jump(page, "sources", p); await page.waitForTimeout(2500); await jump(page, "sources", p); await page.waitForTimeout(1500);
    const al = page.locator("#sources [role=alert]", { hasText: f.toUpperCase() }).first();
    const box = await al.boundingBox().catch(() => null);
    const inView = !!box && box.y >= 0 && box.y + box.height <= h && box.x >= 0 && box.x + box.width <= w;
    let res = "not in view";
    if (inView) { block = false; const h0 = hits; res = await realClick(page, al.locator("button"), w < 1024); await page.waitForTimeout(2500); res += ` refetch ${hits - h0}`; }
    l4.push({ vp: w, file: f, consumer: `S02 card at p ${p}`, inView, res });
    await page.screenshot({ path: join(OUT, `l4-s02-${f}-${w}.jpg`), type: "jpeg", quality: 70 });
    await ctx.close();
  }
}
log("l4_extra", l4);
// 4. silent-failure screenshots: facts / indicators / countries / meta blocked, deep links
for (const [f, hash] of [["facts", "#weight"], ["facts", "#years"], ["facts", "#evidence"], ["indicators", "#weight"], ["countries", "#years"], ["meta", "#atlas"], ["seedhead/gdppc_ppp_latest", "#weight"], ["panel_income", "#weight"], ["facts", "#likeness"]]) {
  const { ctx, page } = await open(1440, 900, { hash, route: (p) => p.route(new RegExp(`/data/${f.replace("/", "\\/")}\\.json`), (r) => r.fulfill({ status: 404, body: "x" })) });
  await page.waitForTimeout(2500);
  const sid = hash.slice(1);
  const txt = await page.locator(`#${sid}`).innerText().catch(() => "");
  await page.screenshot({ path: join(OUT, `silent-${f.replace("/", "_")}-${sid}.jpg`), type: "jpeg", quality: 70 });
  log(`silent_${f}_${sid}`, { anyAlertOnScreen: await page.evaluate(() => [...document.querySelectorAll("[role=alert]")].filter((a) => { const b = a.getBoundingClientRect(); return b.width && b.top >= 0 && b.bottom <= innerHeight; }).map((a) => a.textContent.slice(0, 60))), sceneTextHead: txt.slice(0, 300) });
  await ctx.close();
}
// 5. L15 reduced motion: every canvas inside scenes has size and non-black pixels
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const { ctx, page } = await open(w, h, { reduced: true });
  const n = await page.locator("main canvas, .scene canvas, section canvas").count();
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = page.locator("main canvas, .scene canvas, section canvas").nth(i);
    await c.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(250);
    const b = await c.boundingBox();
    if (!b || b.width < 1 || b.height < 1) { out.push({ i, size: b ? `${b.width}x${b.height}` : "none", lit: 0 }); continue; }
    const buf = await page.screenshot({ clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, w), height: Math.min(b.height, h) } });
    out.push({ i, size: `${Math.round(b.width)}x${Math.round(b.height)}`, png: buf.length, label: await c.getAttribute("aria-label") });
    writeFileSync(join(OUT, `l15-${w}-${i}.png`), buf);
  }
  log(`l15_${w}`, out);
  await ctx.close();
}
// 6. L14 fixture: injected 2000px div must be caught by the scrollWidth-vs-configured-width check
{
  const { ctx, page } = await open(390, 844);
  const before = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "width:2000px;height:10px;position:relative"; document.body.appendChild(d); });
  const after = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  log("l14_fixture", { before, after, configured: 390, caughtVsConfigured: after.sw > 390, caughtVsInnerWidth: after.sw > after.iw });
  await ctx.close();
}
// 7. L12 real-pointer sweep (phones: touch taps; desktop: mouse)
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const touch = w < 1024; const sw = [];
  const { ctx, page } = await open(w, h, { noEsc: true });
  await page.waitForTimeout(300);
  const skip = page.locator(".corner-btn", { hasText: "SKIP INTRO" });
  if (await skip.isVisible().catch(() => false)) sw.push(["SKIP INTRO", await realClick(page, skip, touch), await page.evaluate(() => window.__eca.introStats().playing)]);
  await page.waitForTimeout(1500);
  if (touch) {
    const pill = page.locator(".menu-pill").first();
    sw.push(["MENU pill", await realClick(page, pill, touch), await pill.getAttribute("aria-expanded")]); await page.waitForTimeout(600);
    const item = page.locator("#menu-panel a", { hasText: /^LAB$/ });
    sw.push(["menu LAB", await realClick(page, item, touch)]); await page.waitForTimeout(1500);
    sw.push(["hash after menu", await page.evaluate(() => location.hash)]);
  } else {
    sw.push(["nav LAB", await realClick(page, page.locator(".nav-bar.is-fixed a", { hasText: /^LAB$/ }), touch)]); await page.waitForTimeout(1500);
    sw.push(["hash after nav", await page.evaluate(() => location.hash)]);
  }
  await jump(page, "lab", 0.5); await page.waitForTimeout(2000);
  const sheet = page.locator(".sheet-toggle");
  if (await sheet.isVisible().catch(() => false)) { sw.push(["S05 CONTROLS", await realClick(page, sheet, touch), await sheet.getAttribute("aria-expanded")]); await page.waitForTimeout(500); }
  for (const name of ["2000", "UPPER THIRD", "RESET"]) {
    const loc = name === "RESET" ? page.locator("#lab .weight-reset") : page.locator("#lab [role=radio]", { hasText: new RegExp(`^${name}$`) });
    sw.push([`S05 ${name}`, await realClick(page, loc, touch), name === "RESET" ? null : await loc.getAttribute("aria-checked")]); await page.waitForTimeout(1500);
  }
  await jump(page, "weight", 0.2); await page.waitForTimeout(1500);
  for (const name of ["COUNTRIES", "1990"]) { const loc = page.locator("#weight [role=radio]", { hasText: new RegExp(`^${name}$`) }); sw.push([`S03b ${name}`, await realClick(page, loc, touch), await loc.getAttribute("aria-checked")]); await page.waitForTimeout(1200); }
  const swt = page.locator("#weight [role=switch]"); sw.push(["S03b SET ASIDE", await realClick(page, swt, touch), await swt.getAttribute("aria-checked")]); await page.waitForTimeout(1200);
  sw.push(["S03b RESET", await realClick(page, page.locator("#weight .weight-reset"), touch)]); await page.waitForTimeout(1200);
  await jump(page, "likeness", 0.3); await page.waitForTimeout(1500);
  const ward = page.locator("#likeness [role=radio]", { hasText: /^WARD$/ }); sw.push(["S06 WARD", await realClick(page, ward, touch), await ward.getAttribute("aria-checked")]); await page.waitForTimeout(1200);
  await jump(page, "atlas", 0); await page.waitForTimeout(2500);
  await sheetOn(page); await page.locator("#atlas-country").fill("Japan"); await page.waitForTimeout(800);
  for (const name of ["INDEX = 100", "COUNTRIES"]) { const loc = page.locator("#atlas [role=radio]", { hasText: new RegExp(`^${name}`) }); await loc.scrollIntoViewIfNeeded(); sw.push([`ATLAS ${name}`, await realClick(page, loc, touch), await loc.getAttribute("aria-checked")]); await page.waitForTimeout(1500); }
  const chip = page.locator("#atlas .chipsel__name").first(); await chip.scrollIntoViewIfNeeded(); sw.push(["ATLAS chip -> inspector", await realClick(page, chip, touch), await page.locator(".inspector").isVisible()]); await page.waitForTimeout(1200);
  const close = page.locator(".inspector .btn-square", { hasText: "CLOSE" });
  await page.screenshot({ path: join(OUT, `l12-inspector-${w}.jpg`), type: "jpeg", quality: 70 });
  sw.push(["inspector CLOSE", await realClick(page, close, touch), await page.locator(".inspector").isVisible()]); await page.waitForTimeout(800);
  await jump(page, "resorted", 0.95); await page.waitForTimeout(3500);
  const link = page.locator(".s08-link").first(); sw.push(["S08 OPEN THE ATLAS", await realClick(page, link, touch)]); await page.waitForTimeout(1500);
  sw.push(["scene after S08 link", await page.evaluate(() => window.__eca.debug().scene)]);
  const motion = touch ? null : page.locator(".nav-bar.is-fixed .nav__util", { hasText: /MOTION/ });
  if (motion) { sw.push(["MOTION toggle", await realClick(page, motion, touch), await motion.getAttribute("aria-pressed")]); await realClick(page, motion, touch); }
  log(`l12_sweep_${w}`, sw);
  await ctx.close();
}
// 8. S08 radius at p 0.75 (test 15) and inspector persistence
for (const [w, h] of [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [375, 812], [360, 800]]) {
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => window.__eca.scrollToProgress("resorted", 0.75)); await page.waitForTimeout(2500);
  const d = await page.evaluate(() => window.__eca.debug());
  log(`s08_p075_${w}x${h}`, { R: Math.round(d.R), diamOverH: +(2 * d.R / h).toFixed(3), cx: Math.round(d.cx), cy: Math.round(d.cy) });
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, "extra.json"), JSON.stringify(R, null, 1));
