// VPEX smoke checks. Run against a local copy:
//   python3 -m http.server 8765   (in the repo root)
//   NODE_PATH=<dir with playwright> node tests/smoke.js
// Uses the built-in demo offices (#demo-*) and the mock backend (#mockbench), so nothing touches the live database.
// The browser runs with no proxy: Google's scripts and fonts don't load, like a phone whose signal drops mid-load.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const OFFICES = ['insurance', 'realestate', 'mca', 'auto', 'solar'];
const CONFIGS = [
  { name: 'phone-dark', w: 390, h: 844, scheme: 'dark' },
  { name: 'phone-light', w: 390, h: 844, scheme: 'light' },
  { name: 'desk', w: 1280, h: 860, scheme: 'dark' },
];
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }
const FB_RE = /gstatic\.com\/firebasejs/;
// A tiny stand-in for Google's sign-in scripts: signed out, nothing stored. Enough for the sales page to come up.
const FB_STUB = {
  'firebase-app-compat.js': 'window.firebase={apps:[],initializeApp:function(){var a={auth:function(){return {onAuthStateChanged:function(cb){setTimeout(function(){cb(null)},0);return function(){}},setPersistence:function(){return Promise.resolve()},currentUser:null}},firestore:function(){return {settings:function(){},enablePersistence:function(){return Promise.resolve()}}}};window.firebase.apps.push(a);return a},app:function(){return window.firebase.apps[0]}};window.__fbStubLoads=(window.__fbStubLoads||0)+1;',
  'firebase-auth-compat.js': 'window.firebase.auth=function(){};window.firebase.auth.Auth={Persistence:{LOCAL:"local"}};',
  'firebase-firestore-compat.js': 'window.firebase.firestore=function(){};window.firebase.firestore.FieldValue={};',
  'firebase-messaging-compat.js': 'window.firebase.messaging=function(){};',
};

async function newPage(browser, c, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, isMobile: c.w < 500, hasTouch: c.w < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  return { ctx, page, errs };
}

async function layout(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth, over = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      const b = el.getBoundingClientRect();
      if (!b.width || b.right <= vw + 1) continue;
      let p = el.parentElement, clipped = false;
      while (p) { if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; } p = p.parentElement; }
      if (!clipped) over.push((el.id || el.className || el.tagName).toString().slice(0, 40));
    }
    const bad = document.body.innerText.match(/undefined|NaN|Dovetail|\[object/g) || [];
    return { over: over.slice(0, 5), bad, sw: document.documentElement.scrollWidth, vw };
  });
}

