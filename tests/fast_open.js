// VPEX regression check (fast_open): the sign-in scripts (~180 KB) no longer hold up the first paint.
// On the live site (?fbretry=1 makes localhost act like it) a phone that isn't signed in sees the sales page while they
// download; a signed-in phone sees "Connecting…" as before; then the usual boot, with the visitor's typing kept.
// Demo offices and the test bench skip the download.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/fast_open.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const FB_RE = /gstatic\.com\/firebasejs/;
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
// signed-out stand-ins for Google's sign-in scripts (same as smoke.js)
const STUB = {
  'firebase-app-compat.js': 'window.firebase={apps:[],initializeApp:function(){var a={auth:function(){return {onAuthStateChanged:function(cb){window.__authCb=(window.__authCb||0)+1;setTimeout(function(){cb(null)},0);return function(){}},setPersistence:function(){return Promise.resolve()},currentUser:null}},firestore:function(){return {settings:function(){},enablePersistence:function(){return Promise.resolve()}}}};window.firebase.apps.push(a);return a},app:function(){return window.firebase.apps[0]}};window.__fbStubLoads=(window.__fbStubLoads||0)+1;',
  'firebase-auth-compat.js': 'window.firebase.auth=function(){};window.firebase.auth.Auth={Persistence:{LOCAL:"local"}};',
  'firebase-firestore-compat.js': 'window.firebase.firestore=function(){};window.firebase.firestore.FieldValue={};',
  'firebase-messaging-compat.js': 'window.firebase.messaging=function(){};',
};
const DELAY = 3000;   // a slow phone on cell data
const vis = (page, id) => page.evaluate(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }, id);
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), head = src.slice(0, src.indexOf('</head>'));
  check('no blocking sign-in <script src> left in the page', !/<script[^>]+src="https:\/\/www\.gstatic\.com\/firebasejs/.test(src));
  check('loader keeps the order (async = false) and all 4 files', /el\.async = false/.test(head) && /\["app", "auth", "firestore", "messaging"\]/.test(head));
  check('early theme script still above every stylesheet', head.indexOf('VPEX_SIG') > -1 && head.indexOf('VPEX_SIG') < head.search(/<link rel="stylesheet"|<style/));
  check('loader sits after the early theme script', head.indexOf('window.__vpexFb') > head.indexOf('VPEX_SIG'));
  const br = await chromium.launch();
  for (const c of [{ n: '390-dark', w: 390, h: 844, s: 'dark' }, { n: '390-light', w: 390, h: 844, s: 'light' }, { n: '1280-dark', w: 1280, h: 860, s: 'dark' }]) {
    // 1. visitor, scripts slow: sales page first, then the real boot
    {
      const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      let hits = 0;
      await page.route(FB_RE, async r => { hits++; await new Promise(z => setTimeout(z, DELAY)); r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB[r.request().url().split('/').pop()] || '' }).catch(() => {}); });
      const t0 = Date.now();
      await page.goto(BASE + '?fbretry=1', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => { const a = document.getElementById('authScreen'), h = document.getElementById('authHero'); return a && getComputedStyle(a).display !== 'none' && h && getComputedStyle(h).display !== 'none'; }, null, { timeout: 8000 }).catch(() => {});
      const shown = Date.now() - t0;
      check(c.n + ' visitor: sales page shows before the sign-in scripts arrive', shown < DELAY - 500, shown);
      check(c.n + ' visitor: trial form ready, no "Connecting…"', (await vis(page, 'authSignup')) && !(await vis(page, 'authConnecting')));
      const st0 = await page.evaluate(() => ({ done: window.__vpexFb.done, loads: window.__fbStubLoads || 0 }));
      check(c.n + ' visitor: scripts still downloading at that point', !st0.done && !st0.loads, st0);
      // type into the trial form while the scripts arrive
      const field = await page.$('#authSignup input:not([type=hidden])');
      if (field) await field.fill('Bright Sun Solar');
      await page.waitForFunction(() => window.__vpexFb.done && window.__authCb, null, { timeout: DELAY + 6000 }).catch(() => {});
      await page.waitForTimeout(400);
      const st = await page.evaluate(() => ({ loads: window.__fbStubLoads, cb: window.__authCb, val: (document.querySelector('#authSignup input:not([type=hidden])') || {}).value, msg: document.getElementById('authMsg').innerText, retry: !!document.getElementById('fbRetryBtn'), scripts: document.querySelectorAll('script[src*="firebasejs"]').length }));
      check(c.n + ' visitor: boot ran once when they arrived', st.loads === 1 && st.cb === 1, st);
      check(c.n + ' visitor: each file requested once, no retry', hits === 4 && st.scripts === 4 && !st.retry, { hits, st });
      check(c.n + ' visitor: what they typed is kept, no message', st.val === 'Bright Sun Solar' && !st.msg.trim(), st);
      check(c.n + ' visitor: sales page still up, no "Connecting…"', (await vis(page, 'authHero')) && !(await vis(page, 'authConnecting')));
      check(c.n + ' visitor: no page errors', !errs.length, errs);
      await ctx.close();
    }
    // 2. signed-in phone: "Connecting…" while they download (not the sales page)
    {
      const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s });
      await ctx.addInitScript(() => { try { localStorage.setItem('vpex_team_u1', '{}'); } catch (e) {} });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route(FB_RE, async r => { await new Promise(z => setTimeout(z, DELAY)); r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB[r.request().url().split('/').pop()] || '' }).catch(() => {}); });
      await page.goto(BASE + '?fbretry=1', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
      check(c.n + ' signed-in phone: "Connecting…" while the scripts download', await vis(page, 'authConnecting'));
      await page.waitForFunction(() => window.__authCb, null, { timeout: DELAY + 6000 }).catch(() => {});
      check(c.n + ' signed-in phone: boot ran when they arrived', await page.evaluate(() => window.__fbStubLoads === 1 && window.__authCb === 1));
      check(c.n + ' signed-in phone: no page errors', !errs.length, errs);
      await ctx.close();
    }
  }
  // 3. demo offices and the test bench don't download the sign-in scripts at all
  for (const hash of ['#demo-insurance', '#demo-solar', '#mockbench']) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    let hits = 0; await page.route(FB_RE, r => { hits++; r.abort(); });
    await page.goto(BASE + hash); await page.waitForTimeout(2500);
    check(hash + ': no sign-in script download', hits === 0, hits);
    if (hash !== '#mockbench') check(hash + ': demo works (Call button)', await vis(page, 'callBtn'));
    else check(hash + ': test bench shows the sales page', await vis(page, 'authScreen'));
    check(hash + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  // 4. local page without ?fbretry: waits for the scripts, then the old on-device mode (as before)
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(FB_RE, r => r.abort());
    await page.goto(BASE); await page.waitForTimeout(1500);
    check('localhost: on-device mode unchanged', /Load your leads to start dialing/.test(await page.evaluate(() => document.body.innerText)));
    check('localhost: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('fast_open:', pass, 'passed,', fail, 'failed'); process.exit(fail ? 1 : 0);
})();
