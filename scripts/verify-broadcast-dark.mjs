import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a";
const out = ".pitchline-broadcast-dark-nufc.png";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);

// Force broadcast dark (simulate migration + desk default)
await page.addInitScript(() => {
  localStorage.setItem("pitchline-broadcast-dark-v1", "1");
  localStorage.setItem("pitchline-theme", "dark");
  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
});

await page.goto(`http://localhost:3000/match-day/${deskId}`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForSelector("[data-desk-mode]", { timeout: 45000 });
await page.waitForTimeout(1500);

const probe = await page.evaluate(() => {
  const cs = getComputedStyle(document.body);
  const root = getComputedStyle(document.documentElement);
  const surfaceEls = [
    document.querySelector("header"),
    document.querySelector(".desk-chrome"),
    document.querySelector('[data-desk-rail="notes"]'),
    document.querySelector("[data-desk-mode]"),
  ];
  const samples = surfaceEls.map((el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color, tag: el.tagName + (el.className || "").toString().slice(0, 40) };
  });
  const card = document.querySelector("[data-pitch-token], [data-pitch-card]");
  const cardBg = card ? getComputedStyle(card.querySelector("span span") || card).backgroundColor : null;
  // luminance of body bg
  const bg = cs.backgroundColor;
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  let lum = null;
  if (m) {
    const [r, g, b] = m.slice(1).map(Number);
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return {
    htmlClass: document.documentElement.className,
    theme: localStorage.getItem("pitchline-theme"),
    bodyBg: bg,
    bodyLum: lum,
    cssBg: root.getPropertyValue("--background").trim(),
    cssSurface: root.getPropertyValue("--surface").trim(),
    samples,
    cardBg,
    sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
  };
});

await page.screenshot({ path: out, fullPage: false });
writeFileSync(".pitchline-broadcast-dark-probe.json", JSON.stringify(probe, null, 2));
console.log(JSON.stringify(probe, null, 2));
console.log("screenshot", out);

const darkEnough = probe.bodyLum != null && probe.bodyLum < 0.25;
const tokenDark = /^#0[bB]0[eE]12$/.test(probe.cssBg) || probe.cssBg.includes("0b0e12") || probe.cssBg === "#0b0e12";
if (!darkEnough) {
  console.error("FAIL: body luminance too high", probe.bodyLum);
  process.exitCode = 1;
} else if (probe.sportsPro) {
  console.error("FAIL: SportsPro/Understat in UI");
  process.exitCode = 1;
} else {
  console.log("PASS: dark broadcast desk", { bodyLum: probe.bodyLum, tokenDark, cssBg: probe.cssBg });
}

await browser.close();
