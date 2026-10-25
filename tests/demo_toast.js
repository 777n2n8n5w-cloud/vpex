// VPEX regression check (demo_toast). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/demo_toast.js
// Demo offices: notifications (the welcome toast, the "Dialing … demo" toast) drop below the demo bar,
// so Start free trial and Exit are never covered and answer a tap while a toast shows.
// Real offices (no demo bar) keep the toast at the top of the screen.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const OFFICES = ['insurance', 'realestate', 'mca', 'auto', 'solar'];
const CONFIGS = [{ n: '390-dark', w: 390, s: 'dark' }, { n: '390-light', w: 390, s: 'light' }, { n: '1280', w: 1280, s: 'light' }];
const MORN = '2026-10-20T15:30:00Z';   // 11:30 AM in New York: the first demo leads are callable
const NIGHT = '2026-10-20T07:30:00Z';  // 3:30 AM: the after-hours welcome toast
async function open(br, office, c, when) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(when) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
  await page.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (a && !e.defaultPrevented) e.preventDefault(); }));
  await page.goto(BASE + '#demo-' + office); await page.waitForTimeout(1600);
  return { ctx, page, errs };
}
const geo = page => page.evaluate(() => {
  const t = document.getElementById('toast'), bar = document.querySelector('.demo-pill');
  const r = el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
  const hit = id => { const el = document.getElementById(id); if (!el) return null; const b = el.getBoundingClientRect(); const x = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!x && (x === el || el.contains(x)); };
  const tb = r(t);
  return { show: t.classList.contains('show'), text: t.innerText.replace(/\n/g, ' / '), toast: tb, bar: bar ? r(bar) : null,
    trialHit: hit('demoTrial'), trialBox: document.getElementById('demoTrial') ? r(document.getElementById('demoTrial')) : null, exitHit: hit('demoExit'), inView: tb.top >= 0 && tb.bottom <= innerHeight, sw: document.documentElement.scrollWidth, vw: innerWidth };
});
(async () => {
  const br = await chromium.launch();
  for (const o of OFFICES) for (const c of CONFIGS) {
    const tag = o + ' ' + c.n;
    // 1. the welcome toast, daytime
    let { ctx, page, errs } = await open(br, o, c, MORN);
    await page.waitForTimeout(400);
    let g = await geo(page);
    check(tag + ' welcome toast shows', g.show && /^Demo office with sample leads/.test(g.text), g.text);
    check(tag + ' welcome toast sits below the demo bar', g.bar && g.toast.top >= g.bar.bottom + 4, g);
    check(tag + ' Start free trial and Exit uncovered during the toast', g.trialHit && g.exitHit, g);
    check(tag + ' toast fully on screen, no overflow', g.inView && g.sw <= g.vw, g);
    // 2. the demo call toast
    await page.clock.fastForward(20000); await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('callBtn').click()); await page.waitForTimeout(500);
    g = await geo(page);
    const ov = (x, y) => !(x.bottom <= y.top || y.bottom <= x.top || x.right <= y.left || y.right <= x.left);
    check(tag + ' call toast never covers Start free trial', g.show && /Demo, so no real call goes out/.test(g.text) && (g.trialBox.bottom <= 0 || !ov(g.toast, g.trialBox)), g);
    check(tag + ' no page errors', errs.length === 0, errs);
    await ctx.close();
    // 4. after hours: the longer welcome toast, same place
    ({ ctx, page, errs } = await open(br, o, c, NIGHT));
    await page.waitForTimeout(400);
    g = await geo(page);
    check(tag + ' after-hours toast below the bar, buttons uncovered', g.show && /After hours/.test(g.text) && g.toast.top >= g.bar.bottom + 4 && g.trialHit && g.exitHit, g);
    if (o === 'insurance' && c.n === '390-light' && process.env.SHOT) await page.screenshot({ path: process.env.SHOT, clip: { x: 0, y: 0, width: c.w, height: 220 } });
    await page.evaluate(() => { const b = document.getElementById('demoTrial').getBoundingClientRect(); document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2).click(); });
    await page.waitForTimeout(1200);
    check(tag + ' tap on Start free trial during the welcome toast opens the trial form', /trial=/.test(page.url()) || await page.evaluate(() => { const f = document.getElementById('authScreen'); return !!f && getComputedStyle(f).display !== 'none' && !document.querySelector('.demo-pill'); }), page.url());
    check(tag + ' no page errors (after hours)', errs.length === 0, errs);
    await ctx.close();
  }
  // 5. no demo bar (sales page / real office on the mock bench): a toast stays at the top
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(1500);
    const top = await page.evaluate(() => { const t = document.getElementById('toast'); return { inline: t.style.top, css: getComputedStyle(t).top, bar: !!document.querySelector('.demo-pill') }; });
    check('no demo bar: toast keeps its top spot', !top.bar && top.inline === '' && parseFloat(top.css) <= 10, top);
    await ctx.close();
  }
  await br.close();
  console.log(`demo_toast: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
