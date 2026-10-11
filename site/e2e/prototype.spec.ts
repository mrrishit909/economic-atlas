import { expect, test, type Page } from "@playwright/test";

type Debug = { R: number; cx: number; cy: number; s: number; slots: number; n: number; mode: string; year: number; introDone: boolean; mix: number };
type Eca = { jumpTo: (i: string, p?: number) => void; debug: () => Debug; introStats: () => { minR: number; monotonic: boolean } };
const dbg = (page: Page) => page.evaluate(() => (window as unknown as { __eca: Eca }).__eca.debug());
const jump = (page: Page, id: string, p: number) => page.evaluate(([i, q]) => (window as unknown as { __eca: Eca }).__eca.jumpTo(i as string, q as number), [id, p] as const);
const G0: Record<string, number> = { desktop: 640, tablet: 620, mobile: 510 };
const BASES = ["INTL $ (PPP)", "CONSTANT 2015 US$", "CURRENT US$", "(MADDISON)"];

async function facts(page: Page) {
  const r = await page.request.get("data/facts.json");
  return (await r.json()) as Record<string, { value: number }>;
}

test("S00: the disc is giant from the first dust frame, never shrinks, and keeps a visible edge outside every scrim", async ({ page }, info) => {
  await page.goto("?quality=high");
  await page.waitForFunction(() => (window as unknown as { __eca: Eca }).__eca.debug().introDone, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => (window as unknown as { __eca: Eca }).__eca.introStats());
  const d = await dbg(page);
  expect(st.minR).toBeGreaterThanOrEqual(G0[info.project.name]! - 1);
  expect(st.monotonic).toBe(true);
  expect(d.R).toBeGreaterThanOrEqual(G0[info.project.name]! - 1);
  const vp = page.viewportSize()!;
  expect(2 * d.R).toBeGreaterThanOrEqual(1.2 * vp.height);

  // real pixels: points along the disc edge that lie in the viewport and outside every scrim / text box
  const png = (await page.screenshot()).toString("base64");
  const found = await page.evaluate(async ({ png, d }) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height), x = c.getContext("2d")!;
    x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, img.width, img.height).data, W = img.width, H = img.height;
    const lum = (u: number, v: number) => { const i = (Math.round(v) * W + Math.round(u)) * 4; return Math.max(px[i]!, px[i + 1]!, px[i + 2]!); };
    const boxes = [...document.querySelectorAll(".hero-scrim, h1, p:not(.s00-chips), button, nav, svg, .legend, .chip, .seed-label")].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    const blocked = (u: number, v: number) => boxes.some((r) => u >= r.left - 3 && u <= r.right + 3 && v >= r.top - 3 && v <= r.bottom + 3);
    let hits = 0;
    for (let a = 0; a < 360; a += 0.5) {
      const ca = Math.cos((a * Math.PI) / 180), sa = Math.sin((a * Math.PI) / 180);
      const ox = d.cx + (d.R + 9) * ca, oy = d.cy + (d.R + 9) * sa;
      if (ox < 4 || oy < 4 || ox > W - 4 || oy > H - 4 || blocked(ox, oy) || blocked(d.cx + (d.R - 8) * ca, d.cy + (d.R - 8) * sa)) continue;
      let inside = 0, outside = 0;
      for (let r = d.R - 14; r <= d.R - 1; r += 1) for (const t of [-0.6, 0, 0.6]) inside = Math.max(inside, lum(d.cx + r * Math.cos(((a + t) * Math.PI) / 180), d.cy + r * Math.sin(((a + t) * Math.PI) / 180)));
      for (let r = d.R + 4; r <= d.R + 9; r += 1) outside = Math.max(outside, lum(d.cx + r * ca, d.cy + r * sa));
      if (inside > 60 && outside < 16) hits++;
    }
    return hits;
  }, { png, d });
  expect(found, "edge points with grains inside and black beyond, outside every scrim").toBeGreaterThanOrEqual(8);
});

