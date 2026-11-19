// VPEX regression check (keypad_fit): the Manual dial number is big and fits on its line.
//  - On touch screens the iPhone no-zoom rule (inputs at 16px) used to win over the keypad's 32px/26px,
//    so the number showed at 16px. Now it stays 32px (24px for 1 + 10 digits; 26/22px under 360 px wide).
//  - 10 digits and 1 + 10 digits fit without scrolling inside the box at 320, 360, 390 (dark/light) and 1280.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/keypad_fit.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
(async () => {
  const br = await chromium.launch();
  const sizes = [[320, 'light', true], [360, 'dark', true], [390, 'dark', true], [390, 'light', true], [1280, 'light', false]];
  for (const [w, scheme, touch] of sizes) {
    const ctx = await br.newContext({ viewport: { width: w, height: touch ? 740 : 900 }, isMobile: touch, hasTouch: touch, colorScheme: scheme, timezoneId: 'America/New_York' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-11-06T16:00:00Z') });
    await p.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
    await p.goto(BASE + '#demo-insurance'); await p.waitForTimeout(2500);
    const tap = s => touch ? p.tap(s) : p.click(s);
    await tap('#mdToggle'); await p.waitForTimeout(400);
    const tag = w + ' ' + scheme;
    for (const num of ['7325550142', '17325550142']) {
      await p.evaluate(() => { const i = document.getElementById('kpNum'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
      for (const k of num) await tap('[data-k="' + k + '"]');
      const r = await p.evaluate(() => { const i = document.getElementById('kpNum'), cs = getComputedStyle(i);
        return { v: i.value, fs: parseFloat(cs.fontSize), sw: i.scrollWidth, cw: i.clientWidth, ov: document.documentElement.scrollWidth > innerWidth }; });
      const min = num.length === 11 ? (w < 360 ? 22 : 24) : (w < 360 ? 26 : 32);
      check(tag + ': ' + num.length + ' digits at ' + min + 'px or more', r.fs >= min, r);
      check(tag + ': ' + num.length + ' digits fit in the box (no scrolling inside it)', r.sw <= r.cw + 1, r);
      check(tag + ': no sideways scroll', !r.ov, r);
    }
    check(tag + ': no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log('keypad_fit: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
