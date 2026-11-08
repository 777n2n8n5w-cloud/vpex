// VPEX regression check (floor_tv): Floor TV, the screen for the TV on the wall. Opens from Settings, Admin controls,
// Command and vpexdialer.com/#tv; today's numbers add up; the leaderboard takes turns; who's on a call; a celebration
// on each yes logged on another device; no lead names or numbers on screen; fits a TV, a computer and a phone.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/floor_tv.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-11-04T11:30:00-05:00';
async function ctxFor(br, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, timezoneId: 'America/New_York', isMobile: c.w < 500, hasTouch: c.w < 500 });
  await ctx.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
  return ctx;
}
async function page(ctx, hash) {
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date(NOW) });
  await p.goto(BASE + hash); await p.waitForTimeout(2600);
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  return { p, errs };
}
const snap = p => p.evaluate(() => {
  const tv = document.getElementById('floorTv'); if (!tv) return null;
  const vw = document.documentElement.clientWidth, over = [...tv.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > vw + 1).map(e => e.className || e.tagName).slice(0, 4);
  const k = [...tv.querySelectorAll('.tv-kpi')].map(x => ({ v: x.querySelector('b').innerText, l: x.querySelector('span').innerText }));
  const rows = [...tv.querySelectorAll('.tv-row')].map(r => ({ name: r.querySelector('.tv-who b').innerText, v: +r.querySelector('.tv-val').innerText.replace(/,/g, ''), sub: r.querySelector('.tv-sub').innerText }));
  const btns = [...tv.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { id: b.id, w: r.width, h: r.height }; });
  const pr = tv.querySelector('.tv-board').getBoundingClientRect(), shown = [...tv.querySelectorAll('.tv-row')].every(r => { const b = r.getBoundingClientRect(); return b.height > 10 && b.top >= pr.top - 1 && b.bottom <= pr.bottom + 1; });
  return { k, rows, shown, board: tv.querySelector('#tvBoardH').innerText, text: tv.innerText, over, btns, sw: tv.scrollWidth, cw: tv.clientWidth, role: tv.getAttribute('role'), focus: tv.contains(document.activeElement), feed: tv.querySelectorAll('.tv-feed li').length };
});
(async () => {
  const br = await chromium.launch();
  const C = [{ n: '1920-dark', w: 1920, h: 1080, s: 'dark' }, { n: '1280-light', w: 1280, h: 800, s: 'light' }, { n: '390-dark', w: 390, h: 844, s: 'dark' }, { n: '390-light', w: 390, h: 844, s: 'light' }];
  for (const c of C) for (const ind of (c.n === '1920-dark' ? ['insurance', 'realestate', 'mca', 'auto', 'solar'] : ['insurance'])) {
    const ctx = await ctxFor(br, c); const { p, errs } = await page(ctx, '#demo-' + ind);
    const tag = c.n + ' ' + ind;
    // the lead names and numbers in this office, to be sure none reach the TV
    const leads = await p.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs') || '{}'), out = []; Object.keys(fs).forEach(k => { const d = fs[k]; if (d && d.leads) Object.values(d.leads).forEach(l => out.push([l.name, String(l.phoneRaw || l.phone || '')])); }); return out; });
    // Settings › Floor TV
    await p.evaluate(() => { document.getElementById('menuBtn').click(); }); await p.waitForTimeout(400);
    check(tag + ': Settings lists Floor TV', await p.evaluate(() => { const b = document.getElementById('openTvBtn'); return !!b && b.style.display !== 'none'; }));
    await p.evaluate(() => document.getElementById('openTvBtn').click()); await p.waitForTimeout(600);
    let s = await snap(p);
    check(tag + ': opens as a named dialog with focus inside', s && s.role === 'dialog' && s.focus, s && { role: s.role, focus: s.focus });
    const num = x => +String(x).replace(/[^0-9]/g, '');
    const want = await p.evaluate(() => window.__vpexTvTest.data());
    check(tag + ': calls / conversations / interested match today', num(s.k[0].v) === want.calls && num(s.k[1].v) === want.talk && num(s.k[2].v) === want.int && want.calls > 0, { k: s.k, want });
    check(tag + ': board adds up to the calls tile', /Most calls/.test(s.board) && s.rows.reduce((a, r) => a + r.v, 0) === want.calls, { board: s.board, rows: s.rows.map(r => r.v) });
    check(tag + ': board sorted, leader first', s.rows.every((r, i) => !i || s.rows[i - 1].v >= r.v) && s.rows.length >= 2);
    check(tag + ': every board row shows inside its panel', s.shown);
    check(tag + ': latest calls listed', s.feed >= 5, s.feed);
    const leak = leads.filter(([n, ph]) => (n && n.length > 3 && s.text.includes(n)) || (ph.replace(/\D/g, '').length >= 10 && s.text.replace(/\D/g, '').includes(ph.replace(/\D/g, '').slice(-7))));
    check(tag + ': no lead names or numbers on screen', !leak.length && leads.length > 10, leak.slice(0, 3));
    check(tag + ': fits, no sideways scroll', !s.over.length && s.sw <= s.cw + 1, s.over);
    check(tag + ': buttons at least 44 px', s.btns.every(b => b.w >= 44 && b.h >= 44), s.btns);
    // the board takes turns; tapping the heading moves it on
    await p.click('#tvBoardH'); await p.waitForTimeout(200); s = await snap(p);
    check(tag + ': board moves to Most conversations', /Most conversations/.test(s.board) && s.rows.reduce((a, r) => a + r.v, 0) === want.talk, s.board);
    await p.clock.runFor(15500); await p.waitForTimeout(200); s = await snap(p);
    check(tag + ': board turns by itself after 15 s', /Most interested/.test(s.board), s.board);
    if (c.n === '1920-dark' || c.n === '390-light') {
      // contrast of the big numbers and labels
      const con = await p.evaluate(() => {
        const lum = c => { let m = c.match(/[\d.]+/g).map(Number); if (/^color\(srgb/.test(c)) m = m.map(v => v * 255); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        const bg = el => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; el = el.parentElement; } return 'rgb(255,255,255)'; };
        return [...document.querySelectorAll('#floorTv .tv-kpi b, #floorTv .tv-kpi span, #floorTv .tv-who b, #floorTv .tv-sub, #floorTv .tv-brand span')].map(e => { const a = lum(getComputedStyle(e).color), b = lum(bg(e)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); });
      });
      check(tag + ': text contrast ≥ 4.5', Math.min(...con) >= 4.5, Math.min(...con).toFixed(2));
      if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '/tv-' + c.n + '.png' });
    }
    // Escape closes and hands focus back
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    check(tag + ': Escape closes it', !(await snap(p)) && !(await p.evaluate(() => document.body.classList.contains('tv-open'))));
    check(tag + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  // a yes logged on a phone shows on the TV with a celebration (two tabs, one login, the in-page backend)
  {
    const ctx = await ctxFor(br, { w: 1920, h: 1080, s: 'dark' });
    const a = await page(ctx, '#demo-solar');
    await a.p.evaluate(() => window.__vpexTvTest.open()); await a.p.waitForTimeout(400);
    const before = await snap(a.p);
    const b = await page(ctx, '#demo-solar');
    const tap = (sel, ms) => b.p.evaluate(sel => document.querySelector(sel).click(), sel).then(() => b.p.waitForTimeout(ms));
    await tap('#callBtn', 400); await tap('#outcomesRow [data-outcome="noanswer"]', 700);
    await b.p.evaluate(() => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')));
    await tap('#callBtn', 400); await tap('#outcomesRow [data-outcome="interested"]', 400);
    let got = null; for (let i = 0; i < 20 && !got; i++) { await a.p.waitForTimeout(250); const s = await snap(a.p); if (s && +s.k[0].v.replace(/\D/g, '') === +before.k[0].v.replace(/\D/g, '') + 2) got = s; }
    check('live: two calls from the phone show on the TV', !!got, got && got.k);
    check('live: interested went up by one', got && +got.k[2].v.replace(/\D/g, '') === +before.k[2].v.replace(/\D/g, '') + 1, got && got.k);
    const cele = await a.p.evaluate(() => { const c = document.getElementById('tvCele'); return c && !c.hidden ? c.innerText : null; });
    check('live: celebration shows the rep and Interested', cele && /Interested!/.test(cele) && /You/.test(cele), cele);
    await a.p.clock.runFor(5500); await a.p.waitForTimeout(200);
    check('live: celebration clears after 5 s', await a.p.evaluate(() => document.getElementById('tvCele').hidden));
    check('live: no page errors', !a.errs.length && !b.errs.length, a.errs.concat(b.errs));
    await ctx.close();
  }
  // vpexdialer.com/#tv style link opens it once the office has loaded; Command finds it
  {
    const ctx = await ctxFor(br, { w: 1280, h: 800, s: 'dark' });
    const { p, errs } = await page(ctx, '#demo-auto-tv');
    await p.waitForTimeout(1200);
    check('#…-tv link opens Floor TV', !!(await snap(p)));
    await p.click('#tvClose'); await p.waitForTimeout(200);
    check('closing drops -tv from the address', !/tv$/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
    check('no page errors (link)', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('floor_tv:', pass, 'passed,', fail, 'failed'); process.exit(fail ? 1 : 0);
})();
