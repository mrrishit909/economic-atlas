import { defineConfig, devices } from "@playwright/test";

// Always runs against the production build (vite preview), never the dev server.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // other agents share this CPU (software WebGL suites); more than 2 workers times out
  workers: 2,
  // shared machine: one retry absorbs software-WebGL timeouts (ED #14, #28)
  retries: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4341/economic-atlas/" },
  webServer: {
    command: "npm run build && node tests/serve.mjs",
    url: "http://localhost:4341/economic-atlas/",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
