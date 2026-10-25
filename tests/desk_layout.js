// VPEX regression check (desk_layout). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/desk_layout.js
// The computer layout (1100 px and wider): tabs in the top bar, today + Up next on the left, the lead in the middle,
// the Live panel on the right; other tabs use the full width (Pipeline as a board). Phones keep the one-column layout.
// Live: a call logged on a phone (second tab, same login, in-page backend) shows on the computer within 1.5 s (0.4–0.7 s on an idle machine).
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const MORN = '2026-10-20T15:30:00Z';   // 11:30 AM in New York
const OFFICES = ['insurance', 'realestate', 'mca', 'auto', 'solar'];
const SIZES = [{ n: '1100-dark', w: 1100, h: 760, s: 'dark' }, { n: '1440-light', w: 1440, h: 900, s: 'light' }, { n: '1920-dark', w: 1920, h: 1080, s: 'dark' }];
const lay = page => page.evaluate(() => {
  const r = id => { const el = typeof id === 'string' ? document.getElementById(id) || document.querySelector(id) : id; if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), vis: getComputedStyle(el).display !== 'none' && b.width > 0 }; };
  return { desk: document.body.classList.contains('desk'), view: document.body.getAttribute('data-view'), vw: innerWidth, sw: document.documentElement.scrollWidth,
    hdr: r('header.top'), tabs: r('viewTabs'), tabsInHeader: !!document.querySelector('header.top #viewTabs'), left: r('deskLeft'), main: r('mainArea'), live: r('deskLive'),
    prog: r('progressWrap'), queue: r('queueBlock'), progInLeft: !!document.querySelector('#deskLeft #progressWrap'), queueInLeft: !!document.querySelector('#deskLeft #queueBlock'),
    card: r('#mainArea .card'), call: r('callBtn'), liveText: (document.getElementById('deskLive') || {}).innerText || '', feed: document.querySelectorAll('#deskLive .dl-call').length,
    stages: [...document.querySelectorAll('#mainArea .stage-section')].map(s => { const b = s.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width)]; }),
    bad: (document.body.innerText.match(/undefined|NaN|\[object/g) || []) };
});
async function demo(br, o, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(MORN) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
  await page.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (a && !e.defaultPrevented) e.preventDefault(); }));
  await page.goto(BASE + '#demo-' + o); await page.waitForTimeout(1800);
  return { ctx, page, errs };
}
(async () => {
  const br = await chromium.launch();
  // 1. demo offices on a computer
  for (const o of OFFICES) for (const c of SIZES) {
    const tag = o + ' ' + c.n;
    const { ctx, page, errs } = await demo(br, o, c);
    let L = await lay(page);
    check(tag + ' computer layout on', L.desk && L.view === 'dial', L);
    check(tag + ' tabs in the top bar', L.tabsInHeader && L.tabs.vis && L.tabs.t >= L.hdr.t && L.tabs.b <= L.hdr.b, [L.tabs, L.hdr]);
    check(tag + ' three columns side by side', L.left.vis && L.main.vis && L.live.vis && L.left.r <= L.main.l && L.main.r <= L.live.l + 1 && L.live.r <= L.vw, [L.left, L.main, L.live]);
    check(tag + ' fills the screen (side panels near the edges)', L.left.l <= 40 && L.live.r >= L.vw - 40, [L.left, L.live]);
    check(tag + ' progress and Up next in the left column', L.progInLeft && L.queueInLeft && L.prog.vis && L.queue.vis, L);
    check(tag + ' lead card and Call in the middle', L.card && L.card.vis && L.call && L.call.vis && L.call.l >= L.main.l && L.call.r <= L.main.r, [L.card, L.call]);
    check(tag + ' Live panel: title, Live dot, numbers, latest calls', /Your day/.test(L.liveText) && /Live/.test(L.liveText) && /calls?\b/.test(L.liveText) && /Latest calls/i.test(L.liveText.replace(/\n/g, ' ')), L.liveText.slice(0, 200));
    check(tag + ' no sideways scroll, no leftover words', L.sw <= L.vw && !L.bad.length, [L.sw, L.vw, L.bad]);
    // log a call here: the Live panel adds it at the top, flashed
    const before = L.feed, n0 = await page.evaluate(() => +document.querySelector('#deskLive .dl-kpi b').textContent);
    const who = await page.evaluate(() => document.querySelector('.lead-name').textContent.trim());
    await page.clock.fastForward(20000); await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById('callBtn').click()); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.out-btn[data-outcome="interested"]').click()); await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({ n: +document.querySelector('#deskLive .dl-kpi b').textContent, top: (document.querySelector('#deskLive .dl-call .dl-name') || {}).textContent, fresh: !!document.querySelector('#deskLive .dl-call.fresh'), badge: (document.querySelector('#deskLive .dl-call .qi-status') || {}).textContent }));
    check(tag + ' a logged call lands at the top of Live, flashed', after.n === n0 + 1 && after.top === who && after.fresh && after.badge === 'Interested', { n0, after, who });
    // other tabs use the width; Pipeline is a board
    for (const v of ['history', 'pipeline', 'tasks', 'vault']) {
      await page.evaluate(v => document.querySelector('#viewTabs [data-view="' + v + '"]').click(), v); await page.waitForTimeout(350);
      L = await lay(page);
      check(tag + ' ' + v + ': full width, side panels hidden', L.view === v && !L.left.vis && !L.live.vis && L.main.w >= Math.min(1100, L.vw - 80) && L.sw <= L.vw, [L.main, L.vw]);
      if (v === 'pipeline') check(tag + ' pipeline stages side by side', L.stages.length >= 3 && L.stages[1][0] > L.stages[0][0] && Math.abs(L.stages[1][1] - L.stages[0][1]) < 4, L.stages);
    }
    check(tag + ' no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  // 2. phone and narrow window: unchanged one-column layout
  for (const c of [{ w: 390, h: 844, mob: true }, { w: 1024, h: 800 }]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, isMobile: !!c.mob, hasTouch: !!c.mob, timezoneId: 'America/New_York' });
    const page = await ctx.newPage(); await page.clock.install({ time: new Date(MORN) });
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(1800);
    const L = await lay(page);
    check(c.w + ': phone layout kept (no desk, tabs under the header, Live hidden)', !L.desk && !L.tabsInHeader && !L.live.vis && !L.left.vis && !L.progInLeft && L.tabs.t >= L.hdr.b - 1 && L.main.w <= 480, L);
    // resize to a computer and back: everything returns to its place
    await page.setViewportSize({ width: 1300, height: 860 }); await page.waitForTimeout(400);
    const D = await lay(page);
    check(c.w + ': grows into the computer layout', D.desk && D.tabsInHeader && D.live.vis && D.progInLeft, D);
    await page.setViewportSize({ width: c.w, height: c.h }); await page.waitForTimeout(400);
    const P = await lay(page);
    const order = await page.evaluate(() => [...document.querySelector('.shell').children].filter(e => e.id).map(e => e.id).join(','));
    check(c.w + ': back to the phone layout, original order', !P.desk && !P.tabsInHeader && !P.live.vis && /^syncBanner,viewTabs,progressWrap,queueControls,mainArea,statsBlock,queueBlock/.test(order), order);
    await ctx.close();
  }
  // 3. live: dial on the phone, watch the computer (same login, two tabs on the in-page backend)
  {
    const ctx = await br.newContext({ timezoneId: 'America/New_York' });
    const desk = await ctx.newPage(); await desk.setViewportSize({ width: 1440, height: 900 });
    const errs = []; desk.on('pageerror', e => errs.push(e.message));
    await desk.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await desk.goto(BASE + '#mockbench'); await desk.waitForTimeout(500);
    await desk.evaluate(() => {
      const db = demoSeed();
      localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      localStorage.setItem('__mockauth', JSON.stringify({ 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' } }));
      sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR2', email: 'sam@dovetail-f863c.firebaseapp.com' }));
    });
    await desk.goto(BASE); await desk.waitForTimeout(2800);
    const phone = await ctx.newPage(); await phone.setViewportSize({ width: 390, height: 844 });
    phone.on('pageerror', e => errs.push('phone: ' + e.message));
    await phone.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await phone.addInitScript(() => { try { sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR2', email: 'sam@dovetail-f863c.firebaseapp.com' })); } catch (e) {} window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }); });
    await phone.goto(BASE); await phone.waitForTimeout(2800);
    const D0 = await lay(desk);
    const has = await phone.evaluate(() => !!document.getElementById('callBtn'));
    check('live: computer in the computer layout, phone in the phone layout', D0.desk && has && !(await phone.evaluate(() => document.body.classList.contains('desk'))), D0);
    check('live: Live panel says Live on a real office', /Live/.test(D0.liveText) && !/This device only/.test(D0.liveText), D0.liveText.slice(0, 160));
    const k0 = await desk.evaluate(() => ({ n: +document.querySelector('#deskLive .dl-kpi b').textContent, today: +document.getElementById('todayNum').textContent }));
    for (let i = 0; i < 2; i++) {
      const who = await phone.evaluate(() => document.querySelector('.lead-name').textContent.trim());
      const outc = i ? 'voicemail' : 'interested';
      await phone.evaluate(() => document.getElementById('callBtn').click()); await phone.waitForTimeout(300);
      const gate = await phone.evaluate(() => { const g = document.querySelector('#infoModalBody .gate-call'); if (g && document.getElementById('infoModal').classList.contains('show')) { g.click(); return true; } return false; });
      if (gate) await phone.waitForTimeout(300);
      const t0 = Date.now();
      await phone.evaluate(o => document.querySelector('.out-btn[data-outcome="' + o + '"]').click(), outc);
      let got = null;
      while (Date.now() - t0 < 3000) {
        got = await desk.evaluate(() => ({ n: +document.querySelector('#deskLive .dl-kpi b').textContent, top: (document.querySelector('#deskLive .dl-call .dl-name') || {}).textContent, fresh: !!document.querySelector('#deskLive .dl-call.fresh'), today: +document.getElementById('todayNum').textContent }));
        if (got.n === k0.n + i + 1 && got.top === who) break;
        await desk.waitForTimeout(50);
      }
      const ms = Date.now() - t0; if (process.env.VERBOSE) console.log('latency', ms, 'ms');
      check('live: call ' + (i + 1) + ' from the phone shows on the computer within 1.5 s', got.n === k0.n + i + 1 && got.top === who && ms < 1500, { got, who, ms, k0 });
      check('live: call ' + (i + 1) + ' flashes in the feed and moves today\'s count', got.fresh && got.today === k0.today + i + 1, got);
      await phone.waitForTimeout(1200);
    }
    // the lead the phone just called is no longer the next lead on the computer
    const deskLead = await desk.evaluate(() => (document.querySelector('.lead-name') || {}).textContent);
    const phoneLead = await phone.evaluate(() => (document.querySelector('.lead-name') || {}).textContent);
    check('live: the computer moved past the leads the phone called', deskLead && phoneLead && deskLead.trim() === phoneLead.trim(), { deskLead, phoneLead });
    // typing in notes on the computer doesn't stop the Live panel
    await desk.focus('#leadNotesInput');
    const k1 = await desk.evaluate(() => +document.querySelector('#deskLive .dl-kpi b').textContent);
    await phone.evaluate(() => document.getElementById('callBtn').click()); await phone.waitForTimeout(300);
    await phone.evaluate(() => { const g = document.querySelector('#infoModalBody .gate-call'); if (g && document.getElementById('infoModal').classList.contains('show')) g.click(); });
    await phone.waitForTimeout(200);
    await phone.evaluate(() => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await desk.waitForTimeout(900);
    const k2 = await desk.evaluate(() => ({ n: +document.querySelector('#deskLive .dl-kpi b').textContent, focus: document.activeElement && document.activeElement.id }));
    check('live: panel updates while typing a note on the computer (focus kept)', k2.n === k1 + 1 && k2.focus === 'leadNotesInput', { k1, k2 });
    check('live: no page errors', errs.length === 0, errs);
    await desk.evaluate(() => { localStorage.removeItem('vpex_mockbench'); localStorage.removeItem('__mockfs'); });
    await ctx.close();
  }
  await br.close();
  console.log(`desk_layout: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
