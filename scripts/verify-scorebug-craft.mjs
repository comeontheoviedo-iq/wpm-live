import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shot = ".pitchline-scorebug-craft-nufc.png";

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
await page.waitForSelector(".scorebug", { timeout: 45000 });
await page.waitForTimeout(2000);

await page.evaluate(() => {
  document.querySelectorAll('[role="dialog"] button[title="Dismiss"]').forEach((b) => b.click());
});
await page.waitForTimeout(500);

const pre = await page.evaluate(() => {
  const bug = document.querySelector(".scorebug");
  const bs = bug ? getComputedStyle(bug) : null;
  const score = document.querySelector(".scorebug-score");
  const clock = document.querySelector(".scorebug .scorebug-clock");
  const crests = [...document.querySelectorAll(".scorebug-crest")];
  const hairlines = [...document.querySelectorAll(".scorebug-hairline")];
  const divider = document.querySelector(".scorebug-divider");
  const codes = [...document.querySelectorAll(".scorebug .scorebug-code")];
  const children = bug ? [...bug.children].map((el) => el.className || el.tagName) : [];
  return {
    structure: children,
    radius: bs?.borderRadius || null,
    bg: bs?.backgroundColor || null,
    scoreText: score?.textContent?.replace(/\s+/g, " ").trim() || null,
    scoreFont: score ? getComputedStyle(score).fontSize : null,
    scoreWeight: score ? getComputedStyle(score).fontWeight : null,
    clockText: clock?.textContent?.trim() || null,
    clockFont: clock ? getComputedStyle(clock).fontSize : null,
    clockBg: clock ? getComputedStyle(clock).backgroundColor : null,
    crestCount: crests.length,
    hairlineColors: hairlines.map((h) => getComputedStyle(h).backgroundColor),
    hasDivider: !!divider,
    codeCount: codes.length,
    scoreBg: score ? getComputedStyle(score).backgroundColor : null,
  };
});

// Tight crop on scorebug + pitch context
const bugBox = await page.locator(".scorebug").boundingBox();
const pitch = page.locator('[data-desk-primary="pitch"], .relative.w-full.overflow-hidden').first();
const pitchBox = await pitch.boundingBox().catch(() => null);
if (bugBox) {
  const padX = 80;
  const padTop = 24;
  const padBottom = 140;
  const clip = {
    x: Math.max(0, bugBox.x - padX),
    y: Math.max(0, bugBox.y - padTop),
    width: Math.min(1600, bugBox.width + padX * 2),
    height: Math.min(1000 - (bugBox.y - padTop), bugBox.height + padTop + padBottom),
  };
  if (pitchBox) {
    clip.width = Math.min(clip.width + 40, pitchBox.width * 0.55);
    clip.x = Math.max(0, bugBox.x + bugBox.width / 2 - clip.width / 2);
  }
  await page.screenshot({ path: shot, clip });
} else {
  await page.screenshot({ path: shot, fullPage: false });
}

// Player click → fixed right drawer
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
  return {
    mode: root?.getAttribute("data-desk-mode"),
    hasInvestigate: root?.classList.contains("investigate-desk"),
    dossierOpen: !!closeBtn,
    position: ds?.position || null,
    right: ds?.right || null,
    zIndex: ds?.zIndex || null,
    title: dossierEl?.querySelector("h2")?.textContent?.trim() || null,
  };
});

await browser.close();

const result = { pre, dossier, shot };
writeFileSync(".pitchline-scorebug-craft-probe.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

const ok =
  dossier.dossierOpen &&
  dossier.position === "fixed" &&
  !dossier.hasInvestigate &&
  pre.crestCount >= 2 &&
  pre.hasDivider &&
  pre.scoreFont &&
  parseFloat(pre.scoreFont) >= 18 &&
  pre.bg?.includes("3, 4, 5");

console.log(ok ? "SCOREBUG CRAFT OK" : "SCOREBUG CRAFT FAIL");
process.exit(ok ? 0 : 1);
