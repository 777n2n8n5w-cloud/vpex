// VPEX regression check (callable_jump). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/callable_jump.js
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
async function open(br, office, iso, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(iso) });
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(BASE + '#demo-' + office); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const st = page => page.evaluate(() => {
  const b = document.querySelector('[data-jump-now]'), chip = document.querySelector('[data-qfilter="now"] .chip-n'), act = document.querySelector('.filter-chip.active');
  const where = document.querySelector('.lead-where'); let r = null, con = null;
  if (b) { r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    const lum = c => { const m = c.match(/[\d.]+/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126*m[0]+.7152*m[1]+.0722*m[2]; };
    const L1 = lum(cs.color), L2 = lum(cs.backgroundColor); con = (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05); }
  return { btn: b ? b.textContent : null, h: r && r.height, w: r && r.width, con, chip: chip ? Number(chip.textContent.replace(/,/g,'')) : null,
    active: act ? act.getAttribute('data-qfilter') : null, late: where ? where.classList.contains('late') : null, sw: document.documentElement.scrollWidth, vw: innerWidth };
});
(async () => {
  const br = await chromium.launch();
  const LATE = '2026-10-20T02:30:00Z', NIGHT = '2026-10-20T07:30:00Z', MORN = '2026-10-20T13:30:00Z';
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'dark' }]) {
    const tag = o + '/' + c.n;
    let { ctx, page, errs } = await open(br, o, LATE, c);
    let s = await st(page);
    if (s.late) {
      check(tag + ' late lead: button offered', !!s.btn && s.chip > 0, s);
      check(tag + ' button count = Callable now count', s.btn && Number(s.btn.match(/[\d,]+/)[0].replace(/,/g, '')) === s.chip, s);
      check(tag + ' tap target 44px', s.h >= 44, s);
      check(tag + ' contrast >= 4.5', s.con >= 4.5, s.con);
      check(tag + ' no overflow', s.sw <= s.vw, s);
      if (c.n === 'p-light' && o === 'solar') await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/jump-' + o + '-' + c.n + '.png' });
      await page.click('[data-jump-now]'); await page.waitForTimeout(500);
      const s2 = await st(page);
      check(tag + ' tap: Callable now filter on', s2.active === 'now', s2);
      check(tag + ' tap: lead on screen is callable', s2.late === false, s2);
      check(tag + ' tap: button gone', !s2.btn, s2);
      const saved = await page.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage[k]); if (v && v.queueFilter) return v.queueFilter; } catch (e) {} } return null; });
      check(tag + ' tap: filter saved', saved === 'now', saved);
    } else check(tag + ' first lead is blocked at 10:30 PM ET', false, s);
    check(tag + ' no page errors', !errs.length, errs); await ctx.close();
    if (c.n !== 'p-dark') continue;
    ({ ctx, page, errs } = await open(br, o, NIGHT, c)); s = await st(page);
    check(tag + ' 3:30 AM ET, nobody callable: no button', !s.btn && s.chip === 0, s); check(tag + ' night no errors', !errs.length, errs); await ctx.close();
    ({ ctx, page, errs } = await open(br, o, MORN, c)); s = await st(page);
    check(tag + ' 9:30 AM ET, lead callable: no button', !s.btn && s.late === false, s); check(tag + ' morning no errors', !errs.length, errs); await ctx.close();
  }
  // Interested run: never offered (the run is its own list)
  { const { ctx, page, errs } = await open(br, 'insurance', LATE, { w: 390, s: 'dark' });
    const ok = await page.evaluate(() => { const b = document.querySelector('[data-qfilter="int"],[data-qfilter="hot"]') || [...document.querySelectorAll('button')].find(x => /late follow-ups/.test(x.textContent)); if (b) { b.click(); return true; } return false; }); await page.waitForTimeout(600);
    const s = await st(page); check('run (interested/hot/late follow-ups): no button', ok && !s.btn, { ok, s }); check('run no errors', !errs.length, errs); await ctx.close(); }
  await br.close(); console.log(`jump_test: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
