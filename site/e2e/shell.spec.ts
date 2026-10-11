import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const isLocal = (url: string) => /^(http:\/\/(localhost|127\.0\.0\.1):\d+\/|data:|blob:)/.test(url);
type Eca = { jumpTo: (i: string, p?: number) => void; getProgress: (id: string) => number };
const eca = (page: Page) => page.evaluateHandle(() => (window as unknown as { __eca: Eca }).__eca);
const IDS = ["eight-billion", "sources", "years", "weight", "catch-up", "lab", "likeness", "evidence", "atlas", "resorted"];

async function open(page: Page) {
  await page.goto("");
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape"); // complete the intro
}

test("shell: title, ten scene tracks, hero headline is static HTML ghosted from first paint", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle("Economic Atlas");
  const h1 = page.locator("h1[data-hero]");
  await expect(h1).toHaveText("The world, explained through economic forces.");
  const op = await h1.locator(".wr-word").first().evaluate((w) => getComputedStyle(w).opacity);
  expect(Number(op)).toBeGreaterThan(0.5);
  await expect(page.locator("section.track")).toHaveCount(10);
});

test("intro: SKIP visible at once, nav enters on skip, Esc/wheel complete it", async ({ page, isMobile }) => {
  await page.goto("");
  const skip = page.getByRole("button", { name: "SKIP INTRO" });
  await expect(skip).toBeVisible({ timeout: 1000 });
  await skip.click();
  const nav = isMobile ? page.locator(".nav-pill.is-fixed") : page.locator(".nav-bar.is-fixed");
  await expect(nav).not.toHaveClass(/is-hidden/, { timeout: 400 });
  await page.waitForFunction(() => (window as unknown as { __eca: { debug: () => { introDone: boolean } } }).__eca.debug().introDone, null, { timeout: 5000 });
});

test("intro plays once per session; REPLAY plays it again and completes", async ({ page }) => {
  type I = { __eca: { debug: () => { introDone: boolean }; introStats: () => { playing: boolean } } };
  await page.goto("");
  await page.waitForFunction(() => (window as unknown as I).__eca.debug().introDone && !(window as unknown as I).__eca.introStats().playing, null, { timeout: 15000 });
  await page.reload();
  await page.waitForFunction(() => (window as unknown as I).__eca?.debug, null);
  expect(await page.evaluate(() => (window as unknown as I).__eca.introStats().playing)).toBe(false);
  await page.waitForFunction(() => (window as unknown as I).__eca.debug().introDone, null, { timeout: 5000 });
  await page.locator("button:visible", { hasText: "REPLAY INTRO" }).first().click();
  expect(await page.evaluate(() => (window as unknown as I).__eca.introStats().playing)).toBe(true);
  await page.waitForFunction(() => !(window as unknown as I).__eca.introStats().playing && (window as unknown as I).__eca.debug().introDone, null, { timeout: 15000 });
});

test("zero external requests while visiting every scene", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => { if (!isLocal(r.url())) external.push(r.url()); });
  await page.goto("", { waitUntil: "networkidle" });
  const h = await eca(page);
  for (const id of IDS) { await h.evaluate((e, i) => e.jumpTo(i), id); await page.waitForTimeout(150); }
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
});

test("desktop nav: keyboard jump, aria-current, focus, back", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop bar only");
  await open(page);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  await expect(nav.getByRole("link", { name: "EIGHT BILLION" })).toHaveAttribute("aria-current", "location");
  const years = nav.getByRole("link", { name: "YEARS" });
  await years.focus();
  await page.keyboard.press("Enter");
  await expect(years).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/#years$/);
  await expect(page.locator("#years-title")).toBeFocused();
  const p = await (await eca(page)).evaluate((e) => e.getProgress("years"));
  expect(Math.abs(p - 0.7)).toBeLessThan(0.01);
  await nav.getByRole("link", { name: "WEIGHT" }).click();
  await expect(page).toHaveURL(/#weight$/);
  await page.goBack();
  await expect(page).toHaveURL(/#years$/);
});

test("T/M menu pill: open, Esc closes and returns focus, item jumps", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "T/M pill only");
  await open(page);
  const pill = page.locator(".nav-pill.is-fixed .menu-pill");
  await expect(pill).toContainText("EIGHT BILLION");
  await pill.click();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(pill).toBeFocused();
  await pill.click();
  await page.locator("#menu-panel").getByRole("link", { name: "WEIGHT" }).click();
  await expect(page).toHaveURL(/#weight$/);
  await expect(pill).toContainText("WEIGHT");
});

test("reduced motion renders in flow: no pinned stages, static discs", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  const sticky = await page.evaluate(() => [...document.querySelectorAll(".stage")].filter((s) => getComputedStyle(s).position === "sticky").length);
  expect(sticky).toBe(0);
  await expect(page.locator(".scene-years .static-disc canvas")).toHaveCount(4, { timeout: 15000 });
  await expect(page.locator(".scene-weight .static-disc canvas")).toHaveCount(5);
  await ctx.close();
});

for (const [id, p] of [["eight-billion", 0], ["years", 0.5], ["weight", 0.43]] as const) {
  test(`axe: no serious or critical violations (${id})`, async ({ page }) => {
    await open(page);
    await (await eca(page)).evaluate((e, [i, q]) => e.jumpTo(i as string, q as number), [id, p]);
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("production build excludes the dev gallery", async ({ page }) => {
  await page.goto("?gallery");
  await expect(page.locator(".gallery")).toHaveCount(0);
  await expect(page.locator("section.track")).toHaveCount(10);
});