test("slot and seed counts in the DOM equal the published facts", async ({ page }) => {
  const f = await facts(page);
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => (window as unknown as { __eca: Eca }).__eca.debug().introDone, null, { timeout: 20000 });
  expect((await dbg(page)).n).toBe(f.seedhead_slots_latest!.value);

  await jump(page, "years", 0.065);
  await expect(page.locator("[data-year]")).toHaveText("1990", { timeout: 20000 });
  await expect(page.locator(".years-readout [data-seed-count]")).toHaveAttribute("data-seed-count", String(f.seedhead_slots_1990!.value));
  await expect(page.locator(".years-readout")).toContainText(`${f.seedhead_slots_1990!.value.toLocaleString("en-US")} SEEDS`);
  await expect.poll(async () => (await dbg(page)).slots).toBe(f.seedhead_slots_1990!.value);

  await jump(page, "weight", 0.2);
  await expect(page.locator(".weight-count")).toHaveAttribute("data-seed-count", String(f.seedhead_slots_latest!.value));
  await jump(page, "weight", 0.43);
  await expect(page.locator(".weight-count")).toHaveAttribute("data-seed-count", String(f.gdppc_ppp_countries_latest!.value));
  await expect.poll(async () => (await dbg(page)).n, { timeout: 5000 }).toBe(f.gdppc_ppp_countries_latest!.value);
});

test("S03b controls change the visible state; set aside hollows China and India; not-causal copy is on screen", async ({ page }) => {
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await jump(page, "weight", 0.2);
  await page.waitForSelector(".years-readout, .weight-count");
  await page.locator("#weight").getByRole("radio", { name: "COUNTRIES" }).click();
  await expect.poll(async () => (await dbg(page)).mode).toBe("countries");
  await page.locator("#weight").getByRole("radio", { name: "PEOPLE" }).click();
  await expect.poll(async () => (await dbg(page)).mode).toBe("people");
  await page.locator("#weight").getByRole("switch", { name: "CHINA + INDIA" }).click();
  await expect(page.locator("#weight").getByRole("switch", { name: "CHINA + INDIA" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __eca: { rest: () => { hollow: number } } }).__eca.rest().hollow), { timeout: 5000 }).toBeGreaterThan(2000);
  await expect(page.locator("#weight [data-not-causal]")).toBeVisible();
  await page.locator("#weight").getByRole("button", { name: "RESET" }).click();
  await expect(page.locator("#weight").getByRole("switch", { name: "CHINA + INDIA" })).toHaveAttribute("aria-checked", "false");
});

test("basis is never mixed in one view (S00, S03a, S03b)", async ({ page }) => {
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  for (const [id, p] of [["eight-billion", 0], ["years", 0.5], ["weight", 0.43], ["weight", 0.93]] as const) {
    await jump(page, id, p);
    await page.waitForTimeout(800);
    const text = await page.evaluate((i) => (document.getElementById(i) as HTMLElement).innerText.toUpperCase(), id);
    const bases = BASES.filter((b) => text.includes(b));
    expect(bases, `${id} @ ${p}`).toHaveLength(1);
  }
});

test("S03a: integer years only, the readout equals DR-1's median person, FOLLOW outlines a country", async ({ page }) => {
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await jump(page, "years", 0.5);
  const year = 1990 + Math.floor(((0.5 - 0.06) / 0.88) * 36); // p 0.06-0.94 maps to 36 integer years
  await expect(page.locator("[data-year]")).toHaveText(String(year), { timeout: 20000 });
  const sh = await (await page.request.get("data/seedhead/gdppc_ppp.json")).json() as { years: { year: number; median_person: { iso3: string } }[] };
  const mp = sh.years.find((y) => y.year === year)!.median_person.iso3;
  await expect(page.locator(".years-readout")).toContainText(`MIDDLE PERSON'S COUNTRY: ${mp}`);
  await page.waitForTimeout(300);
  expect((await dbg(page)).mix).toBe(0); // no fractional-year state is held after the 200ms crossfade
  await page.fill("#follow-input", "India");
  await expect(page.locator(".follow__line")).toContainText("INDIA · RANK");
});

test("404 on the year layouts shows COULD NOT LOAD + RETRY, and RETRY re-runs the fetch", async ({ page }) => {
  let block = true;
  await page.route("**/seedhead/gdppc_ppp.json", (r) => (block ? r.fulfill({ status: 404, body: "" }) : r.continue()));
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await jump(page, "years", 0.5);
  const alert = page.locator(".years-readout [role=alert]");
  await expect(alert).toContainText("COULD NOT LOAD SEEDHEAD/GDPPC_PPP (HTTP 404)", { timeout: 20000 });
  block = false;
  await alert.getByRole("button", { name: "RETRY" }).click();
  await expect(page.locator("[data-year]")).toBeVisible({ timeout: 20000 });
});
