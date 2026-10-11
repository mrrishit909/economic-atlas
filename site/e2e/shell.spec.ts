import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const isLocal = (url: string) => /^(http:\/\/(localhost|127\.0\.0\.1):\d+\/|data:|blob:)/.test(url);
type Hook = { __eca: { getProgress: (id: string) => number } };

async function open(page: Page) {
  await page.goto("");
  await page.evaluate(() => document.fonts.ready);
}

test("shell renders nine placeholder scenes", async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle("Economic Atlas");
  await expect(page.locator("section.track")).toHaveCount(9);
  await expect(page.locator("#s00-title")).toContainText("S00 Opening");
  await expect(page.locator("#s08-title")).toContainText("S08 Closing");
});

test("zero external requests while visiting every scene", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => { if (!isLocal(r.url())) external.push(r.url()); });
  await page.goto("", { waitUntil: "networkidle" });
  for (let i = 0; i < 9; i++) {
    await page.evaluate((id) => (window as unknown as { __eca: { jumpTo: (i: string) => void } }).__eca.jumpTo(id), `s0${i}`);
    await page.waitForTimeout(100);
  }
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
});

test("desktop nav: keyboard jump, aria-current, focus, back", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "desktop bar only");
  await open(page);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  await expect(nav).toBeVisible();
  const s00 = nav.getByRole("link", { name: "S00" });
  await expect(s00).toHaveAttribute("aria-current", "location");
  const s03 = nav.getByRole("link", { name: "S03" });
  await s03.focus();
  await page.keyboard.press("Enter");
  await expect(s03).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/#s03$/);
  await expect(page.locator("#s03-title")).toBeFocused();
  const p = await page.evaluate(() => (window as unknown as Hook).__eca.getProgress("s03"));
  expect(Math.abs(p - 0.3)).toBeLessThan(0.01);
  await nav.getByRole("link", { name: "S06" }).click();
  await expect(page).toHaveURL(/#s06$/);
  await page.goBack();
  await expect(page).toHaveURL(/#s03$/);
  await expect(s03).toHaveAttribute("aria-current", "location");
});

test("mobile menu pill: open, Esc closes and returns focus, item jumps", async ({ page, isMobile }) => {
  test.skip(!isMobile, "T/M pill only");
  await open(page);
  const pill = page.locator(".nav-pill.is-fixed .menu-pill");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("S00");
  await pill.click();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("#menu-panel");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(pill).toBeFocused();
  await pill.click();
  await panel.getByRole("link", { name: "S04" }).click();
  await expect(page).toHaveURL(/#s04$/);
  await expect(pill).toContainText("S04");
});

test("reduced motion renders in flow: no pinned stages, no blur", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  const sticky = await page.evaluate(() => [...document.querySelectorAll(".stage")].filter((s) => getComputedStyle(s).position === "sticky").length);
  expect(sticky).toBe(0);
  const blurred = await page.evaluate(() => [...document.querySelectorAll(".wr-word")].filter((w) => getComputedStyle(w).filter !== "none").length);
  expect(blurred).toBe(0);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThan(9 * 900 * 1.2); // 9 scenes of about one viewport, not 250vh tracks
  await ctx.close();
});

test("axe: no serious or critical violations", async ({ page }) => {
  await open(page);
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("production build excludes the dev gallery", async ({ page }) => {
  await page.goto("?gallery");
  await expect(page.locator(".gallery")).toHaveCount(0);
  await expect(page.locator("section.track")).toHaveCount(9);
});
