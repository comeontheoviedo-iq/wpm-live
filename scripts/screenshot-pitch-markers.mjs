import { chromium } from "playwright";
import path from "path";

const matchId = "cmto7ma85000610otexazyf6k";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(800);

for (const pct of [20, 40]) {
  await page.goto(`http://localhost:3000/match-day/${matchId}`, {
    waitUntil: "networkidle",
  });
  await page.evaluate((markerSizePct) => {
    localStorage.setItem(
      "pitchline.fieldSettings.v2",
      JSON.stringify({
        markerSizePct,
        nameSizePct: 10,
        dataRows: 2,
        fieldsPerRow: 4,
        userAdjusted: true,
      })
    );
  }, pct);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const out = path.resolve(`.pitchline-rangers-+${pct}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log("wrote", out);
}

await browser.close();
