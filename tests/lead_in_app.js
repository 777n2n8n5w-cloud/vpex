// VPEX regression check (lead_in_app): Admin controls › Live leads. Turning it on makes a key that's shown once (only its
// SHA-256 is saved, matching what the server checks), a lead the server writes shows up next on the list with a toast,
// a new key replaces the old, Turn off removes it; in a demo, Send a test lead shows what happens.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/lead_in_app.js
const { chromium } = require('playwright');
const L = require('../functions/lib.js');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-11-09T11:30:00-05:00';
async function bench(br, c) {   // the original team on the in-page backend, signed in as the admin, with sample leads
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
  await page.evaluate(() => {
    const db = demoSeed();
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'demo@dovetail-f863c.firebaseapp.com': { uid: 'dAdm', pw: 'demo' } }));
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dAdm', email: 'demo@dovetail-f863c.firebaseapp.com' }));
  });
  await page.goto(BASE); await page.waitForTimeout(3000);
  await page.evaluate(() => document.getElementById('toast').classList.remove('show'));
  return { ctx, page, errs };
}
const watchToasts = page => page.evaluate(() => { window.__toasts = []; const t = document.getElementById('toast'); new MutationObserver(() => { if (t.innerText) window.__toasts.push(t.innerText); }).observe(t, { childList: true, subtree: true, characterData: true }); });
const openLI = async (page) => { await page.evaluate(() => document.getElementById('adminBtn').click()); await page.waitForTimeout(400);
  const row = await page.evaluate(() => { const r = document.getElementById('hubLeadIn'); return r ? r.innerText.replace(/\s+/g, ' ') : null; });
  await page.evaluate(() => document.getElementById('hubLeadIn').click()); await page.waitForTimeout(400); return row; };
const sheet = page => page.evaluate(() => { const b = document.getElementById('featModalBody'); const m = document.getElementById('featModal');
  return { open: m.classList.contains('show'), text: b.innerText, key: (document.getElementById('liKey') || {}).textContent || '', sw: m.querySelector('.modal').scrollWidth, cw: m.querySelector('.modal').clientWidth,
    btns: [...b.querySelectorAll('button, summary')].filter(x => x.offsetParent).map(x => [x.innerText.trim().slice(0, 20), Math.round(x.getBoundingClientRect().height)]) }; });
