// P05-QA-002 (pass 2) lesson probes, DOM-generated boxes (L19). Was: P05-QA-001 lesson probes L1/L2/L3/L5/L7/L8/L9/L11/L12/L13/L14/L15 + L16 capture, own browsers.
// For every viewport (normal, and reduced at the gate set): each scene landing (plus S00 end and one mid point).
//  - overflow vs the CONFIGURED viewport width (L14), under isMobile emulation below 768
//  - collisions over visible DOM text, controls, chips AND the seed-label layer (canvas iso3 labels, L13)
//  - 11px floor (L7), visible honesty chip (L3), elementFromPoint on every visible control (L9/L12)
//  - L16: per shot, text hidden -> screenshot + boxes json for contrast.py
// Usage: node lessons.mjs [base] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json");
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] ?? "http://localhost:4341/economic-atlas/";
const OUT = process.argv[3] ?? "lessons";
mkdirSync(join(OUT, "contrast"), { recursive: true });
const SCENES = [["eight-billion", 0.0], ["eight-billion", 0.5], ["eight-billion", 0.78], ["sources", 0.124], ["sources", 0.314], ["sources", 0.504], ["sources", 0.694], ["years", 0.3], ["years", 0.7], ["weight", 0.2], ["weight", 0.43], ["weight", 0.6], ["weight", 0.9], ["catch-up", 0.04], ["catch-up", 0.24], ["catch-up", 0.6], ["catch-up", 0.95], ["lab", 0.12], ["lab", 0.27], ["lab", 0.45], ["likeness", 0.2], ["likeness", 0.4], ["likeness", 0.62], ["likeness", 0.96], ["evidence", 0.05], ["evidence", 0.35], ["evidence", 0.65], ["evidence", 0.95], ["atlas", 0], ["resorted", 0.3], ["resorted", 0.6], ["resorted", 0.9]];
const VPS = (process.env.VPS ?? "1920x1080,1440x900,1280x720,1024x768,768x1024,390x844,375x812,360x800").split(",").map((s) => s.split("x").map(Number));
const REDUCED = !!process.env.REDUCED;
const CLASSIC = !!process.env.CLASSIC;
const SCROLLBAR_CSS = "html{overflow-y:scroll!important}::-webkit-scrollbar{width:15px}::-webkit-scrollbar-thumb{background:#555}";

// L19: the box list is generated from the DOM, never from a selector list: every painted text line (Range client
// rects of every visible text node, so text overflowing a fixed-height box is measured where it is painted), every
// visible control, and every seed-label (canvas label hook, L13). Overlaps between different owners > 2x2 px count.
const pageProbe = ([sid, vw, fixture]) => {
  const root = document.getElementById(sid);
  if (fixture) { const f = document.createElement("div"); f.className = "qa-fixture-novel-" + Date.now(); f.textContent = "FIXTURE OVERLAP"; const h = root.querySelector("h2, h1"); const b = h.getBoundingClientRect(); f.style.cssText = `position:fixed;left:${b.left + 4}px;top:${b.top + 4}px;font:14px monospace;color:#fff;z-index:99`; document.body.appendChild(f); }
  const visEl = (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && +getComputedStyle(e).opacity > 0.05;
  const inView = (r) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const owner = (e) => e.closest("button, select, input, a, summary, [role=radio], [role=tab], [role=switch], .chip, .seed-label, li, p, h1, h2, h3, figcaption, label, td, th, dt, dd, text") ?? e;
  const scope = [root, ...document.querySelectorAll(".nav-bar.is-fixed, .menu-pill, .corner-btn, .inspector, .seed-labels, .s00-corner, [class*=qa-fixture]")];
  const B = [];
  const seen = new Set();
  for (const sc of scope) {
    const tw = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || !visEl(el) || el.closest(".sr-only, [aria-hidden=true]:not(.seed-label):not(.seed-labels)")) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const o = owner(el);
      for (const r of rg.getClientRects()) if (inView(r)) B.push({ o, t: n.textContent.trim().slice(0, 34), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, kind: el.closest(".seed-label") ? "label" : "text" });
    }
    for (const c of sc.querySelectorAll("button, select, input, [role=radio], [role=switch]")) { if (!visEl(c) || seen.has(c)) continue; seen.add(c); const r = c.getBoundingClientRect(); if (inView(r)) B.push({ o: c, t: (c.textContent || c.id || c.tagName).trim().slice(0, 24), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, kind: "ctrl" }); }
  }
  const col = [];
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], c = B[j]; if (a.o === c.o || a.o.contains(c.o) || c.o.contains(a.o)) continue; if (a.kind === "label" && c.kind === "label") continue;
    const w = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), h = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
    if (w > 2 && h > 2) col.push(`${a.kind === "label" || c.kind === "label" ? "[L13] " : ""}"${a.t}" x "${c.t}" (${w.toFixed(0)}x${h.toFixed(0)})`);
  }
  const fixtureCaught = fixture ? col.some((x) => x.includes("FIXTURE OVERLAP")) : null;
  document.querySelectorAll("[class*=qa-fixture]").forEach((e) => e.remove());
  const small = [...root.querySelectorAll("*")].filter((e) => visEl(e) && inView(e.getBoundingClientRect()) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => `${e.textContent.trim().slice(0, 30)} ${getComputedStyle(e).fontSize}`);
  const chips = [...root.querySelectorAll(".chip")].filter(visEl).filter((c) => { const b = c.getBoundingClientRect(); return b.width > 0 && b.top >= 0 && b.bottom <= innerHeight; }).length;
  const ctrls = [...root.querySelectorAll("button, select, input, summary, [role=radio], [role=tab]")].filter(visEl).map((c) => {
    const b = c.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
    if (!b.width || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
    const hit = document.elementFromPoint(x, y);
    if (!hit || c === hit || c.contains(hit) || hit.contains(c) || c.closest("label")?.contains(hit)) return null;
    return `${(c.textContent || c.id || c.tagName).trim().slice(0, 24)} under ${hit.className?.toString?.().slice(0, 40) || hit.tagName}`;
  }).filter(Boolean);
  const outside = B.filter((b) => b.kind !== "ctrl" && root.contains(b.o) && (b.x1 > vw + 1 || b.x0 < -1) && !b.o.closest(".story-card:not(.is-active), .deck")).map((b) => b.t).slice(0, 4);
  const tgt = B.filter((b) => b.kind !== "ctrl" && !b.o.closest(".nav-bar, .menu-pill, .menu-panel, button, select, input, [role=radio]")).map((b) => {
    const e = b.o; let op = 1; for (let n = e; n && n !== document.documentElement; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    return { t: b.t, color: getComputedStyle(e).color, op, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0, fs: parseFloat(getComputedStyle(e).fontSize) };
  }).filter((b) => b.y >= 0 && b.y + b.h <= innerHeight && b.x >= 0 && b.x + b.w <= innerWidth && b.fs < 20);
  const d = window.__eca.debug();
  return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, col, small, chips, ctrls, outside, tgt, fixtureCaught, jsCls: d.cls,
    cssCls: matchMedia("(max-width: 767px)").matches ? "M" : matchMedia("(max-width: 1023px)").matches ? "T" : "D", scene: d.scene };
};

