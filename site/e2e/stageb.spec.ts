import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type Eca = {
  jumpTo: (i: string, p?: number) => void; scrollToProgress: (i: string, p: number) => void;
  debug: () => { R: number; palette: string; free: string; echo: number; scene: string; cls: string; n: number; introDone: boolean };
  seedPx: (iso: string) => [number, number] | null; expectedPx: (iso: string, w: string) => [number, number] | null;
};
const E = (page: Page) => page.evaluateHandle(() => (window as unknown as { __eca: Eca }).__eca);
const jump = async (page: Page, id: string, p: number) => (await E(page)).evaluate((e, [i, q]) => e.jumpTo(i as string, q as number), [id, p] as const);
const dbg = async (page: Page) => (await E(page)).evaluate((e) => e.debug());
const SCENES: [string, number][] = [["eight-billion", 0.78], ["sources", 0.14], ["years", 0.7], ["weight", 0.43], ["catch-up", 0.95], ["lab", 0.4], ["likeness", 0.2], ["evidence", 0.05], ["atlas", 0], ["resorted", 0.9]];
const basesOf = (t: string) => {
  const u = t.toUpperCase(), out: string[] = [];
  if (/\bPPP\b/.test(u)) out.push("ppp"); if (/CONSTANT 2015 US/.test(u)) out.push("const"); if (/CURRENT US/.test(u)) out.push("nominal"); if (/MADDISON/.test(u)) out.push("maddison");
  return out;
};
const PALETTE: Record<string, string> = { ppp_constant_intl_2021: "ppp", constant_usd_2015: "const", current_usd: "nominal" };

async function ready(page: Page, q = "?quality=high") {
  await page.goto(q);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => (window as unknown as { __eca: Eca }).__eca?.debug().introDone, null, { timeout: 20000 });
  await page.waitForFunction(() => (window as unknown as { __eca: Eca }).__eca.debug().introDone, null);
}

