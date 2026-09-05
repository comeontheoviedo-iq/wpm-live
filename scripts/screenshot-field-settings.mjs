import { chromium } from "playwright";
import path from "path";

const matchId = "cmto7ma85000610otexazyf6k";
const out = path.resolve(".pitchline-field-settings.png");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

// login
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(800);

await page.goto(`http://localhost:3000/match-day/${matchId}`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);

// bump field settings in localStorage then reload so cards enlarge
await page.evaluate(() => {
  localStorage.setItem(
    "pitchline.fieldSettings.v2",
    JSON.stringify({
      markerSizePct: 20,
      nameSizePct: 10,
      dataRows: 2,
      fieldsPerRow: 4,
      userAdjusted: true,
    })
  );
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// open Field Settings modal
const fieldBtn = page.getByRole("button", { name: /Field/i }).first();
await fieldBtn.click();
await page.waitForTimeout(600);

await page.screenshot({ path: out, fullPage: false });
console.log("wrote", out);
await browser.close();
