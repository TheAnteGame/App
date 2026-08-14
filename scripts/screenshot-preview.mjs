#!/usr/bin/env node
/**
 * Visual QA: screenshot /preview (mock-data render of the Phase 2 dashboard)
 * in both states, desktop + mobile. Requires a running server with
 * ALLOW_PREVIEW=1 (e.g. `ALLOW_PREVIEW=1 npm run dev`). Playwright + the
 * preinstalled Chromium at PLAYWRIGHT_BROWSERS_PATH.
 * Usage: node scripts/screenshot-preview.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "/tmp/shots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(
  process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {},
);
const shots = [
  { name: "pre-desktop", url: `${base}/preview?state=pre`, width: 1380, height: 900 },
  { name: "post-desktop", url: `${base}/preview?state=post`, width: 1380, height: 900 },
  { name: "pre-mobile", url: `${base}/preview?state=pre`, width: 390, height: 844 },
  { name: "post-mobile", url: `${base}/preview?state=post`, width: 390, height: 844 },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
  await page.goto(s.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600); // let flip/rise animations land
  await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: true });
  console.log(`${s.name}.png`);
  await page.close();
}
await browser.close();
