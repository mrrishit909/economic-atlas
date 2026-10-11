// P05-QA-001: frame pacing during the S00 sort (intro, 4.6 s) in headed Chromium (real GPU). Usage: node pacing-s00.mjs [base]
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json");
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] ?? "http://localhost:4341/economic-atlas/";
const b = await chromium.launch({ headless: false });
const out = [];
for (const [w, h, thr] of [[1440, 900, 0], [1440, 900, 4], [390, 844, 4]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 1024 });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  if (thr) await cdp.send("Emulation.setCPUThrottlingRate", { rate: thr });
  await page.addInitScript(() => { window.__d = []; let l = performance.now(); const t = () => { const n = performance.now(); window.__d.push(n - l); l = n; if (n < 9000) requestAnimationFrame(t); }; requestAnimationFrame(t); });
  await page.goto(`${BASE}?quality=high`); await page.waitForTimeout(8000);
  const d = (await page.evaluate(() => window.__d)).slice(5); const s = [...d].sort((a, b) => a - b);
  const renderer = await page.evaluate(() => { const g = document.createElement("canvas").getContext("webgl2"); const e = g?.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "n/a"; });
  out.push({ label: `S00 sort ${w}x${h} ${thr ? thr + "x CPU" : "unthrottled"}`, renderer, n: d.length, p50: +s[Math.floor(s.length * .5)].toFixed(2), p95: +s[Math.floor(s.length * .95)].toFixed(2), over16_7: +(d.filter((x) => x > 16.7).length / d.length).toFixed(3), over33: +(d.filter((x) => x > 33).length / d.length).toFixed(3), tier: await page.evaluate(() => window.__eca.debug().tier) });
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({ device: execFileSync("sysctl", ["-n", "hw.model"]).toString().trim(), uptime: execFileSync("uptime").toString().trim(), runs: out }, null, 1));
