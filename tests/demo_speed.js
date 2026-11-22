// VPEX regression check (demo_speed): a demo opens fast on a phone, and stays fast.
// Demos run on the in-page database (localStorage). Every update used to re-read and re-parse the whole database once per
// open listener, several times over: opening a demo parsed its ~400 KB database 239 times (94 MB of parsing, most of the
// start-up on a mid-range phone). Reads now share one parsed copy until the stored text changes. This counts the parses
// (an exact number, not a stopwatch, so a busy machine can't make it flaky):
//  - opening a demo: at most 40 parses of the database
//  - a call and its outcome: at most 15 more
// It also checks that the dial card's notes box is still sized to its text, and the demo bar's height is still known
// (both are now measured when the browser lays out the page, not forced at start-up).
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/demo_speed.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

(async () => {
  const br = await chromium.launch();
  for (const o of ['insurance', 'solar']) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
    await ctx.clock.install({ time: new Date('2026-11-04T11:30:00-05:00') });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)|cloudfunctions/, r => r.abort());
    await pg.addInitScript(() => { const P = JSON.parse; window.__bigParse = 0;
      JSON.parse = function (s) { if (typeof s === 'string' && s.length > 50000) window.__bigParse++; return P.apply(this, arguments); };
      window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }, true); });
    await pg.goto(BASE + '#demo-' + o); await pg.waitForTimeout(3000);
    const open = await pg.evaluate(() => ({ n: window.__bigParse, db: (localStorage.getItem('__mockfs') || '').length }));
    check(o + ': the demo database is big enough for this to mean something (> 50 KB)', open.db > 50000, open);
    check(o + ': opening the demo parses its database at most 40 times (was 239)', open.n <= 40, open);
    await pg.evaluate(() => { window.__bigParse = 0; document.getElementById('callBtn').click(); }); await pg.waitForTimeout(600);
    await pg.evaluate(() => { const b = document.querySelector('.out-btn[data-outcome="noanswer"]'); b && b.click(); }); await pg.waitForTimeout(1200);
    const call = await pg.evaluate(() => window.__bigParse);
    check(o + ': a call and its outcome: at most 15 more', call <= 15, call);
    const fit = await pg.evaluate(() => { const n = document.getElementById('leadNotesInput'); const pill = getComputedStyle(document.documentElement).getPropertyValue('--dp-h');
      return { h: n ? n.getBoundingClientRect().height : -1, sh: n ? n.scrollHeight : -1, pill, pillH: (document.querySelector('.demo-pill') || {}).offsetHeight }; });
    check(o + ': the notes box is sized to its text (46 to 120 px)', fit.h >= 45 && fit.h <= 121 && fit.sh <= fit.h + 3, fit);
    check(o + ': the demo bar\'s height is known to the page', parseInt(fit.pill) === fit.pillH && fit.pillH > 0, fit);
    // typing a long note grows the box (still sized on every keystroke)
    await pg.click('#leadNotesInput'); await pg.keyboard.type('Line one\nLine two\nLine three\nLine four');
    const grown = await pg.evaluate(() => document.getElementById('leadNotesInput').getBoundingClientRect().height);
    check(o + ': a longer note grows the box', grown > fit.h, { before: fit.h, after: grown });
    check(o + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('demo_speed: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
