// P05-QA-002 pass-2 probes: D-006 literal check, L18 per-frame unit sampler (S05 basis swaps both ways, all windows;
// ATLAS cross-family indicator changes), L17 (inspector and sheets closed after a scene change, destination controls
// real-pointer clickable), D-009 (narratives and units follow the indicator), D-010 (EVIDENCE landing shows a card).
// Usage: node pass2.mjs [base] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json");
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] ?? "http://localhost:4341/economic-atlas/";
const OUT = process.argv[3] ?? "pass2";
mkdirSync(OUT, { recursive: true });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v).slice(0, 700)); };
const browser = await chromium.launch();
const open = async (w = 1440, h = 900) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?quality=high`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__eca, null, { timeout: 30000 });
  await page.keyboard.press("Escape"); await page.waitForTimeout(3000);
  return { ctx, page };
};
const jump = (page, s, p) => page.evaluate(([a, b]) => window.__eca.jumpTo(a, b), [s, p]);
const realClick = async (page, loc) => {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox(); if (!b) return "no box";
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const own = await loc.evaluate((el, [x, y]) => { const e = document.elementFromPoint(x, y); return !!e && (el === e || el.contains(e)); }, [x, y]);
  const hit = own ? "" : await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.className?.toString?.() || e.tagName).slice(0, 40) : "null"; }, [x, y]);
  if ((page.viewportSize().width) < 1024) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  return own ? "ok" : `covered by ${hit}`;
};
const bases = (t) => { const u = t.toUpperCase(), o = new Set(); if (/\bPPP\b|INTL \$|GDPPC_PPP/.test(u)) o.add("ppp"); if (/CONSTANT 2015 US|GDPPC_CONST|CONSTANT US\$/.test(u)) o.add("const"); if (/CURRENT US|GDPPC_NOMINAL/.test(u)) o.add("nominal"); return [...o]; };
// in-page rAF sampler: every frame, the text of each unit-bearing selector
const startSampler = (page, sels) => page.evaluate((s) => { window.__smp = []; window.__on = true; const t0 = performance.now(); const f = () => { window.__smp.push({ t: Math.round(performance.now() - t0), pal: window.__eca.debug().palette, v: s.map((q) => [...document.querySelectorAll(q)].filter((e) => e.checkVisibility({ opacityProperty: true })).map((e) => e.textContent).join(" | ")) }); if (window.__on) requestAnimationFrame(f); }; requestAnimationFrame(f); }, sels);
const stopSampler = (page) => page.evaluate(() => { window.__on = false; return window.__smp; });
const PAL = { ppp_constant_intl_2021: "ppp", constant_usd_2015: "const", current_usd: "nominal" };
const judge = (frames, labels) => {
  const bad = [];
  for (const f of frames) {
    const per = f.v.map(bases); const all = new Set(per.flat());
    if (PAL[f.pal]) all.add(PAL[f.pal]);
    if (all.size > 1) bad.push({ t: f.t, pal: f.pal, per: Object.fromEntries(labels.map((l, i) => [l, per[i]])) });
  }
  return { frames: frames.length, mixed: bad.length, first: bad[0] ?? null };
};

for (const [w, h] of [[1440, 900], [390, 844]]) {
  // ---- S05: L18 + D-006
  {
    const { ctx, page } = await open(w, h);
    await jump(page, "lab", 0.5); await page.waitForTimeout(2500);
    const sheet = page.locator(".sheet-toggle");
    const openSheet = async () => { if (await sheet.isVisible().catch(() => false) && (await sheet.getAttribute("aria-expanded")) !== "true") { await realClick(page, sheet); await page.waitForTimeout(400); } };
    const closeSheet = async () => { if (await sheet.isVisible().catch(() => false) && (await sheet.getAttribute("aria-expanded")) === "true") { await realClick(page, sheet); await page.waitForTimeout(400); } };
    const radio = (n) => page.locator("#lab [role=radio]", { hasText: new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first();
    const SEL = ["#lab .plane text", "#lab .plane-read", "#lab .chip", "#lab .plane-unit, #lab .axis-unit"];
    const swaps = [];
    for (const [to, win] of [["CONSTANT US$", "1980"], ["PPP", "2000"], ["CONSTANT US$", "2000"], ["PPP", "1990"]]) {
      await openSheet();
      await startSampler(page, SEL);
      const r = await realClick(page, radio(to));
      await page.waitForTimeout(2200);
      const j = judge(await stopSampler(page), ["axis", "readout", "chip", "unit"]);
      swaps.push({ to, click: r, ...j });
      await realClick(page, radio(win)); await page.waitForTimeout(1500);
    }
    log(`L18_s05_${w}`, swaps);
    // D-006 literal: every people-weighted record shown also shows its ex-CHN+IND counterpart in the same readout
    const d6 = [];
    for (const basis of ["PPP", "CONSTANT US$"]) {
      await openSheet(); await realClick(page, radio(basis)); await page.waitForTimeout(2200);
      const wins = basis === "PPP" ? ["1990", "2000", "2010"] : ["1960", "1980", "2000"];
      for (const win of wins) {
        await openSheet(); await realClick(page, radio(win)); await page.waitForTimeout(1200);
        for (const s of ["PEOPLE-WEIGHTED", "PEOPLE-WEIGHTED WITHOUT CHINA + INDIA"]) {
          await openSheet(); const c = await realClick(page, radio(s)); await page.waitForTimeout(1800); await closeSheet();
          const t = await page.locator("#lab .plane-read").innerText();
          const slopes = (t.match(/-?\d+\.\d\d\b/g) ?? []).length;
          d6.push({ basis, win, sample: s, click: c, hasBoth: /SET ASIDE|WITHOUT CHINA|EX[ -]CHN|ALL PEOPLE|WITH CHINA/i.test(t) && /CHINA|CHN/i.test(t), text: t.replace(/\n+/g, " / ").slice(0, 260), nNumbers: slopes });
        }
      }
    }
    log(`D006_${w}`, d6);
    await page.screenshot({ path: join(OUT, `d006-${w}.jpg`), type: "jpeg", quality: 60 });
    await ctx.close();
  }
  // ---- ATLAS: L18 across families + D-009
  {
    const { ctx, page } = await open(w, h);
    await jump(page, "atlas", 0); await page.waitForTimeout(2500);
    const tog = page.locator(".atlas-sheet-toggle");
    const on = async () => { if (await tog.isVisible().catch(() => false) && (await tog.getAttribute("aria-expanded")) !== "true") { await realClick(page, tog); await page.waitForTimeout(400); } };
    const off = async () => { const c = page.locator(".rail__sheet-close"); if (await c.isVisible().catch(() => false)) { await realClick(page, c); await page.waitForTimeout(400); } };
    await on(); await page.locator("#atlas-country").fill("India"); await page.waitForTimeout(400); await on(); await page.locator("#atlas-country").fill("Brazil"); await page.waitForTimeout(800);
    const SEL = ["#atlas .atlas__status", "#atlas .legend", "#atlas .paths", "#atlas .narr", ".inspector"];
    const sw = [];
    for (const ind of ["gdppc_const", "gdppc_nominal", "agr_share", "gdppc_ppp", "productivity", "gdppc_const"]) {
      await on(); await startSampler(page, SEL);
      await page.selectOption("#atlas-ind", ind); await off();
      await page.waitForTimeout(2600);
      const j = judge(await stopSampler(page), ["status", "legend", "paths", "narr", "inspector"]);
      const narr = await page.locator("#atlas .narr").innerText().catch(() => "");
      sw.push({ ind, ...j, narr: narr.replace(/\n+/g, " / ").slice(0, 200) });
    }
    log(`L18_atlas_${w}`, sw);
    // D-009 (c): INDEX status vs legend
    await on(); await page.selectOption("#atlas-ind", "gdppc_ppp"); await page.waitForTimeout(2500);
    const idx = page.locator("#atlas [role=radio]", { hasText: /^INDEX/ }); const c = await realClick(page, idx); await page.waitForTimeout(1500); await off();
    const st = await page.locator("#atlas .atlas__status").innerText(), lg = await page.locator("#atlas .legend").innerText(), pa = await page.locator("#atlas .paths").innerText().catch(() => "");
    log(`D009c_${w}`, { click: c, status: st.slice(0, 120), legend: lg.replace(/\n/g, " ").slice(0, 120), paths: pa.replace(/\n/g, " ").slice(0, 120) });
    await page.screenshot({ path: join(OUT, `d009-index-${w}.jpg`), type: "jpeg", quality: 60 });
    // ---- L17: inspector opened in ATLAS, then every other scene
    await on(); const chip = page.locator("#atlas .chipsel__name").first(); const cc = await realClick(page, chip); await page.waitForTimeout(1200);
    const opened = await page.locator(".inspector").isVisible();
    const closeBtn = page.locator(".inspector .btn-square", { hasText: "CLOSE" });
    const closeInView = await closeBtn.evaluate((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).catch(() => null);
    const l17 = { chipClick: cc, opened, closeInView, scenes: [] };
    for (const [s, p] of [["eight-billion", 0.78], ["sources", 0.14], ["years", 0.7], ["weight", 0.43], ["catch-up", 0.95], ["lab", 0.45], ["likeness", 0.2], ["evidence", 0.05], ["resorted", 0.95]]) {
      await jump(page, s, p); await page.waitForTimeout(1500);
      l17.scenes.push([s, await page.locator(".inspector").isVisible()]);
    }
    await page.waitForTimeout(2500);
    const link = page.locator(".s08-link").first(); l17.s08Link = await realClick(page, link); await page.waitForTimeout(1500);
    l17.afterLinkScene = await page.evaluate(() => window.__eca.debug().scene);
    // sheets: open the ATLAS sheet (phones) and the S05 sheet, jump away, assert closed
    if (w < 1024) {
      await jump(page, "atlas", 0); await page.waitForTimeout(1500); await on();
      const atlasSheetOpen = (await tog.getAttribute("aria-expanded").catch(() => null)) === "true";
      await jump(page, "likeness", 0.2); await page.waitForTimeout(1200);
      l17.atlasSheetAfterJump = { wasOpen: atlasSheetOpen, stillOpen: await page.locator("#atlas-controls.is-open").isVisible().catch(() => false), toggleExpanded: await tog.getAttribute("aria-expanded").catch(() => null) };
      await jump(page, "lab", 0.5); await page.waitForTimeout(1500); const st5 = page.locator(".sheet-toggle"); await realClick(page, st5); await page.waitForTimeout(400);
      await jump(page, "evidence", 0.5); await page.waitForTimeout(1200);
      l17.labSheetAfterJump = { expanded: await st5.getAttribute("aria-expanded"), visibleControls: await page.locator("#lab-controls.is-open").isVisible().catch(() => false) };
    }
    log(`L17_${w}`, l17);
    await ctx.close();
  }
  // ---- D-009 (a/b): narratives per indicator with 1 and 2 countries
  {
    const { ctx, page } = await open(w, h);
    await jump(page, "atlas", 0); await page.waitForTimeout(2500);
    const tog = page.locator(".atlas-sheet-toggle");
    const on = async () => { if (await tog.isVisible().catch(() => false) && (await tog.getAttribute("aria-expanded")) !== "true") { await realClick(page, tog); await page.waitForTimeout(400); } };
    await on(); await page.locator("#atlas-country").fill("India"); await page.waitForTimeout(600);
    const out = [];
    for (const n of [1, 2]) {
      if (n === 2) { await on(); await page.locator("#atlas-country").fill("Brazil"); await page.waitForTimeout(800); }
      for (const ind of ["gdppc_ppp", "gdppc_const", "gdppc_nominal", "agr_share", "inflation", "trade_open", "hhi5"]) {
        await on(); await page.selectOption("#atlas-ind", ind); await page.waitForTimeout(2200);
        const st = await page.locator("#atlas .atlas__status").innerText();
        const nr = (await page.locator("#atlas .narr").innerText().catch(() => "")).replace(/\n+/g, " / ");
        const mismatch = bases(nr).some((b) => !bases(st).includes(b)) && bases(st).length > 0 || (bases(st).length === 0 && bases(nr).length > 0);
        out.push({ n, ind, mismatch, narr: nr.slice(0, 160) });
      }
    }
    log(`D009ab_${w}`, out);
    await ctx.close();
  }
  // ---- D-010
  {
    const { ctx, page } = await open(w, h);
    const navItem = w < 1024 ? null : page.locator(".nav-bar.is-fixed a", { hasText: /^EVIDENCE$/ });
    if (navItem) await realClick(page, navItem); else await jump(page, "evidence", 0.05);
    await page.waitForTimeout(1800);
    const cards = await page.evaluate(() => [...document.querySelectorAll("#evidence .ev-stack > *")].filter((e) => { const r = e.getBoundingClientRect(); return e.checkVisibility({ opacityProperty: true }) && r.width && r.bottom > 0 && r.top < innerHeight; }).length);
    await page.screenshot({ path: join(OUT, `d010-${w}.jpg`), type: "jpeg", quality: 60 });
    log(`D010_${w}`, { visibleCards: cards, alpha: await page.evaluate(() => window.__eca.debug().alpha) });
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(OUT, "pass2.json"), JSON.stringify(R, null, 1));
console.log("PDONE");
