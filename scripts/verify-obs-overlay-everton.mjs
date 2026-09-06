import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtots5dq011ma69s89vv9ffe"; // Everton MatchDay
const url = `http://localhost:3000/match-day/${deskId}/overlay`;
const shot = ".pitchline-obs-overlay-everton.png";
const probe = ".pitchline-obs-overlay-everton-probe.json";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector(".obs-overlay", { timeout: 45000 });
await page.waitForSelector(".scorebug", { timeout: 20000 });
await page.waitForTimeout(2500);

// Inject a craft flash so the screenshot shows scorebug + intel (match may be pre-kick)
const injected = await page.evaluate(() => {
  const host = document.querySelector(".obs-overlay");
  if (!host) return false;
  if (document.querySelector(".live-flash")) return false;
  const wrap = document.createElement("div");
  wrap.className =
    "obs-overlay-flashes absolute left-1/2 top-28 z-[60] flex w-[min(94%,26rem)] -translate-x-1/2 flex-col gap-2";
  wrap.setAttribute("data-craft-inject", "1");
  wrap.innerHTML = `
    <div role="dialog" aria-label="GOAL 67'" class="live-flash live-flash-goal px-2.5 py-1.5 text-left">
      <div class="flex items-start justify-between gap-2">
        <div class="live-flash-meta min-w-0 truncate">Goal · Everton 1–0 United</div>
        <span class="live-flash-time">67'</span>
      </div>
      <div class="live-flash-headline min-w-0">GOAL 67'<span class="ml-1.5 text-[0.8em] font-bold text-slate-300">Calvert-Lewin</span></div>
      <span class="live-flash-chip mt-1 inline-flex">Advanced stats</span>
      <ul class="live-flash-body mt-1 space-y-0.5"><li>Score: Everton 1–0 United</li><li>On target 4–2</li></ul>
      <div class="live-flash-viz">
        <div class="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">xG race</div>
        <div class="flex h-1.5 overflow-hidden rounded-full bg-white/5">
          <div style="width:55%;background:#0d9488" class="h-full"></div>
          <div style="width:45%;background:#e11d48" class="h-full"></div>
        </div>
      </div>
    </div>`;
  host.appendChild(wrap);
  return true;
});
await page.waitForTimeout(400);

const probeData = await page.evaluate(() => {
  const html = document.documentElement;
  const body = document.body;
  const root = document.querySelector(".obs-overlay");
  const bug = document.querySelector(".scorebug");
  const flash = document.querySelector(".live-flash");
  const hs = getComputedStyle(html);
  const bs = getComputedStyle(body);
  const rs = root ? getComputedStyle(root) : null;
  const chrome =
    !!document.querySelector(".desk-chrome") ||
    !!document.querySelector("[data-desk-mode]") ||
    !!document.querySelector("nav") ||
    !!document.querySelector("header.desk-header");
  return {
    url: location.href,
    hasOverlay: !!root,
    overlaySize: root
      ? { w: root.getBoundingClientRect().width, h: root.getBoundingClientRect().height }
      : null,
    htmlBg: hs.backgroundColor,
    bodyBg: bs.backgroundColor,
    rootBg: rs?.backgroundColor || null,
    htmlTransparentClass: html.classList.contains("obs-overlay-active"),
    bodyTransparentClass: body.classList.contains("obs-overlay-active"),
    hasScorebug: !!bug,
    scoreText: bug?.querySelector(".scorebug-score")?.textContent?.replace(/\s+/g, " ").trim() || null,
    crestCount: bug ? bug.querySelectorAll(".scorebug-crest").length : 0,
    hasFlash: !!flash,
    chromePresent: chrome,
    scrollbar: rs?.overflow || null,
  };
});

// Checkerboard underlay for visible PNG (OBS will still use real transparency)
await page.evaluate(() => {
  const under = document.createElement("div");
  under.setAttribute("data-chroma", "1");
  under.style.cssText =
    "position:fixed;inset:0;z-index:0;pointer-events:none;" +
    "background:repeating-conic-gradient(#1a3a2a 0% 25%, #0f2418 0% 50%) 50% / 48px 48px;";
  document.body.prepend(under);
  const ov = document.querySelector(".obs-overlay");
  if (ov) ov.style.zIndex = "1";
});
await page.waitForTimeout(200);

await page.screenshot({ path: shot, omitBackground: false });

const out = { ...probeData, injected, shot, url };
writeFileSync(probe, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));

const ok =
  probeData.hasOverlay &&
  probeData.overlaySize?.w === 1920 &&
  probeData.overlaySize?.h === 1080 &&
  probeData.hasScorebug &&
  probeData.crestCount >= 2 &&
  probeData.htmlTransparentClass &&
  !probeData.chromePresent;

console.log(ok ? "OBS OVERLAY OK" : "OBS OVERLAY FAIL");
await browser.close();
process.exit(ok ? 0 : 1);
