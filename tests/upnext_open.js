// VPEX regression check (upnext_open). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/upnext_open.js
// Up next: every name is a button. Tapping (phone) or clicking (computer) one opens that lead's profile without
// changing the lead on the dial card; Call in the profile dials that lead. Worked leads open too. Keyboard works.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const OFFICES = ['insurance', 'realestate', 'mca', 'auto', 'solar'];
const CONFIGS = [{ n: '390-dark', w: 390, s: 'dark' }, { n: '390-light', w: 390, s: 'light' }, { n: '1280', w: 1280, s: 'light' }, { n: '1440-dark', w: 1440, s: 'dark' }];
const MORN = '2026-10-20T15:30:00Z';   // 11:30 AM in New York
(async () => {
  const br = await chromium.launch();
  for (const office of OFFICES) for (const c of CONFIGS) {
    const tag = office + ' ' + c.n;
    const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date(MORN) });
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (a && !e.defaultPrevented) e.preventDefault(); }));
    await page.goto(BASE + '#demo-' + office); await page.waitForTimeout(1600);
    if (c.w < 1100) { await page.evaluate(() => { const b = document.getElementById('toggleQueueBtn'); if (b.textContent.trim() === 'Show') b.click(); }); await page.waitForTimeout(200); }
    const info = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#queueList .queue-item')];
      return { n: items.length, buttons: items.every(b => b.tagName === 'BUTTON' && b.type === 'button' && b.dataset.queueLead && /^Open /.test(b.getAttribute('aria-label') || '')),
        minH: Math.min(...items.map(b => b.getBoundingClientRect().height)), card: document.querySelector('.lead-name').textContent.trim(),
        sw: document.documentElement.scrollWidth, vw: innerWidth, cursor: items[0] && getComputedStyle(items[0]).cursor, align: items[0] && getComputedStyle(items[0]).textAlign };
    });
    check(tag + ' Up next items are buttons with a name', info.n >= 5 && info.buttons, info);
    check(tag + ' tap height >= 44', info.minH >= 44, info.minH);
    check(tag + ' looks as before (left aligned, pointer)', info.align === 'left' && info.cursor === 'pointer', info);
    check(tag + ' no sideways scroll', info.sw <= info.vw, info);
    // Open the 3rd one
    const target = await page.evaluate(() => { const b = document.querySelectorAll('#queueList .queue-item:not(.done)')[2]; b.scrollIntoView({ block: 'center' }); return b.querySelector('.qi-name').textContent; });
    await page.locator('#queueList .queue-item:not(.done)').nth(2).click(); await page.waitForTimeout(500);
    const prof = await page.evaluate(() => ({ open: document.getElementById('leadModal').classList.contains('show'), name: (document.querySelector('#leadModal .lp-name') || {}).textContent, card: document.querySelector('.lead-name').textContent.trim() }));
    check(tag + ' tap opens that lead', prof.open && prof.name === target, { prof, target });
    check(tag + ' dial card unchanged', prof.card === info.card, { prof, info });
    // Call from the profile dials that lead
    await page.evaluate(() => document.querySelector('#leadModal .call-btn').click()); await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({ open: document.getElementById('leadModal').classList.contains('show'), card: document.querySelector('.lead-name').textContent.trim(), ready: !!document.querySelector('.out-btn[data-outcome="noanswer"]:not([disabled])') }));
    check(tag + ' Call in the profile dials that lead', !after.open && after.card === target && after.ready, { after, target });
    await page.evaluate(() => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await page.waitForTimeout(700);
    // The worked lead now sits at the bottom as done; it opens too
    const done = await page.evaluate(t => { const d = [...document.querySelectorAll('#queueList .queue-item.done')].find(b => b.querySelector('.qi-name').textContent === t); if (!d) return null; d.click(); return true; }, target);
    await page.waitForTimeout(400);
    const prof2 = await page.evaluate(() => ({ open: document.getElementById('leadModal').classList.contains('show'), name: (document.querySelector('#leadModal .lp-name') || {}).textContent }));
    check(tag + ' worked lead opens', done && prof2.open && prof2.name === target, { done, prof2, target });
    await page.evaluate(() => document.getElementById('lpClose').click()); await page.waitForTimeout(400);
    // Keyboard: focus the first item, Enter opens it
    const first = await page.evaluate(() => { const b = document.querySelector('#queueList .queue-item:not(.done)'); b.focus(); return b.querySelector('.qi-name').textContent; });
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const prof3 = await page.evaluate(() => ({ open: document.getElementById('leadModal').classList.contains('show'), name: (document.querySelector('#leadModal .lp-name') || {}).textContent }));
    check(tag + ' Enter opens it', prof3.open && prof3.name === first, { prof3, first });
    check(tag + ' no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log('upnext_open: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