test.describe("Stage B scenes", () => {
  test("every scene renders its heading at its landing; never two bases in one visual element", async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(1500);
    for (const [id, p] of SCENES) {
      await jump(page, id, p);
      await page.waitForTimeout(1200);
      await expect(page.locator(`#${id} [data-scene-heading]`).first()).toBeAttached();
      const texts = await page.evaluate((i) => [...document.querySelectorAll(`#${i} :is(.legend, .plane, .plane-read, .years-readout, .ledger, .atlas__status, .paths, .narr, .s08-caption, .verdict-card, .dollars__row, .weight-count)`)].map((e) => (e as HTMLElement).innerText ?? e.textContent ?? ""), id);
      for (const t of texts) expect(basesOf(t).length, `${id}: ${t.slice(0, 80)}`).toBeLessThanOrEqual(1);
    }
    // S02 card 2: three bases on purpose, three rows, three distinct unit strings, no shared axis
    await jump(page, "sources", 0.314); await page.waitForTimeout(1200);
    const rows = await page.locator("[data-three-bases] .dollars__chip").allInnerTexts();
    expect(new Set(rows.map((r) => basesOf(r)[0])).size).toBe(3);
    await expect(page.locator("[data-three-bases] svg, [data-three-bases] .axis")).toHaveCount(0);
  });

  test("S05 basis swap: no sampled frame shows two bases (DOM) or a canvas palette of another basis", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one run is enough");
    await ready(page);
    await page.waitForTimeout(1500);
    await jump(page, "lab", 0.5);
    await page.waitForTimeout(1500);
    await page.getByRole("radio", { name: "CONSTANT US$" }).click();
    const seen = new Set<string>();
    for (let k = 0; k < 14; k++) {
      const s = await page.evaluate(() => ({
        dom: [...document.querySelectorAll("#lab .plane text")].map((t) => t.textContent ?? "").join(" | "),
        pal: (window as unknown as { __eca: Eca }).__eca.debug().palette,
      }));
      const b = basesOf(s.dom);
      expect(b.length, s.dom).toBeLessThanOrEqual(1);
      if (s.pal !== "none" && b[0]) expect(PALETTE[s.pal]).toBe(b[0]);
      seen.add(s.pal);
      await page.waitForTimeout(120);
    }
    expect(seen.has("none")).toBe(true); // the neutral phase was actually sampled
    await expect(page.locator("#lab .plane")).toHaveAttribute("data-basis", "constant_usd_2015", { timeout: 4000 });
  });

  test("ATLAS indicator change across bases passes through neutral; status, legend and canvas agree", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one run is enough");
    await ready(page);
    await page.waitForTimeout(1500);
    await jump(page, "atlas", 0);
    await page.waitForTimeout(1500);
    await page.selectOption("#atlas-ind", "gdppc_const");
    for (let k = 0; k < 16; k++) {
      const s = await page.evaluate(() => ({ dom: [...document.querySelectorAll("#atlas :is(.atlas__status, .legend)")].map((e) => (e as HTMLElement).innerText).join(" | "), pal: (window as unknown as { __eca: Eca }).__eca.debug().palette }));
      const b = basesOf(s.dom);
      expect(b.length, s.dom).toBeLessThanOrEqual(1);
      if (s.pal !== "none" && b[0]) expect(PALETTE[s.pal], `${s.pal} vs ${s.dom.slice(0, 60)}`).toBe(b[0]);
      await page.waitForTimeout(150);
    }
    await expect(page.locator("#atlas .atlas__status")).toContainText("CONSTANT 2015 US$", { timeout: 8000 });
  });

  test("S04 flight: seeds start on their disc slots and land on their plane positions (1px)", async ({ page }) => {
    await ready(page);
    await page.waitForTimeout(1500);
    const near = async (where: string) => {
      for (const iso of ["USA", "IND", "BRA"]) {
        const [a, b] = await (await E(page)).evaluate((e, [i, w]) => [e.seedPx(i), e.expectedPx(i, w)], [iso, where] as const);
        expect(a && b, iso).toBeTruthy();
        expect(Math.hypot(a![0] - b![0], a![1] - b![1]), `${iso} ${where}`).toBeLessThan(1);
      }
    };
    await jump(page, "catch-up", 0.0805); await page.waitForTimeout(600);
    expect((await dbg(page)).free).toBe("flight");
    await near("disc");
    await jump(page, "catch-up", 0.3999); await page.waitForTimeout(600);
    await near("gdppc_ppp_1990_2025_primary");
  });

  test("S04 windows draw only published fits; not-causal copy always on screen", async ({ page }) => {
    await ready(page);
    const conv = await (await page.request.get("data/convergence.json")).json() as { beta: { id: string; beta: number }[] };
    for (const [p, start] of [[0.6, 1990], [0.75, 2000], [0.95, 2010]] as const) {
      await jump(page, "catch-up", p); await page.waitForTimeout(700);
      const id = `gdppc_ppp_${start}_2025_primary`;
      await expect(page.locator(`#catch-up [data-fit="${id}"]`)).toHaveAttribute("data-slope", String(conv.beta.find((b) => b.id === id)!.beta));
      await expect(page.locator("#catch-up [data-not-causal]")).toBeVisible();
    }
    await expect(page.locator("#catch-up .verdict-card")).toContainText("Since 2010");
  });

  test("S06: Ward hollow count is the published disagree_count; rho readout from pairs; groups are descriptive", async ({ page }) => {
    await ready(page);
    const cl = await (await page.request.get("data/clusters.json")).json() as { hierarchical: { disagree_count: number } };
    await jump(page, "likeness", 0.4); await page.waitForTimeout(1500);
    await expect(page.locator("#likeness [data-ward]")).toContainText(`${cl.hierarchical.disagree_count} OF 165`);
    await expect(page.locator("#likeness [data-not-causal]")).toContainText("DESCRIPTIVE");
    await jump(page, "likeness", 0.62); await page.waitForTimeout(1500);
    await expect(page.locator("#likeness .rho")).toContainText("SPEARMAN RHO 0.97");
    await expect(page.locator("#likeness [data-not-causal]")).toBeVisible();
  });

  test("ATLAS: aggregates never offered, INDEX disabled for shares, template narratives match the reference, RESET restores", async ({ page }, info) => {
    test.skip(info.project.name === "tablet", "desktop and mobile cover it");
    await ready(page);
    const cs = await (await page.request.get("data/countries.json")).json() as { aggregates: { code: string; name: string }[] };
    const nr = await (await page.request.get("data/narratives.json")).json() as { examples: { iso3: string; template: string; text: string }[]; pair_examples: { a: string; b: string; template: string; text: string }[] };
    await page.waitForTimeout(1500);
    await jump(page, "atlas", 0); await page.waitForTimeout(1200);
    const opts = await page.locator("#atlas-list option").evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    for (const a of cs.aggregates) expect(opts).not.toContain(a.name);
    await page.fill("#atlas-country", "United States"); await page.waitForTimeout(300);
    const one = nr.examples.find((e) => e.iso3 === "USA" && e.template === "level")!;
    await expect(page.locator("#atlas .narr")).toContainText(one.text, { timeout: 10000 });
    await page.fill("#atlas-country", "China"); await page.waitForTimeout(300);
    const two = nr.pair_examples.find((e) => e.a === "USA" && e.b === "CHN" && e.template === "compare_level")!;
    await expect(page.locator("#atlas .narr")).toContainText(two.text);
    await page.selectOption("#atlas-ind", "agr_share");
    await expect(page.getByRole("radio", { name: /INDEX = 100/ })).toHaveAttribute("aria-disabled", "true");
    // inspector: opened from a chip, Esc closes it and focus returns to the chip
    const chip = page.locator(".chipsel__name").first();
    await chip.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(chip).toBeFocused();
    await page.getByRole("button", { name: "RESET" }).last().click();
    await expect(page.locator(".chipsel")).toHaveCount(0);
    await expect(page.locator("#atlas-ind")).toHaveValue("gdppc_ppp");
  });

  test("S08: the echo dissolves and re-sorts at giant size; the closing names vintage, WDI, Maddison and the IMF exclusion", async ({ page }, info) => {
    await ready(page);
    const f = await (await page.request.get("data/facts.json")).json() as { strings: Record<string, string> };
    await page.waitForTimeout(1500);
    await jump(page, "resorted", 0.6); await page.waitForTimeout(800);
    await (await E(page)).evaluate((e) => e.scrollToProgress("resorted", 0.75));
    await page.waitForFunction(() => (window as unknown as { __eca: Eca }).__eca.debug().echo >= 1, null, { timeout: 5000 });
    const G0: Record<string, number> = { desktop: 640, tablet: 620, mobile: 510 };
    expect((await dbg(page)).R).toBeGreaterThanOrEqual(G0[info.project.name]! - 1);
    await page.waitForFunction(() => (window as unknown as { __eca: Eca }).__eca.debug().echo === 2, null, { timeout: 8000 });
    for (const k of ["attribution_wdi", "attribution_owid", "imf_excluded"]) await expect(page.locator("#resorted .scene-footer")).toContainText(f.strings[k]!);
    await expect(page.locator("#resorted .scene-footer")).toContainText("WDI revises history");
  });

  test("axe: no serious or critical violations in any Stage B scene", async ({ page }, info) => {
    test.skip(info.project.name === "tablet", "desktop and mobile cover it");
    await ready(page);
    await page.waitForTimeout(1500);
    for (const [id, p] of SCENES.slice(1)) {
      await jump(page, id, p);
      await page.waitForTimeout(1000);
      const r = await new AxeBuilder({ page }).include(`#${id}`).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${id} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
  });
});

