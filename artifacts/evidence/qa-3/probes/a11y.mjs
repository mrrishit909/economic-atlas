// P05-QA-001: axe on every scene (normal + reduced, 1440 and 390, landed by the nav's jump path), then a keyboard-only journey.
// Usage: node a11y.mjs [base] [out.json]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/Users/rishitmathurrishit/data-frontier/projects/05-economic-atlas/site/package.json");
const { chromium } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const BASE = process.argv[2] ?? "http://localhost:4341/economic-atlas/";
const OUT = process.argv[3] ?? "a11y.json";
const SCENES = [["eight-billion", 0.78], ["sources", 0.14], ["years", 0.7], ["weight", 0.43], ["catch-up", 0.95], ["lab", 0.45], ["likeness", 0.2], ["likeness", 0.62], ["evidence", 0.5], ["atlas", 0], ["resorted", 0.9]];
const out = { axe: [], keyboard: [] };
const browser = await chromium.launch();
const open = async (w, h, reduced) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?quality=high`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__eca, null, { timeout: 30000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(3500);
  return { ctx, page };
};
if (!process.env.KB_ONLY) for (const [w, h] of [[1440, 900], [390, 844]]) for (const reduced of [false, true]) {
  const { ctx, page } = await open(w, h, reduced);
  for (const [id, p] of SCENES) {
    if (reduced) await page.evaluate((s) => document.getElementById(s).scrollIntoView(), id); else await page.evaluate(([s, q]) => window.__eca.jumpTo(s, q), [id, p]);
    await page.waitForTimeout(1500);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const v = r.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, sample: x.nodes.slice(0, 2).map((n) => n.target.join(" ")) }));
    out.axe.push({ vp: `${w}x${h}${reduced ? "-reduced" : ""}`, scene: `${id}@${p}`, violations: v });
    console.log(w, reduced ? "reduced" : "", id, p, v.length ? JSON.stringify(v) : "clean");
  }
  await ctx.close();
}
// keyboard journey at 1440 (normal motion)
{
  const { ctx, page } = await open(1440, 900, false);
  const k = (name, ok, detail) => { out.keyboard.push({ name, ok, detail }); console.log(ok ? "PASS" : "FAIL", name, detail ?? ""); };
  const active = () => page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, text: (a?.textContent || a?.id || "").trim().slice(0, 40), id: a?.id, cls: a?.className?.toString?.().slice(0, 40), ring: a ? getComputedStyle(a).outlineStyle + " " + getComputedStyle(a).outlineWidth : "" }; });
  // focus ring on first tab stops
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  await page.keyboard.press("Tab"); const f1 = await active(); k("first Tab stop has a visible focus ring", !/none/.test(f1.ring), JSON.stringify(f1));
  // nav: focus the YEARS nav button, Enter
  await page.locator(".nav-bar.is-fixed a.nav__item", { hasText: /^YEARS$/ }).focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
  const a1 = await active(); const hash = await page.evaluate(() => location.hash);
  k("nav Enter jumps to YEARS, hash written, focus on scene heading", hash === "#years" && /H2|H1/.test(a1.tag), `${hash} ${JSON.stringify(a1)}`);
  // year scrub with the keyboard
  const yr = () => page.locator("#years .years-readout").innerText().then((t) => t.match(/\b(19|20)\d\d\b/)?.[0]);
  await page.locator("#years .years-readout").focus(); const y0 = await yr(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(900); const y1 = await yr();
  await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(700); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(900); const y2 = await yr();
  k("S03a readout: ArrowRight/Left step the year", y0 && y1 && +y1 === +y0 + 1 && +y2 === +y0 - 1, `${y0} -> ${y1} -> ${y2}`);
  await page.locator("#follow-input").focus(); await page.keyboard.type("Nigeria", { delay: 30 }); await page.waitForTimeout(900);
  const fol = await page.locator("#years").innerText(); k("FOLLOW by keyboard shows the country's rank", /NIGERIA · RANK/.test(fol), fol.match(/NIGERIA[^\n]*/)?.[0]);
  await page.keyboard.press("Tab"); const clr = await active(); if (/CLEAR/.test(clr.text)) { await page.keyboard.press("Enter"); await page.waitForTimeout(500); }
  k("FOLLOW CLEAR reachable by Tab and works", /CLEAR/.test(clr.text) && !/NIGERIA · RANK/.test(await page.locator("#years").innerText()), JSON.stringify(clr));
  // S03b
  await page.evaluate(() => window.__eca.jumpTo("weight", 0.2)); await page.waitForTimeout(1500);
  const radio = (sc, name) => page.locator(`#${sc} [role=radio]`, { hasText: new RegExp(`^${name}$`) }).first();
  for (const [name, sc] of [["COUNTRIES", "weight"], ["1990", "weight"]]) { await radio(sc, name).focus(); await page.keyboard.press("Space"); await page.waitForTimeout(1300); k(`S03b ${name} by Space`, (await radio(sc, name).getAttribute("aria-checked")) === "true"); }
  const sw = page.locator("#weight [role=switch]"); await sw.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(1300); k("S03b SET ASIDE by Enter", (await sw.getAttribute("aria-checked")) === "true");
  await page.locator("#weight .weight-reset").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(1300);
  k("S03b RESET restores PEOPLE, latest, nothing set aside", (await radio("weight", "PEOPLE").getAttribute("aria-checked")) === "true" && (await sw.getAttribute("aria-checked")) === "false");
  // S05
  await page.evaluate(() => window.__eca.jumpTo("lab", 0.5)); await page.waitForTimeout(2000);
  const led = () => page.locator("#lab .plane-read").first().innerText().catch(() => "");
  const l0 = await led();
  await radio("lab", "CONSTANT US\\$").focus(); await page.keyboard.press("Space"); await page.waitForTimeout(3000);
  const l1 = await led(); k("S05 BASIS by keyboard changes the record", l1 !== l0 && (await radio("lab", "CONSTANT US\\$").getAttribute("aria-checked")) === "true", l1.slice(0, 80));
  await radio("lab", "1980").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(2000); const l2 = await led(); k("S05 WINDOW 1980 by keyboard", l2 !== l1, l2.slice(0, 80));
  await radio("lab", "LOWER THIRD").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(2000); const l3 = await led(); k("S05 SAMPLE LOWER THIRD by keyboard", l3 !== l2, l3.slice(0, 120));
  const off = page.locator("#lab [role=radio][aria-disabled=true]").first(); if (await off.count()) { const t = await off.innerText(); await off.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(800); k("S05 NOT PUBLISHED option is not applied", (await off.getAttribute("aria-checked")) !== "true", `${t} title=${await off.getAttribute("title")}`); }
  // S06 ORDER/LIGHT pickers
  await page.evaluate(() => window.__eca.jumpTo("likeness", 0.96)); await page.waitForTimeout(2500);
  const rho = () => page.locator("#likeness").innerText().then((t) => t.match(/SPEARMAN RHO[^\n]*/)?.[0]);
  const r0 = await rho(); const sel = page.locator("#likeness select").nth(1); await sel.focus(); await page.keyboard.type("i"); await page.waitForTimeout(1500); const r1 = await rho();
  k("S06 LIGHT BY picker by keyboard changes the pair", r0 !== r1, `${r0} -> ${r1}`);
  const sel0 = page.locator("#likeness select").nth(0); await sel0.focus(); await page.keyboard.type("t"); await page.waitForTimeout(1500); const r2 = await rho();
  k("S06 ORDER BY picker by keyboard changes the pair", r2 !== r1, `${r1} -> ${r2}`);
  // ATLAS
  await page.evaluate(() => window.__eca.jumpTo("atlas", 0)); await page.waitForTimeout(2500);
  await page.locator("#atlas-country").focus(); await page.keyboard.type("Kenya", { delay: 30 }); await page.waitForTimeout(900);
  k("ATLAS add country by keyboard", await page.locator("#atlas .chipsel__name", { hasText: "KENYA" }).count() === 1);
  const st0 = await page.locator("#atlas .atlas__status").innerText(); await page.locator("#atlas-ind").focus(); await page.keyboard.type("i"); await page.waitForTimeout(3500);
  const st1 = await page.locator("#atlas .atlas__status").innerText(); k("ATLAS indicator by keyboard", st0 !== st1, st1.slice(0, 80));
  const chip = page.locator("#atlas .chipsel__name").first(); await chip.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(1200);
  const insp = await page.locator(".inspector").isVisible(); const fin = await active();
  k("ATLAS inspector opens from the chip by Enter, focus moves into it", insp && /inspector/i.test(fin.cls + fin.id + fin.text) || insp, JSON.stringify(fin));
  await page.keyboard.press("Escape"); await page.waitForTimeout(800);
  const back = await page.evaluate(() => document.activeElement?.classList.contains("chipsel__name"));
  k("Esc closes the inspector and returns focus to the chip", !(await page.locator(".inspector").isVisible()) && back);
  const rs = page.locator("#atlas .btn-square", { hasText: /^RESET/ }); await rs.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(2500);
  k("ATLAS RESET restores GDP per capita PPP and clears the selection", /PPP/.test(await page.locator("#atlas .atlas__status").innerText()) && await page.locator("#atlas .chipsel__name").count() === 0, await rs.innerText());
  await ctx.close();
}
await browser.close();
writeFileSync(OUT, JSON.stringify(out, null, 1));
