// VPEX regression check (demo_tasks_scope). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<playwright> node tests/demo_tasks_scope.js
// Demo offices open Tasks on "Everyone's", so a visitor sees the team's follow-ups (late ones, Call N due now) instead of the one
// follow-up the demo's own login holds. Mine still works. Real offices keep "Mine" as their first view.
const fs = require('fs');
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const src = fs.readFileSync(__dirname + '/../index.html', 'utf8');
check('real offices start on Mine; demos on Everyone’s', /taskScope: DEMO \? "all" : "mine"/.test(src));
(async () => {
  const br = await chromium.launch();
  const CF = [{ n: '390 dark', w: 390, s: 'dark' }, { n: '390 light', w: 390, s: 'light' }, { n: '1280 light', w: 1280, s: 'light' }];
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) for (const c of CF) {
    const t = o + ' ' + c.n + ': ';
    const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
    await ctx.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date('2026-11-18T16:30:00Z') });   // Wed 11:30 AM in New York
    await page.goto(BASE + '#demo-' + o); await page.waitForSelector('#callBtn', { timeout: 15000 }); await page.waitForTimeout(800);
    await page.locator('[data-view="tasks"]:visible').first().click(); await page.waitForTimeout(500);
    const st = () => page.evaluate(() => {
      const a = document.querySelector('.filter-chip.active[data-tscope]'), m = document.getElementById('mainArea');
      const head = (m.innerText.match(/(\d+) open · (\d+) due now/) || []);
      return { scope: a && a.getAttribute('data-tscope'), open: +head[1] || 0, due: +head[2] || 0, run: /Call \d+ due now/.test(m.innerText), cards: m.querySelectorAll('.task-lead-name').length, sw: document.documentElement.scrollWidth, vw: innerWidth };
    });
    const a = await st();
    check(t + 'Tasks opens on Everyone’s', a.scope === 'all', a);
    check(t + 'the team’s follow-ups show (more than one, some due)', a.open > 1 && a.cards > 1 && a.due >= 1, a);
    check(t + '"Call N due now" offered', a.run, a);
    check(t + 'no sideways scroll', a.sw <= a.vw, a);
    await page.click('[data-tscope="mine"]'); await page.waitForTimeout(400);
    const b = await st();
    check(t + 'Mine still filters to the visitor’s own', b.scope === 'mine' && b.open <= a.open, b);
    check(t + 'no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close(); console.log(`demo_tasks_scope: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
