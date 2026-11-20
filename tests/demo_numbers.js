// VPEX regression check (demo_numbers): demo leads look like a real list.
//  - Every demo number (main and other numbers, Vault records) is in 555-0100..0199, the range reserved for fiction.
//  - No two demo numbers are the same, and neighbours in Up next don't all end the same (they all read 555-0115 before).
//  - No two demo leads share a name (13 did).
//  - A returning visitor with the old demo data gets the new data (demo data version 5).
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/demo_numbers.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };
const FICTION = /^\(\d{3}\) 555-01\d\d$/;
(async () => {
  const br = await chromium.launch();
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) {
    for (const [w, scheme, touch] of [[390, 'dark', true], [390, 'light', true], [1280, 'light', false]]) {
      const tag = o + ' ' + w + ' ' + scheme;
      const ctx = await br.newContext({ viewport: { width: w, height: touch ? 844 : 900 }, isMobile: touch, hasTouch: touch, colorScheme: scheme, timezoneId: 'America/New_York' });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.clock.install({ time: new Date('2026-11-20T16:30:00Z') });
      await p.route(/gstatic\.com\/firebasejs|googleapis|cloudfunctions/, r => r.abort());
      await p.goto(BASE + '#demo-' + o); await p.waitForTimeout(2300);
      const d = await p.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs') || '{}'); const leads = [], vault = [];
        Object.keys(fs).forEach(k => { if (/leadChunks\/c\d+$/.test(k)) Object.values(fs[k].leads || {}).forEach(l => leads.push(l)); if (/^vault\//.test(k)) vault.push(fs[k]); });
        return { leads: leads.map(l => ({ n: l.name, p: l.phoneRaw, ph: l.phone, a: (l.alts || []).map(x => x.n) })), vault: vault.map(v => ({ p: v.phoneRaw, ph: v.phone })), v: localStorage.getItem('dovetail_demo_v') }; });
      if (w === 390 && scheme === 'dark') {
        const nums = d.leads.flatMap(l => [l.p].concat(l.a)).concat(d.vault.map(v => v.p));
        check(tag + ': 240 leads, 5 Vault records', d.leads.length === 240 && d.vault.length === 5, [d.leads.length, d.vault.length]);
        check(tag + ': every number is 555-01xx', nums.every(n => FICTION.test(n)), nums.filter(n => !FICTION.test(n)));
        check(tag + ': dial numbers match what shows', d.leads.every(l => l.ph === '+1' + l.p.replace(/\D/g, '')) && d.vault.every(v => v.ph === '+1' + v.p.replace(/\D/g, '')));
        check(tag + ': no number used twice', new Set(nums).size === nums.length, nums.length - new Set(nums).size);
        check(tag + ': no name used twice', new Set(d.leads.map(l => l.n)).size === d.leads.length, d.leads.length - new Set(d.leads.map(l => l.n)).size);
        check(tag + ': demo data version 5', d.v === '5:' + o, d.v);
      }
      // What a visitor sees: the dial card and Up next (computer) show different endings
      const seen = await p.evaluate(() => { const up = [...((document.getElementById('queueHeading') || document.body).parentElement.parentElement.querySelectorAll('*'))].map(e => e.childElementCount === 0 ? e.textContent.trim() : '').filter(t => /^\(\d{3}\) 555-\d{4}$/.test(t));
        return { up, ov: document.documentElement.scrollWidth > innerWidth }; });
      check(tag + ': the page shows 555-01xx numbers only', !/555-(?!01\d\d)\d{4}/.test(await p.evaluate(() => document.body.innerText)) && /555-01\d\d/.test(await p.evaluate(() => document.body.innerText)));
      if (!touch) { const ends = seen.up.slice(0, 5).map(t => t.slice(-4)); check(tag + ': Up next numbers end differently', ends.length >= 4 && new Set(ends).size === ends.length, seen.up.slice(0, 5)); }
      check(tag + ': no sideways scroll', !seen.ov);
      check(tag + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }
  // A returning visitor who has the old (version 4) demo data gets the new data
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); await p.route(/gstatic\.com\/firebasejs|googleapis|cloudfunctions/, r => r.abort());
  await p.goto(BASE + '#demo-auto'); await p.waitForTimeout(1500);
  await p.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); Object.keys(fs).forEach(k => { if (/leadChunks\/c\d+$/.test(k)) Object.values(fs[k].leads).forEach(l => { l.phoneRaw = '(212) 555-0115'; }); }); localStorage.setItem('__mockfs', JSON.stringify(fs)); localStorage.setItem('dovetail_demo_v', '4:auto'); });
  await p.reload(); await p.waitForTimeout(2000);
  const again = await p.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); const ps = []; Object.keys(fs).forEach(k => { if (/leadChunks\/c\d+$/.test(k)) Object.values(fs[k].leads).forEach(l => ps.push(l.phoneRaw)); }); return { n: new Set(ps).size, v: localStorage.getItem('dovetail_demo_v') }; });
  check('returning visitor with old demo data: fresh data, version 5', again.n === 240 && again.v === '5:auto', again);
  await ctx.close();
  await br.close();
  console.log('demo_numbers: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
