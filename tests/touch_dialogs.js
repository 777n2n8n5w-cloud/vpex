// VPEX regression check (touch_dialogs): on touch screens the small everyday buttons answer a 44 px tap without
// changing their look (top bar icons, Goal, the demo bar, + Add, chips); every sheet is a named dialog that takes focus,
// keeps Tab inside and hands focus back; the home page has its canonical address (removed from customer copies).
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/touch_dialogs.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const ev = (page, f, a) => page.evaluate(f, a);
async function open(br, c, hash, theme) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 860 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  if (theme) await page.addInitScript(t => { try { localStorage.setItem('dovetail_dialer_theme_v1', t); } catch (e) {} }, theme);
  await page.route(/gstatic\.com\/firebasejs|fonts\.g/, r => r.abort());
  await page.goto(BASE + hash); await page.waitForTimeout(2600);
  await ev(page, () => document.querySelectorAll('.toast').forEach(t => t.remove()));
  return { ctx, page, errs };
}
// does a tap this far outside each edge still land on the button?
const reach = (page, sel, d) => ev(page, ([sel, d]) => { const el = document.querySelector(sel); if (!el || !el.offsetParent) return null; const b = el.getBoundingClientRect();
  const hit = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
  return { w: Math.round(b.width), h: Math.round(b.height), top: hit(b.left + b.width / 2, b.top - d.v), bottom: hit(b.left + b.width / 2, b.bottom + d.v), left: hit(b.left - d.h, b.top + b.height / 2), right: hit(b.right + d.h, b.top + b.height / 2), mid: hit(b.left + b.width / 2, b.top + b.height / 2) }; }, [sel, d]);
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('home page has its canonical address', /<link rel="canonical" href="https:\/\/vpexdialer\.com\/">/.test(src));
  check('customer copies drop the canonical address', /\.replace\(\/<link rel="canonical"\[\^>\]\*>\\n\?\/g, ""\)/.test(src));
  const br = await chromium.launch();
  for (const c of [{ n: '390-dark', w: 390, s: 'dark' }, { n: '390-light', w: 390, s: 'light', th: 'starfighter' }, { n: '360-dark', w: 360, s: 'dark', th: 'neobrutalism' }, { n: '320-light', w: 320, s: 'light' }]) {
    const { ctx, page, errs } = await open(br, c, '#demo-insurance', c.th);
    const t = c.n + (c.th ? '/' + c.th : '') + ' ';
    const narrow = c.w <= 360;
    for (const id of ['#adminBtn', '#searchBtn', '#addLeadsBtn', '#menuBtn']) {
      const r = await reach(page, id, { v: narrow ? 5 : 3.5, h: narrow ? 0.5 : 2 });
      check(t + id + ' keeps its size', r && r.w <= 37 && r.h <= 37, r);
      check(t + id + ' answers a tap just outside every edge (44 px target)', r && r.mid && r.top && r.bottom && r.left && r.right, r);
    }
    for (const id of ['#demoTrial', '#demoExit']) { const r = await reach(page, id, { v: 3.5, h: 1 }); check(t + id + ' answers a tap just above and below', r && r.top && r.bottom && r.h <= 37, r); }
    const g = await reach(page, '#todayGoalLbl', { v: 5.5, h: 1 }); check(t + 'Goal answers a 44 px tap', g && g.top && g.bottom, g);
    // the badge on Admin controls still sits in its corner
    const badge = await ev(page, () => { const b = document.getElementById('adminBtn'), a = getComputedStyle(b, '::after'); return { content: a.content, w: parseFloat(a.width), left: a.left }; });
    check(t + 'Admin badge unchanged (small, in the corner)', badge.content !== 'none' && badge.content !== '""' && badge.w < 30, badge);
    // taps still do what they did
    await page.tap('#searchBtn'); await page.waitForTimeout(400);
    check(t + 'Search opens', await ev(page, () => !document.getElementById('searchOverlay').hidden));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const sw = await ev(page, () => document.documentElement.scrollWidth > innerWidth); check(t + 'no sideways scroll', !sw);
    await ev(page, () => document.querySelector('#viewTabs [data-view="tasks"]').click()); await page.waitForTimeout(400);
    const add = await reach(page, '#addTaskBtn', { v: 4, h: 2 }); check(t + 'Tasks + Add answers a 44 px tap', add && add.top && add.bottom, add);
    check(t + 'no page errors', !errs.length, errs);
    await ctx.close();
  }
  // computer: nothing changes for the mouse; dialogs behave as dialogs with the keyboard
  {
    const { ctx, page, errs } = await open(br, { w: 1280, s: 'dark' }, '#demo-insurance');
    const ae = () => ev(page, () => { const a = document.activeElement; return a ? a.id || a.className : ''; });
    const r = await reach(page, '#menuBtn', { v: 2, h: 2 });
    check('1280: no extra tap frame for the mouse', r && r.mid && !r.top && !r.bottom, r);
    await page.focus('#menuBtn'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const d = await ev(page, () => { const m = document.querySelector('#menuModal .modal'); return { role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'), name: (document.getElementById(m.getAttribute('aria-labelledby')) || {}).innerText, inside: m.contains(document.activeElement) }; });
    check('1280: Settings opens as a named dialog with focus inside', d.role === 'dialog' && d.modal === 'true' && d.name === 'Settings' && d.inside, d);
    for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
    check('1280: Tab stays inside the dialog', await ev(page, () => document.getElementById('menuModal').contains(document.activeElement)));
    await page.keyboard.press('Shift+Tab'); check('1280: Shift+Tab stays inside', await ev(page, () => document.getElementById('menuModal').contains(document.activeElement)));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    check('1280: closing gives focus back to the menu button', (await ae()) === 'menuBtn', await ae());
    await page.click('#mainArea .lead-name'); await page.waitForTimeout(400);
    const p = await ev(page, () => { const m = document.querySelector('#leadModal .modal'); return { name: (document.getElementById(m.getAttribute('aria-labelledby')) || {}).innerText, inside: m.contains(document.activeElement), lead: document.querySelector('#mainArea .lead-name').innerText }; });
    check('1280: lead profile is named by the lead and has focus', p.name === p.lead && p.inside, p);
    await page.click('#lpClose'); await page.waitForTimeout(300);
    await page.click('#callBtn'); await page.waitForTimeout(400); await page.click('#outcomesRow [data-outcome="interested"]'); await page.waitForTimeout(500);
    check('1280: the follow-up sheet keeps its own focus on Book', (await ae()) === 'fuBook', await ae());
    check('1280: no page errors', !errs.length, errs);
    await ctx.close();
  }
  // every sheet in the page is announced as a dialog once open
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' }, '#demo-solar');
    const ids = ['menuBtn', 'addLeadsBtn'];
    for (const id of ids) {
      await page.tap('#' + id); await page.waitForTimeout(500);
      const d = await ev(page, () => { const ov = [...document.querySelectorAll('.modal-overlay.show')].pop(); if (!ov) return null; const m = ov.querySelector(':scope > .modal') || ov.firstElementChild; return { role: m.getAttribute('role'), name: m.getAttribute('aria-labelledby') && (document.getElementById(m.getAttribute('aria-labelledby')) || {}).innerText }; });
      check('390 ' + id + ': sheet is a named dialog', d && d.role === 'dialog' && !!d.name, d);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }
    check('390 sheets: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`touch_dialogs: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
