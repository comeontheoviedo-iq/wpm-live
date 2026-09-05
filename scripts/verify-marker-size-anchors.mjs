/**
 * Hands-off: markerSizePct must change card size only — formation slot
 * anchors (left%/top%) and depth-band order must stay fixed when userAdjusted.
 */
import { chromium } from "playwright";

const matchId = "cmto7ma85000610otexazyf6k";
const PCTS = [-40, -15, 0, 40];
const DEPTH_EPS_PCT = 0.35; // style % must match across sizes
const LATERAL_EPS_PCT = 0.35;

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
await page.waitForTimeout(400);

async function loadWithSettings(settings) {
  await page.goto(`http://localhost:3000/match-day/${matchId}`, {
    waitUntil: "networkidle",
  });
  await page.evaluate((s) => {
    try {
      localStorage.removeItem("pitchline.fieldSettings.v1");
    } catch {}
    localStorage.setItem("pitchline.fieldSettings.v2", JSON.stringify(s));
  }, settings);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-pitch-card="1"]', { timeout: 25000 });
  await page.waitForTimeout(900);
}

async function measure() {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-pitch-card="1"]')];
    return cards.map((el) => {
      const token =
        el.querySelector("[data-pitch-token]") ||
        el.querySelector("button span.inline-flex") ||
        el.querySelector("button") ||
        el;
      const r = token.getBoundingClientRect();
      const left = parseFloat(el.style.left);
      const top = parseFloat(el.style.top);
      return {
        side: el.getAttribute("data-pitch-side"),
        slot: el.getAttribute("data-pitch-slot"),
        left,
        top,
        w: r.width,
        h: r.height,
        cx: (r.left + r.right) / 2,
      };
    });
  });
}

function key(c) {
  return `${c.side}:${c.slot}`;
}

const byPct = {};
for (const pct of PCTS) {
  await loadWithSettings({
    markerSizePct: pct,
    nameSizePct: 0,
    dataRows: 2,
    fieldsPerRow: 4,
    userAdjusted: true,
  });
  const rows = await measure();
  byPct[pct] = rows;
  const sample = rows[0];
  console.log(
    "SIZE",
    pct,
    "cards",
    rows.length,
    "sample",
    sample
      ? { w: Math.round(sample.w), h: Math.round(sample.h), left: sample.left, top: sample.top }
      : null
  );
}

const baseline = byPct[0] || byPct[-15] || byPct[PCTS[0]];
if (!baseline?.length) {
  console.log("FAIL no cards");
  await browser.close();
  process.exit(1);
}

const baseMap = new Map(baseline.map((c) => [key(c), c]));
let anchorFail = false;
const issues = [];

for (const pct of PCTS) {
  const rows = byPct[pct];
  const map = new Map(rows.map((c) => [key(c), c]));
  if (map.size !== baseMap.size) {
    issues.push(`pct ${pct}: card count ${map.size} vs base ${baseMap.size}`);
    anchorFail = true;
  }
  for (const [k, b] of baseMap) {
    const c = map.get(k);
    if (!c) {
      issues.push(`pct ${pct}: missing ${k}`);
      anchorFail = true;
      continue;
    }
    if (Math.abs(c.left - b.left) > DEPTH_EPS_PCT) {
      issues.push(
        `pct ${pct}: ${k} left ${c.left.toFixed(2)} vs base ${b.left.toFixed(2)} (depth)`
      );
      anchorFail = true;
    }
    if (Math.abs(c.top - b.top) > LATERAL_EPS_PCT) {
      issues.push(
        `pct ${pct}: ${k} top ${c.top.toFixed(2)} vs base ${b.top.toFixed(2)} (lateral)`
      );
      anchorFail = true;
    }
  }
}

// Depth-band order: home CB left of CDM (screen x), away CB right of CDM
function depthIssues(rows, side) {
  const out = [];
  const cbs = rows.filter((r) => r.side === side && (r.slot === "RCB" || r.slot === "LCB"));
  const cdms = rows.filter((r) => r.side === side && (r.slot === "RDM" || r.slot === "LDM" || r.slot === "CDM"));
  for (const cb of cbs) {
    for (const cdm of cdms) {
      const ok = side === "home" ? cb.cx < cdm.cx - 2 : cb.cx > cdm.cx + 2;
      if (!ok) out.push(`${side} ${cb.slot}@${cb.cx.toFixed(0)} vs ${cdm.slot}@${cdm.cx.toFixed(0)}`);
    }
  }
  return out;
}

let depthFail = false;
for (const pct of PCTS) {
  const hi = depthIssues(byPct[pct], "home");
  const ai = depthIssues(byPct[pct], "away");
  if (hi.length || ai.length) {
    depthFail = true;
    issues.push(`pct ${pct} depth:`, ...hi, ...ai);
  }
}

const wNeg = byPct[-40]?.[0]?.w ?? 0;
const wMid = byPct[-15]?.[0]?.w ?? byPct[0]?.[0]?.w ?? 0;
const wPos = byPct[40]?.[0]?.w ?? 0;
const sizeOk = wPos > wMid && wMid > wNeg && wPos - wNeg >= 15;

console.log("SIZE_RANGE", {
  wNeg: Math.round(wNeg),
  wMid: Math.round(wMid),
  wPos: Math.round(wPos),
  sizeOk,
});
if (issues.length) {
  console.log("ISSUES");
  for (const i of issues) console.log(" -", i);
}
const pass = sizeOk && !anchorFail && !depthFail;
console.log(pass ? "PASS" : "FAIL", { sizeOk, anchorFail, depthFail });

await page.screenshot({ path: ".pitchline-marker-anchor-verify.png", fullPage: false });
await browser.close();
process.exit(pass ? 0 : 1);
