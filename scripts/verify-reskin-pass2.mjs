import { chromium } from "playwright";

const desks = [
  { id: "cmtorhbeo08zm11zutipi5m3a", label: "nufc" },
  { id: "cmtol75ys0crk1bhyhj7aikkx", label: "fener" },
];

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

const results = [];

for (const desk of desks) {
  await page.goto(`http://localhost:3000/match-day/${desk.id}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector("[data-desk-mode]", { timeout: 30000 });
  await page.waitForSelector('[data-pitch-card="1"]', { timeout: 30000 });
  await page.waitForTimeout(1200);

  const scan = await page.evaluate(() => {
    const root = document.querySelector("[data-desk-mode]");
    const rail = document.querySelector('[data-desk-rail="notes"]');
    const primary = document.querySelector('[data-desk-primary="pitch"]');
    const noteRow = document.querySelector(".queue-row");
    const cs = rail ? getComputedStyle(rail) : null;
    const ps = primary ? getComputedStyle(primary) : null;
    return {
      mode: root?.getAttribute("data-desk-mode"),
      hasScan: root?.classList.contains("scan-desk"),
      hasQueueRow: !!noteRow,
      railOpacity: cs ? parseFloat(cs.opacity) : null,
      primaryOpacity: ps ? parseFloat(ps.opacity) : null,
      sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
    };
  });

  await page.screenshot({ path: `.pitchline-pass2-scan-${desk.label}.png` });

  // Investigate via real player card button
  await page.locator('[data-pitch-card="1"] button').first().click({ force: true });
  await page.waitForTimeout(1500);

  // Player click → fixed right dossier (pre-investigate screenflow)
  const inv = await page.evaluate(() => {
    const root = document.querySelector("[data-desk-mode]");
    const dossier =
      document.querySelector('[aria-label="Close dossier"]')?.closest(".fixed, [class*=fixed]") ||
      Array.from(document.querySelectorAll("div")).find((el) => {
        const s = getComputedStyle(el);
        return s.position === "fixed" && s.zIndex === "50" && el.querySelector('button[aria-label="Close dossier"]');
      }) ||
      null;
    // Prefer explicit close-button ancestor walk
    const closeBtn = document.querySelector('button[aria-label="Close dossier"]');
    let dossierEl = null;
    if (closeBtn) {
      let n = closeBtn;
      while (n && n !== document.body) {
        const s = getComputedStyle(n);
        if (s.position === "fixed" && (n.className || "").includes("fixed")) {
          dossierEl = n;
          break;
        }
        n = n.parentElement;
      }
      if (!dossierEl) dossierEl = closeBtn.closest("div");
    }
    const primary = document.querySelector('[data-desk-primary="pitch"]');
    const ps = primary ? getComputedStyle(primary) : null;
    const ds = dossierEl ? getComputedStyle(dossierEl) : null;
    return {
      mode: root?.getAttribute("data-desk-mode"),
      hasInvestigate: root?.classList.contains("investigate-desk"),
      dossierOpen: !!closeBtn,
      dossierPosition: ds?.position || null,
      dossierZ: ds?.zIndex || null,
      dossierRight: ds?.right || null,
      dossierTitle: dossierEl?.querySelector("h2")?.textContent?.trim() || null,
      primaryOpacity: ps ? parseFloat(ps.opacity) : null,
      hasDeskFocusAttr: !!document.querySelector("[data-desk-focus]"),
    };
  });

  await page.screenshot({ path: `.pitchline-pass2-investigate-${desk.label}.png` });

  // Close dossier
  const close = page.locator('button[aria-label="Close dossier"], button[aria-label="Close"]');
  if (await close.count()) {
    await close.first().click({ force: true });
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForSelector('button[aria-label="Close dossier"]', { state: "detached", timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(400);

  // On-air
  await page.getByRole("button", { name: /On-air/i }).first().click({ force: true });
  await page.waitForTimeout(700);
  const onair = await page.evaluate(() => {
    const root = document.querySelector("[data-desk-mode]");
    const header = document.querySelector("header.desk-header");
    const hs = header ? getComputedStyle(header) : null;
    const notesRail = document.querySelector('[data-desk-rail="notes"]');
    const primary = document.querySelector('[data-desk-primary="pitch"]');
    const ps = primary ? getComputedStyle(primary) : null;
    return {
      mode: root?.getAttribute("data-desk-mode"),
      hasOnair: root?.classList.contains("onair-desk"),
      notesHidden: !notesRail,
      headerOpacity: hs ? parseFloat(hs.opacity) : null,
      primaryOpacity: ps ? parseFloat(ps.opacity) : null,
    };
  });

  await page.screenshot({ path: `.pitchline-pass2-onair-${desk.label}.png` });
  await page.getByRole("button", { name: /On-air/i }).first().click({ force: true });
  await page.waitForTimeout(300);

  // League + notes routes smoke
  await page.goto(`http://localhost:3000/match-day/${desk.id}/league`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  const league = await page.evaluate(() => ({
    hasPanel: !!document.querySelector(".rounded-\\[var\\(--radius-md\\)\\], [class*=radius-md]") ||
      document.body.innerText.includes("League") ||
      document.body.innerText.includes("Standings") ||
      document.body.innerText.length > 200,
    sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
  }));

  await page.goto(`http://localhost:3000/match-day/${desk.id}/news`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  const news = await page.evaluate(() => ({
    violet: /violet-/.test(document.body.innerHTML),
    sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
  }));

  results.push({ desk: desk.label, scan, inv, onair, league, news });
  console.log(JSON.stringify({ desk: desk.label, scan, inv, onair, league, news }, null, 2));
}