const browser = await chromium.launch(CLASSIC ? { ignoreDefaultArgs: ["--hide-scrollbars"] } : {});
const report = [];
for (const [w, h] of VPS) {
  const label = `${w}x${h}${REDUCED ? "-reduced" : ""}${CLASSIC ? "-classic" : ""}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768, deviceScaleFactor: 1, reducedMotion: REDUCED ? "reduce" : "no-preference" });
  if (CLASSIC) await ctx.addInitScript((css) => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }), SCROLLBAR_CSS);
  const page = await ctx.newPage();
  await page.goto(`${BASE}?quality=high`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__eca, null, { timeout: 30000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(3500);
  const bad = []; let fixtureOk = 0;
  for (const [sid, p] of SCENES) {
    if (REDUCED) { await page.evaluate(([s, q]) => { const el = document.getElementById(s); const y = el.getBoundingClientRect().top + scrollY + q * Math.max(0, el.offsetHeight - innerHeight); scrollTo(0, y); }, [sid, p]); await page.waitForTimeout(900); }
    else { await page.evaluate(([s, q]) => window.__eca.jumpTo(s, q), [sid, p]); await page.waitForTimeout(1800); }
    const r = await page.evaluate(pageProbe, [sid, w, false]);
    if (sid === "years" && !REDUCED) { const fx = await page.evaluate(pageProbe, [sid, w, true]); if (!fx.fixtureCaught) bad.push(`${sid}: L19 fixture overlap NOT caught`); else fixtureOk++; }
    const key = `${sid}@${p}`;
    if (r.scrollW > w) bad.push(`${key}: L14 scrollWidth ${r.scrollW} > viewport ${w} (innerWidth ${r.innerW})`);
    if (r.outside.length) bad.push(`${key}: L14 text outside viewport: ${r.outside.slice(0, 3).join(" | ")}`);
    if (r.col.length) bad.push(`${key}: L2/L11/L13 ${r.col.slice(0, 6).join(" ; ")}${r.col.length > 6 ? ` (+${r.col.length - 6})` : ""}`);
    if (r.small.length) bad.push(`${key}: L7 ${r.small.slice(0, 3).join(" | ")}`);
    if (!r.chips && !["evidence", "resorted"].includes(sid)) bad.push(`${key}: L3 no in-viewport honesty chip`);
    if (r.ctrls.length) bad.push(`${key}: L9/L12 ${r.ctrls.slice(0, 4).join(" | ")}`);
    if (r.jsCls !== r.cssCls) bad.push(`${key}: L1 JS class ${r.jsCls} != CSS ${r.cssCls}`);
    // L16 capture: hide text, screenshot, save boxes
    const name = `${label}_${sid}_${p}`;
    await page.addStyleTag({ content: "*{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important} text,tspan{fill:transparent!important;stroke:transparent!important}" }).then(async (h) => {
      await page.waitForTimeout(80);
      await page.screenshot({ path: join(OUT, "contrast", `${name}.png`) });
      await h.evaluate((el) => el.remove());
    });
    writeFileSync(join(OUT, "contrast", `${name}.json`), JSON.stringify(r.tgt));
  }
  // L8 corner button vs pill (phones / tablet)
  if (w < 1024) {
    const gap = await page.evaluate(() => { const a = document.querySelector(".corner-btn"), b = document.querySelector(".menu-pill"); if (!a || !b) return null; const A = a.getBoundingClientRect(), Bb = b.getBoundingClientRect(); if (!A.width || !Bb.width) return null; return Math.max(A.left - Bb.right, Bb.left - A.right, A.top - Bb.bottom, Bb.top - A.bottom); });
    if (gap !== null && gap < 8) bad.push(`L8 corner button to pill ${gap.toFixed(1)}px`);
  }
  console.log(label, `fixture caught ${fixtureOk}`, bad.length ? `\n  ${bad.join("\n  ")}` : "clean");
  report.push({ viewport: label, defects: bad });
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, `lessons${REDUCED ? "-reduced" : ""}${CLASSIC ? "-classic" : ""}.json`), JSON.stringify(report, null, 1));
