import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shots = {
  table: ".pitchline-league-table-elite-nufc.png",
  results: ".pitchline-league-results-elite-nufc.png",
  fixtures: ".pitchline-league-fixtures-elite-nufc.png",
};
const probe = ".pitchline-league-elite-probe.json";

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

const shell = await page.evaluate(() => {
  const el = document.querySelector('[data-league-dossier="1"]');
  if (!el) return { found: false };
  const banned = /understat|sportspro|sports.?pro/i.test(el.textContent || "");
  return {
    found: true,
    elite: el.getAttribute("data-league-elite"),
    craft: el.getAttribute("data-dossier-craft"),
    tabs: [...el.querySelectorAll(".player-dossier-tab")].map((t) =>
      (t.textContent || "").replace(/\s+/g, " ").trim()
    ),
    bannedVendorNames: banned,
  };
});

async function openTab(label) {
  await page.locator(".player-dossier-tab", { hasText: label }).first().click();
  await page.waitForTimeout(700);
}

await openTab("Table");
await page.waitForSelector("[data-league-elite-table]", { timeout: 15000 });
const tableProbe = await page.evaluate(() => {
  const panel = document.querySelector("[data-league-elite-table]");
  const rows = [...panel?.querySelectorAll("tbody tr") || []];
  const formPills = panel?.querySelectorAll(".league-elite-form-pill").length || 0;
  const crests = panel?.querySelectorAll(".league-elite-crest").length || 0;
  const zones = {
    cl: panel?.querySelectorAll("tr.is-zone-cl").length || 0,
    el: panel?.querySelectorAll("tr.is-zone-el").length || 0,
    ecl: panel?.querySelectorAll("tr.is-zone-ecl").length || 0,
    rel: panel?.querySelectorAll("tr.is-zone-rel").length || 0,
  };
  const desk = panel?.querySelectorAll("tr.is-desk").length || 0;
  const sticky = (() => {
    const th = panel?.querySelector("thead th");
    if (!th) return false;
    return getComputedStyle(th).position === "sticky";
  })();
  const cols = [...(panel?.querySelectorAll("thead th") || [])].map((th) =>
    (th.textContent || "").trim()
  );
  return {
    rows: rows.length,
    formPills,
    crests,
    zones,
    desk,
    sticky,
    cols,
    snippet: panel?.textContent?.replace(/\s+/g, " ").trim().slice(0, 180) || "",
  };
});
await page.locator('[data-league-dossier="1"]').screenshot({ path: shots.table });

await openTab("Results");
await page.waitForSelector("[data-league-elite-results]", { timeout: 15000 });
// Prefer a desk-club result (W/D/L edge) if present
const deskResult = page.locator("[data-league-elite-results] .league-elite-fx-row.is-w, [data-league-elite-results] .league-elite-fx-row.is-d, [data-league-elite-results] .league-elite-fx-row.is-l").first();
const anyResult = page.locator("[data-league-elite-results] [data-league-fx]").first();
if (await deskResult.count()) {
  await deskResult.click();
} else if (await anyResult.count()) {
  await anyResult.click();
}
await page.waitForTimeout(400);

const resultsProbe = await page.evaluate(() => {
  const panel = document.querySelector("[data-league-elite-results]");
  const groups = panel?.querySelectorAll(".league-elite-fx-group").length || 0;
  const rows = panel?.querySelectorAll("[data-league-fx]").length || 0;
  const crests = panel?.querySelectorAll(".league-elite-crest").length || 0;
  const scores = panel?.querySelectorAll(".league-elite-fx-score-nums").length || 0;
  const wdl = panel?.querySelectorAll(".league-elite-wdl.is-w, .league-elite-wdl.is-d, .league-elite-wdl.is-l").length || 0;
  const hasMatchInfo = !!document.querySelector("[data-league-match-info]");
  return {
    groups,
    rows,
    crests,
    scores,
    wdl,
    hasMatchInfo,
    snippet: panel?.textContent?.replace(/\s+/g, " ").trim().slice(0, 220) || "",
  };
});
await page.locator('[data-league-dossier="1"]').screenshot({ path: shots.results });

await openTab("Fixtures");
await page.waitForSelector("[data-league-elite-fixtures]", { timeout: 15000 });
const fxBtn = page.locator("[data-league-elite-fixtures] [data-league-fx]").first();
if (await fxBtn.count()) {
  await fxBtn.click();
  await page.waitForTimeout(350);
}
const fixturesProbe = await page.evaluate(() => {
  const panel = document.querySelector("[data-league-elite-fixtures]");
  const groups = panel?.querySelectorAll(".league-elite-fx-group").length || 0;
  const rows = panel?.querySelectorAll("[data-league-fx]").length || 0;
  const crests = panel?.querySelectorAll(".league-elite-crest").length || 0;
  const times = panel?.querySelectorAll(".league-elite-fx-time").length || 0;
  const hasMatchInfo = !!document.querySelector("[data-league-match-info]");
  return {
    groups,
    rows,
    crests,
    times,
    hasMatchInfo,
    snippet: panel?.textContent?.replace(/\s+/g, " ").trim().slice(0, 220) || "",
  };
});
await page.locator('[data-league-dossier="1"]').screenshot({ path: shots.fixtures });

const ok =
  shell.found &&
  shell.elite === "1" &&
  shell.craft === "v2" &&
  !shell.bannedVendorNames &&
  tableProbe.rows >= 10 &&
  tableProbe.sticky &&
  tableProbe.formPills > 0 &&
  tableProbe.crests > 0 &&
  tableProbe.cols.join("|") === "#|Club|P|W|D|L|GD|Pts|Form" &&
  resultsProbe.groups >= 1 &&
  resultsProbe.scores >= 1 &&
  resultsProbe.hasMatchInfo &&
  fixturesProbe.groups >= 1 &&
  fixturesProbe.hasMatchInfo;

const result = {
  ok,
  shell,
  tableProbe,
  resultsProbe,
  fixturesProbe,
  shots,
};
writeFileSync(probe, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(ok ? 0 : 2);
