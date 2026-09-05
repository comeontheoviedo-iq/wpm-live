/**
 * Playwright: login → Rangers desk → enter fullscreen (or large desk) →
 * assert 0 AABB overlaps among player cards at whatever marker fit chooses.
 */
import { chromium } from "playwright";

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
await page.waitForTimeout(500);

await page.goto(`http://localhost:3000/match-day/${matchId}`, {
  waitUntil: "networkidle",
});
await page.evaluate(() => {
  localStorage.setItem(
    "pitchline.fieldSettings.v1",
    JSON.stringify({
      markerSizePct: 0,
      nameSizePct: 0,
      dataRows: 2,
      fieldsPerRow: 4,
      userAdjusted: false,
    })
  );
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[data-pitch-card="1"]', { timeout: 20000 });
await page.waitForTimeout(800);

async function countOverlaps() {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-pitch-card="1"]')];
    const rects = nodes.map((el) => {
      const token =
        el.querySelector("button span.inline-flex") ||
        el.querySelector("button") ||
        el;
      const r = token.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });
    let overlaps = 0;
    const pairs = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const hit =
          a.left < b.right - 0.5 &&
          a.right > b.left + 0.5 &&
          a.top < b.bottom - 0.5 &&
          a.bottom > b.top + 0.5;
        if (hit) {
          overlaps++;
          pairs.push(
            `${nodes[i].getAttribute("data-pitch-side")}-${nodes[i].getAttribute("data-pitch-slot")} vs ${nodes[j].getAttribute("data-pitch-side")}-${nodes[j].getAttribute("data-pitch-slot")}`
          );
        }
      }
    }
    const pitchEl = document.querySelector(".relative.w-full.min-h-\\[220px\\]");
    const pr = pitchEl ? pitchEl.getBoundingClientRect() : null;
    return {
      overlaps,
      pairs: pairs.slice(0, 12),
      cards: rects.length,
      pitch: pr
        ? { w: Math.round(pr.width), h: Math.round(pr.height) }
        : null,
      fs: !!document.fullscreenElement,
    };
  });
}

// Prefer real Fullscreen API so match-desk sets isFullscreen → auto-fit ceiling.
const fsOk = await page.evaluate(async () => {
  const desk = document.querySelector(
    ".relative.flex.flex-col.gap-1\\.5.overflow-hidden"
  );
  if (!desk) return false;
  try {
    await desk.requestFullscreen();
    return document.fullscreenElement === desk;
  } catch {
    return false;
  }
});

if (!fsOk) {
  // Fallback: enlarge desk + dispatch events; also force a high desired marker
  // via localStorage userAdjusted so fit still has to clamp.
  console.log("requestFullscreen unavailable — simulating large container");
  await page.evaluate(() => {
    localStorage.setItem(
      "pitchline.fieldSettings.v1",
      JSON.stringify({
        markerSizePct: 40,
        nameSizePct: 0,
        dataRows: 2,
        fieldsPerRow: 4,
        userAdjusted: true,
      })
    );
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-pitch-card="1"]', { timeout: 20000 });
  await page.evaluate(() => {
    const desk = document.querySelector(
      ".relative.flex.flex-col.gap-1\\.5.overflow-hidden"
    );
    if (!desk) throw new Error("desk root not found");
    desk.classList.add(
      "fixed",
      "inset-0",
      "z-[100]",
      "h-[100dvh]",
      "max-h-[100dvh]",
      "min-h-0",
      "p-2"
    );
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("fullscreenchange"));
  });
} else {
  console.log("entered document fullscreen");
}

await page.waitForTimeout(1000);
const result = await countOverlaps();
console.log(JSON.stringify(result, null, 2));
await page.screenshot({
  path: ".pitchline-fullscreen-fit.png",
  fullPage: false,
});
console.log("wrote .pitchline-fullscreen-fit.png");

await browser.close();
if (result.cards < 20) {
  console.error(`Expected ~22 cards, got ${result.cards}`);
  process.exit(1);
}
if (result.overlaps !== 0) {
  console.error(`FAIL overlaps=${result.overlaps}`, result.pairs);
  process.exit(1);
}
console.log("PASS: 0 DOM AABB overlaps after fullscreen/large fit");
