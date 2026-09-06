import { chromium } from "playwright";
import { writeFileSync } from "fs";

const deskId = "cmtorhbeo08zm11zutipi5m3a"; // Newcastle
const shot = ".pitchline-tokens-fernandez-o-nufc.png";

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
await page.waitForSelector("[data-pitch-token]", { timeout: 45000 });
await page.waitForTimeout(2000);

await page.evaluate(() => {
  document.querySelectorAll('[role="dialog"] button[title="Dismiss"]').forEach((b) => b.click());
});
await page.waitForTimeout(500);

const pre = await page.evaluate(() => {
  const tokens = [...document.querySelectorAll("[data-pitch-token]")];
  const tokenEl =
    tokens[0]?.querySelector(".pitch-token") || tokens[0]?.firstElementChild;
  const ts = tokenEl ? getComputedStyle(tokenEl) : null;
  const id = tokenEl?.querySelector(".pitch-token-id");
  const name = tokenEl?.querySelector(".pitch-token-name");
  const age = tokenEl?.querySelector(".pitch-token-age");
  const hair = tokenEl?.querySelector(".pitch-token-hairline");
  const photo = tokenEl?.querySelector(".pitch-token-photo");
  const stats = tokenEl?.querySelector(".pitch-token-stats");
  const statCells = tokenEl
    ? [...tokenEl.querySelectorAll(".pitch-token-stat-value")].length
    : 0;
  const coach = document.querySelector(".pitch-overlay-chip");
  const scorebug = document.querySelector(".scorebug");
  const root = document.querySelector("[data-desk-mode]");

  const samples = tokens.map((t) => {
    const el = t.querySelector(".pitch-token") || t.firstElementChild;
    const num = el?.querySelector(".pitch-token-id");
    const hl = el?.querySelector(".pitch-token-hairline");
    const nameEl = el?.querySelector(".pitch-token-name");
    const nameText = nameEl?.textContent?.trim() || null;
    const truncated = nameEl
      ? nameEl.scrollWidth > nameEl.clientWidth + 1
      : false;
    const nameFont = nameEl ? parseFloat(getComputedStyle(nameEl).fontSize) : null;
    return {
      idText: num?.textContent?.trim() || null,
      idColor: num ? getComputedStyle(num).color : null,
      hairColor: hl ? getComputedStyle(hl).backgroundColor : null,
      name: nameText,
      nameFont,
      nameFit: nameEl?.getAttribute("data-name-fit") || null,
      nameClientW: nameEl ? nameEl.clientWidth : null,
      nameScrollW: nameEl ? nameEl.scrollWidth : null,
      truncated,
      age: el?.querySelector(".pitch-token-age")?.textContent?.trim() || null,
      hasPhoto: !!el?.querySelector(".pitch-token-photo"),
      tokenW: el ? Math.round(el.getBoundingClientRect().width) : null,
      statCount: el
        ? [...el.querySelectorAll(".pitch-token-stat-value")].length
        : 0,
    };
  });
  const mustRead = [
    "LIVRAMENTO",
    "FERNANDEZ-PARDO",
    "BARNES",
    "RAMSEY",
    "TRUFFERT",
    "BOTMAN",
  ];
  const nameHits = mustRead.map((n) => {
    const hit = samples.find((s) => (s.name || "").includes(n));
    return {
      want: n,
      found: !!hit,
      truncated: hit?.truncated ?? null,
      name: hit?.name ?? null,
      nameFont: hit?.nameFont ?? null,
      nameFit: hit?.nameFit ?? null,
    };
  });
  const fern = samples.find((s) => (s.name || "").includes("FERNANDEZ-PARDO"));
  const fernShrunk =
    !!fern &&
    typeof fern.nameFont === "number" &&
    fern.nameFont < 8.95 &&
    fern.truncated === false;
  const truncatedCount = samples.filter((s) => s.truncated).length;

  return {
    mode: root?.getAttribute("data-desk-mode"),
    hasInvestigate: root?.classList.contains("investigate-desk"),
    tokenCount: tokens.length,
    radius: ts?.borderRadius || null,
    bg: ts?.backgroundColor || null,
    hasHairline: !!hair,
    hasPhoto: !!photo,
    hasIdentity: !!tokenEl?.querySelector(".pitch-token-identity"),
    idFont: id ? getComputedStyle(id).fontSize : null,
    idWeight: id ? getComputedStyle(id).fontWeight : null,
    idColor: id ? getComputedStyle(id).color : null,
    hairColor: hair ? getComputedStyle(hair).backgroundColor : null,
    nameText: name?.textContent?.trim() || null,
    ageText: age?.textContent?.trim() || null,
    ageFont: age ? getComputedStyle(age).fontSize : null,
    ageColor: age ? getComputedStyle(age).color : null,
    statCount: statCells,
    statsBg: stats ? getComputedStyle(stats).backgroundColor : null,
    coachSlim: !!coach,
    scorebugOk: !!scorebug,
    samples: samples.slice(0, 8),
    allNames: samples.map((s) => s.name),
    truncatedCount,
    nameHits,
    fernShrunk,
    fern: fern
      ? {
          name: fern.name,
          nameFont: fern.nameFont,
          nameFit: fern.nameFit,
          truncated: fern.truncated,
          clientW: fern.nameClientW,
          scrollW: fern.nameScrollW,
        }
      : null,
  };
});

