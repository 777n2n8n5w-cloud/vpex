// VPEX regression check (calls_live): "calls today" moves the moment a call is placed, for you and for the admin watching.
//  - The rep's own count goes up when they tap Call (not when the outcome is logged), and doesn't go up again on logging.
//  - The admin's Team panel shows the rep's new count and "on a call with <lead>" within 1.5 s, even while the admin is
//    typing in Add a rep (the text and the cursor stay put); logging doesn't count it twice.
//  - The Scoreboard and the computer's "Your day" count it as well.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/calls_live.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ timezoneId: 'America/New_York' });
  await ctx.clock.install({ time: new Date('2026-11-04T11:30:00-05:00') });   // a weekday 11:30 AM in New York: the leads are inside calling hours (at night Call asks first)
  const errs = [];
  const admin = await ctx.newPage(); await admin.setViewportSize({ width: 390, height: 844 }); admin.on('pageerror', e => errs.push('admin: ' + e.message));
  await admin.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await admin.goto(BASE + '#mockbench'); await admin.waitForTimeout(500);
  await admin.evaluate(() => {
    const db = demoSeed();
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'demo@dovetail-f863c.firebaseapp.com': { uid: 'dAdm', pw: 'test' }, 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' } }));
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dAdm', email: 'demo@dovetail-f863c.firebaseapp.com' }));
  });
  await admin.goto(BASE); await admin.waitForTimeout(2800);
  const rep = await ctx.newPage(); await rep.setViewportSize({ width: 390, height: 844 }); rep.on('pageerror', e => errs.push('rep: ' + e.message));
  await rep.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await rep.addInitScript(() => { try { sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR2', email: 'sam@dovetail-f863c.firebaseapp.com' })); } catch (e) {} window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }); });
  await rep.goto(BASE); await rep.waitForTimeout(2800);

  const repCount = () => rep.evaluate(() => +document.getElementById('todayNum').textContent);
  const samLine = () => admin.evaluate(() => { const el = document.querySelector('[data-tm-stat="dR2"]'); return el ? el.textContent : null; });
  const samCalls = async () => { const t = await samLine(); const m = /(\d+) calls? today/.exec(t || ''); return m ? +m[1] : -1; };
  const waitFor = async (f, ok, ms) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await f(); if (ok(v)) return { v, ms: Date.now() - t0 }; await sleep(100); } return { v, ms: -1 }; };

  // the admin opens Team & access and starts typing a new rep's username
  await admin.evaluate(() => document.getElementById('adminBtn').click()); await admin.waitForTimeout(300);
  await admin.evaluate(() => document.getElementById('hubTeam').click()); await admin.waitForTimeout(500);
  check('Team panel shows Sam with a calls-today line', /calls? today/.test(await samLine() || ''), await samLine());
  await admin.click('#tmUser'); await admin.keyboard.type('lancenop');
  const c0 = await samCalls(), r0 = await repCount();

  // 1. the rep taps Call
  const who = await rep.evaluate(() => document.querySelector('.lead-name').textContent);
  await rep.evaluate(() => document.getElementById('callBtn').click());
  const rc = await waitFor(repCount, v => v === r0 + 1, 1000);
  check('rep: their own count goes up the moment they tap Call', rc.ms >= 0, { r0, got: rc.v });
  const ac = await waitFor(samCalls, v => v === c0 + 1, 2500);
  check('admin: Sam\'s count goes up within 1.5 s of the dial, while the admin types', ac.ms >= 0 && ac.ms < 1500, { c0, got: ac.v, ms: ac.ms });
  check('admin: and it says who Sam is on a call with', new RegExp('on a call with ' + who).test(await samLine() || ''), await samLine());
  const typing = await admin.evaluate(() => ({ v: document.getElementById('tmUser').value, f: document.activeElement && document.activeElement.id }));
  check('admin: the username being typed and the cursor stay put', typing.v === 'lancenop' && typing.f === 'tmUser', typing);

  // 2. the rep logs the outcome: still one call, not two
  await rep.evaluate(() => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await rep.waitForTimeout(400);
  check('rep: logging the outcome doesn\'t count it twice', await repCount() === r0 + 1, await repCount());
  await sleep(1500);
  const after = await samCalls();
  check('admin: still one more call after it\'s logged (not two), and no longer on a call', after === c0 + 1 && !/on a call/.test(await samLine() || ''), { after, line: await samLine() });

  // 2b. dialed, then Skip: Skip waits for the real outcome (nothing is logged for them, so Call + Skip can't pad the count)
  await rep.waitForTimeout(9000);   // the pacing gap between dials
  const savedCalls = () => admin.evaluate(() => { const db = JSON.parse(localStorage.getItem('__mockfs')); return Object.keys(db).filter(k => /^callDays\/\d{4}-\d\d-\d\d_dR2_/.test(k)).reduce((n, k) => n + Object.keys(db[k].calls || {}).length, 0); });
  const sv0 = await savedCalls(), skipWho = await rep.evaluate(() => document.querySelector('.lead-name').textContent);
  await rep.evaluate(() => document.getElementById('callBtn').click()); await rep.waitForTimeout(400);
  await rep.evaluate(() => document.getElementById('skipBtn').click()); await rep.waitForTimeout(700);
  let sk = await rep.evaluate(() => ({ toast: document.getElementById('toast').textContent, cur: (document.querySelector('.lead-name') || {}).textContent, need: document.getElementById('outcomesRow').classList.contains('need'), n: +document.getElementById('todayNum').textContent }));
  check('dial then Skip: asks for the outcome, stays on the lead, logs nothing', /went first/.test(sk.toast) && sk.need && sk.cur === skipWho && (await savedCalls()) === sv0, { sk, saved: await savedCalls(), sv0 });
  check('dial then Skip: the live call still counts once, no more', sk.n === r0 + 2, { sk, r0 });
  await rep.evaluate(() => document.querySelector('.out-btn[data-outcome="voicemail"]').click()); await rep.waitForTimeout(900);
  check('the real outcome saves it, counted once', (await savedCalls()) === sv0 + 1 && (await repCount()) === r0 + 2, { saved: await savedCalls(), n: await repCount() });
  const ac2 = await waitFor(samCalls, v => v === c0 + 2, 2500);
  check('admin: it counts for Sam once', ac2.ms >= 0, ac2);
  await rep.waitForTimeout(9000);
  const n0 = await repCount();
  await rep.evaluate(() => document.getElementById('skipBtn').click()); await rep.waitForTimeout(500);
  check('Skip without dialing still just skips (no count)', (await repCount()) === n0 && (await rep.evaluate(() => (document.querySelector('.lead-name') || {}).textContent)) !== skipWho, await repCount());

  // 3. the Scoreboard counts a call the moment it's placed too
  await admin.keyboard.press('Tab'); await admin.evaluate(() => { const x = document.querySelector('#teamModal .modal-x, #teamModal [data-close], #teamModalClose'); if (x) x.click(); else document.getElementById('teamModal').classList.remove('show'); });
  await rep.waitForTimeout(9000);   // the pacing gap between dials
  await rep.evaluate(() => document.getElementById('callBtn').click()); await sleep(1500);
  const sb = await admin.evaluate(() => { const s = window.__scoreRows ? window.__scoreRows() : null; return s; });
  check('Scoreboard: Sam\'s live call counts', (sb.find(r => r.uid === 'dR2') || {}).calls === c0 + 3, sb);
  check('rep: third dial counted at once', await repCount() === r0 + 3, await repCount());
  // 4. a call placed from Search counts the moment it's placed too (it used to wait for the outcome)
  await rep.evaluate(() => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await rep.waitForTimeout(400);
  const r3 = await repCount();
  await rep.waitForTimeout(9000);
  await rep.evaluate(() => document.getElementById('searchBtn').click()); await rep.waitForTimeout(300);
  await rep.fill('#gsQ', 'walsh'); await rep.waitForTimeout(400);
  await rep.evaluate(() => document.querySelector('.srch-call').click()); await rep.waitForTimeout(500);
  check('rep: a call from Search counts the moment it\'s placed', await repCount() === r3 + 1, { r3, now: await repCount() });
  await rep.evaluate(() => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await rep.waitForTimeout(400);
  check('rep: and once, after the outcome', await repCount() === r3 + 1, await repCount());
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('calls_live: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
