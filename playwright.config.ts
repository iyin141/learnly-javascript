import { defineConfig } from "@playwright/test";

/**
 * Visual comparison against the Stitch mockups in design/stitch/<screen>/screen.png.
 * Run with: pnpm exec playwright test   (needs `docker compose up` + `pnpm seed`, and the
 * dev dependency @playwright/test + `playwright install chromium`).
 *
 * Mockup PNGs are used as the baseline, so a mismatch is reported (soft assertion) rather than
 * silently re-baselined. Never run with --update-snapshots against design/.
 */
export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "./design/stitch",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost",
    colorScheme: "light",
    reducedMotion: "reduce",
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.12, animations: "disabled" } },
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } }, grep: /@desktop/ },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, grep: /@mobile/ },
  ],
});
