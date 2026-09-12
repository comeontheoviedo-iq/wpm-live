/**
 * Capture clean Matchday Cut frames: Strasbourg vs Monaco desk.
 * Login via minted pitchline_session JWT (chris@ronniedogmedia.com).
 * Suppresses live intel / data-viz flash overlays before each shot.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const MATCH_ID = "cmtuguaof0004rarmb9711ja5";
const BASE = "https://www.cocomms.online";
const OUT = "tmp/demo-video-stras/frames";
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
  // Force-dismiss live intel flashes (Clear button + Esc)
  const clearBtn = page.getByTitle(/Force-dismiss all live intel/i);
  if (await clearBtn.count()) {
    await clearBtn.first().click({ force: true }).catch(() => null);
  }
  await page.evaluate(() => {
    document
      .querySelectorAll('[role="dialog"] button[title="Dismiss"], button[title="Dismiss"], button[aria-label="Close dossier"]')
      .forEach((b) => b.click());
    // Hide any leftover flash nodes just in case
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
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
}

async function shot(name) {
  await dismissOverlays();
  // Confirm no visible live-flash / data-viz flash before capture
  const clutter = await page.evaluate(() => {
    const flashes = [...document.querySelectorAll(".live-flash")].filter((el) => {
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.opacity !== "0" && s.display !== "none";
    });
    const viz = [...document.querySelectorAll(".live-flash-viz, [class*='DataViz']")].filter((el) => {
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.opacity !== "0" && s.display !== "none" && el.offsetParent !== null;
    });
    return { flashVisible: flashes.length, vizVisible: viz.length };
  });
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("SHOT", name, clutter);
  return clutter;
}

async function clickNav(label) {
  // Top desk nav tabs
  const tab = page.getByRole("link", { name: new RegExp(`^${label}`, "i") }).or(
    page.getByRole("button", { name: new RegExp(`^${label}`, "i") })
  );
  if (await tab.count()) {
    await tab.first().click().catch(() => null);
    await page.waitForTimeout(800);
    return true;
  }
  // fallback text click
  const el = page.locator(`text=${label}`).first();
  if (await el.count()) {
    await el.click().catch(() => null);
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

const probe = { who: null, shots: {}, posters: {} };

// --- 01 Homepage ---
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);
await shot("01-homepage.png");

// --- Desk ---
await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForSelector("[data-desk-mode], .scorebug, body", { timeout: 60000 });
await page.waitForTimeout(3500);

probe.who = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return {
    hasChris: /chris@ronniedogmedia\.com/i.test(text) || /CB\b/.test(text),
    hasDemo: /demo@pitchline\.app|tester@cocomms/i.test(text),
    hasStras: /Strasbourg/i.test(text),
    hasMonaco: /Monaco/i.test(text),
    scorebug: document.querySelector(".scorebug")?.innerText?.replace(/\s+/g, " ").trim()?.slice(0, 120) || null,
    flashCount: document.querySelectorAll(".live-flash").length,
    pitchCards: document.querySelectorAll('[data-pitch-card="1"]').length,
    onAir: !!document.querySelector(".onair-desk, [data-desk-mode='onair']"),
  };
});
console.log("WHO", JSON.stringify(probe.who, null, 2));

await dismissOverlays();
await page.waitForTimeout(800);
probe.shots.desk = await shot("10-desk-live.png");

// Enable On-air mode (O) for clean chrome
await page.keyboard.press("o");
await page.waitForTimeout(700);
await dismissOverlays();
probe.shots.onair = await shot("11-desk-onair.png");

// Scripts route/tab
await clickNav("Scripts");
await page.waitForTimeout(1000);
await dismissOverlays();
probe.shots.scripts = await shot("12-scripts.png");

// Notes
await clickNav("Notes");
await page.waitForTimeout(1000);
await dismissOverlays();
probe.shots.notes = await shot("13-notes.png");

// Research
await clickNav("Research");
await page.waitForTimeout(1200);
await dismissOverlays();
probe.shots.research = await shot("14-research.png");

// Back to desk for posters — navigate again to ensure desk chrome
await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(2500);
await dismissOverlays();
await page.keyboard.press("o"); // on-air
await page.waitForTimeout(500);
await dismissOverlays();

// Probe poster buttons
probe.posters = await page.evaluate(() => {
  const league = document.querySelector('[aria-label="LEAGUE poster"]');
  const hooks = document.querySelector('[aria-label="HOOKS poster"]');
  const viz = document.querySelector('[aria-label="DATA VIZ"]');
  return {
    leagueDisabled: league?.disabled ?? null,
    hooksDisabled: hooks?.disabled ?? null,
    vizPresent: !!viz,
    leagueText: league?.innerText?.trim() || null,
    hooksText: hooks?.innerText?.trim() || null,
  };
});
console.log("POSTERS", probe.posters);

// LEAGUE poster if available
const leagueBtn = page.getByLabel("LEAGUE poster");
if (await leagueBtn.count()) {
  const disabled = await leagueBtn.isDisabled().catch(() => true);
  if (!disabled) {
    await leagueBtn.click();
    await page.waitForTimeout(900);
    probe.shots.leaguePoster = await shot("15-league-poster.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
}

// HOOKS poster if available
const hooksBtn = page.getByLabel("HOOKS poster");
if (await hooksBtn.count()) {
  const disabled = await hooksBtn.isDisabled().catch(() => true);
  if (!disabled) {
    await hooksBtn.click();
    await page.waitForTimeout(900);
    probe.shots.hooksPoster = await shot("16-hooks-poster.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
}

// DATA VIZ as reopenable poster (from Notes) — not auto flash spam
const vizBtn = page.getByLabel("DATA VIZ");
if (await vizBtn.count()) {
  await dismissOverlays();
  await vizBtn.click();
  await page.waitForTimeout(1200);
  // Capture with intentional reopenable viz (allowed) — but if none, still desk
  probe.shots.dataViz = await shot("17-data-viz-reopen.png");
  await dismissOverlays();
}

// League dossier / page (clean)
await page.goto(`${BASE}/match-day/${MATCH_ID}/league`, {
  waitUntil: "networkidle",
  timeout: 90000,
}).catch(() => null);
await page.waitForTimeout(1500);
await dismissOverlays();
probe.shots.league = await shot("18-league.png");

// Dossier via desk — open a player if possible
await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(2500);
await dismissOverlays();
await page.keyboard.press("o");
await page.waitForTimeout(400);
await dismissOverlays();

// Try click first pitch card
const card = page.locator('[data-pitch-card="1"]').first();
if (await card.count()) {
  await card.click({ force: true }).catch(() => null);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    // keep dossier, hide flashes
    document.querySelectorAll(".live-flash").forEach((el) => {
      el.style.visibility = "hidden";
    });
  });
  probe.shots.dossier = await shot("19-dossier.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// Final clean on-air desk with action ticker if present
await dismissOverlays();
probe.shots.finalDesk = await shot("20-desk-clean.png");

// Homepage CTA
await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
probe.shots.cta = await shot("21-cta.png");

writeFileSync("tmp/demo-video-stras/probe.json", JSON.stringify(probe, null, 2));
console.log("DONE", JSON.stringify(probe, null, 2));
await browser.close();
