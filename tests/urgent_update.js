// VPEX regression check (urgent_update): an important fix reaches every phone the same day.
// Updates published during the day wait until midnight, then install the next time it's safe. On Nov 24 2026 a fix for reps'
// calls not saving (build 2027-03-12) would have sat on phones until midnight that way. The published page now names the
// oldest build that is still OK (<meta name="vpex-min-build">); a phone on an older build installs the new one the next time
// it's safe (not mid-call, not typing, no sheet open), day or night. This serves the app a "newer version" and checks:
//  - an ordinary new build published at 2:30 PM still waits for midnight (no reload; the note says after midnight)
//  - an important fix installs within seconds (the app reloads to the new version), at 390 dark/light and 1280 light
//  - an important fix never interrupts a call: it waits until the outcome is logged, then installs
//  - the min-build tag is in the first 4 KB of the page (the app only reads that much)
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/urgent_update.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const build = (src.match(/name="vpex-build" content="([^"]+)"/) || [])[1];
const minAt = Buffer.from(src).indexOf('name="vpex-min-build"');
check('the page names its oldest OK build', minAt > 0);
check('the min-build tag is in the first 4 KB', minAt > 0 && minAt < 3800, minAt);
check('the min-build is not newer than the build itself', (src.match(/name="vpex-min-build" content="([^"]+)"/) || [])[1] <= build);
const next = build.slice(0, -2) + String(Number(build.slice(-2)) + 1).padStart(2, '0');
// what the "published" page looks like: a newer build, and (for an important fix) a min-build above this one
const head = (urgent) => src.slice(0, 4096).replace(/name="vpex-build" content="[^"]+"/, 'name="vpex-build" content="' + next + '"')
  .replace(/name="vpex-min-build" content="[^"]+"/, 'name="vpex-min-build" content="' + (urgent ? next : build) + '"');

async function open(br, w, scheme, urgent) {
  const ctx = await br.newContext({ viewport: { width: w, height: w < 500 ? 844 : 800 }, isMobile: w < 500, hasTouch: w < 500, colorScheme: scheme, timezoneId: 'America/New_York' });
  await ctx.clock.install({ time: new Date('2026-11-24T14:30:00-05:00') });
  const pg = await ctx.newPage(); const errs = [], installs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('request', r => { if (/index\.html\?v=/.test(r.url())) installs.push(r.url()); });
  await pg.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)|cloudfunctions/, r => r.abort());
  await pg.route(/index\.html\?check=/, r => r.fulfill({ status: 206, contentType: 'text/html', body: head(urgent), headers: { 'Last-Modified': new Date('2026-11-24T19:20:00Z').toUTCString() } }));
  await pg.route(/index\.html\?v=/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>new</title>installed' }));
  await pg.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }, true));
  await pg.goto(BASE + '#demo-insurance');
  return { ctx, pg, errs, installs };
}

(async () => {
  const br = await chromium.launch();
  for (const [w, scheme] of [[390, 'dark'], [390, 'light'], [1280, 'light']]) {
    const tag = w + ' ' + scheme + ': ';
    // an ordinary build waits for midnight
    let t = await open(br, w, scheme, false);
    await t.pg.waitForTimeout(6500);
    const note = await t.pg.evaluate(() => (document.getElementById('updNote') || {}).textContent || '');
    check(tag + 'an ordinary new build is noticed', /Update ready/.test(note), note);
    check(tag + 'an ordinary new build waits for midnight', !t.installs.length && /after midnight/.test(note), { note, n: t.installs.length });
    check(tag + 'no page errors (ordinary)', !t.errs.length, t.errs);
    await t.ctx.close();
    // an important fix installs the next time it's safe
    t = await open(br, w, scheme, true);
    await t.pg.waitForTimeout(6500);
    check(tag + 'an important fix installs the same day', t.installs.length === 1 && t.installs[0].includes(next), t.installs);
    check(tag + 'no page errors (important fix)', !t.errs.length, t.errs);
    await t.ctx.close();
  }
  // mid-call: the fix waits until the outcome is logged
  const t = await open(br, 390, 'dark', true);
  await t.pg.waitForTimeout(2200);
  await t.pg.evaluate(() => document.getElementById('callBtn').click());
  await t.pg.waitForTimeout(4500);
  const mid = await t.pg.evaluate(() => (document.getElementById('updNote') || {}).textContent || '');
  check('mid-call: the important fix does not interrupt the call', !t.installs.length, t.installs);
  check('mid-call: the note says it is an important fix', /Important fix/.test(mid), mid);
  await t.pg.evaluate(() => { const b = document.querySelector('.out-btn[data-outcome="noanswer"]'); b && b.click(); });
  await t.pg.waitForTimeout(800);
  await t.pg.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await t.pg.clock.fastForward(61000); await t.pg.waitForTimeout(800);
  check('after the outcome is logged, the fix installs', t.installs.length === 1, t.installs);
  check('no page errors (mid-call)', !t.errs.length, t.errs);
  await t.ctx.close();
  await br.close();
  console.log('urgent_update: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
