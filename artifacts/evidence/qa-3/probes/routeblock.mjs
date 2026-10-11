// P05-QA-001 route-block matrix (QA lesson L4 + L12). Every artifact x every consuming scene, at 1440x900 and 390x844.
// The file answers 404 until RETRY; RETRY is clicked with a real pointer (page.mouse / touchscreen.tap at the centre,
// after elementFromPoint confirms the button is the hit target). Pass = an alert naming the file is visible inside that
// scene's viewport, RETRY is hit-testable, and after one click the alert is gone with exactly one new request.
// Usage: node routeblock.mjs [base] [out.json]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json");
const { chromium } = require("@playwright/test");
const BASE = process.argv[2] ?? "http://localhost:4341/economic-atlas/";
const OUT = process.argv[3] ?? "routeblock.json";
const M = {
  "eight-billion": [0.05, ["facts", "meta", "countries", "indicators", "seedhead/gdppc_ppp_latest"]],
  sources: [0.14, ["facts", "meta", "countries", "reconciliation", "panel_income", "indicators", "coverage", "longrun"]],
  years: [0.7, ["seedhead/gdppc_ppp", "convergence", "facts", "countries", "indicators", "panel_income"]],
  weight: [0.43, ["seedhead/gdppc_ppp", "seedhead/gdppc_ppp_latest", "convergence", "facts", "indicators", "panel_income"]],
  "catch-up": [0.95, ["convergence"]],
  lab: [0.45, ["convergence", "panel_income"]],
  likeness: [0.2, ["clusters", "correlations", "facts"]],
  evidence: [0.95, ["facts", "meta", "convergence", "validation", "clusters", "correlations", "coverage", "boundaries"]],
  atlas: [0, ["indicators", "countries", "meta", "panel_income", "panel_structure", "narratives", "seedhead/gdppc_ppp"]],
  resorted: [0.9, ["facts", "meta", "indicators"]],
};
// pass 2: PAT="scene=p,..." overrides the landing p (to test a file at the card or part that consumes it)
for (const kv of (process.env.PAT ?? "").split(",").filter(Boolean)) { const [k, v] = kv.split("="); M[k][0] = +v; }
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const results = [];
const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const [scene, [p, files]] of Object.entries(M)) {
    for (const file of files) {
      if (only && !only.has(`${scene}:${file}`)) continue;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      let block = true, hits = 0;
      const re = new RegExp(`/data/${file.replace("/", "\\/")}\\.json`);
      await page.route(re, async (r) => { hits++; if (block) await r.fulfill({ status: 404, body: "nope" }); else await r.continue(); });
      const r = { vp: `${w}x${h}`, scene, file, p };
      try {
        await page.goto(`${BASE}?quality=high`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__eca, null, { timeout: 30000 });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(2500);
        // load the scene's artifacts (the idle wave + scene entry) then land
        await page.evaluate(([s, q]) => window.__eca.jumpTo(s, q), [scene, p]);
        await page.waitForTimeout(2500);
        await page.evaluate(([s, q]) => window.__eca.jumpTo(s, q), [scene, p]);
        await page.waitForTimeout(1200);
        const fileName = file.toUpperCase();
        const probe = () => page.evaluate(([sid, fname]) => {
          const root = document.getElementById(sid);
          const alerts = [...root.querySelectorAll("[role=alert]")].filter((a) => a.textContent.includes(fname));
          const vis = alerts.filter((a) => { const b = a.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight && a.checkVisibility({ opacityProperty: true, visibilityProperty: true }); });
          const anywhere = [...document.querySelectorAll("[role=alert]")].filter((a) => a.textContent.includes(fname)).map((a) => a.closest("section, [id]")?.id ?? "?");
          const btn = vis[0]?.querySelector("button");
          let hit = null, box = null;
          if (btn) { const b = btn.getBoundingClientRect(); box = { x: b.left + b.width / 2, y: b.top + b.height / 2 }; const e = document.elementFromPoint(box.x, box.y); hit = e === btn || btn.contains(e) ? "button" : (e?.className?.toString?.() || e?.tagName); }
          return { inScene: alerts.length, visible: vis.length, anywhere, hit, box, text: vis[0]?.textContent?.slice(0, 80) ?? alerts[0]?.textContent?.slice(0, 80) ?? null };
        }, [scene, fileName]);
        const before = await probe();
        Object.assign(r, { alertInScene: before.inScene, alertVisible: before.visible, alertElsewhere: before.anywhere, retryHit: before.hit, text: before.text });
        if (before.box && before.hit === "button") {
          block = false; const h0 = hits;
          if (w < 1024) await page.touchscreen.tap(before.box.x, before.box.y); else await page.mouse.click(before.box.x, before.box.y);
          await page.waitForTimeout(2500);
          const after = await probe();
          Object.assign(r, { refetches: hits - h0, recovered: after.inScene === 0 });
        }
        r.pass = r.alertVisible > 0 && r.retryHit === "button" && r.recovered === true && r.refetches === 1;
      } catch (e) { r.error = e.message.slice(0, 120); r.pass = false; }
      console.log(JSON.stringify(r));
      results.push(r);
      await ctx.close();
    }
  }
}
await browser.close();
writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log("FAIL", results.filter((x) => !x.pass).length, "of", results.length);
