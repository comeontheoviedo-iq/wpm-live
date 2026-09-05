import { chromium } from "playwright";

const matchId = "cmto7ma85000610otexazyf6k";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
await page.fill('input[type="password"], input[name="password"]', "demo1234");
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(500);

async function loadWithSettings(settings) {
  await page.goto(`http://localhost:3000/match-day/${matchId}`, { waitUntil: "networkidle" });
  await page.evaluate((s) => {
    try { localStorage.removeItem("pitchline.fieldSettings.v1"); } catch {}
    localStorage.setItem("pitchline.fieldSettings.v2", JSON.stringify(s));
  }, settings);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-pitch-card="1"]', { timeout: 20000 });
  await page.waitForTimeout(1000);
}

async function measure() {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-pitch-card="1"]')];
    const rows = cards.map((el) => {
      const token =
        el.querySelector("[data-pitch-token]") ||
        el.querySelector("button span.inline-flex") ||
        el.querySelector("button") ||
        el;
      const r = token.getBoundingClientRect();
      return {
        side: el.getAttribute("data-pitch-side"),
        slot: el.getAttribute("data-pitch-slot"),
        cx: (r.left + r.right) / 2,
        w: r.width,
        h: r.height,
      };
    });
    const sample = rows[0] ? { w: Math.round(rows[0].w), h: Math.round(rows[0].h) } : null;
    function orderIssues(side) {
      const cbs = rows.filter((r) => r.side === side && (r.slot === "RCB" || r.slot === "LCB"));
      const cdms = rows.filter((r) => r.side === side && (r.slot === "RDM" || r.slot === "LDM"));
      const issues = [];
      for (const cb of cbs) {
        for (const cdm of cdms) {
          const ok = side === "home" ? cb.cx < cdm.cx - 2 : cb.cx > cdm.cx + 2;
          if (!ok) issues.push(`${side} ${cb.slot}@${cb.cx.toFixed(0)} vs ${cdm.slot}@${cdm.cx.toFixed(0)}`);
        }
      }
      return issues;
    }
    return {
      cards: rows.length,
      sample,
      homeIssues: orderIssues("home"),
      awayIssues: orderIssues("away"),
      home: rows.filter((r) => r.side === "home").sort((a, b) => a.cx - b.cx).map((r) => `${r.slot}:${Math.round(r.cx)}`),
      away: rows.filter((r) => r.side === "away").sort((a, b) => b.cx - a.cx).map((r) => `${r.slot}:${Math.round(r.cx)}`),
    };
  });
}

const sizes = {};
let depthFail = false;
for (const pct of [-40, -25, 0, 40]) {
  await loadWithSettings({
    markerSizePct: pct,
    nameSizePct: 0,
    dataRows: 2,
    fieldsPerRow: 4,
    userAdjusted: true,
  });
  const m = await measure();
  sizes[pct] = m.sample;
  console.log("SIZE", pct, JSON.stringify(m.sample), "homeIssues", m.homeIssues, "awayIssues", m.awayIssues);
  if (m.homeIssues.length || m.awayIssues.length) depthFail = true;
  if (pct === -25) {
    console.log("home", m.home.join(" "));
    console.log("away", m.away.join(" "));
    await page.screenshot({ path: ".pitchline-fix-verify.png", fullPage: false });
  }
}

await loadWithSettings({
  markerSizePct: -25,
  nameSizePct: 0,
  dataRows: 2,
  fieldsPerRow: 4,
  userAdjusted: false,
});
const def = await measure();
console.log("DEFAULT", JSON.stringify(def.sample));

const wNeg = sizes[-40]?.w ?? 0;
const wMid = sizes[-25]?.w ?? 0;
const wPos = sizes[40]?.w ?? 0;
const sizeOk = wPos > wMid && wMid > wNeg && wPos - wNeg >= 20;
console.log("SIZE_RANGE", { wNeg, wMid, wPos, sizeOk, depthFail });
console.log(sizeOk && !depthFail ? "PASS" : "FAIL");
await browser.close();
process.exit(sizeOk && !depthFail ? 0 : 1);
