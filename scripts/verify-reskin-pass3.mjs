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
  // Desk scan smoke
  await page.goto(`http://localhost:3000/match-day/${desk.id}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector("[data-desk-mode]", { timeout: 30000 });
  await page.waitForTimeout(800);
  const deskState = await page.evaluate(() => {
    const root = document.querySelector("[data-desk-mode]");
    return {
      mode: root?.getAttribute("data-desk-mode"),
      hasScan: root?.classList.contains("scan-desk"),
      sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
      violetClass: /violet-/.test(document.body.innerHTML),
    };
  });
  await page.screenshot({ path: `.pitchline-pass3-desk-${desk.label}.png` });

  // Research / packs
  await page.goto(`http://localhost:3000/match-day/${desk.id}/packs`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(900);
  const research = await page.evaluate(() => {
    const html = document.body.innerHTML;
    const text = document.body.innerText;
    return {
      hasStages: /Research \/ Prep stages/i.test(text),
      hasNotebook: /Notebook/i.test(text),
      hasPanelSurface: !!document.querySelector(".panel-surface"),
      violetClass: /violet-/.test(html),
      tealCandy: /bg-teal-|border-teal-|text-teal-|bg-violet-|border-violet-/.test(html),
      sportsPro: /SportsPro|Understat/i.test(text),
      title: document.querySelector("h2")?.textContent?.trim() || null,
    };
  });
  await page.screenshot({ path: `.pitchline-pass3-research-${desk.label}.png` });

  // Scripts
  await page.goto(`http://localhost:3000/match-day/${desk.id}/scripts`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const scripts = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return {
      hasScripts: /Scripts/i.test(document.body.innerText),
      tealCandy: /text-teal-|bg-teal-/.test(html),
      sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
    };
  });
  await page.screenshot({ path: `.pitchline-pass3-scripts-${desk.label}.png` });

  // League dossier
  await page.goto(`http://localhost:3000/match-day/${desk.id}/league`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(900);
  const league = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return {
      hasLeague: /League|Standings|Profile/i.test(document.body.innerText),
      tealCandy: /bg-teal-|border-teal-|text-teal-/.test(html),
      sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
    };
  });
  await page.screenshot({ path: `.pitchline-pass3-league-${desk.label}.png` });

  // Clubs dossier shell
  await page.goto(`http://localhost:3000/match-day/${desk.id}/clubs`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1000);
  const clubs = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return {
      hasClub: /Club|Clubs|dossier/i.test(document.body.innerText),
      tealCandy: /bg-teal-|border-teal-|ring-teal-/.test(html),
      sportsPro: /SportsPro|Understat/i.test(document.body.innerText),
      violetClass: /violet-/.test(html),
    };
  });
  await page.screenshot({ path: `.pitchline-pass3-clubs-${desk.label}.png` });

  results.push({ desk: desk.label, deskState, research, scripts, league, clubs });
  console.log(JSON.stringify(results[results.length - 1], null, 2));
}

await browser.close();

let ok = true;
for (const r of results) {
  if (!r.deskState.hasScan || r.deskState.mode !== "scan") {
    console.error("FAIL desk scan", r.desk, r.deskState); ok = false;
  }
  if (r.deskState.sportsPro || r.research.sportsPro || r.scripts.sportsPro || r.league.sportsPro || r.clubs.sportsPro) {
    console.error("FAIL SportsPro/Understat", r.desk); ok = false;
  }
  if (r.research.violetClass || r.research.tealCandy || !r.research.hasStages || !r.research.hasPanelSurface) {
    console.error("FAIL research", r.desk, r.research); ok = false;
  }
  if (r.scripts.tealCandy || !r.scripts.hasScripts) {
    console.error("FAIL scripts", r.desk, r.scripts); ok = false;
  }
  if (r.league.tealCandy || !r.league.hasLeague) {
    console.error("FAIL league", r.desk, r.league); ok = false;
  }
  if (r.clubs.tealCandy || r.clubs.violetClass || !r.clubs.hasClub) {
    console.error("FAIL clubs", r.desk, r.clubs); ok = false;
  }
}
console.log(ok ? "PASS3 OK" : "PASS3 ISSUES");
process.exit(ok ? 0 : 1);
