// VPEX regression check (manual_dial): the Manual dial keypad.
//  - The switch turns the keypad on and off; keys type and format the number; Delete works.
//  - Pasted numbers dial however they're written, including "+1 (732) 555-0142" (how iPhone copies a number)
//    and numbers with an extension; a number that can't be called says why instead of a silent grey button.
//  - Calling a new number opens the phone and then asks whether to save it; a lead's number is recognized.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/manual_dial.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-11-06T16:00:00Z') });   // Fri 11 AM in New York
  await page.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await page.addInitScript(() => { window.__tel = []; window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) setTimeout(() => window.__tel.push({ href: a.getAttribute('href'), prevented: e.defaultPrevented }), 0); }, true); });
  await page.goto(BASE + '#demo-investments'); await page.waitForTimeout(2500);
  const ev = (f, a) => page.evaluate(f, a);

  check('the Manual dial switch is on the Dial tab', await ev(() => !!document.getElementById('mdToggle')));
  await page.tap('#mdToggle'); await page.waitForTimeout(400);
  check('switching it on shows the keypad', await ev(() => !!document.getElementById('kpNum') && document.querySelectorAll('[data-k]').length === 12));
  const sw = await ev(() => { const t = document.getElementById('mdToggle'), r = t.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && t.contains(hit); });
  check('the switch can be tapped (nothing covers it)', sw);

  for (const k of '73255501429') await page.tap('[data-k="' + k + '"]');
  await page.tap('#kpDel'); await page.waitForTimeout(150);
  const typed = await ev(() => ({ v: document.getElementById('kpNum').value, call: !!document.querySelector('#kpGo a'), info: document.getElementById('kpInfo').innerText }));
  check('keys type and Delete removes the last digit', typed.v === '(732) 555-0142', typed);
  check('a full number lights up Call', typed.call && /New number/.test(typed.info), typed);

  const paste = v => ev(v => { const i = document.getElementById('kpNum'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true }));
    const a = document.querySelector('#kpGo a'); return { v: i.value, href: a ? a.getAttribute('href') : null, info: document.getElementById('kpInfo').innerText }; }, v);
  for (const v of ['+1 (732) 555-0142', '+17325550142', '‪+1 (732) 555‑0142‬', '1-732-555-0142', '732.555.0142', '(732) 555-0142 ext. 12', '732-555-0142 x12']) {
    const r = await paste(v);
    check('pasting ' + JSON.stringify(v) + ' dials (732) 555-0142', !!r.href && r.href.replace(/\D/g, '').slice(-10) === '7325550142', r);
  }
  check('a pasted +1 number shows as (732) 555-0142', (await paste('+1 (732) 555-0142')).v === '(732) 555-0142');
  await paste('');
  for (const k of '17325550142') await page.tap('[data-k="' + k + '"]');
  const fit = await ev(() => { const i = document.getElementById('kpNum'), c = document.createElement('canvas').getContext('2d'), cs = getComputedStyle(i); c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    return { v: i.value, text: c.measureText(i.value).width + i.value.length * (parseFloat(cs.letterSpacing) || 0), room: i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }; });
  check('a typed 1 + 10 digits fits on the line', fit.v === '1 (732) 555-0142' && fit.text <= fit.room, fit);
  const intl = await paste('+44 20 7946 0958');
  check('a non-US number says why it can\'t be called', !intl.href && /US numbers/.test(intl.info), intl);
  const long = await paste('732555014299');
  check('too many digits says so', !long.href && /12 digits\. A US number has 10/.test(long.info), long);
  const short = await paste('732555');
  check('a number still being typed stays quiet', !short.href && short.info === '', short);

  const known = await paste('(212) 555-0115');
  check('a lead\'s number shows who it is', /Anthony Ross/.test(known.info) && !!known.href, known);

  await paste('(732) 555-0142');
  await page.tap('#kpGo a'); await page.waitForTimeout(800);
  const tel = await ev(() => window.__tel);
  check('Call dials the number (demo holds the actual call)', tel.length === 1 && tel[0].href.replace(/\D/g, '').slice(-10) === '7325550142', tel);
  check('after the call it asks whether to save the number', /You called \(732\) 555-0142\. Add them as a lead\?/.test(await ev(() => (document.querySelector('.kp-after') || {}).innerText || '')));
  await page.tap('#kpSkip'); await page.waitForTimeout(300);
  await page.tap('#mdToggle'); await page.waitForTimeout(300);
  check('switching it off brings your leads back', await ev(() => !document.getElementById('kpNum') && !!document.getElementById('mdToggle')));
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('manual_dial: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
