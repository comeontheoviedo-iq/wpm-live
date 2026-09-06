import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.removeItem("pitchline-broadcast-dark-v1");
  localStorage.setItem("pitchline-theme", "light");
});
await page.reload({ waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);
await page.goto("http://localhost:3000/match-day/cmtorhbeo08zm11zutipi5m3a", {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForSelector("[data-desk-mode]", { timeout: 45000 });
await page.waitForTimeout(600);
const probe = await page.evaluate(() => ({
  theme: localStorage.getItem("pitchline-theme"),
  migrated: localStorage.getItem("pitchline-broadcast-dark-v1"),
  htmlClass: document.documentElement.className,
  bg: getComputedStyle(document.body).backgroundColor,
  cssBg: getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
}));
console.log(JSON.stringify(probe, null, 2));
if (probe.theme !== "dark" || !probe.htmlClass.includes("dark") || probe.cssBg !== "#0b0e12") {
  console.error("FAIL migration");
  process.exit(1);
}
console.log("PASS migration from prior light");
await browser.close();
