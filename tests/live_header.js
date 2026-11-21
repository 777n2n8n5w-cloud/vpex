// VPEX regression check (live_header): on a call, the header stays a solid bar.
//  On a call ("one decision on screen") the header, tabs and list dim. The header is sticky, and dimming the whole bar made it
//  see-through: on a phone the page scrolls the lead card up after Call, so the tabs and the list slid under the header and
//  showed through it ("Dial History Pipeline" printed over "You · Synced"). Now only what's in the header dims; its background stays solid.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/live_header.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };
const alpha = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(','); return p.length > 3 ? +p[3] : 1; };
const state = p => p.evaluate(() => {
  const h = document.querySelector('header.top'), cs = getComputedStyle(h), kids = [...h.children].filter(k => getComputedStyle(k).display !== 'none');
  let eff = 1; for (let e = h; e && e.nodeType === 1; e = e.parentElement) eff *= +getComputedStyle(e).opacity;
  const hb = h.getBoundingClientRect(), tb = document.getElementById('viewTabs').getBoundingClientRect();
  return { live: document.body.classList.contains('st-live'), shown: cs.display !== 'none', eff, bg: cs.backgroundColor, pos: cs.position,
    kids: kids.map(k => +getComputedStyle(k).opacity), under: tb.top < hb.bottom - 4 && tb.bottom > hb.top, tabsOp: +getComputedStyle(document.getElementById('viewTabs')).opacity,
    ov: document.documentElement.scrollWidth > innerWidth };
});
(async () => {
  const br = await chromium.launch();
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) {
    for (const [w, h, scheme, touch] of [[390, 844, 'dark', true], [390, 844, 'light', true], [1280, 900, 'light', false]]) {
      const tag = o + ' ' + w + ' ' + scheme;
      const ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, colorScheme: scheme, timezoneId: 'America/New_York' });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.clock.install({ time: new Date('2026-11-20T16:30:00Z') });   // Fri 11:30 AM in New York: the first leads are callable
      await p.route(/gstatic\.com\/firebasejs|googleapis|cloudfunctions/, r => r.abort());
      await p.goto(BASE + '#demo-' + o); await p.waitForTimeout(3000);
      const before = await state(p);
      check(tag + ': not on a call yet, header at full strength', !before.live && before.eff === 1 && before.kids.every(x => x === 1), before);
      if (touch) await p.locator('#callBtn').tap(); else await p.locator('#callBtn').click();
      await p.waitForTimeout(1500);
      // on a phone the page scrolls the card up; make sure the tabs are under the header either way
      if (touch) await p.evaluate(() => { const t = document.getElementById('viewTabs'), hd = document.querySelector('header.top'); const d = t.getBoundingClientRect().top - hd.getBoundingClientRect().top - 10; if (d > 0) window.scrollBy(0, d); });
      await p.waitForTimeout(600);
      const s = await state(p);
      check(tag + ': on a call', s.live, s);
      check(tag + ': header bar is solid (no see-through)', s.eff === 1 && alpha(s.bg) === 1, s);
      check(tag + ': what is in the header still dims', s.kids.length > 0 && s.kids.every(x => x <= 0.5), s.kids);
      check(tag + ': tabs still dim', s.tabsOp <= 0.5, s.tabsOp);
      if (touch) check(tag + ': tabs scrolled under the sticky header are hidden by it', s.pos === 'sticky' && s.under, s);
      check(tag + ': no sideways scroll', !s.ov);
      // log the call: everything comes back to full strength
      await p.evaluate(() => { const b = document.querySelector('#outcomesRow [data-outcome="noanswer"]'); if (b) b.click(); }); await p.waitForTimeout(1200);
      const a = await state(p);
      check(tag + ': after logging, header back to full strength', !a.live && a.eff === 1 && a.kids.every(x => x === 1), a);
      check(tag + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }
  // Short phones (under 760 px tall) still hide the header on a call
  {
    const ctx = await br.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, colorScheme: 'dark', timezoneId: 'America/New_York' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-11-20T16:30:00Z') });
    await p.route(/gstatic\.com\/firebasejs|googleapis|cloudfunctions/, r => r.abort());
    await p.goto(BASE + '#demo-insurance'); await p.waitForTimeout(3000);
    await p.locator('#callBtn').tap(); await p.waitForTimeout(1500);
    const s = await state(p);
    check('375x667: on a call the header is hidden', s.live && !s.shown, s);
    check('375x667: no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log('live_header: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