await browser.close();

let ok = true;
for (const r of results) {
  if (!r.scan.hasScan || r.scan.mode !== "scan") { console.error("FAIL scan", r.desk); ok = false; }
  if (!(r.scan.railOpacity > 0.7 && r.scan.railOpacity < 0.9)) {
    console.error("FAIL scan rail opacity", r.desk, r.scan.railOpacity); ok = false;
  }
  if (!r.scan.hasQueueRow) { console.error("FAIL queue-row", r.desk); ok = false; }
  if (r.scan.sportsPro || r.news.sportsPro || r.league.sportsPro) {
    console.error("FAIL SportsPro/Understat", r.desk); ok = false;
  }
  if (r.news.violet) { console.error("FAIL violet news", r.desk); ok = false; }
  // Restored pre-reskin flow: stay in scan, fixed dossier drawer, no investigate weighting
  if (r.inv.hasInvestigate || r.inv.mode === "investigate") {
    console.error("FAIL investigate mode still active", r.desk, r.inv); ok = false;
  }
  if (!r.inv.dossierOpen || r.inv.dossierPosition !== "fixed") {
    console.error("FAIL dossier not fixed drawer", r.desk, r.inv); ok = false;
  }
  if (r.inv.hasDeskFocusAttr) {
    console.error("FAIL leftover data-desk-focus", r.desk, r.inv); ok = false;
  }
  if (r.inv.primaryOpacity != null && r.inv.primaryOpacity < 0.95) {
    console.error("FAIL pitch unexpectedly dimmed on player click", r.desk, r.inv.primaryOpacity); ok = false;
  }
  if (!r.onair.hasOnair || !r.onair.notesHidden) {
    console.error("FAIL onair", r.desk, r.onair); ok = false;
  }
  if (!(r.onair.headerOpacity > 0.7 && r.onair.headerOpacity < 0.9)) {
    console.error("FAIL onair header opacity", r.desk, r.onair.headerOpacity); ok = false;
  }
}
console.log(ok ? "PASS2 OK" : "PASS2 ISSUES");
process.exit(ok ? 0 : 1);