/** QA L4: every artifact-consuming scene shows its own error + RETRY, and RETRY recovers after one re-fetch. */
const BLOCKS: [string, number, string, string][] = [
  ["eight-billion", 0, "seedhead/gdppc_ppp_latest.json", "SEEDHEAD/GDPPC_PPP_LATEST"],
  ["eight-billion", 0.6, "facts.json", "FACTS"],
  ["sources", 0.124, "reconciliation.json", "RECONCILIATION"],
  ["sources", 0.504, "coverage.json", "COVERAGE"],
  ["sources", 0.694, "longrun.json", "LONGRUN"],
  ["years", 0.5, "seedhead/gdppc_ppp.json", "SEEDHEAD/GDPPC_PPP"],
  ["years", 0.5, "convergence.json", "CONVERGENCE"],
  ["weight", 0.43, "convergence.json", "CONVERGENCE"],
  ["weight", 0.43, "seedhead/gdppc_ppp.json", "SEEDHEAD/GDPPC_PPP"],
  ["catch-up", 0.6, "convergence.json", "CONVERGENCE"],
  ["lab", 0.4, "convergence.json", "CONVERGENCE"],
  ["likeness", 0.2, "clusters.json", "CLUSTERS"],
  ["likeness", 0.7, "correlations.json", "CORRELATIONS"],
  ["evidence", 0.5, "validation.json", "VALIDATION"],
  ["evidence", 0.5, "boundaries.json", "BOUNDARIES"],
  ["atlas", 0, "seedhead/gdppc_ppp.json", "SEEDHEAD/GDPPC_PPP"],
  ["resorted", 0.9, "indicators.json", "INDICATORS"],
  ["eight-billion", 0, "indicators.json", "INDICATORS"],
  ["eight-billion", 0, "meta.json", "META"],
  ["eight-billion", 0, "countries.json", "COUNTRIES"],
  ["sources", 0.314, "panel_income.json", "PANEL_INCOME"],
  ["years", 0.5, "panel_income.json", "PANEL_INCOME"],
  ["lab", 0.5, "panel_income.json", "PANEL_INCOME"],
  ["evidence", 0.5, "convergence.json", "CONVERGENCE"],
  ["evidence", 0.5, "clusters.json", "CLUSTERS"],
  ["evidence", 0.5, "correlations.json", "CORRELATIONS"],
  ["evidence", 0.5, "coverage.json", "COVERAGE"],
  ["atlas", 0, "narratives.json", "NARRATIVES"],
  ["atlas", 0, "panel_structure.json", "PANEL_STRUCTURE"],
  ["atlas", 0, "panel_income.json", "PANEL_INCOME"],
  ["atlas", 0, "indicators.json", "INDICATORS"],
  ["atlas", 0, "countries.json", "COUNTRIES"],
  ["resorted", 0.9, "facts.json", "FACTS"],
  ["resorted", 0.9, "meta.json", "META"],
];

