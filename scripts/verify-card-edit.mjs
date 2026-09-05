import { chromium } from "playwright";

const NUFC = "cmtorhbeo08zm11zutipi5m3a";
const FENER = "cmtol75ys0crk1bhyhj7aikkx";

async function login(page) {
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', "demo@pitchline.app");
  await page.fill('input[type="password"], input[name="password"]', "demo1234");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(600);
}

async function openDesk(page, matchId) {
  await page.goto(`http://localhost:3000/match-day/${matchId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1800);
}

async function run(matchId, label) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`[${label}] PAGEERROR`, e.message));
  const push = (m) => console.log(`[${label}] ${m}`);

  try {
    await login(page);
    await openDesk(page, matchId);

    await page.evaluate(() => {
      localStorage.removeItem("pitchline.fieldSettings.v4");
      localStorage.removeItem("pitchline.fieldSettings.v3");
      localStorage.removeItem("pitchline.fieldSettings.v2");
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Find field settings button
    const fsBtn = page.getByRole("button", { name: "Field Settings" });
    const fsCount = await fsBtn.count();
    push(`Field Settings buttons=${fsCount}`);
    if (!fsCount) {
      // dump aria labels
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .map((b) => b.getAttribute("aria-label") || b.title || b.textContent?.trim()?.slice(0, 40))
          .filter(Boolean)
          .slice(0, 40)
      );
      push(`buttons sample: ${JSON.stringify(labels)}`);
      throw new Error("No Field Settings button");
    }
    await fsBtn.first().click();
    await page.waitForTimeout(500);
    await page.waitForSelector("#field-settings-title", { timeout: 8000 });

    for (const name of ["Player", "Keeper", "Coach", "Referee"]) {
      const tab = page.getByRole("tab", { name });
      const disabled = await tab.isDisabled();
      push(`tab ${name} disabled=${disabled}`);
      if (disabled) throw new Error(`${name} tab still disabled`);
    }

    // Keeper
    await page.getByRole("tab", { name: "Keeper" }).click();
    await page.waitForTimeout(250);
    const sv = page.getByRole("button", { name: "SV", exact: true });
    const cs = page.getByRole("button", { name: "CS", exact: true });
    push(`SV visible=${await sv.isVisible()} CS visible=${await cs.isVisible()}`);
    const ageBtn = page.getByRole("button", { name: "AGE", exact: true });
    const svClass = await sv.getAttribute("class");
    if (svClass && svClass.includes("line-through")) await sv.click();
    const ageClass = await ageBtn.getAttribute("class");
    if (ageClass && !ageClass.includes("line-through")) await ageBtn.click();
    await page.waitForTimeout(150);

    // Coach
    await page.getByRole("tab", { name: "Coach" }).click();
    await page.waitForTimeout(250);
    const flagBtn = page.getByRole("button", { name: "Flag", exact: true });
    const ageChrome = page.getByRole("button", { name: "Age", exact: true });
    let fc = await flagBtn.getAttribute("class");
    if (fc && !fc.includes("line-through")) await flagBtn.click();
    let ac = await ageChrome.getAttribute("class");
    if (ac && ac.includes("line-through")) await ageChrome.click();
    await page.waitForTimeout(150);

    // Referee
    await page.getByRole("tab", { name: "Referee" }).click();
    await page.waitForTimeout(250);
    const prefixBtn = page.getByRole("button", { name: /Ref · prefix/i });
    let pc = await prefixBtn.getAttribute("class");
    if (pc && !pc.includes("line-through")) await prefixBtn.click();
    await page.waitForTimeout(150);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pitchline.fieldSettings.v4") || "null")
    );
    push(`stored keeper=${JSON.stringify(stored?.keeperVisibleFields)}`);
    push(`stored coach=${JSON.stringify(stored?.coach)}`);
    push(`stored ref=${JSON.stringify(stored?.referee)}`);

    if (!stored?.keeperVisibleFields?.includes("SV")) throw new Error("SV not persisted");
    if (stored?.keeperVisibleFields?.includes("AGE")) throw new Error("AGE should be off");
    if (stored?.coach?.showFlag !== false) throw new Error("coach flag should be false");
    if (stored?.coach?.showAge !== true) throw new Error("coach age should be true");
    if (stored?.referee?.showPrefix !== false) throw new Error("ref prefix should be false");

    await page.locator('[role="dialog"]').getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(400);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const stored2 = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pitchline.fieldSettings.v4") || "null")
    );
    push(`after reload prefix=${stored2?.referee?.showPrefix} flag=${stored2?.coach?.showFlag}`);

    // Referee chip text
    const darkChips = await page.locator(".pitch-overlay-chip-dark").allInnerTexts();
    push(`dark chips: ${JSON.stringify(darkChips)}`);
    const refChip = darkChips.find((t) => !/^SUB/i.test(t.trim()));
    if (refChip && stored2?.referee?.showPrefix === false && /^\s*Ref\s*·/.test(refChip)) {
      throw new Error("Ref prefix still showing: " + refChip);
    }
    if (refChip) push(`ref chip ok: ${JSON.stringify(refChip)}`);

    // Coach Edit card
    const coachBtn = page.locator("button.pitch-overlay-chip").first();
    if (await coachBtn.count()) {
      await coachBtn.click();
      await page.waitForTimeout(500);
      const editCard = page.getByRole("button", { name: "Edit card" });
      if (await editCard.isVisible()) {
        await editCard.click();
        await page.waitForTimeout(400);
        const coachTabSelected = await page
          .getByRole("tab", { name: "Coach" })
          .getAttribute("aria-selected");
        push(`Edit card → Coach tab selected=${coachTabSelected}`);
        if (coachTabSelected !== "true") throw new Error("Edit card did not open Coach tab");
        await page.locator('[role="dialog"]').getByRole('button', { name: 'Close' }).click();
        await page.waitForTimeout(300);
      } else {
        push("no Edit card (drawer may not have opened)");
      }
    }

    // Ref click
    const refButtons = page.locator("button.pitch-overlay-chip-dark");
    const n = await refButtons.count();
    push(`clickable dark chips=${n}`);
    if (n) {
      await refButtons.last().click();
      await page.waitForTimeout(400);
      const titleVisible = await page.locator("#field-settings-title").isVisible();
      if (titleVisible) {
        const refSel = await page
          .getByRole("tab", { name: "Referee" })
          .getAttribute("aria-selected");
        push(`ref click → Referee selected=${refSel}`);
        if (refSel !== "true") throw new Error("ref click wrong tab");
        await page.locator('[role="dialog"]').getByRole('button', { name: 'Close' }).click();
      } else {
        push("ref click did not open modal");
      }
    }

    // GK card click → dossier
    const gkHit = page.locator('[data-pitch-card="1"]').filter({ hasText: "GK" }).first();
    if (await gkHit.count()) {
      await gkHit.click({ force: true });
      await page.waitForTimeout(700);
      const gear = page.getByRole("button", { name: /Pitch card overrides/i });
      push(`GK dossier gear visible=${await gear.isVisible().catch(() => false)}`);
    } else {
      push("no GK card");
    }

    await page.screenshot({ path: `.pitchline-card-edit-${label}.png` });
    push("PASS");
  } catch (e) {
    push("FAIL: " + e.message);
    await page.screenshot({ path: `.pitchline-card-edit-${label}-fail.png` }).catch(() => {});
    throw e;
  } finally {
    await browser.close();
  }
}

await run(NUFC, "nufc");
await run(FENER, "fener");
console.log("ALL PASS");
