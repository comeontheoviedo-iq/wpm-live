/** Recapture STATS + LEAGUE/HOOKS without Esc-before-shot. */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";

const MATCH_ID = "cmtuguaof0004rarmb9711ja5";
const BASE = "https://www.cocomms.online";
const OUT = "tmp/demo-video-trailer/frames";
const TOKEN = readFileSync("/tmp/.cocomms_session_jwt", "utf8").trim();
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
await context.addCookies([
  {
    name: "pitchline_session",
    value: TOKEN,
    domain: "www.cocomms.online",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  },
]);
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem("pitchline-broadcast-dark-v1", "1");
  localStorage.setItem("pitchline-theme", "dark");
  document.documentElement.classList.add("dark");
});

async function clearFlashesOnly() {
  const clearBtn = page.getByTitle(/Force-dismiss all live intel/i);
  if (await clearBtn.count()) {
    await clearBtn.first().click({ force: true }).catch(() => null);
  }
  await page.evaluate(() => {
    document.querySelectorAll(".live-flash,.live-flash-viz").forEach((el) => {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    });
  });
}

await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(3500);
await clearFlashesOnly();
await page.keyboard.press("o");
await page.waitForTimeout(600);
await clearFlashesOnly();

// STATS — do NOT Escape before shot
const statsBtn = page.getByLabel("STATS");
console.log("stats disabled?", await statsBtn.isDisabled().catch(() => "missing"));
if (await statsBtn.count() && !(await statsBtn.isDisabled())) {
  await statsBtn.click();
  await page.waitForTimeout(1000);
  const open = await page.locator('[data-cocomms="stats-overlay"]').count();
  console.log("stats overlay count", open);
  await page.screenshot({ path: join(OUT, "12-stats.png"), fullPage: false });
  console.log("SHOT 12-stats.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// LEAGUE poster
const leagueBtn = page.getByLabel("LEAGUE poster");
if (await leagueBtn.count() && !(await leagueBtn.isDisabled())) {
  await leagueBtn.click();
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log("league text head", text.replace(/\s+/g, " ").slice(0, 120));
  await page.screenshot({ path: join(OUT, "15-league-poster.png"), fullPage: false });
  console.log("SHOT 15-league-poster.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// HOOKS poster
const hooksBtn = page.getByLabel("HOOKS poster");
if (await hooksBtn.count() && !(await hooksBtn.isDisabled())) {
  await hooksBtn.click();
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log("hooks text head", text.replace(/\s+/g, " ").slice(0, 120));
  await page.screenshot({ path: join(OUT, "16-hooks-poster.png"), fullPage: false });
  console.log("SHOT 16-hooks-poster.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// Pitch hero crop-ish: clean on-air after posters
await clearFlashesOnly();
await page.screenshot({ path: join(OUT, "20-desk-clean.png"), fullPage: false });
console.log("SHOT 20-desk-clean.png");

// Also grab HT period button state for vibe — click HT control if present (visual only)
const ht = page.getByRole("button", { name: /^HT$/i }).or(page.getByTitle(/Half-time/i));
console.log("ht buttons", await ht.count());

await browser.close();
console.log("DONE");