test("L4: an ATLAS layout for a non-PPP indicator fails visibly and RETRY recovers", async ({ page }, info) => {
  test.skip(info.project.name === "tablet", "1440 and 390 per QA L4");
  let block = true;
  await page.route("**/data/seedhead/agr_share.json", (r) => (block ? r.fulfill({ status: 404, body: "" }) : r.continue()));
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  await jump(page, "atlas", 0);
  await page.selectOption("#atlas-ind", "agr_share");
  const alert = page.locator("#atlas [role=alert]").filter({ hasText: "COULD NOT LOAD SEEDHEAD/AGR_SHARE (HTTP 404)" });
  await expect(alert).toBeVisible({ timeout: 15000 });
  block = false;
  await alert.getByRole("button", { name: "RETRY" }).click();
  await expect(page.locator("#atlas .atlas__status")).toContainText("PERCENT OF GDP", { timeout: 15000 });
});

test("S02 names the vintage, the WDI attribution and the IMF exclusion; S05 never calls a loading panel unpublished", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one run");
  const f = await (await page.request.get("data/facts.json")).json() as { strings: Record<string, string> };
  await page.route("**/data/panel_income.json", (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto("?quality=high"); await page.keyboard.press("Escape"); await page.waitForTimeout(1500);
  await jump(page, "sources", 0.2); await page.waitForTimeout(800);
  await expect(page.locator("#sources .sources-pipeline")).toContainText(f.strings.attribution_wdi!);
  await jump(page, "sources", 0.694); await page.waitForTimeout(1200);
  await expect(page.locator("#sources [data-imf]")).toContainText(f.strings.imf_excluded!);
  await jump(page, "lab", 0.5); await page.waitForTimeout(1200);
  await expect(page.locator("#lab").getByRole("radio", { name: "WITH TERRITORY CHANGES" })).toHaveAttribute("title", /PANEL_INCOME FAILED TO LOAD/);
});
for (const [scene, p, file, label] of BLOCKS) {
  test(`L4: ${scene} shows COULD NOT LOAD ${label} + RETRY in view, and recovers`, async ({ page }, info) => {
    test.skip(info.project.name === "tablet", "1440 and 390 per QA L4");
    let block = true, hits = 0;
    await page.route(`**/data/${file}`, (r) => { hits++; return block ? r.fulfill({ status: 404, body: "" }) : r.continue(); });
    await page.goto("?quality=high");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1500);
    await jump(page, scene, p);
    const alert = page.locator(`#${scene} [role=alert]`).filter({ hasText: `COULD NOT LOAD ${label} (HTTP 404)` }).first();
    await expect(alert).toBeVisible({ timeout: 15000 });
    const before = hits;
    block = false;
    await alert.getByRole("button", { name: "RETRY" }).click();
    await expect(page.locator(`#${scene} [role=alert]`).filter({ hasText: `COULD NOT LOAD ${label}` })).toHaveCount(0, { timeout: 15000 });
    expect(hits - before).toBe(1);
  });
}
