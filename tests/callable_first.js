// VPEX regression check (callable_first): in the evening and early morning the dial list leads with people who can be
// called right now; anyone outside their calling hours waits at the end instead of stopping call after call with
// "Outside calling hours". During the day the list order is unchanged.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/callable_first.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

async function session(br, when) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  await ctx.clock.install({ time: new Date(when) });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await p.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (a) e.preventDefault(); }, true));
  await p.goto(BASE + '#demo-investments'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const t = document.querySelector('.toast'); if (t) t.remove(); });
  return { ctx, p, errs };
}
const card = p => p.evaluate(() => ({ name: (document.querySelector('.lead-name') || {}).textContent, where: (document.querySelector('.lead-where') || {}).innerText || '' }));

(async () => {
  const br = await chromium.launch();

  // 9:30 PM in New York: the East Coast is past 9 PM, Texas, Chicago, Denver and California are not
  const n = await session(br, '2026-11-04T21:30:00-05:00');
  const gates = [], names = [];
  for (let i = 0; i < 6; i++) {
    const c = await card(n.p); names.push(c.name + ' | ' + c.where.replace(/\s+/g, ' '));
    await n.p.clock.fastForward(20000);
    await n.p.evaluate(() => document.getElementById('callBtn').click()); await n.p.waitForTimeout(400);
    const g = await n.p.evaluate(() => { const m = document.querySelector('#infoModal.show'); return m ? m.innerText.slice(0, 80) : ''; });
    if (g) { gates.push(g); await n.p.evaluate(() => document.getElementById('gateNo').click()); await n.p.evaluate(() => document.getElementById('skipBtn') && document.getElementById('skipBtn').click()); continue; }
    await n.p.evaluate(() => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await n.p.waitForTimeout(400);
    await n.p.evaluate(() => { const t = document.getElementById('textPrompt'); if (t && t.style.display !== 'none') { const x = t.querySelector('.btn-secondary'); if (x) x.click(); } });
  }
  check('evening: six calls in a row, none stopped by "Outside calling hours"', !gates.length, { gates, names });
  check('evening: the first leads are in zones still inside calling hours', names.every(x => !/ NY | NJ | FL | MA | GA /.test(' ' + x.split('|')[1] + ' ')), names);
  const left = await n.p.evaluate(() => (document.querySelector('.queue-tag') || {}).textContent);
  check('evening: nobody is dropped, they just wait (the count still includes them)', /\d+ left/.test(left || ''), left);
  check('evening: no page errors', !n.errs.length, n.errs);
  await n.ctx.close();

  // 11:30 AM in New York: everyone is callable, so the list keeps its uploaded order
  const d = await session(br, '2026-11-04T11:30:00-05:00');
  const first = await card(d.p);
  const imported = await d.p.evaluate(() => window.__fuLists ? window.__fuLists().pending[0] : null);
  const firstId = await d.p.evaluate(() => (document.querySelector('.lead-name') || {}).getAttribute('data-open-lead'));
  check('daytime: the list keeps its order (first lead is the first uploaded)', !imported || firstId === imported, { first, imported, firstId });
  check('daytime: no page errors', !d.errs.length, d.errs);
  await d.ctx.close();

  await br.close();
  console.log('callable_first: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
