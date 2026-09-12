/**
 * CoComms HOMEPAGE TRAILER frames — 30s silent promo (Chris script).
 * Strasbourg vs Monaco desk. NO music. Max two features.
 * Login via minted pitchline_session JWT (chris@).
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const MATCH_ID = "cmtuguaof0004rarmb9711ja5";
const BASE = "https://www.cocomms.online";
const OUT = "tmp/demo-video-promo30/frames";
const TOKEN = readFileSync("/tmp/.cocomms_session_jwt", "utf8").trim();

mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1920, height: 1080 };

const browser = await chromium.launch({ headless: true });

function cookie(domain) {
  return {
    name: "pitchline_session",
    value: TOKEN,
    domain,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  };
}

async function makeAuthedContext() {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  await context.addCookies([
    cookie("www.cocomms.online"),
    cookie("cocomms.online"),
  ]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("pitchline-broadcast-dark-v1", "1");
    localStorage.setItem("pitchline-theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  });
  return { context, page };
}

const probe = { who: null, shots: {}, meta: {} };

async function hideChrome(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".live-flash, .live-flash-viz").forEach((el) => {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    });
    const fb = document.querySelector(
      'button, a, [class*="feedback"]'
    );
    document.querySelectorAll("button").forEach((b) => {
      const t = (b.textContent || "").trim();
      if (/^Feedback$/i.test(t)) {
        b.style.display = "none";
      }
    });
  });
}

async function dismissOverlays(page) {
  const clearBtn = page.getByTitle(/Force-dismiss all live intel/i);
  if (await clearBtn.count()) {
    await clearBtn.first().click({ force: true }).catch(() => null);
  }
  await page.evaluate(() => {
    document
      .querySelectorAll(
        '[role="dialog"] button[title="Dismiss"], button[title="Dismiss"]'
      )
      .forEach((b) => b.click());
    document.querySelectorAll(".live-flash, .live-flash-viz").forEach((el) => {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    });
  });
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }
  await hideChrome(page);
  await page.waitForTimeout(200);
}

async function shot(page, name, { dismiss = true } = {}) {
  if (dismiss) await dismissOverlays(page);
  else await hideChrome(page);
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("SHOT", name);
  return path;
}

async function clickNav(page, label) {
  const tab = page
    .getByRole("link", { name: new RegExp(`^${label}`, "i") })
    .or(page.getByRole("button", { name: new RegExp(`^${label}`, "i") }));
  if (await tab.count()) {
    await tab.first().click().catch(() => null);
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

// ---------- Guest homepage (CoComms name) ----------
{
  const guest = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await guest.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);
  // Hide the old trailer so the hero copy is the reveal
  await page.evaluate(() => {
    document.querySelectorAll("video").forEach((v) => {
      v.style.visibility = "hidden";
    });
  });
  await shot(page, "01-homepage-guest.png", { dismiss: false });
  await guest.close();
}

const { context, page } = await makeAuthedContext();

// ---------- Dashboard (fixture select) ----------
await page.goto(`${BASE}/dashboard`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(1200);
await shot(page, "02-dashboard.png");

// Highlight Strasbourg–Monaco row if present
const strasRow = page.getByText(/Strasbourg/i).first();
if (await strasRow.count()) {
  await strasRow.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(300);
  await strasRow.hover().catch(() => null);
  await page.waitForTimeout(200);
}
await shot(page, "03-dashboard-stras.png");

// ---------- Research (chaos base) ----------
await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(2800);
probe.who = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return {
    hasChris: /chris@ronniedogmedia\.com/i.test(text) || /\bCB\b/.test(text),
    hasDemo: /demo@pitchline\.app|tester@cocomms/i.test(text),
    hasStras: /Strasbourg/i.test(text),
    hasMonaco: /Monaco/i.test(text),
    scorebug:
      document.querySelector(".scorebug")?.innerText?.replace(/\s+/g, " ").trim()?.slice(0, 160) ||
      null,
    pitchCards: document.querySelectorAll('[data-pitch-card="1"]').length,
  };
});
console.log("WHO", JSON.stringify(probe.who, null, 2));

await dismissOverlays(page);
await clickNav(page, "Research");
await page.waitForTimeout(1000);
await shot(page, "04-research.png");

// Stage browser-tab chaos on Research
await page.evaluate(() => {
  const root = document.createElement("div");
  root.id = "chaos-root";
  root.innerHTML = `
    <style>
      #chaos-root { position:fixed; inset:0; z-index:2147483646; pointer-events:none; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; }
      #chaos-chrome { position:absolute; top:0; left:0; right:0; background:#1a1d22; color:#d7dde6; box-shadow:0 8px 28px rgba(0,0,0,.45); }
      #chaos-tabs { display:flex; align-items:flex-end; gap:2px; padding:8px 8px 0; overflow:hidden; background:#12151a; }
      .ctab { display:flex; align-items:center; gap:8px; max-width:220px; padding:8px 12px; background:#2a3038; border-radius:8px 8px 0 0; font-size:12px; color:#c5cdd6; white-space:nowrap; overflow:hidden; }
      .ctab.active { background:#3a414c; color:#fff; }
      .cdot { width:8px; height:8px; border-radius:99px; flex:0 0 auto; }
      .cx { opacity:.45; font-size:11px; }
      #chaos-omni { display:flex; align-items:center; gap:10px; padding:8px 14px 10px; background:#2a3038; font-size:12px; color:#9aa3ad; }
      #chaos-omni .url { flex:1; background:#1c2026; border-radius:14px; padding:6px 14px; color:#d5dbe3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .sticky { position:absolute; width:240px; padding:12px 14px; background:#f6e27a; color:#2a2208; box-shadow:0 10px 24px rgba(0,0,0,.35); font-size:13px; line-height:1.35; transform:rotate(-3deg); }
      .sticky b { display:block; font-size:11px; letter-spacing:.04em; text-transform:uppercase; margin-bottom:4px; }
      .win { position:absolute; width:380px; background:#161a20; border:1px solid rgba(255,255,255,.12); border-radius:6px; box-shadow:0 18px 40px rgba(0,0,0,.5); overflow:hidden; }
      .win-bar { background:#2a3038; color:#d0d6de; font-size:11px; padding:6px 10px; display:flex; justify-content:space-between; }
      .win-body { padding:10px 12px; color:#c9d2dc; font-size:12px; line-height:1.45; }
    </style>
    <div id="chaos-chrome">
      <div id="chaos-tabs">
        <div class="ctab"><span class="cdot" style="background:#3b82f6"></span>Transfermarkt — Strasbourg<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#f59e0b"></span>Wiki — AS Monaco XI<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#ef4444"></span>team-sheet-L1.pdf<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#22c55e"></span>Notes — hooks + names<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#a78bfa"></span>WhatsApp — production<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#fb7185"></span>BBC Sport live blog<span class="cx">✕</span></div>
        <div class="ctab active"><span class="cdot" style="background:#14b8a6"></span>CoComms Research<span class="cx">✕</span></div>
      </div>
      <div id="chaos-omni">
        <span>← →</span>
        <div class="url">file:///Users/chris/Desktop/matchday/stras-monaco-NOTES-FINAL-v7.docx &nbsp;·&nbsp; 14 tabs</div>
      </div>
    </div>
    <div class="sticky" style="top:118px; left:36px;">
      <b>Phone note · 18:41</b>
      Embolo start?? Check Twitter.<br/>Still no official XI.
    </div>
    <div class="sticky" style="top:210px; right:48px; transform:rotate(2.5deg); background:#fde68a;">
      <b>Scrap paper</b>
      Monaco set pieces — left side.<br/>Where did I put the ages?
    </div>
    <div class="win" style="bottom:48px; left:56px; transform:rotate(-1deg);">
      <div class="win-bar"><span>team-sheet-L1.pdf</span><span>✕</span></div>
      <div class="win-body">
        STRASBOURG &nbsp; v &nbsp; MONACO<br/>
        Kick-off approaching · Ligue 1<br/><br/>
        1 Hutó · 36 Guela · 7 Amo-Ameyaw<br/>
        6 Doukouré · 14 Enciso · …<br/>
        <span style="color:#94a3b8">Page 1 of 4 · last opened 14 minutes ago</span>
      </div>
    </div>
    <div class="win" style="bottom:72px; right:64px; width:320px; transform:rotate(1.4deg);">
      <div class="win-bar"><span>Untitled spreadsheet</span><span>✕</span></div>
      <div class="win-body">
        Player &nbsp;&nbsp; Age &nbsp;&nbsp; Note<br/>
        Golovin &nbsp;&nbsp; ? &nbsp;&nbsp; find minutes<br/>
        Camara &nbsp;&nbsp; &nbsp;&nbsp; card risk??<br/>
        <span style="color:#f87171">#REF! &nbsp; tab 3 missing</span>
      </div>
    </div>
  `;
  document.body.appendChild(root);
});
await page.waitForTimeout(200);
await shot(page, "05-chaos-research.png", { dismiss: false });

// Also chaos on dashboard (more "too many boards")
await page.goto(`${BASE}/dashboard`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(900);
await page.evaluate(() => {
  const root = document.createElement("div");
  root.id = "chaos-root";
  root.innerHTML = `
    <style>
      #chaos-root { position:fixed; inset:0; z-index:2147483646; pointer-events:none; font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif; }
      #chaos-chrome { position:absolute; top:0; left:0; right:0; background:#1a1d22; color:#d7dde6; }
      #chaos-tabs { display:flex; align-items:flex-end; gap:2px; padding:8px 8px 0; overflow:hidden; background:#12151a; }
      .ctab { display:flex; align-items:center; gap:8px; max-width:210px; padding:8px 12px; background:#2a3038; border-radius:8px 8px 0 0; font-size:12px; color:#c5cdd6; white-space:nowrap; overflow:hidden; }
      .ctab.active { background:#3a414c; color:#fff; }
      .cdot { width:8px; height:8px; border-radius:99px; flex:0 0 auto; }
      .cx { opacity:.45; font-size:11px; }
      #chaos-omni { display:flex; align-items:center; gap:10px; padding:8px 14px 10px; background:#2a3038; font-size:12px; color:#9aa3ad; }
      #chaos-omni .url { flex:1; background:#1c2026; border-radius:14px; padding:6px 14px; color:#d5dbe3; }
      .sticky { position:absolute; width:230px; padding:12px 14px; background:#f6e27a; color:#2a2208; box-shadow:0 10px 24px rgba(0,0,0,.35); font-size:13px; line-height:1.35; }
    </style>
    <div id="chaos-chrome">
      <div id="chaos-tabs">
        <div class="ctab"><span class="cdot" style="background:#3b82f6"></span>Transfermarkt<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#f59e0b"></span>Wiki XI<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#ef4444"></span>team-sheet.pdf<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#22c55e"></span>Notes.app<span class="cx">✕</span></div>
        <div class="ctab"><span class="cdot" style="background:#a78bfa"></span>WhatsApp<span class="cx">✕</span></div>
        <div class="ctab active"><span class="cdot" style="background:#14b8a6"></span>14 tabs — still looking<span class="cx">✕</span></div>
      </div>
      <div id="chaos-omni"><span>← →</span><div class="url">Too many tabs. Kick-off approaching.</div></div>
    </div>
    <div class="sticky" style="top:130px; right:40px; transform:rotate(2deg);">
      <b>Where is it?</b>
      Ages · minutes · last 5.<br/>Four windows. None of them.
    </div>
  `;
  document.body.appendChild(root);
});
await shot(page, "06-chaos-dashboard.png", { dismiss: false });

// ---------- Clean desk ----------
await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(2800);
await dismissOverlays(page);
await shot(page, "10-desk.png");

await page.keyboard.press("o");
await page.waitForTimeout(600);
await dismissOverlays(page);
await shot(page, "11-desk-onair.png");

// ---------- Feature 2: player dossier ----------
await dismissOverlays(page);
let dossierOk = false;
const cards = page.locator('[data-pitch-card="1"]');
const cardCount = await cards.count();
probe.meta.pitchCards = cardCount;
for (let i = 0; i < Math.min(cardCount, 6); i++) {
  const btn = cards.nth(i).locator("button").first();
  if (await btn.count()) {
    await btn.click({ force: true }).catch(() => null);
  } else {
    await cards.nth(i).click({ force: true }).catch(() => null);
  }
  await page.waitForTimeout(1400);
  const found = await page.locator('[data-player-dossier="1"]').count();
  console.log("dossier try", i, "found", found);
  if (found) {
    await hideChrome(page);
    await shot(page, "15-dossier-desk.png", { dismiss: false });
    const box = page.locator('[data-player-dossier="1"]');
    await box.screenshot({ path: join(OUT, "16-dossier-detail.png") }).catch(() => null);
    console.log("SHOT 16-dossier-detail.png");
    dossierOk = true;
    break;
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}
probe.meta.dossierOk = dossierOk;

// Club dossier fallback via Clubs tab
if (!dossierOk) {
  await page.goto(`${BASE}/match-day/${MATCH_ID}/clubs`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
  await shot(page, "15-clubs.png");
  const openClub = page.getByRole("button", { name: /open|dossier|Strasbourg|Monaco/i }).first();
  if (await openClub.count()) {
    await openClub.click().catch(() => null);
    await page.waitForTimeout(1200);
    await shot(page, "15-dossier-desk.png", { dismiss: false });
    const club = page.locator('[data-club-dossier="1"], [data-player-dossier="1"]');
    if (await club.count()) {
      await club.first().screenshot({ path: join(OUT, "16-dossier-detail.png") }).catch(() => null);
      dossierOk = true;
    }
  }
}

// Notes (in case they have content now)
await page.goto(`${BASE}/match-day/${MATCH_ID}/notes`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(1000);
await shot(page, "17-notes.png");

// League / match info
await page.goto(`${BASE}/match-day/${MATCH_ID}/league`, {
  waitUntil: "networkidle",
  timeout: 90000,
});
await page.waitForTimeout(1200);
await shot(page, "18-league.png");

// Final clean on-air desk
await page.goto(`${BASE}/match-day/${MATCH_ID}`, {
  waitUntil: "networkidle",
  timeout: 120000,
});
await page.waitForTimeout(2500);
await dismissOverlays(page);
await page.keyboard.press("o");
await page.waitForTimeout(500);
await dismissOverlays(page);
await shot(page, "20-desk-ready.png");

// ---------- Designed cards (title + end) ----------
async function cardShot(html, name) {
  const p = await context.newPage();
  await p.setViewportSize(VIEWPORT);
  await p.setContent(html, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(OUT, name), fullPage: false });
  console.log("SHOT", name);
  await p.close();
}

const titleHtml = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#05080f;color:#e8eef7;
    font-family:Inter,ui-sans-serif,system-ui,Helvetica,Arial,sans-serif;}
  body{display:flex;align-items:center;justify-content:center;
    background:
      radial-gradient(ellipse at 50% 30%, rgba(45,212,191,.16), transparent 52%),
      linear-gradient(180deg,#05080f 0%,#0a1220 60%,#070b12 100%);}
  .wrap{text-align:center;}
  .mark{width:72px;height:72px;margin:0 auto 22px;display:flex;align-items:center;justify-content:center;
    background:#e8eef7;color:#0b0e12;border-radius:4px;}
  .mark svg{width:34px;height:34px;}
  h1{margin:0;font-size:86px;letter-spacing:-.04em;font-weight:800;line-height:1;}
  h1 span.co{color:#2dd4bf;}
  h1 span.rest{color:#c5d0dc;}
  p{margin:18px 0 0;font-size:20px;letter-spacing:.18em;text-transform:uppercase;
    color:#5eead4;font-weight:700;}
</style></head>
<body>
  <div class="wrap">
    <div class="mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
      </svg>
    </div>
    <h1><span class="co">Co</span><span class="rest">Comms</span></h1>
    <p>Built for football commentators</p>
  </div>
</body></html>`;

const endHtml = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#05080f;color:#e8eef7;
    font-family:Inter,ui-sans-serif,system-ui,Helvetica,Arial,sans-serif;}
  body{display:flex;align-items:center;justify-content:center;
    background:
      radial-gradient(ellipse at 50% 40%, rgba(45,212,191,.18), transparent 55%),
      linear-gradient(180deg,#05080f 0%,#0a1220 60%,#070b12 100%);}
  .wrap{text-align:center;}
  .mark{width:64px;height:64px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;
    background:#e8eef7;color:#0b0e12;border-radius:4px;}
  .mark svg{width:30px;height:30px;}
  h1{margin:0;font-size:72px;letter-spacing:-.04em;font-weight:800;line-height:1;}
  h1 span.co{color:#2dd4bf;}
  h1 span.rest{color:#c5d0dc;}
  .cta{margin:28px auto 0;display:inline-block;background:#2dd4bf;color:#042f2e;
    font-weight:800;font-size:22px;letter-spacing:.02em;padding:14px 28px;border-radius:3px;}
  .url{margin:22px 0 0;font-size:28px;letter-spacing:.04em;color:#e8eef7;font-weight:700;}
</style></head>
<body>
  <div class="wrap">
    <div class="mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
      </svg>
    </div>
    <h1><span class="co">Co</span><span class="rest">Comms</span></h1>
    <div class="cta">Try it free</div>
    <div class="url">cocomms.online</div>
  </div>
</body></html>`;

await cardShot(titleHtml, "30-title-card.png");
await cardShot(endHtml, "31-end-card.png");

writeFileSync("tmp/demo-video-promo30/probe.json", JSON.stringify(probe, null, 2));
console.log("DONE", JSON.stringify(probe, null, 2));
await browser.close();