const team = page => page.evaluate(() => JSON.parse(localStorage.getItem('__mockfs'))['leadChunks/_team'] || {});
const confirmYes = page => page.evaluate(() => { const b = [...document.querySelectorAll('.modal-overlay.show button')].find(x => /Make a new key|Turn off/.test(x.innerText) && x.classList.contains('btn-primary') || /^(Make a new key|Turn off)$/.test(x.innerText.trim()) && x.closest('#confirmModal, #infoModal')); if (b) b.click(); return !!b; });
(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: '390-dark', w: 390, h: 844, s: 'dark' }, { n: '1280-light', w: 1280, h: 860, s: 'light' }]) {
    const { ctx, page, errs } = await bench(br, c);
    const row = await openLI(page);
    check(c.n + ': Admin controls lists Live leads', row && /Live leads/.test(row) && /Website forms/.test(row), row);
    let s = await sheet(page);
    check(c.n + ': off: explains it and offers Turn on', s.open && /land at the top of your list/.test(s.text) && /Turn on live leads/.test(s.text), s.text.slice(0, 200));
    await page.click('#liMake'); await page.waitForTimeout(600);
    s = await sheet(page);
    check(c.n + ': key shown once, original team format', /^vk__[0-9a-f]{64}$/.test(s.key), s.key);
    const secret = s.key.slice(4), t = await team(page);
    check(c.n + ': only the SHA-256 saved, the same the server checks', t.leadIn && t.leadIn.h === L.sha256hex(secret) && t.leadIn.end === secret.slice(-4) && L.leadInKey(s.key) && L.sameHash(t.leadIn.h, L.sha256hex(L.leadInKey(s.key).secret)), t.leadIn);
    check(c.n + ': the key itself is stored nowhere on the phone', await page.evaluate(k => !Object.keys(localStorage).some(x => (localStorage.getItem(x) || '').includes(k.slice(4))) && !Object.keys(sessionStorage).some(x => (sessionStorage.getItem(x) || '').includes(k.slice(4))), s.key));
    check(c.n + ': address, header, how-tos and form snippet', /cloudfunctions\.net\/leadIn/.test(s.text) && /X-VPEX-Key/.test(s.text) && /Zapier or Make/.test(s.text) && /Facebook or Google lead ads/.test(s.text) && /A Google Sheet/.test(s.text) && /Your website form/.test(s.text));
    await page.evaluate(() => document.querySelectorAll('#featModalBody details').forEach(d => d.open = true)); await page.waitForTimeout(100);
    s = await sheet(page);
    check(c.n + ': form snippet carries the key', s.text.includes('?key=' + await page.evaluate(() => document.getElementById('liKey').textContent)));
    check(c.n + ': no sideways scroll in the sheet; buttons 44 px', s.sw <= s.cw + 1 && s.btns.every(b => b[1] >= 40), { sw: s.sw, cw: s.cw, btns: s.btns });
    // close and reopen: the key isn't shown again
    await page.evaluate(() => { document.getElementById('featClose').click(); }); await page.waitForTimeout(200);
    await page.evaluate(() => { window.__vpexLiForget = 1; }); 
    await page.reload(); await page.waitForTimeout(3000); await page.evaluate(() => document.getElementById('toast').classList.remove('show'));
    const row2 = await openLI(page);
    s = await sheet(page);
    check(c.n + ': after a reload: On, key ending, no key shown', /On/.test(row2) && /Key ending …/.test(s.text) && s.text.includes('…' + secret.slice(-4)) && !s.key && /no leads yet/.test(s.text), s.text.slice(0, 300));
    await page.evaluate(() => document.getElementById('featClose').click()); await page.waitForTimeout(200);
    // the server writes a lead (as functions/ leadIn does): it shows up next, with a toast
    await watchToasts(page);
    const now = Date.parse(NOW), cl = L.leadInClean({ first_name: 'Pat', last_name: 'Webb', phone: '(646) 555-0142', state: 'NY', message: 'Quote please' }, now, 'test01');
    const ck = L.leadInChunk(L.nyDate(now).replace(/-/g, ''), {});
    await page.evaluate(([ck, id, lead]) => firebase.app().firestore().collection('leadChunks').doc(ck).set({ leads: { [id]: lead } }, { merge: true }), [ck, cl.id, cl.lead]);
    await page.evaluate(([ck, now]) => firebase.app().firestore().collection('leadChunks').doc('_team').set({ leadIn: { last: now, n: 1 } }, { merge: true }), [ck, now]);
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => ({ toast: (window.__toasts || []).join(' | ').replace(/\n/g, ' · '), card: (document.querySelector('#mainArea .lead-name') || {}).innerText || '' }));
    check(c.n + ': toast "New lead: Pat Webb · Web leads"', /New lead: Pat Webb · Web leads/.test(after.toast), after.toast);
    check(c.n + ': the new lead is next on the Dial card', /Pat Webb/.test(after.card), after.card);
    const row3 = await openLI(page); s = await sheet(page);
    check(c.n + ': count and last lead shown', /1 lead so far/.test(row3) && /1 lead so far, last/.test(s.text), [row3, s.text.slice(0, 260)]);
    // a new key replaces the old
    await page.click('#liNew'); await page.waitForTimeout(300); await confirmYes(page); await page.waitForTimeout(700);
    s = await sheet(page); const t2 = await team(page);
    check(c.n + ': Make a new key: a different key, its hash saved, count reset', /^vk__[0-9a-f]{64}$/.test(s.key) && s.key.slice(4) !== secret && t2.leadIn.h === L.sha256hex(s.key.slice(4)) && !t2.leadIn.n, { key: s.key.slice(0, 10), t2: t2.leadIn });
    await page.click('#liOff'); await page.waitForTimeout(300); await confirmYes(page); await page.waitForTimeout(600);
    check(c.n + ': Turn off removes it', (await team(page)).leadIn == null && !(await page.evaluate(() => document.getElementById('featModal').classList.contains('show'))));
    check(c.n + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  // a demo: Send a test lead shows what happens
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date(NOW) }); await page.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#demo-solar'); await page.waitForTimeout(2600); await page.evaluate(() => document.getElementById('toast').classList.remove('show'));
    await openLI(page); await page.click('#liMake'); await page.waitForTimeout(600); await watchToasts(page);
    await page.click('#liTest'); await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ toast: (window.__toasts || []).join(' | ').replace(/\n/g, ' · '), card: (document.querySelector('#mainArea .lead-name') || {}).innerText || '' }));
    check('demo: test lead added at the top with a toast', /New lead: Test Lead/.test(r.toast), r);
    await page.evaluate(() => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')));
    check('demo: Test Lead is next on the Dial card', /Test Lead/.test(await page.evaluate(() => (document.querySelector('#mainArea .lead-name') || {}).innerText || '')));
    await openLI(page); await watchToasts(page); await page.click('#liTest'); await page.waitForTimeout(400);
    check('demo: a second test says it\'s already there', /already on your list/.test(await page.evaluate(() => (window.__toasts || []).join(' | ').replace(/\n/g, ' · '))));
    check('demo: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('lead_in_app:', pass, 'passed,', fail, 'failed'); process.exit(fail ? 1 : 0);
})();
