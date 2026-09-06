import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shot = ".pitchline-structural-upgrade-nufc.png";

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

await page.goto(`http://localhost:3000/match-day/${deskId}`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForSelector("[data-desk-mode]", { timeout: 45000 });
await page.waitForSelector('[data-pitch-card="1"]', { timeout: 45000 });
await page.waitForTimeout(1800);

// Dismiss intel popups so scorebug/tokens are visible in screenshot
await page.evaluate(() => {
  document.querySelectorAll('[role="dialog"] button[title="Dismiss"]').forEach((b) => b.click());
});
await page.waitForTimeout(600);

const pre = await page.evaluate(() => {
  const bug = document.querySelector(".scorebug");
  const bs = bug ? getComputedStyle(bug) : null;
  const score = document.querySelector(".scorebug-score");
  const clock = document.querySelector(".scorebug-clock");
  const team = document.querySelector(".scorebug-team");
  const token = document.querySelector("[data-pitch-token]");
  const tokenEl = token?.querySelector(".pitch-token") || token?.firstElementChild;
  const ts = tokenEl ? getComputedStyle(tokenEl) : null;
  const flash = document.querySelector(".live-flash");
  const root = document.querySelector("[data-desk-mode]");
  return {
    mode: root?.getAttribute("data-desk-mode"),
    hasInvestigate: root?.classList.contains("investigate-desk"),
    hasDeskFocusCss: !!document.querySelector("[data-desk-focus]"),
    scorebug: bug
      ? {
          radius: bs.borderRadius,
          bg: bs.backgroundColor,
          hasTeam: !!team,
          scoreText: score?.textContent?.replace(/\s+/g, " ").trim() || null,
          clockText: clock?.textContent?.trim() || null,
          scoreFont: score ? getComputedStyle(score).fontSize : null,
          clockFont: clock ? getComputedStyle(clock).fontSize : null,
        }
      : null,
    token: tokenEl
      ? {
          hasPitchTokenClass: tokenEl.classList.contains("pitch-token"),
          bg: ts.backgroundColor,
          radius: ts.borderRadius,
          age: tokenEl.querySelector(".pitch-token-age")?.textContent?.trim() || null,
          name: tokenEl.querySelector(".pitch-token-name")?.textContent?.trim() || null,
        }
      : null,
    flashPresent: !!flash,
    sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
  };
});

await page.screenshot({ path: shot, fullPage: false });

// Click a pitch player → dossier must be position:fixed
await page.locator('[data-pitch-card="1"] button').first().click({ force: true });
await page.waitForTimeout(1500);

const dossier = await page.evaluate(() => {
  const root = document.querySelector("[data-desk-mode]");
  const closeBtn = document.querySelector('button[aria-label="Close dossier"]');
  let dossierEl = null;
  if (closeBtn) {
    let n = closeBtn.parentElement;
    while (n && n !== document.body) {
      if (getComputedStyle(n).position === "fixed") {
        dossierEl = n;
        break;
      }
      n = n.parentElement;
    }
  }
  const ds = dossierEl ? getComputedStyle(dossierEl) : null;
  const primary = document.querySelector('[data-desk-primary="pitch"]');
  const ps = primary ? getComputedStyle(primary) : null;
  return {
    mode: root?.getAttribute("data-desk-mode"),
    hasInvestigate: root?.classList.contains("investigate-desk"),
    dossierOpen: !!closeBtn,
    position: ds?.position || null,
    zIndex: ds?.zIndex || null,
    top: ds?.top || null,
    right: ds?.right || null,
    width: ds?.width || null,
    title: dossierEl?.querySelector("h2")?.textContent?.trim() || null,
    primaryOpacity: ps ? parseFloat(ps.opacity) : null,
    hasDeskFocus: !!document.querySelector("[data-desk-focus]"),
  };
});

await page.screenshot({ path: ".pitchline-structural-upgrade-dossier-nufc.png", fullPage: false });
await browser.close();

const result = { pre, dossier, shot };
writeFileSync(".pitchline-structural-upgrade-probe.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

const ok =
  dossier.dossierOpen &&
  dossier.position === "fixed" &&
  dossier.mode === "scan" &&
  !dossier.hasInvestigate &&
  !dossier.hasDeskFocus &&
  !pre.hasInvestigate &&
  !pre.hasDeskFocusCss &&
  !pre.sportsPro &&
  pre.scorebug?.hasTeam &&
  pre.token?.hasPitchTokenClass &&
  (dossier.primaryOpacity == null || dossier.primaryOpacity >= 0.95);

console.log(ok ? "STRUCTURAL UPGRADE OK" : "STRUCTURAL UPGRADE FAIL");
process.exit(ok ? 0 : 1);
