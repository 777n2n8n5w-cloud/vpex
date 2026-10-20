// VPEX regression check (owner_console). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/owner_console.js
// The VPEX offices screen (owner only) with fictional offices on the in-page mock backend: a small floor (3 offices, 16 reps)
// and a big one (148 offices, 3,568 reps). Numbers have thousands separators, revenue never breaks across lines, no overflow.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const DAY = 864e5, now = Date.now();
function seed(N, TOTAL) {
  const db = {};
  db['members/vOwn'] = { username: 'vincent', name: 'Vincent', role: 'admin', active: true, lastSeen: now };
  db['config/billing'] = { price: 49, foundingPrice: 29 };
  const IND = ['insurance', 'realestate', 'mca', 'auto', 'solar'];
  const base = Math.floor(TOTAL / N); let extra = TOTAL - base * N;
  for (let i = 0; i < N; i++) {
    const id = 'office' + String(i).padStart(3, '0'), reps = base + (extra-- > 0 ? 1 : 0), pre = 'offices/' + id + '/', declined = N > 10 && (i === 5 || i === 40);
    db['offices/' + id] = { name: 'Sample Office ' + String(i + 1).padStart(3, '0'), industry: IND[i % 5], plan: 'paid', paidThrough: declined ? now - 3 * DAY : now + (5 + i % 20) * DAY, ownerUid: 'm0', createdAt: now - 60 * DAY, stripeSub: 'sub_test', seatsPaid: reps, payFailed: declined || undefined };
    for (let k = 0; k < reps; k++) db[pre + 'members/m' + k] = k === 0 ? { username: 'owner' + i, name: 'Owner ' + i, role: 'admin', active: true, lastSeen: now - 6e5, phone: '(305) 555-01' + String(i % 90 + 10), email: 'owner' + i + '@example.com' } : { name: 'R', role: 'rep', active: true };
    const nl = i < 6 ? reps * 180 : 1, l1 = {}, l2 = {}; for (let k = 0; k < nl; k++) (k < nl / 2 ? l1 : l2)[k] = 1;
    db[pre + 'leadChunks/c001'] = { leads: l1 }; db[pre + 'leadChunks/c002'] = { leads: l2 };
    db[pre + 'callDays/n_' + new Date(now).toISOString().slice(0, 10)] = { c: reps * 210 };
  }
  return db;
}
async function openConsole(br, c, db) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(600);
  await page.evaluate(db => {
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'vincent@dovetail-f863c.firebaseapp.com': { uid: 'vOwn', pw: 'test' } }));
    localStorage.setItem('vpex_oc_seen', String(Date.now()));
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'vOwn', email: 'vincent@dovetail-f863c.firebaseapp.com' }));
  }, db);
  await page.goto(BASE); await page.waitForTimeout(2500);
  await page.evaluate(() => document.getElementById('menuBtn').click()); await page.waitForTimeout(400);
  await page.evaluate(() => { const c = document.querySelector('[data-set-cat="admin"]'); if (c) c.click(); }); await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('hubOffices').click());
  await page.waitForSelector('.oc-tot', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}
const read = page => page.evaluate(() => {
  const t = [...document.querySelectorAll('.oc-tot > div')].map(d => { const b = d.querySelector('b'); const lh = parseFloat(getComputedStyle(b).lineHeight) || parseFloat(getComputedStyle(b).fontSize) * 1.25; return { v: b.textContent, lines: Math.round(b.getBoundingClientRect().height / lh), w: d.getBoundingClientRect().width, sw: b.scrollWidth, cw: b.clientWidth }; });
  const metas = [...document.querySelectorAll('.oc-meta')].slice(0, 3).map(m => m.textContent);
  return { t, cards: document.querySelectorAll('.oc-card').length, metas, first: (document.querySelector('.oc-card .oc-name b') || {}).textContent, sw: document.documentElement.scrollWidth, vw: innerWidth };
});
(async () => {
  const br = await chromium.launch();
  const SIZES = [{ n: '390-light', w: 390, s: 'light' }, { n: '390-dark', w: 390, s: 'dark' }, { n: '320', w: 320, s: 'light' }, { n: '1280', w: 1280, s: 'dark' }];
  for (const [N, TOTAL, mrr] of [[3, 16, '$784'], [148, 3568, '$174,832']]) for (const c of SIZES) {
    const tag = N + ' offices/' + c.n;
    const { ctx, page, errs } = await openConsole(br, c, seed(N, TOTAL));
    const r = await read(page);
    check(tag + ' every office listed', r.cards === N, r.cards);
    check(tag + ' totals: revenue, paying, trial, reps', r.t.length === 4 && r.t[0].v === mrr && r.t[1].v === N.toLocaleString('en-US') && r.t[2].v === '0' && r.t[3].v === TOTAL.toLocaleString('en-US'), r.t.map(x => x.v));
    check(tag + ' revenue on one line, own row', r.t[0].lines === 1 && r.t[0].w > r.t[1].w * 2, r.t[0]);
    check(tag + ' tiles never clip', r.t.every(x => x.sw <= x.cw + 1), r.t);
    check(tag + ' "1 lead", not "1 leads"', r.metas.every(m => !/^1 leads/.test(m)), r.metas);
    check(tag + ' office numbers have separators', r.metas.every(m => !/\b\d{4,}\b/.test(m.replace(/\$[\d,]+/g, ''))), r.metas);
    if (N > 10) check(tag + ' declined cards come first', /Card declined/.test(await page.evaluate(() => document.querySelector('.oc-card').textContent)));
    check(tag + ' no overflow', r.sw <= r.vw, r);
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close(); console.log(`owner_console: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