(async () => {
  const browser = await chromium.launch();

  // 1. Every demo office at phone (dark, light) and computer size
  for (const o of OFFICES) for (const c of CONFIGS) {
    const { ctx, page, errs } = await newPage(browser, c);
    const t0 = Date.now();
    await page.goto(BASE + '#demo-' + o);
    await page.waitForSelector('.lead-name, #leadName, .call-btn, [data-call]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const ms = Date.now() - t0;
    const l = await layout(page);
    const tag = o + '/' + c.name;
    check(tag + ' no page errors', !errs.length, errs);
    check(tag + ' no sideways overflow', l.sw <= l.vw && !l.over.length, l);
    check(tag + ' no leftover words', !l.bad.length, l.bad);
    check(tag + ' demo banner', await page.locator('text=Exit demo').first().isVisible().catch(() => false));
    check(tag + ' call button', await page.locator('button:has-text("Call ")').first().isVisible().catch(() => false));
    check(tag + ' opens in under 8 s', ms < 8000, ms);
    if (c.name === 'phone-dark') {
      // log a call outcome; the calls-today counter moves
      const before = await page.evaluate(() => document.getElementById('todayNum').textContent);
      const na = page.locator('[data-outcome="noanswer"]').first();
      if (await na.count()) {
        await page.evaluate(() => { document.getElementById('copyBtn').click(); }); await page.waitForTimeout(300);   // the first-visit tour covers the card, so tap through code
        await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="noanswer"]').click()); await page.waitForTimeout(800);
        const after = await page.evaluate(() => document.getElementById('todayNum').textContent);
        check(tag + ' No answer counts a call', Number(after) === Number(before) + 1, { before, after });
      } else check(tag + ' No answer button', false);
      check(tag + ' no page errors after a call', !errs.length, errs);
    }
    await ctx.close();
  }

  // 2. Medicare compliance note says "on record", not "signed" only
  {
    const { ctx, page, errs } = await newPage(browser, CONFIGS[0]);
    await page.goto(BASE + '#demo-insurance');
    await page.waitForTimeout(2500);
    const row = page.locator('[data-qf-open]').first();
    await row.click().catch(() => {});
    await page.waitForTimeout(600);
    let txt = await page.evaluate(() => document.body.innerText);
    if (!/Scope of Appointment/.test(txt)) {   // first lead isn't Medicare: pick it
      const med = page.locator('[data-qf-v="Medicare"]').first();
      if (await med.count()) { await med.click(); await page.waitForTimeout(400); txt = await page.evaluate(() => document.body.innerText); }
    }
    check('Medicare note shown', /Scope of Appointment/.test(txt));
    check('Medicare note: on record (signed or recorded)', /Scope of Appointment on record \(signed, or recorded on the call\)/.test(txt));
    check('Medicare: no page errors', !errs.length, errs);
    await ctx.close();
  }

  // 3. Sign-in scripts fail to load on the live site (?fbretry=1 makes localhost act like it)
  {
    const { ctx, page, errs } = await newPage(browser, CONFIGS[0]);
    let hits = 0;
    await page.route(FB_RE, r => { hits++; r.abort(); });
    await page.goto(BASE.replace('index.html', 'index.html?fbretry=1'));
    await page.waitForTimeout(1500);
    let st = await page.evaluate(() => ({ auth: getComputedStyle(document.getElementById('authScreen')).display, txt: document.body.innerText }));
    check('fb down: auth screen, not the on-device dialer', st.auth !== 'none' && !/Load your leads to start dialing/.test(st.txt), st.auth);
    await page.waitForSelector('#fbRetryBtn', { timeout: 30000 }).catch(() => {});
    st = await page.evaluate(() => ({ msg: document.getElementById('authMsg').innerText, btn: !!document.getElementById('fbRetryBtn'), hero: getComputedStyle(document.getElementById('authHero')).display }));
    check('fb down: says it cannot reach VPEX', /Can.t reach VPEX/.test(st.msg), st);
    check('fb down: Try again button', st.btn);
    check('fb down: sales page still shows for a visitor', st.hero !== 'none', st);
    check('fb down: retried the scripts', hits >= 4 + 3, hits);   // 4 in the page, then the app retries (3 rounds; app first)
    await page.click('#suGo').catch(() => {});
    await page.waitForTimeout(300);
    st = await page.evaluate(() => ({ msg: document.getElementById('authMsg').innerText, btn: !!document.getElementById('fbRetryBtn') }));
    check('fb down: trial button says still connecting (no crash)', /Still connecting/.test(st.msg) && st.btn, st);
    check('fb down: no page errors', !errs.length, errs);
    await ctx.close();
  }
  {
    // first load fails, the app's retry gets through: the normal sales page, no error
    const { ctx, page, errs } = await newPage(browser, CONFIGS[1]);
    let n = 0;
    await page.route(FB_RE, r => {
      n++;
      if (n <= 4) return r.abort();
      const f = r.request().url().split('/').pop();
      r.fulfill({ status: 200, contentType: 'application/javascript', body: FB_STUB[f] || '' });
    });
    await page.goto(BASE.replace('index.html', 'index.html?fbretry=1'));
    await page.waitForTimeout(3000);
    const st = await page.evaluate(() => ({ loads: window.__fbStubLoads, auth: getComputedStyle(document.getElementById('authScreen')).display, hero: getComputedStyle(document.getElementById('authHero')).display, msg: getComputedStyle(document.getElementById('authMsg')).display, retry: !!document.getElementById('fbRetryBtn') }));
    check('fb retry ok: scripts loaded on retry', st.loads === 1, st);
    check('fb retry ok: sales page, no error message', st.auth !== 'none' && st.hero !== 'none' && st.msg === 'none' && !st.retry, st);
    check('fb retry ok: no page errors', !errs.length, errs);
    await ctx.close();
  }
  {
    // local test pages without ?fbretry keep the old on-device mode
    const { ctx, page, errs } = await newPage(browser, CONFIGS[0]);
    await page.route(FB_RE, r => r.abort());
    await page.goto(BASE);
    await page.waitForTimeout(1500);
    const txt = await page.evaluate(() => document.body.innerText);
    check('localhost without fbretry: on-device mode unchanged', /Load your leads to start dialing/.test(txt));
    check('localhost without fbretry: no page errors', !errs.length, errs);
    await ctx.close();
  }

  // 4. Mock backend: sales page and a full trial signup still work
  {
    const { ctx, page, errs } = await newPage(browser, CONFIGS[0]);
    await page.goto(BASE + '#mockbench');
    await page.waitForTimeout(1500);
    check('mockbench: sales page', await page.locator('#authHero').isVisible());
    const id = 'smoke' + Date.now().toString(36).slice(-5);
    await page.fill('#suOffice', 'Harbor Smoke ' + id);
    await page.selectOption('#suInd', 'solar');
    await page.fill('#suName', 'Sam Test');
    await page.fill('#suPhone', '(212) 555-0142');
    await page.fill('#suEmail', id + '@example.com');
    await page.fill('#suUser', 'sam');
    await page.fill('#suPw', 'longpassword1');
    await page.fill('#suPw2', 'longpassword1');
    await page.click('#suGo');
    await page.waitForTimeout(4000);
    const st = await page.evaluate(() => ({ auth: getComputedStyle(document.getElementById('authScreen')).display, msg: document.getElementById('authMsg').innerText }));
    check('mockbench: trial signup gets into the app', st.auth === 'none', st);
    check('mockbench: no page errors', !errs.length, errs);
    await ctx.close();
  }

  await browser.close();
  console.log(`smoke: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
