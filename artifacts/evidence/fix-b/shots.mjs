// FIX-B evidence: the scenes the pass-2 defects name, at 5 viewports, normal and reduced motion.
import { createRequire } from "node:module";
const { chromium } = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json")("playwright");
import { mkdirSync } from "node:fs";
const OUT = process.argv[2];
const POS = [["years", 0.7], ["sources", 0.314], ["catch-up", 0.5], ["catch-up", 0.95], ["lab", 0.12], ["lab", 0.27], ["lab", 0.5], ["likeness", 0.2], ["evidence", 0.35]];
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [1280, 720], [768, 1024], [390, 844], [360, 800]]) for (const red of [false, true]) {
  const dir = `${OUT}/${w}x${h}${red ? "-reduced" : ""}`; mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: red ? "reduce" : "no-preference", isMobile: w < 768, hasTouch: w < 1024 });
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:4341/economic-atlas/?quality=high"); await pg.keyboard.press("Escape"); await pg.waitForTimeout(3000);
  for (const [id, p] of POS) { await pg.evaluate(([i, q]) => window.__eca.jumpTo(i, q), [id, p]); await pg.waitForTimeout(2200); await pg.screenshot({ path: `${dir}/${id}-${p}.jpg`, type: "jpeg", quality: 70 }); }
  await ctx.close();
}
await b.close();
