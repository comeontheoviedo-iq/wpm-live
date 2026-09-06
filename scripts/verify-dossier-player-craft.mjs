import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shot = ".pitchline-dossier-player-v2-nufc.png";
const probe = ".pitchline-dossier-player-v2-probe.json";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
});
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
await page.waitForTimeout(2000);

// Dismiss overlays
await page.evaluate(() => {
  document
    .querySelectorAll('[role="dialog"] button[title="Dismiss"]')
    .forEach((b) => b.click());
});
for (let i = 0; i < 3; i++) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
}
await page.waitForTimeout(300);

await page.locator('[data-pitch-card="1"] button').first().click({ force: true });
await page.waitForSelector('[data-player-dossier="1"]', { timeout: 15000 });
await page.waitForTimeout(1800);

const craft = await page.evaluate(() => {
  const el = document.querySelector('[data-player-dossier="1"]');
  if (!el) return { found: false };
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const name = el.querySelector(".player-dossier-name")?.textContent?.trim() || null;
  const age = el.querySelector(".player-dossier-age")?.textContent?.trim() || null;
  const hash = el.querySelector(".player-dossier-hash")?.textContent?.trim() || null;
  const pos = el.querySelector(".player-dossier-pos")?.textContent?.trim() || null;
  const verdict = el.querySelector("[data-dossier-verdict]") || el.querySelector(".player-dossier-verdict");
  const title = el.querySelector(".player-dossier-title")?.textContent?.trim() || null;
  const tabs = [...el.querySelectorAll(".player-dossier-tab")].map((t) => ({
    label: t.textContent?.trim(),
    active: t.classList.contains("is-active"),
    borderRadius: getComputedStyle(t).borderRadius,
  }));
  const tabLabels = tabs.map((t) => (t.label || "").replace(/\s*\(.*\)$/, "").trim());
  const expectedTabs = ["Overview", "Career", "Form", "Notes"];
  const tabsMatch =
    tabLabels.length === 4 &&
    expectedTabs.every((x, i) => tabLabels[i] === x);
  const hasLoudName = (() => {
    const n = el.querySelector(".player-dossier-name");
    if (!n) return false;
    const fs = parseFloat(getComputedStyle(n).fontSize);
    const fw = parseInt(getComputedStyle(n).fontWeight, 10);
    return fs >= 20 && fw >= 700;
  })();
  const hasNoteChrome = /\+\s*NOTE|\+\s*FILL/i.test(
    el.querySelector(".player-dossier-titlebar")?.innerText || ""
  ) || !!el.querySelector(".player-dossier-titlebar .player-dossier-action");
  const hasCrest = !!el.querySelector(".crest-watermark");
  const general = /\bGENERAL\b/i.test(el.innerText || "");
  const attacking = /\b(ATTACKING|KEEPING)\b/i.test(el.innerText || "");
  const formChips = [...el.querySelectorAll(".player-dossier-form-chip")].map((c) =>
    c.textContent?.trim()
  );
  const bg = cs.backgroundColor;
  const text = el.innerText || "";
  return {
    found: true,
    position: cs.position,
    right: cs.right,
    left: cs.left,
    top: cs.top,
    zIndex: cs.zIndex,
    background: bg,
    borderRadius: cs.borderRadius,
    boxShadow: cs.boxShadow,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      right: Math.round(rect.right),
    },
    fixedRight:
      cs.position === "fixed" &&
      (cs.right === "0px" || rect.right >= window.innerWidth - 4),
    title,
    name,
    age,
    hash,
    pos,
    hasYo: !!(age && /y\/o/.test(age)),
    hasVerdict: !!verdict,
    verdictText: verdict?.querySelector(".player-dossier-verdict-line")?.textContent?.trim() || null,
    verdictLabel: verdict?.querySelector(".player-dossier-verdict-label")?.textContent?.trim() || null,
    tabs,
    tabLabels,
    tabsMatch,
    hasLoudName,
    hasNoteChrome,
    hasCrest,
    general,
    attacking,
    underlineTabs:
      tabs.length > 0 &&
      tabs.every((t) => !t.borderRadius || t.borderRadius === "0px"),
    formChips,
    hasFormChips: formChips.length > 0,
    noSportsPro: !/sports\s*pro|understat/i.test(text),
    noVioletCandy: !/violet|fuchsia|purple/i.test(bg),
  };
});

const dossierEl = page.locator('[data-player-dossier="1"]');
const box = await dossierEl.boundingBox();
if (box) {
  await page.screenshot({
    path: shot,
    clip: {
      x: Math.max(0, box.x - 12),
      y: 0,
      width: Math.min(1600 - Math.max(0, box.x - 12), box.width + 24),
      height: 1000,
    },
  });
} else {
  await page.screenshot({ path: shot, fullPage: false });
}

const out = {
  shot,
  craft,
  ok:
    craft.found &&
    craft.fixedRight &&
    craft.hasYo &&
    craft.hasVerdict &&
    craft.underlineTabs &&
    craft.noSportsPro &&
    craft.tabsMatch &&
    craft.hasLoudName &&
    !craft.hasNoteChrome &&
    !craft.hasCrest &&
    craft.general &&
    craft.attacking &&
    /verdict/i.test(craft.verdictLabel || ""),
};
writeFileSync(probe, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

await browser.close();
if (!out.ok) process.exit(1);
