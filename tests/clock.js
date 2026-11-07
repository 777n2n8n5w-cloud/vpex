// VPEX regression check (clock): your date and time in the header of every theme.
//  - Shows the day, date, time and zone; moves on the minute.
//  - Tap it for the time across the US: each zone's time, whether calling hours are open there, and a
//    one-tap "Call N" that switches the Dial tab to that zone's leads.
//  - Fits on a 320 px phone in every public theme without pushing the header buttons; sits in the top bar on desktop.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/clock.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
async function open(br, w) {
  const ctx = await br.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, hasTouch: w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-11-06T16:00:30Z') });   // Fri 11:00 AM in New York
  await page.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await page.goto(BASE + '#demo-investments'); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const ev = (page, f, a) => page.evaluate(f, a);
const txt = (page, id) => ev(page, i => { const e = document.getElementById(i); return e ? e.textContent : null; }, id);

(async () => {
  const br = await chromium.launch();
  {
    const { ctx, page, errs } = await open(br, 390);
    check('phone shows the time', await txt(page, 'hcTime') === '11:00 AM', await txt(page, 'hcTime'));
    check('phone shows the day and date', await txt(page, 'hcDate') === 'Friday, November 6', await txt(page, 'hcDate'));
    check('phone shows the zone', await txt(page, 'hcZone') === 'EST', await txt(page, 'hcZone'));
    const vis = await ev(page, () => { const r = document.getElementById('hdrClock').getBoundingClientRect(), h = document.querySelector('header.top').getBoundingClientRect(); return r.height > 10 && r.top >= h.top && r.bottom <= h.bottom; });
    check('clock sits inside the header', vis);
    await page.clock.runFor(61000); await page.waitForTimeout(100);
    check('clock moves on the minute', await txt(page, 'hcTime') === '11:01 AM', await txt(page, 'hcTime'));
    check('label reads the time aloud', /11:01 AM on Friday, November 6/.test(await ev(page, () => document.getElementById('hdrClock').getAttribute('aria-label'))));

    await ev(page, () => document.getElementById('hdrClock').click()); await page.waitForTimeout(300);
    const sh = await ev(page, () => [...document.querySelectorAll('#featModalBody .tz-row')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    check('US time sheet lists six zones', sh.length === 6, sh);
    check('Eastern is marked as yours', /^Eastern You 11:01 AM EST/.test(sh[0] || ''), sh[0]);
    check('Pacific shows 8:01 AM and open', /Pacific 8:01 AM PST Calling hours, until 9 PM/.test(sh[3] || ''), sh[3]);
    check('Hawaii is too early', /Hawaii 6:01 AM HST Too early, opens at 8 AM/.test(sh[5] || ''), sh[5]);
    const go = await ev(page, () => { const b = [...document.querySelectorAll('[data-tz-go]')].find(x => !x.disabled); return b ? b.getAttribute('data-tz-go') : null; });
    check('a zone with leads offers Call', !!go, go);
    if (go) {
      await ev(page, z => document.querySelector('[data-tz-go="' + z + '"]').click(), go); await page.waitForTimeout(400);
      const after = await ev(page, () => ({ open: document.getElementById('featModal').classList.contains('show'), toast: document.getElementById('toast').textContent, view: document.body.dataset.view }));
      check('Call switches to that zone and closes the sheet', !after.open && /^Calling .+ leads$/.test(after.toast), after);
    }
    check('no page errors (phone)', !errs.length, errs);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open(br, 320);
    const ids = Object.keys(JSON.parse(require('fs').readFileSync(__dirname + '/../index.html', 'utf8').match(/var VX_KIT = (\{[^}]*\})/)[1]));
    check('theme list available', ids.length > 50, ids.length);
    const bad = [];
    for (const id of ids) {
      const r = await ev(page, t => {
        document.documentElement.setAttribute('data-theme', t); window.__applyThemeFont && window.__applyThemeFont(t);
        const c = document.getElementById('hdrClock'), tm = c.querySelector('.hc-time').getBoundingClientRect(), d = c.querySelector('.hc-date').getBoundingClientRect();
        const hr = document.querySelector('.header-right').getBoundingClientRect(), cs = getComputedStyle(c);
        return { shown: cs.display !== 'none' && cs.visibility !== 'hidden' && tm.width > 20, fits: tm.right <= innerWidth - 4 && d.right <= tm.left, btns: hr.right <= innerWidth, overlap: tm.bottom > hr.top + 2 && tm.top < hr.bottom };
      }, id);
      if (!r.shown || !r.fits || !r.btns || r.overlap) bad.push(id + ' ' + JSON.stringify(r));
    }
    check('every theme shows the clock at 320 px, fitted, buttons untouched', !bad.length, bad.slice(0, 6));
    check('no page errors (themes)', !errs.length, errs);
    await ctx.close();
  }
  {
    const { ctx, page, errs } = await open(br, 1440);
    const r = await ev(page, () => { const c = document.getElementById('hdrClock').getBoundingClientRect(), h = document.querySelector('.header-right').getBoundingClientRect(), t = document.querySelector('#viewTabs').getBoundingClientRect();
      return { desk: document.body.classList.contains('desk'), sameRow: Math.abs((c.top + c.bottom) / 2 - (h.top + h.bottom) / 2) < 12, between: c.left >= t.right && c.right <= h.left }; });
    check('desktop: clock sits in the top bar between the tabs and the buttons', r.sameRow && r.between, r);
    check('no page errors (desktop)', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('clock: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