const pitch = page
  .locator('[data-desk-primary="pitch"], .relative.w-full.overflow-hidden')
  .first();
const pitchBox = await pitch.boundingBox().catch(() => null);
if (pitchBox) {
  const clip = {
    x: Math.max(0, pitchBox.x + pitchBox.width * 0.08),
    y: Math.max(0, pitchBox.y + 8),
    width: Math.min(900, pitchBox.width * 0.55),
    height: Math.min(720, pitchBox.height * 0.92),
  };
  await page.screenshot({ path: shot, clip });
} else {
  await page.screenshot({ path: shot, fullPage: false });
}

await page.locator('[data-pitch-card="1"] button').first().click({ force: true });
await page.waitForTimeout(1500);

const dossier = await page.evaluate(() => {
  const root = document.querySelector("[data-desk-mode]");
  const closeBtn = document.querySelector('button[aria-label="Close dossier"]');
  let dossierEl = null;
  if (closeBtn) {
    let n = closeBtn.parentElement;
    while (n && n !== document.body) {
      if (getComputedStyle(n).position === "fixed") {
        dossierEl = n;
        break;
      }
      n = n.parentElement;
    }
  }
  const ds = dossierEl ? getComputedStyle(dossierEl) : null;
  return {
    mode: root?.getAttribute("data-desk-mode"),
    hasInvestigate: root?.classList.contains("investigate-desk"),
    dossierOpen: !!closeBtn,
    position: ds?.position || null,
    right: ds?.right || null,
    top: ds?.top || null,
    zIndex: ds?.zIndex || null,
    title: dossierEl?.querySelector("h2")?.textContent?.trim() || null,
  };
});

await browser.close();

const result = { pre, dossier, shot };
writeFileSync(".pitchline-tokens-craft-probe.json", JSON.stringify(result, null, 2));
writeFileSync(".pitchline-tokens-autofit-probe.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

const idPx = pre.idFont ? parseFloat(pre.idFont) : 0;
const hairMatchesId =
  pre.samples?.some(
    (s) => s.idColor && s.hairColor && s.idColor === s.hairColor
  ) ?? false;

const namesOk =
  Array.isArray(pre.nameHits) &&
  pre.nameHits.every((h) => h.found && h.truncated === false) &&
  (pre.truncatedCount ?? 99) === 0 &&
  pre.fernShrunk === true;

const ok =
  dossier.dossierOpen &&
  dossier.position === "fixed" &&
  dossier.right === "0px" &&
  !dossier.hasInvestigate &&
  !pre.hasInvestigate &&
  pre.hasHairline &&
  pre.hasPhoto &&
  pre.hasIdentity &&
  pre.statCount >= 3 &&
  idPx >= 14 &&
  pre.ageText?.includes("y/o") &&
  pre.scorebugOk &&
  pre.coachSlim &&
  hairMatchesId &&
  namesOk;

console.log(ok ? "TOKENS CRAFT OK" : "TOKENS CRAFT FAIL");
if (!ok) {
  console.log({
    dossierOpen: dossier.dossierOpen,
    position: dossier.position,
    right: dossier.right,
    hasInvestigate: dossier.hasInvestigate || pre.hasInvestigate,
    hasHairline: pre.hasHairline,
    hasPhoto: pre.hasPhoto,
    hasIdentity: pre.hasIdentity,
    statCount: pre.statCount,
    idPx,
    ageText: pre.ageText,
    hairMatchesId,
    namesOk,
    truncatedCount: pre.truncatedCount,
    nameHits: pre.nameHits,
    fernShrunk: pre.fernShrunk,
    fern: pre.fern,
  });
}
process.exit(ok ? 0 : 1);
