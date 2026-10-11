// P05-QA-003 pass-3 targeted probes: D-023 (reduced S04/S05 overlay under natural scroll), D-024 (768 S05 tour chip
// unobstructed p 0.05..0.30 step 0.025), D-025 (share of the S03a disc covered by opaque text panels on phones),
// D-026 (plane x tick labels fully painted), D-027 (S06 NOT GROUPED caption vs its hollow set).
// Usage: node pass3.mjs [base] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json");
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] ?? "http://localhost:4341/economic-atlas/";
const OUT = process.argv[3] ?? "pass3";
mkdirSync(OUT, { recursive: true });
const R = {};
const log = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v).slice(0, 900)); };
const browser = await chromium.launch();
const open = async (w, h, reduced = false) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?quality=high`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__eca, null, { timeout: 30000 });
  await page.keyboard.press("Escape"); await page.waitForTimeout(3000);
  return { ctx, page };
};

// D-023: natural scroll through S04 and S05 under reduced motion
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const { ctx, page } = await open(w, h, true);
  const rows = [];
  for (const sid of ["catch-up", "lab"]) {
    const top = await page.evaluate((s) => document.getElementById(s).getBoundingClientRect().top + scrollY, sid);
    const H = await page.evaluate((s) => document.getElementById(s).offsetHeight, sid);
    for (const f of [0, 0.2, 0.4, 0.6, 0.8]) {
      await page.evaluate((y) => scrollTo(0, y), top + f * Math.max(0, H - h)); await page.waitForTimeout(900);
      const r = await page.evaluate((s) => {
        const sv = [...document.querySelectorAll(`#${s} svg.plane`)].find((e) => e.checkVisibility({ opacityProperty: true }));
        if (!sv) return { svg: null };
        const b = sv.getBoundingClientRect();
        const texts = [...sv.querySelectorAll("text")].map((t) => t.textContent);
        const unit = texts.find((t) => /GDP PER CAPITA IN/.test(t)) ?? null;
        // flow text that is painted over the plane's labels (the builder's open question)
        const lab = [...sv.querySelectorAll("text")].map((t) => t.getBoundingClientRect()).filter((r) => r.width && r.bottom > 0 && r.top < innerHeight);
        const flow = [];
        const tw = document.createTreeWalker(document.getElementById(s), NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) { const el = n.parentElement; if (!n.textContent.trim() || !el || sv.contains(el) || !el.checkVisibility({ opacityProperty: true })) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width) flow.push({ r, t: n.textContent.trim().slice(0, 30) }); }
        const over = []; for (const L of lab) for (const F of flow) { const ww = Math.min(L.right, F.r.right) - Math.max(L.left, F.r.left), hh = Math.min(L.bottom, F.r.bottom) - Math.max(L.top, F.r.top); if (ww > 2 && hh > 2) over.push(F.t); }
        return { svg: [b.left, b.top, b.width, b.height].map(Math.round), pos: getComputedStyle(sv).position, xLabels: texts.filter((t) => /^\d+K$/.test(t)).length, unit, zero: !!sv.querySelector(".plane__zero"), fit: !!sv.querySelector(".plane__fit .plane__line"), ci: !!sv.querySelector(".plane__fit [fill*='url'], .plane__fit path, .plane__fit polygon"), basis: sv.getAttribute("data-basis"), textOverLabels: [...new Set(over)].slice(0, 4) };
      }, sid);
      rows.push({ sid, f, ...r });
      if (f === 0.4 || f === 0.8) await page.screenshot({ path: join(OUT, `d023-${sid}-${w}-${f}.jpg`), type: "jpeg", quality: 55 });
    }
  }
  log(`D023_${w}`, rows);
  await ctx.close();
}
// D-024: 768 tour chip fully visible and on top, p 0.05..0.30 step 0.025 (normal)
{
  const { ctx, page } = await open(768, 1024);
  const rows = [];
  for (let p = 0.05; p <= 0.3001; p += 0.025) {
    await page.evaluate((q) => window.__eca.jumpTo("lab", q), p); await page.waitForTimeout(1300);
    rows.push({ p: +p.toFixed(3), ...(await page.evaluate(() => {
      const c = [...document.querySelectorAll("#lab .chip")].find((e) => e.checkVisibility({ opacityProperty: true }));
      if (!c) return { chip: null };
      const r = c.getBoundingClientRect(); const pts = [[r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
      const hits = pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && (c === e || c.contains(e)); });
      return { chip: c.textContent.trim().slice(0, 50), inView: r.top >= 0 && r.bottom <= innerHeight, onTop: hits.every(Boolean), hits };
    })) });
  }
  log("D024_768", rows);
  await page.evaluate(() => window.__eca.jumpTo("lab", 0.12)); await page.waitForTimeout(1300);
  await page.screenshot({ path: join(OUT, "d024-768-p012.jpg"), type: "jpeg", quality: 60 });
  await ctx.close();
}
// D-025: S03a disc share covered by opaque text panels; D-026 tick labels; D-027 caption vs hollow set
for (const [w, h] of [[390, 844], [375, 812], [360, 800]]) {
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => window.__eca.jumpTo("years", 0.7)); await page.waitForTimeout(1800);
  const cov = await page.evaluate(() => {
    const d = window.__eca.debug(); const cx = d.cx, cy = d.cy, R = d.R;
    // opaque panels: elements in #years with a non-transparent background that intersect the disc
    const panels = [...document.querySelectorAll("#years *")].filter((e) => { const cs = getComputedStyle(e); const bg = cs.backgroundColor; const a = bg.startsWith("rgba") ? +bg.split(",")[3].replace(")", "") : bg === "transparent" ? 0 : 1; return a > 0.6 && e.checkVisibility({ opacityProperty: true }); }).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 20 && r.height > 8);
    let inDisc = 0, covered = 0, visible = 0;
    for (let y = Math.max(0, cy - R); y < Math.min(innerHeight, cy + R); y += 4) for (let x = Math.max(0, cx - R); x < Math.min(innerWidth, cx + R); x += 4) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue; inDisc++;
      if (panels.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) covered++; else visible++;
    }
    return { R: Math.round(R), cx: Math.round(cx), cy: Math.round(cy), inViewDiscSamples: inDisc, coveredPct: +(100 * covered / Math.max(1, inDisc)).toFixed(1) };
  });
  await page.screenshot({ path: join(OUT, `d025-s03a-${w}.jpg`), type: "jpeg", quality: 60 });
  await page.evaluate(() => window.__eca.jumpTo("catch-up", 0.95)); await page.waitForTimeout(2000);
  const ticks = await page.evaluate(() => {
    const sv = document.querySelector("#catch-up svg.plane"); if (!sv) return null;
    const clipEl = sv.closest("[class*=stage], .col--plane") ?? sv; const cr = sv.getBoundingClientRect();
    return [...sv.querySelectorAll("text")].filter((t) => /^\d+K$/.test(t.textContent)).map((t) => { const r = t.getBoundingClientRect(); const x = (r.left + r.right) / 2, y = r.top + 2; const e = document.elementFromPoint(x, y); return { t: t.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), svgBottom: Math.round(cr.bottom), topVisible: !!e && (e === t || sv.contains(e) || e === sv), inView: r.bottom <= innerHeight && r.top >= 0 }; });
  });
  await page.evaluate(() => window.__eca.jumpTo("likeness", 0.2)); await page.waitForTimeout(2200);
  const cap = await page.evaluate(() => {
    const c = [...document.querySelectorAll("#likeness *")].find((e) => /NOT GROUPED/.test(e.textContent) && e.children.length === 0);
    if (!c) return null; const r = c.getBoundingClientRect();
    const hol = document.querySelector("#likeness .hollow-set, #likeness [class*=hollow], #likeness [class*=ungrouped]");
    const hr = hol?.getBoundingClientRect();
    return { caption: [r.left, r.top, r.right, r.bottom].map(Math.round), hollow: hr ? [hr.left, hr.top, hr.right, hr.bottom].map(Math.round) : null, hollowCls: hol?.className ?? null };
  });
  await page.screenshot({ path: join(OUT, `d027-s06-${w}.jpg`), type: "jpeg", quality: 60 });
  log(`D025_26_27_${w}`, { s03aDisc: cov, ticks, s06caption: cap });
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, "pass3.json"), JSON.stringify(R, null, 1));
console.log("P3DONE");
