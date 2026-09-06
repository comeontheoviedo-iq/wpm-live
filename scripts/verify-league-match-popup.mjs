import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shots = {
  results: ".pitchline-league-match-popup-results.png",
  fixtures: ".pitchline-league-match-popup-fixtures.png",
};
const probe = ".pitchline-league-match-popup-probe.json";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await context.newPage();

await page.addInitScript(() => {
  localStorage.setItem("pitchline-broadcast-dark-v1", "1");
  localStorage.setItem("pitchline-theme", "dark");
  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
});

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);

await page.goto(`http://localhost:3000/match-day/${deskId}/league`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForSelector('[data-league-dossier="1"]', { timeout: 45000 });
await page.waitForTimeout(2800);

async function openTab(label) {
  await page.locator(".player-dossier-tab", { hasText: label }).first().click();
  await page.waitForTimeout(700);
}

async function clickPreferredRow(scope) {
  const everton = page.locator(`${scope} [data-league-fx]`, {
    hasText: /Everton|Manchester United/i,
  }).first();
  const any = page.locator(`${scope} [data-league-fx]`).first();
  if (await everton.count()) {
    await everton.click();
    return "everton-united-ish";
  }
  if (await any.count()) {
    await any.click();
    return "first-row";
  }
  return null;
}

async function popupProbe() {
  return page.evaluate(() => {
    const root = document.querySelector("[data-league-match-popup]");
    const dialog = document.querySelector("[data-league-match-info]");
    if (!root || !dialog) {
      return { open: false };
    }
    const cs = getComputedStyle(root);
    const text = (dialog.textContent || "").replace(/\s+/g, " ").trim();
    return {
      open: true,
      position: cs.position,
      hasBackdrop: !!root.querySelector(".league-match-popup-backdrop"),
      hasScoreboard: !!dialog.querySelector(".league-match-popup-scoreboard"),
      hasMeta: !!dialog.querySelector(".league-match-popup-meta"),
      hasForm: /Form/i.test(text),
      softFailEvents: /events not loaded/i.test(text),
      softFailH2h: /Head-to-head not/i.test(text),
      snippet: text.slice(0, 260),
    };
  });
}

await openTab("Results");
await page.waitForSelector("[data-league-elite-results]", { timeout: 15000 });
const resultsClick = await clickPreferredRow("[data-league-elite-results]");
await page.waitForSelector("[data-league-match-popup]", { timeout: 8000 });
await page.waitForTimeout(450);
const resultsPopup = await popupProbe();
await page.locator('[data-league-dossier="1"]').screenshot({ path: shots.results });

// close via Escape then reopen fixtures
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const closedAfterEsc = await page.evaluate(
  () => !document.querySelector("[data-league-match-popup]")
);

await openTab("Fixtures");
await page.waitForSelector("[data-league-elite-fixtures]", { timeout: 15000 });
const fixturesClick = await clickPreferredRow("[data-league-elite-fixtures]");
await page.waitForSelector("[data-league-match-popup]", { timeout: 8000 });
await page.waitForTimeout(450);
const fixturesPopup = await popupProbe();
await page.locator('[data-league-dossier="1"]').screenshot({ path: shots.fixtures });

// close before leaving fixtures
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const closedAfterFixturesEsc = await page.evaluate(
  () => !document.querySelector("[data-league-match-popup]")
);

// table tab still works / no popup leak
await openTab("Table");
await page.waitForSelector("[data-league-elite-table]", { timeout: 15000 });
const tableOk = await page.evaluate(() => {
  const table = document.querySelector("[data-league-elite-table]");
  const popup = document.querySelector("[data-league-match-popup]");
  return {
    rows: table?.querySelectorAll("tbody tr").length || 0,
    popupGone: !popup,
  };
});

const ok =
  !!resultsClick &&
  !!fixturesClick &&
  resultsPopup.open &&
  fixturesPopup.open &&
  resultsPopup.hasScoreboard &&
  fixturesPopup.hasScoreboard &&
  resultsPopup.hasBackdrop &&
  closedAfterEsc &&
  closedAfterFixturesEsc &&
  tableOk.rows >= 10 &&
  tableOk.popupGone;

const out = {
  ok,
  resultsClick,
  fixturesClick,
  closedAfterEsc,
  closedAfterFixturesEsc,
  resultsPopup,
  fixturesPopup,
  tableOk,
  shots,
};
writeFileSync(probe, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
