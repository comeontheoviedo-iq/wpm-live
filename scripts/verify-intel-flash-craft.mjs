import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shot = ".pitchline-intel-flash-craft-nufc.png";
const probe = ".pitchline-intel-flash-craft-probe.json";

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
await page.waitForTimeout(2500);

async function dismissOverlays() {
  await page.evaluate(() => {
    document
      .querySelectorAll('[role="dialog"] button[title="Dismiss"]')
      .forEach((b) => b.click());
  });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  // Force-remove dossier drawers if Escape didn't
  await page.evaluate(() => {
    document.querySelectorAll(".fixed.inset-y-0.right-0.z-50").forEach((el) => {
      const close = el.querySelector("button");
      if (close) close.click();
    });
  });
  await page.waitForTimeout(300);
}

await dismissOverlays();

// Sync to fire FT viz / thresholds
const syncBtn = page.locator('button:has-text("Sync")').first();
if (await syncBtn.count()) {
  await syncBtn.click({ force: true });
  await page.waitForTimeout(4000);
}

let hasFlash = (await page.locator(".live-flash").count()) > 0;
if (!hasFlash) {
  const histBtn = page
    .locator('button[title*="Live intel history"]')
    .first();
  if (await histBtn.count()) {
    await histBtn.click({ force: true });
    await page.waitForTimeout(500);
    const item = page.locator(".live-flash-history").first();
    if (await item.count()) {
      await item.click({ force: true });
      await page.waitForTimeout(700);
    } else {
      // close empty history
      await page.keyboard.press("Escape");
    }
  }
}

hasFlash = (await page.locator(".live-flash").count()) > 0;
if (!hasFlash) {
  await page.evaluate(() => {
    const host = document.querySelector("[data-desk-mode]") || document.body;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-craft-inject", "1");
    wrap.className =
      "absolute left-1/2 top-12 z-[60] flex w-[min(94%,26rem)] -translate-x-1/2 flex-col gap-2";
    wrap.innerHTML = `
      <div role="dialog" aria-label="GOAL 67'" class="live-flash live-flash-goal px-2.5 py-1.5 text-left">
        <div class="flex items-start justify-between gap-2">
          <div class="live-flash-meta min-w-0 truncate">Goal · Newcastle 2–1 Liverpool</div>
          <div class="flex shrink-0 items-center gap-1"><span class="live-flash-time">67'</span></div>
        </div>
        <div class="mt-0.5 flex items-start justify-between gap-2">
          <div class="live-flash-headline min-w-0">GOAL 67'<span class="ml-1.5 text-[0.8em] font-bold text-slate-300">Isak</span></div>
          <span class="live-flash-chip shrink-0">Advanced stats</span>
        </div>
        <ul class="live-flash-body mt-1 space-y-0.5"><li>Score: Newcastle 2–1 Liverpool</li><li>On target 6–4</li></ul>
        <div class="live-flash-viz">
          <div class="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">xG race</div>
          <div class="flex h-1.5 overflow-hidden rounded-full bg-white/5">
            <div style="width:58%;background:#0ea5e9" class="h-full"></div>
            <div style="width:42%;background:#f43f5e" class="h-full"></div>
          </div>
        </div>
      </div>`;
    host.appendChild(wrap);
  });
  await page.waitForTimeout(300);
}

const flashProbe = await page.evaluate(() => {
  const flash = document.querySelector(".live-flash");
  const fs = flash ? getComputedStyle(flash) : null;
  const chip = flash?.querySelector(".live-flash-chip");
  const time = flash?.querySelector(".live-flash-time");
  const viz = flash?.querySelector(".live-flash-viz");
  const headline = flash?.querySelector(".live-flash-headline");
  const bg = fs?.backgroundColor || "";
  // Detect candy full-fill washes (large saturated background, not charcoal)
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  let candy = false;
  if (m) {
    const [r, g, b] = m.slice(1).map(Number);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    candy = max - min > 40 && max > 80; // saturated wash
  }
  return {
    flashPresent: !!flash,
    flashClasses: flash?.className || null,
    borderLeftWidth: fs ? parseFloat(fs.borderLeftWidth) : null,
    borderLeftColor: fs?.borderLeftColor || null,
    background: bg,
    radius: fs?.borderRadius || null,
    chipText: chip?.textContent?.trim() || null,
    timeText: time?.textContent?.trim() || null,
    hasViz: !!viz,
    headline: headline?.textContent?.replace(/\s+/g, " ").trim() || null,
    candyFullFill: candy,
    providerLeak: /understat|sportspro/i.test(
      (flash?.textContent || "") + (document.body?.innerText || "").slice(0, 2000)
    ),
    injected: !!document.querySelector("[data-craft-inject]"),
  };
});

// Screenshot flash craft
const flashBox = await page.locator(".live-flash").first().boundingBox();
if (flashBox) {
  const clip = {
    x: Math.max(0, Math.floor(flashBox.x - 48)),
    y: Math.max(0, Math.floor(flashBox.y - 48)),
    width: Math.min(1600, Math.ceil(flashBox.width + 96)),
    height: Math.min(1000, Math.ceil(flashBox.height + 96)),
  };
  await page.screenshot({ path: shot, clip });
} else {
  await page.screenshot({ path: shot });
}

// Verify player drawer still fixed-right
await dismissOverlays();
await page.evaluate(() => {
  document.querySelectorAll("[data-craft-inject]").forEach((n) => n.remove());
});
const token = page.locator("[data-pitch-token]").first();
if (await token.count()) {
  await token.click({ force: true });
  await page.waitForTimeout(1000);
}

const drawer = await page.evaluate(() => {
  const el = document.querySelector(".fixed.inset-y-0.right-0.z-50");
  if (!el) return { found: false };
  const s = getComputedStyle(el);
  return {
    found: true,
    position: s.position,
    right: s.right,
    top: s.top,
    bottom: s.bottom,
    zIndex: s.zIndex,
    maxWidth: s.maxWidth,
  };
});

const out = { ...flashProbe, playerDrawer: drawer };
writeFileSync(probe, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log("wrote", shot, probe);

const ok =
  out.flashPresent &&
  out.borderLeftWidth === 4 &&
  out.chipText === "Advanced stats" &&
  out.timeText &&
  !out.candyFullFill &&
  !out.providerLeak &&
  out.playerDrawer?.found &&
  out.playerDrawer?.position === "fixed" &&
  out.playerDrawer?.right === "0px";

if (!ok) {
  console.error("VERIFY FAILED");
  process.exit(1);
}
console.log("VERIFY OK");
await browser.close();
