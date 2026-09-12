/**
 * CoComms HOMEPAGE TRAILER frames — Strasbourg vs Monaco.
 * Salesy / wow energy: pitch, scrolling ticker, STATS, HT vibe, LEAGUE/HOOKS.
 * NO data-viz flash spam. Login via minted pitchline_session JWT (chris@).
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
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
  document.documentElement.classList.remove("light");
});

async function dismissOverlays() {
  const clearBtn = page.getByTitle(/Force-dismiss all live intel/i);
  if (await clearBtn.count()) {
    await clearBtn.first().click({ force: true }).catch(() => null);
  }
  await page.evaluate(() => {
    document
      .querySelectorAll(
        '[role="dialog"] button[title="Dismiss"], button[title="Dismiss"], button[aria-label="Close dossier"]'
      )
      .forEach((b) => b.click());
    document.querySelectorAll(".live-flash").forEach((el) => {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    });
    document.querySelectorAll(".live-flash-viz").forEach((el) => {
      el.style.visibility = "hidden";
    });
  });
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(250);
}

async function shot(name) {
  await dismissOverlays();
  const clutter = await page.evaluate(() => {
    const flashes = [...document.querySelectorAll(".live-flash")].filter((el) => {
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.opacity !== "0" && s.display !== "none";
    });
    const viz = [...document.querySelectorAll(".live-flash-viz")].filter((el) => {
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.opacity !== "0" && s.display !== "none";
    });
    return { flashVisible: flashes.length, vizVisible: viz.length };
  });
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("SHOT", name, clutter);
  return clutter;
}

async function clickNav(label) {
  const tab = page.getByRole("link", { name: new RegExp(`^${label}`, "i") }).or(
    page.getByRole("button", { name: new RegExp(`^${label}`, "i") })
  );
  if (await tab.count()) {
    await tab.first().click().catch(() => null);
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

const probe = { who: null, shots: {}, meta: {} };

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(900);
await shot("01-homepage.png");

await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForSelector("body", { timeout: 60000 });
await page.waitForTimeout(4000);

probe.who = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return {
    hasChris: /chris@ronniedogmedia\.com/i.test(text) || /\bCB\b/.test(text),
    hasDemo: /demo@pitchline\.app|tester@cocomms/i.test(text),
    hasStras: /Strasbourg/i.test(text),
    hasMonaco: /Monaco/i.test(text),
    scorebug:
      document.querySelector(".scorebug")?.innerText?.replace(/\s+/g, " ").trim()?.slice(0, 140) ||
      null,
    ticker: !!document.querySelector('[data-cocomms="action-ticker"]'),
    tickerEmpty: !!document.querySelector('[data-cocomms="action-ticker-empty"]'),
    pitchCards: document.querySelectorAll('[data-pitch-card="1"]').length,
    statsBtn: !!document.querySelector('[aria-label="STATS"]'),
    htText: /\bHT\b|Half.?time|countdown/i.test(text),
  };
});
console.log("WHO", JSON.stringify(probe.who, null, 2));

await dismissOverlays();
await page.waitForTimeout(600);
probe.shots.desk = await shot("10-desk-live.png");

// Ticker motion frames (CSS marquee advances between shots)
await page.waitForTimeout(1800);
probe.shots.tickerA = await shot("10b-ticker-a.png");
await page.waitForTimeout(2200);
probe.shots.tickerB = await shot("10c-ticker-b.png");

// On-air clean chrome
await page.keyboard.press("o");
await page.waitForTimeout(700);
await dismissOverlays();
probe.shots.onair = await shot("11-desk-onair.png");
await page.waitForTimeout(1600);
probe.shots.onairTicker = await shot("11b-onair-ticker.png");

// STATS overlay (allowed — intentional poster, not spam flash)
const statsBtn = page.getByLabel("STATS");
if (await statsBtn.count()) {
  const disabled = await statsBtn.isDisabled().catch(() => true);
  probe.meta.statsDisabled = disabled;
  if (!disabled) {
    await statsBtn.click();
    await page.waitForTimeout(900);
    probe.shots.stats = await shot("12-stats.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
}

// Scripts + Research (quick)
await clickNav("Scripts");
await page.waitForTimeout(900);
await dismissOverlays();
probe.shots.scripts = await shot("13-scripts.png");

await clickNav("Research");
await page.waitForTimeout(1000);
await dismissOverlays();
probe.shots.research = await shot("14-research.png");

// Back to desk for posters
await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(2800);
await dismissOverlays();
await page.keyboard.press("o");
await page.waitForTimeout(500);
await dismissOverlays();

const leagueBtn = page.getByLabel("LEAGUE poster");
if (await leagueBtn.count()) {
  const disabled = await leagueBtn.isDisabled().catch(() => true);
  if (!disabled) {
    await leagueBtn.click();
    await page.waitForTimeout(850);
    probe.shots.league = await shot("15-league-poster.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
  }
}

const hooksBtn = page.getByLabel("HOOKS poster");
if (await hooksBtn.count()) {
  const disabled = await hooksBtn.isDisabled().catch(() => true);
  if (!disabled) {
    await hooksBtn.click();
    await page.waitForTimeout(850);
    probe.shots.hooks = await shot("16-hooks-poster.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
  }
}

await dismissOverlays();
probe.shots.clean = await shot("20-desk-clean.png");

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(700);
probe.shots.cta = await shot("21-cta.png");

writeFileSync("tmp/demo-video-trailer/probe.json", JSON.stringify(probe, null, 2));
console.log("DONE", JSON.stringify(probe, null, 2));
await browser.close();
