import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shot = ".pitchline-dossier-league-craft-nufc.png";
const probe = ".pitchline-dossier-league-craft-probe.json";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
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
await page.waitForTimeout(2500);

const craft = await page.evaluate(() => {
  const el = document.querySelector('[data-league-dossier="1"]');
  if (!el) return { found: false };
  const cs = getComputedStyle(el);
  const name = el.querySelector(".player-dossier-name")?.textContent?.trim() || null;
  const title = el.querySelector(".player-dossier-title")?.textContent?.trim() || null;
  const verdict = el.querySelector("[data-dossier-verdict]");
  const tabs = [...el.querySelectorAll(".player-dossier-tab")].map((t) => ({
    label: (t.textContent || "").replace(/\s+/g, " ").trim(),
    active: t.classList.contains("is-active"),
    borderRadius: getComputedStyle(t).borderRadius,
  }));
  const tabLabels = tabs.map((t) => (t.label || "").replace(/\s*\(.*\)$/, "").trim());
  const expected = ["Overview", "Table", "Results", "Fixtures", "History", "Notes"];
  const tabsMatch =
    tabLabels.length === expected.length &&
    expected.every((x, i) => tabLabels[i] === x);
  const underline =
    tabs.some((t) => t.active) &&
    tabs.every((t) => parseFloat(t.borderRadius) <= 2 || t.borderRadius === "0px");
  const hasLoudName = (() => {
    const n = el.querySelector(".player-dossier-name");
    if (!n) return false;
    const fs = parseFloat(getComputedStyle(n).fontSize);
    const fw = parseInt(getComputedStyle(n).fontWeight, 10);
    return fs >= 20 && fw >= 700;
  })();
  const banned = /understat|sportspro|sports.?pro/i.test(el.textContent || "");
  return {
    found: true,
    position: cs.position,
    name,
    title,
    hasVerdict: !!verdict,
    verdictLabel: verdict?.querySelector(".player-dossier-verdict-label")?.textContent?.trim() || null,
    tabs,
    tabLabels,
    tabsMatch,
    underlineTabs: underline,
    hasLoudName,
    craftAttr: el.getAttribute("data-dossier-craft"),
    bannedVendorNames: banned,
  };
});

const tabResults = {};
for (const label of ["Table", "Results", "Fixtures", "History", "Notes", "Overview"]) {
  await page.locator(".player-dossier-tab", { hasText: label }).first().click();
  await page.waitForTimeout(400);
  tabResults[label] = await page.evaluate((lab) => {
    const el = document.querySelector('[data-league-dossier="1"]');
    const active = el?.querySelector(".player-dossier-tab.is-active")?.textContent?.replace(/\s+/g, " ").trim();
    const body = el?.querySelector(".player-dossier-body")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 160);
    return { active, bodySnippet: body };
  }, label);
}

// Click a result row if present → match info
await page.locator(".player-dossier-tab", { hasText: "Results" }).first().click();
await page.waitForTimeout(400);
let matchInfo = { clicked: false };
const fxBtn = page.locator("[data-league-fx]").first();
if (await fxBtn.count()) {
  await fxBtn.click();
  await page.waitForTimeout(300);
  matchInfo = await page.evaluate(() => {
    const body = document.querySelector('[data-league-dossier="1"] .player-dossier-body');
    const text = body?.textContent || "";
    return {
      clicked: true,
      hasMatchInfo: /Match info/i.test(text),
      snippet: text.replace(/\s+/g, " ").trim().slice(0, 200),
    };
  });
}

await page.locator(".player-dossier-tab", { hasText: "Overview" }).first().click();
await page.waitForTimeout(300);
await page.locator('[data-league-dossier="1"]').screenshot({ path: shot });

const result = {
  ok:
    craft.found &&
    craft.position === "relative" &&
    craft.hasVerdict &&
    craft.tabsMatch &&
    craft.hasLoudName &&
    craft.craftAttr === "v2" &&
    /verdict/i.test(craft.verdictLabel || "") &&
    !craft.bannedVendorNames &&
    (matchInfo.clicked ? matchInfo.hasMatchInfo : true),
  craft,
  tabResults,
  matchInfo,
  shot,
};
writeFileSync(probe, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 2);
