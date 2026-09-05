import { chromium } from 'playwright-core';
import fs from 'fs';

const MATCH = 'cmtol75ys0crk1bhyhj7aikkx';
const base = 'http://localhost:3000';

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console:' + m.text());
});

async function login() {
  await page.goto(base + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', 'demo@pitchline.app');
  await page.fill('input[type="password"], input[name="password"]', 'demo1234');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
}

await login();
await page.goto(`${base}/match-day/${MATCH}/packs`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Ensure Research pack selected
const researchBtn = page.locator('aside button', { hasText: 'Research pack' }).first();
if (await researchBtn.count()) await researchBtn.click();
await page.waitForTimeout(500);

const ta = page.locator('textarea').last();
await ta.waitFor({ state: 'visible', timeout: 15000 });
let draft = await ta.inputValue();
console.log('draft_len_initial', draft.length);

// If somehow empty, paste a marker + keep structure
if (draft.trim().length < 100) {
  draft = fs.readFileSync('/tmp/fener-research.txt', 'utf8');
  await ta.fill(draft);
  console.log('refilled_from_file', draft.length);
}

// Click Send to desk notes
const send = page.getByRole('button', { name: /Send to desk notes/i });
await send.click();
await page.waitForTimeout(2500);

const msg = await page.locator('p.text-xs, p.text-\\[11px\\]').allTextContents();
console.log('msgs', msg.filter(Boolean).slice(0, 8));

// Screenshot
await page.screenshot({ path: '/tmp/fener-packs-send.png', fullPage: true });

// Check notes API
const notes = await page.evaluate(async (matchId) => {
  const r = await fetch(`/api/notes?matchId=${matchId}`);
  return r.json();
}, MATCH);
const interesting = (notes.notes || []).filter((n) =>
  /research|must-mention|fener|beşik|besik/i.test(`${n.title} ${n.category}`)
);
console.log(
  'notes_interesting',
  interesting.map((n) => ({
    title: n.title,
    len: (n.body || '').length,
    cat: n.category,
    pinned: n.pinned,
  }))
);
console.log('page_errors', errors.slice(0, 10));
await browser.close();
