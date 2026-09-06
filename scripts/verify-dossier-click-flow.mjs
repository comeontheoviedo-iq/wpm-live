import { chromium } from "playwright";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);

await page.goto(`http://localhost:3000/match-day/${deskId}`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForSelector("[data-desk-mode]", { timeout: 30000 });
await page.waitForSelector('[data-pitch-card="1"]', { timeout: 30000 });
await page.waitForTimeout(1000);

await page.locator('[data-pitch-card="1"] button').first().click({ force: true });
await page.waitForTimeout(1500);

const result = await page.evaluate(() => {
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
    bottom: ds?.bottom || null,
    width: ds?.width || null,
    title: dossierEl?.querySelector("h2")?.textContent?.trim() || null,
    primaryOpacity: ps ? parseFloat(ps.opacity) : null,
    hasDeskFocus: !!document.querySelector("[data-desk-focus]"),
  };
});

await page.screenshot({ path: ".pitchline-dossier-click-nufc.png", fullPage: false });
await browser.close();

console.log(JSON.stringify(result, null, 2));
const ok =
  result.dossierOpen &&
  result.position === "fixed" &&
  result.mode === "scan" &&
  !result.hasInvestigate &&
  !result.hasDeskFocus &&
  (result.primaryOpacity == null || result.primaryOpacity >= 0.95);

console.log(ok ? "DOSSIER CLICK FLOW OK" : "DOSSIER CLICK FLOW FAIL");
process.exit(ok ? 0 : 1);
