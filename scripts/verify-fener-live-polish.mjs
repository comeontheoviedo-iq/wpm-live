import { chromium } from "playwright";

const matchId = "cmtol75ys0crk1bhyhj7aikkx";
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
await page.goto(`http://localhost:3000/match-day/${matchId}`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForSelector('[data-pitch-card="1"]', { timeout: 30000 });
await page.waitForTimeout(2500);

const skr = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('[data-pitch-card="1"]')];
  const hit = cards.find((el) => /SKRINIAR|ŠKRINIAR|KRINIAR/i.test(el.innerText || ""));
  if (!hit) return { found: false };
  const text = (hit.innerText || "").replace(/\s+/g, " ").trim();
  return {
    found: true,
    text,
    hasSGOL: /S\s*GOL/i.test(text),
    hasMGOL: /M\s*GOL/i.test(text),
    mGol1: /M\s*GOL\s*1/i.test(text),
  };
});
console.log("SKRINIAR", skr);

const logos = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")].map((i) => i.src);
  return {
    team: imgs.filter((s) => /\/teams\//.test(s)).length,
    league: imgs.filter((s) => /\/leagues\//.test(s)).length,
  };
});
console.log("LOGOS", logos);

const chips = await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
    .filter((t) => /Relevant|Pinned|All/.test(t))
    .slice(0, 6)
);
console.log("CHIPS", chips);

const sports = await page.evaluate(() =>
  /SportsPro|SportsCom/i.test(document.body.innerText || "")
);
console.log("SPORTS_LEAK", sports);

// Field settings open
await page.click('button[aria-label="Field settings"], button:has-text("Field")').catch(() => null);
await page.waitForTimeout(600);
const fieldUi = await page.evaluate(() => {
  const dialog = document.querySelector('[aria-labelledby="field-settings-title"]');
  if (!dialog) return { open: false };
  const t = dialog.textContent || "";
  return {
    open: true,
    hasToggles: /S GOL|M GOL|APP/.test(t),
    hasCurrency: /€|£|\$/.test(t),
    hasHeight: /cm|ft\/in/.test(t),
    sports: /SportsPro|SportsCom/i.test(t),
  };
});
console.log("FIELD_UI", fieldUi);

await page.screenshot({ path: ".pitchline-fener-live-polish.png" });

// Nav check — no Keepers/Penalties
await page.goto(`http://localhost:3000/match-day/${matchId}/venue`, { waitUntil: "networkidle" });
const venue = await page.evaluate(() => {
  const t = document.body.innerText || "";
  return {
    sponsored: /Sponsored name/i.test(t),
    historic: /Original \/ historic name/i.test(t),
    chobani: /Chobani/i.test(t),
  };
});
console.log("VENUE", venue);

await page.goto(`http://localhost:3000/match-day/${matchId}/squad`, { waitUntil: "networkidle" });
const squad = await page.evaluate(() => {
  const t = document.body.innerText || "";
  return {
    xi: /Current XI/i.test(t),
    bench: /\bBench\b/i.test(t),
    notIn: /Not in matchday squad/i.test(t),
  };
});
console.log("SQUAD", squad);

const nav = await page.evaluate(() => {
  const links = [...document.querySelectorAll("nav a")].map((a) =>
    (a.textContent || "").trim()
  );
  return {
    keepers: links.some((l) => /Keepers/i.test(l)),
    penalties: links.some((l) => /Penalties/i.test(l)),
    links: links.slice(0, 20),
  };
});
console.log("NAV", nav);

let ok = true;
if (!skr.found || !skr.hasSGOL || !skr.hasMGOL || !skr.mGol1) {
  console.error("FAIL skriniar", skr);
  ok = false;
} else console.log("OK skriniar S/M GOL");
if (sports || fieldUi.sports) {
  console.error("FAIL sports leak");
  ok = false;
} else console.log("OK no Sports* in UI");
if (!fieldUi.open || !fieldUi.hasToggles || !fieldUi.hasCurrency) {
  console.error("FAIL field settings", fieldUi);
  ok = false;
} else console.log("OK field customisation");
if (!venue.sponsored || !venue.historic) {
  console.error("FAIL venue", venue);
  ok = false;
} else console.log("OK venue names");
if (!squad.xi || !squad.bench || !squad.notIn) {
  console.error("FAIL squad", squad);
  ok = false;
} else console.log("OK squad columns");
if (nav.keepers || nav.penalties) {
  console.error("FAIL nav still has keepers/penalties", nav);
  ok = false;
} else console.log("OK nav purged");

await browser.close();
process.exit(ok ? 0 : 1);
