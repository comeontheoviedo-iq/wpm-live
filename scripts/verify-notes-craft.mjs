import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shot = ".pitchline-notes-craft-nufc.png";
const probe = ".pitchline-notes-craft-probe.json";

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
await page.waitForSelector('[data-desk-rail="notes"]', { timeout: 45000 });
await page.waitForTimeout(2500);

async function dismissOverlays() {
  await page.evaluate(() => {
    document
      .querySelectorAll('[role="dialog"] button[title="Dismiss"]')
      .forEach((b) => b.click());
  });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => {
    document.querySelectorAll(".fixed.inset-y-0.right-0.z-50").forEach((el) => {
      const close = el.querySelector("button");
      if (close) close.click();
    });
  });
  await page.waitForTimeout(250);
}

await dismissOverlays();

const rail = page.locator('[data-desk-rail="notes"]');
await rail.waitFor({ state: "visible" });

// Expand first row so brighter state is visible in shot
const firstRow = rail.locator(".queue-row").first();
if (await firstRow.count()) {
  await firstRow.click({ force: true });
  await page.waitForTimeout(300);
}

const railBox = await rail.boundingBox();
if (railBox) {
  const clip = {
    x: Math.max(0, railBox.x - 8),
    y: Math.max(0, railBox.y - 8),
    width: Math.min(1600 - railBox.x + 8, railBox.width + 16),
    height: Math.min(1000 - railBox.y + 8, railBox.height + 16),
  };
  await page.screenshot({ path: shot, clip });
} else {
  await page.screenshot({ path: shot, fullPage: false });
}

const craft = await page.evaluate(() => {
  const railEl = document.querySelector('[data-desk-rail="notes"]');
  const rows = [...(railEl?.querySelectorAll(".queue-row") || [])];
  const sample = rows.slice(0, 8).map((r) => {
    const cs = getComputedStyle(r);
    return {
      height: Math.round(r.getBoundingClientRect().height),
      borderLeftWidth: cs.borderLeftWidth,
      borderLeftColor: cs.borderLeftColor,
      background: cs.backgroundColor,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      minute: r.querySelector(".note-queue-minute")?.textContent?.trim() || null,
      title: r.querySelector(".note-queue-title")?.textContent?.trim() || null,
      chip: r.querySelector(".note-queue-chip")?.textContent?.trim() || null,
      classes: r.className,
    };
  });
  const shell = railEl?.querySelector(".notes-rail-shell") || railEl?.firstElementChild;
  const shellCs = shell ? getComputedStyle(shell) : null;
  return {
    rowCount: rows.length,
    sample,
    shellBg: shellCs?.backgroundColor || null,
    hasMinute: sample.some((s) => s.minute && /\d+'/.test(s.minute)),
    hasChip: sample.some((s) => !!s.chip),
    denseOk: sample
      .filter((s) => !s.classes.includes("queue-row-active"))
      .every((s) => s.height >= 32 && s.height <= 44),
    edge4px: sample.every((s) => s.borderLeftWidth === "4px"),
    noCandyShadow: sample.every(
      (s) => !s.boxShadow || s.boxShadow === "none"
    ),
  };
});

// Player click → fixed-right dossier (must remain intact)
await dismissOverlays();
const tokenBtn = page.locator('[data-pitch-card="1"] button').first();
await tokenBtn.click({ force: true });
await page.waitForTimeout(1500);

const dossier = await page.evaluate(() => {
  const closeBtn = document.querySelector('button[aria-label="Close dossier"]');
  let dossierEl = null;
  if (closeBtn) {
    let n = closeBtn.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (cs.position === "fixed") {
        dossierEl = n;
        break;
      }
      n = n.parentElement;
    }
  }
  if (!dossierEl) {
    dossierEl = document.querySelector(".fixed.inset-y-0.right-0");
  }
  if (!dossierEl) return { found: false };
  const cs = getComputedStyle(dossierEl);
  const rect = dossierEl.getBoundingClientRect();
  return {
    found: true,
    position: cs.position,
    right: cs.right,
    left: cs.left,
    top: cs.top,
    bottom: cs.bottom,
    zIndex: cs.zIndex,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
    fixedRight:
      cs.position === "fixed" &&
      (cs.right === "0px" || rect.right >= window.innerWidth - 4),
  };
});

const out = { shot, craft, dossier, ok: craft.edge4px && dossier.fixedRight };
writeFileSync(probe, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

await browser.close();
if (!out.ok) process.exit(1);
