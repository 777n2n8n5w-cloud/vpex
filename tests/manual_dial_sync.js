// VPEX regression check (manual_dial_sync): Manual dial never gets stuck on "Save or skip the number you just called first".
// The switch syncs across a rep's phone and computer, but the "You called … Add them as a lead?" question stays on the
// phone that made the call. Switching Manual dial off on the computer used to hide that question on the phone while the
// switch kept refusing with that message, so Manual dial looked broken.
//  - Phone calls a new number, the computer switches Manual dial off: on the phone, the switch opens the question.
//  - Don't save → the keypad is back and calls again.
//  - A question left from hours ago doesn't block anything.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/manual_dial_sync.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ timezoneId: 'America/New_York' });
  await ctx.clock.install({ time: new Date('2026-11-23T11:30:00-05:00') });
  const boot = await ctx.newPage(); await boot.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await boot.goto(BASE + '#mockbench'); await boot.waitForTimeout(500);
  await boot.evaluate(() => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(demoSeed()));
    localStorage.setItem('__mockauth', JSON.stringify({ 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' } })); });
  await boot.close();
  const errs = [];
  const open = async (w, mobile) => { const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: 844 }); p.on('pageerror', e => errs.push(e.message));
    await p.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
    await p.addInitScript(() => { sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR2', email: 'sam@dovetail-f863c.firebaseapp.com' }));
      window.__toasts = []; new MutationObserver(() => { const t = document.querySelector('.toast'); if (t && t.textContent && window.__toasts[window.__toasts.length - 1] !== t.textContent) window.__toasts.push(t.textContent); }).observe(document, { subtree: true, childList: true, characterData: true });
      window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }, true); });
    await p.goto(BASE); await p.waitForTimeout(3000); return p; };
  const phone = await open(390), desk = await open(1366);
  const st = p => p.evaluate(() => ({ on: (document.getElementById('mdToggle') || {}).getAttribute ? document.getElementById('mdToggle').getAttribute('aria-checked') : null,
    kp: !!document.getElementById('kpNum'), ask: !!document.getElementById('kpSave'), card: (document.querySelector('.lead-name') || {}).textContent || null, toast: window.__toasts.slice(-1)[0] || '' }));

  // the phone calls a new number from the keypad
  await phone.evaluate(() => document.getElementById('mdToggle').click()); await phone.waitForTimeout(300);
  for (const k of '7325550142') await phone.evaluate(k => document.querySelector('[data-k="' + k + '"]').click(), k);
  await phone.evaluate(() => document.querySelector('#kpGo a').click()); await phone.waitForTimeout(800);
  check('phone: after the call it asks whether to save the number', (await st(phone)).ask);
  await sleep(2500);   // the switch's state reaches the computer

  // the computer switches Manual dial off: the saved setting for this login says off, and the phone opens with it
  // (the same state the phone reaches when the change syncs in while it's open)
  const prefsOff = await phone.evaluate(() => {
    const fs = JSON.parse(localStorage.getItem('__mockfs')), ck = Object.keys(fs).find(k => /leadChunks\/r_dR2$/.test(k));
    if (ck && fs[ck].prefs) { fs[ck].prefs.manualDial = false; localStorage.setItem('__mockfs', JSON.stringify(fs)); }
    let local = 0; for (const k of Object.keys(localStorage)) { if (!/^(vpex|dovetail)_team_/.test(k)) continue; try { const v = JSON.parse(localStorage.getItem(k)); if (v && 'manualDial' in v) { v.manualDial = false; localStorage.setItem(k, JSON.stringify(v)); local++; } } catch (e) {} }
    return { ck: !!ck, local };
  });
  await phone.reload(); await phone.waitForTimeout(3000);
  const p1 = await st(phone);
  check('phone: Manual dial shows off, the question is out of sight (the stuck state)', p1.on === 'false' && !p1.ask, { prefsOff, p1 });

  // the phone taps the switch: it opens the waiting question instead of refusing
  await phone.evaluate(() => { window.__toasts = []; document.getElementById('mdToggle').click(); }); await phone.waitForTimeout(400);
  const p2 = await st(phone);
  check('phone: the switch opens the "Add them as a lead?" question, no "Save or skip … first" dead end', p2.ask && !/Save or skip/.test(p2.toast), p2);
  await phone.evaluate(() => document.getElementById('kpSkip').click()); await phone.waitForTimeout(400);
  const p3 = await st(phone);
  check('phone: Don\'t save brings the keypad back', p3.kp && !p3.ask, p3);
  await phone.clock.fastForward(20000);
  for (const k of '2015550199') await phone.evaluate(k => document.querySelector('[data-k="' + k + '"]').click(), k);
  await phone.evaluate(() => document.querySelector('#kpGo a').click()); await phone.waitForTimeout(800);
  check('phone: and the next number calls', (await st(phone)).ask);

  // a question left from hours ago is let go: switching off and on opens the keypad, not a stale question
  await phone.clock.fastForward(7 * 3600000); await phone.waitForTimeout(300);
  await phone.evaluate(() => document.getElementById('mdToggle').click()); await phone.waitForTimeout(400);
  const p4 = await st(phone);
  if (p4.on === 'false') { await phone.evaluate(() => document.getElementById('mdToggle').click()); await phone.waitForTimeout(400); }
  const p5 = await st(phone);
  check('phone: a question from 7 hours ago no longer blocks the keypad', p5.kp && !p5.ask, { p4, p5 });
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('manual_dial_sync: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
