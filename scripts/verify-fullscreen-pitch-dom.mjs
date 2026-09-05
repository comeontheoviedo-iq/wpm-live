/**
 * Playwright: login → Rangers desk → assert 0 AABB overlaps among real
 * `[data-pitch-card]` / `[data-pitch-token]` boxes for:
 *   1) windowed three-column desk
 *   2) fullscreen desk
 * Prefer smaller cards over overlaps — fail if any DOM AABB intersects.
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
  try { localStorage.removeItem("pitchline.fieldSettings.v1"); } catch {}
  localStorage.setItem(
    "pitchline.fieldSettings.v2",
    JSON.stringify({
      markerSizePct: -25,
      nameSizePct: 0,
      dataRows: 2,
      fieldsPerRow: 4,
      userAdjusted: false,
    })
  );
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[data-pitch-card="1"]', { timeout: 20000 });
await page.waitForTimeout(1000);

async function countOverlaps() {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-pitch-card="1"]')];
    const rects = nodes.map((el) => {
      const token =
        el.querySelector("[data-pitch-token]") ||
        el.querySelector("button span.inline-flex") ||
        el.querySelector("button") ||
        el;
      const r = token.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
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
    const pitchEl =
      document.querySelector("[data-pitch-card]")?.closest(".relative.w-full") ||
      null;
    const pr = pitchEl ? pitchEl.getBoundingClientRect() : null;
    const sample = rects[0]
      ? { w: Math.round(rects[0].w), h: Math.round(rects[0].h) }
      : null;
    return {
      overlaps,
      pairs: pairs.slice(0, 12),
      cards: rects.length,
      sampleCard: sample,
      pitch: pr
        ? { w: Math.round(pr.width), h: Math.round(pr.height) }
        : null,
      fs: !!document.fullscreenElement,
    };
  });
}

// --- 1) Windowed three-column desk ---
const windowed = await countOverlaps();
console.log("WINDOWED", JSON.stringify(windowed, null, 2));
await page.screenshot({
  path: ".pitchline-windowed-fit.png",
  fullPage: false,
});
console.log("wrote .pitchline-windowed-fit.png");

// --- 2) Fullscreen ---
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
  console.log("requestFullscreen unavailable — simulating large container");
  await page.evaluate(() => {
    localStorage.setItem(
      "pitchline.fieldSettings.v2",
      JSON.stringify({
        markerSizePct: -25,
        nameSizePct: 0,
        dataRows: 2,
        fieldsPerRow: 4,
        userAdjusted: false,
      })
    );
    try { localStorage.removeItem("pitchline.fieldSettings.v1"); } catch {}
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

await page.waitForTimeout(1200);
const fullscreen = await countOverlaps();
console.log("FULLSCREEN", JSON.stringify(fullscreen, null, 2));
await page.screenshot({
  path: ".pitchline-fullscreen-fit.png",
  fullPage: false,
});
console.log("wrote .pitchline-fullscreen-fit.png");

await browser.close();

let failed = false;
for (const [label, result] of [
  ["windowed", windowed],
  ["fullscreen", fullscreen],
]) {
  if (result.cards < 20) {
    console.error(`${label}: Expected ~22 cards, got ${result.cards}`);
    failed = true;
  }
  if (result.overlaps !== 0) {
    console.error(`${label}: FAIL overlaps=${result.overlaps}`, result.pairs);
    failed = true;
  } else {
    console.log(`${label}: PASS 0 DOM AABB overlaps`);
  }
}
// Cards must look reasonably small — not edge-to-edge columns spanning pitch height.
// Base card ~76x152; at -25% scale ≈ 57x114. Fail if sample taller than ~45% of pitch height
// or wider than ~18% of pitch width (would look like oversized columns).
for (const [label, result] of [
  ["windowed", windowed],
  ["fullscreen", fullscreen],
]) {
  if (!result.sampleCard || !result.pitch) continue;
  const { w: cw, h: ch } = result.sampleCard;
  const { w: pw, h: ph } = result.pitch;
  const tooTall = ch > ph * 0.45;
  const tooWide = cw > pw * 0.18;
  console.log(`${label}: sampleCard ${cw}x${ch} vs pitch ${pw}x${ph} (hRatio=${(ch / ph).toFixed(2)} wRatio=${(cw / pw).toFixed(2)})`);
  if (tooTall || tooWide) {
    console.error(`${label}: FAIL cards too large (want clearly smaller than edge-to-edge)`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: windowed + fullscreen 0 real DOM overlaps + cards reasonably small");
