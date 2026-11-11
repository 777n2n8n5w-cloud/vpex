// VPEX regression check (book_link): "Let them pick a time". A rep texts a lead a booking link; the lead picks a time
// on vpexdialer.com/book/ inside their calling hours and the rep's hours; it comes back as a follow-up they picked.
//  - functions/lib.js: the key, the times offered, the booked follow-up, the push.
//  - functions/ book with stand-ins for Firebase: wrong / expired / turned-off links say nothing, a taken time is refused,
//    picking again moves the same call.
//  - The app on the in-page backend: the sheet, what the lead's record keeps (only the SHA-256), the booking arriving.
//  - The lead's page: days, times, booking, the calendar file, picking a different time, an expired link.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/book_link.js
const L = require('../functions/lib.js'), crypto = require('crypto');
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const NOW = Date.UTC(2026, 10, 10, 20, 0);            // Tue Nov 10, 3:00 PM in New York, 12:00 PM in Los Angeles
const SECRET = crypto.randomBytes(32).toString('hex'), H = 3600000, M = 60000;

// ---- 1. the key ----
check('key: office, lead and secret', (k => k && k.office === 'acme' && k.leadId === 'lmh2x9abc' && k.secret === SECRET)(L.bookKey('vb_acme_lmh2x9abc_' + SECRET)));
check('key: the original team', (k => k && k.office === '' && k.leadId === 'l1')(L.bookKey('vb__l1_' + SECRET)));
check('key: junk refused', !L.bookKey('') && !L.bookKey('vc_acme_l1_' + SECRET) && !L.bookKey('vb_acme_l/1_' + SECRET) && !L.bookKey('vb_acme_l1_' + SECRET.slice(1)) && !L.bookKey('vb_ACME_l1_' + SECRET));

// ---- 2. the times offered ----
const win = {}; for (let i = 0; i < 10; i++) { const p = L.zParts(NOW + i * 86400000, 'America/Los_Angeles'); win[p.ymd] = p.wd === 0 ? null : p.wd === 6 ? [540, 1020] : [480, 1260]; }
win['2026-11-11'] = null;                              // a holiday where the lead is
const book = { h: L.sha256hex(SECRET), tag: 'abc123def456', at: NOW - H, exp: NOW + 14 * 86400000, by: { uid: 'rep222xyz', name: 'Sam Rivera' },
  lz: 'America/Los_Angeles', rtz: 'America/New_York', hrs: [540, 1080], days: [1, 2, 3, 4, 5], win, co: 'Acme Funding' };
const slots = L.bookSlots(book, NOW, []);
check('slots: some on offer', slots.length > 20, slots.length);
check('slots: first is 2 hours out on a half hour (5:00 PM in New York)', slots[0] === Date.UTC(2026, 10, 10, 22, 0), new Date(slots[0]).toISOString());
check('slots: every one inside the lead\'s calling window that day', slots.every(t => { const p = L.zParts(t, 'America/Los_Angeles'), w = win[p.ymd]; return w && p.min >= w[0] && p.min + 30 <= w[1]; }));
check('slots: every one inside the rep\'s hours and days', slots.every(t => { const p = L.zParts(t, 'America/New_York'); return [1, 2, 3, 4, 5].includes(p.wd) && p.min >= 540 && p.min + 30 <= 1080; }));
check('slots: none on the lead\'s holiday or the weekend', !slots.some(t => ['2026-11-11', '2026-11-14', '2026-11-15'].includes(L.zParts(t, 'America/Los_Angeles').ymd)));
check('slots: a week at most', slots.every(t => t <= NOW + 7 * 86400000) && slots.every(t => t % (30 * M) === 0));
const busy = L.bookBusy([{ leads: { x: { tasks: [{ id: 'a', dueAt: slots[3], note: 'Appointment with Pat', assignee: { uid: 'rep222xyz' } }, { id: 'b', dueAt: slots[5], assignee: { uid: 'rep222xyz' } },
  { id: 'c', dueAt: slots[6], booked: 1, assignee: { uid: 'otherrep1' } }, { id: 'd', dueAt: slots[7], booked: 1, done: true, assignee: { uid: 'rep222xyz' } }] } } }], 'rep222xyz', NOW, 'zz');
check('busy: the rep\'s own open appointments and booked calls only', busy.length === 1 && busy[0] === slots[3], busy);
const s2 = L.bookSlots(book, NOW, busy);
check('slots: a time the rep already has booked is left out, the ones beside it stay', !s2.includes(slots[3]) && s2.includes(slots[2]) && s2.includes(slots[4]) && s2.length === slots.length - 1);
check('live: expired, turned off or junk links are not', L.bookLive(book, NOW) && !L.bookLive(Object.assign({}, book, { exp: NOW - 1 }), NOW) && !L.bookLive(Object.assign({}, book, { off: true }), NOW) && !L.bookLive({ h: 'x' }, NOW) && !L.bookLive(null, NOW));
check('slots: a bad time zone offers nothing', L.bookSlots(Object.assign({}, book, { lz: 'Mars/Base' }), NOW, []).length === 0);

// ---- 3. the booked follow-up ----
const lead0 = { name: 'Pat Lee', phoneRaw: '2125550199', tasks: [{ id: 't1', dueAt: NOW + 50 * H, assignee: { uid: 'rep222xyz' } }], book };
const a1 = L.bookApply(lead0, 'l1', slots[0], NOW), bt = a1.tasks.find(t => t.booked);
check('apply: a follow-up they picked, for the rep, at that time', bt && bt.dueAt === slots[0] && bt.pinned === true && bt.auto === false && bt.assignee.uid === 'rep222xyz' && bt.what === 'Booked call' && /^They picked this time/.test(bt.note) && bt.leadId === 'l1' && bt.due === '2026-11-10', bt);
check('apply: other follow-ups kept, link marked picked', a1.tasks.length === 2 && a1.book.picked === slots[0] && a1.book.h === book.h);
const a2 = L.bookApply(a1, 'l1', slots[4], NOW + M);
check('apply: picking again moves the same call', a2.tasks.filter(t => t.booked && !t.done).length === 1 && a2.tasks.find(t => t.booked).dueAt === slots[4]);
const a3 = L.bookApply(Object.assign({}, a2, { book: Object.assign({}, a2.book, { h: 'f'.repeat(64) }) }), 'l1', slots[5], NOW + 2 * M);
check('apply: a new link for the same lead still moves it (same tag)', a3.tasks.filter(t => t.booked && !t.done).length === 1);
const msg = L.bookMessage('acme', 'l1', lead0, slots[0], 'America/New_York', false);
check('push: who and when, in the rep\'s time, links to the lead', msg.title === 'Pat booked a call' && /^Tue, Nov 10, 5:00\sPM your time/.test(msg.body) && msg.link === 'https://vpexdialer.com/?o=acme&open=l1' && msg.kind === 'book', msg);
check('push: moved says so', /moved their call/.test(L.bookMessage('acme', 'l1', lead0, slots[0], 'America/New_York', true).title));

(async () => {
  // ---- 4. the server function with stand-ins ----
  const Module = require('module'), store = {}, sent = [];
  const snap = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, ref: docRef(p), get: f => d ? d[f] : undefined, data: () => d }; };
  function docRef(p) { return { path: p, get: async () => snap(p), set: async (v) => { store[p] = v; } }; }
  const col = (p) => ({ get: async () => { const docs = Object.keys(store).filter(k => k.startsWith(p + '/') && k.slice(p.length + 1).indexOf('/') < 0).map(snap); return { docs, empty: !docs.length, size: docs.length }; },
    where: (f, op, v) => { const c = col(p), g = c.get; c.get = async () => { const r = await g(); r.docs = r.docs.filter(d => d.get(f) === v); r.empty = !r.docs.length; r.size = r.docs.length; return r; }; c.limit = () => c; return c; }, limit: () => col(p) });
  class FieldPath { constructor(...a) { this.a = a; } }
  const tx = { get: (r) => r.get(), update: (r, fp, v) => { let o = store[r.path]; for (let i = 0; i < fp.a.length - 1; i++) o = o[fp.a[i]]; o[fp.a[fp.a.length - 1]] = JSON.parse(JSON.stringify(v)); } };
  const fakeDb = { doc: docRef, collection: col, runTransaction: async (fn) => fn(tx) };
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => fakeDb, { FieldValue: {}, FieldPath }), messaging: () => ({ sendEach: async (b) => { sent.push(...b); return { responses: b.map(() => ({ success: true })) }; } }) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: () => () => {} }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => Object.assign(fn, { opts: o }) }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load; Module._load = function (r) { if (stubs[r]) return stubs[r]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  const realNow = Date.now; let clock = NOW; Date.now = () => clock;
  const call = async (method, q, body) => { let code = 0, out = null; const res = { status(c) { code = c; return this; }, set() { return this; }, json(b) { out = b; return this; }, end() { return this; }, send(b) { out = b; return this; } };
    await F.book({ method, query: q || {}, rawBody: body === undefined ? undefined : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) }, res); return { code, body: out }; };
  check('server: only vpexdialer.com may call it from a browser', JSON.stringify(F.book.opts.cors) === JSON.stringify(['https://vpexdialer.com', 'https://www.vpexdialer.com']));
  const K = 'vb_acme_l1_' + SECRET;
  const fresh = () => {
    Object.keys(store).forEach(k => delete store[k]);
    store['offices/acme'] = { name: 'Acme Funding', plan: 'paid', paidThrough: NOW + 30 * 86400000 };
    store['offices/acme/members/rep222xyz'] = { active: true, role: 'rep', name: 'Sam Rivera' };
    store['offices/acme/leadChunks/c001'] = { leads: { l1: JSON.parse(JSON.stringify(lead0)), l2: { name: 'Other', tasks: [{ id: 'z', dueAt: slots[1], note: 'Appointment: demo', assignee: { uid: 'rep222xyz' } }] } } };
    store['offices/acme/leadChunks/_team'] = { leads: { l1: { book: { h: 'nope' } } } };
    store['pushTokens/tok1'] = { uid: 'rep222xyz', token: 'tok-abc', tz: 'America/Chicago' };
    sent.length = 0;
  };
  fresh();
  let r = await call('GET', { k: K });
  check('server: the right link gets the times (first name, rep\'s first name, office)', r.code === 200 && r.body.first === 'Pat' && r.body.rep === 'Sam' && r.body.co === 'Acme Funding' && r.body.slots.length > 20 && r.body.picked === null, [r.code, r.body && Object.keys(r.body)]);
  check('server: the rep\'s appointment elsewhere is left out', !r.body.slots.includes(slots[1]) && r.body.slots.includes(slots[0]));
  check('server: nothing else about the lead or rep goes out', JSON.stringify(r.body).indexOf('5550199') < 0 && JSON.stringify(r.body).indexOf('Rivera') < 0 && JSON.stringify(r.body).indexOf('Lee') < 0 && JSON.stringify(r.body).indexOf('rep222xyz') < 0);
  check('server: a wrong secret, another lead, junk: 404', (await call('GET', { k: 'vb_acme_l1_' + 'f'.repeat(64) })).code === 404 && (await call('GET', { k: 'vb_acme_l2_' + SECRET })).code === 404 && (await call('GET', { k: 'x' })).code === 404 && (await call('GET', {})).code === 404);
  check('server: other methods refused, big bodies refused', (await call('PUT', { k: K })).code === 405 && (await call('POST', {}, 'x'.repeat(600))).code === 400 && (await call('POST', {}, '{nope')).code === 400);
  r = await call('POST', {}, { k: K, at: slots[0] + 60000 });
  check('server: a time that isn\'t on offer is refused, with fresh times', r.code === 409 && r.body.view && r.body.view.slots.length > 20);
  r = await call('POST', {}, { k: K, at: slots[0] });
  const l1 = store['offices/acme/leadChunks/c001'].leads.l1, bk = l1.tasks.filter(t => t.booked);
  check('server: booking answers ok with the picked time', r.code === 200 && r.body.ok === true && r.body.picked === slots[0], r);
  check('server: the follow-up is in the lead\'s record, for the rep, and the link is marked', bk.length === 1 && bk[0].dueAt === slots[0] && bk[0].assignee.uid === 'rep222xyz' && l1.book.picked === slots[0] && l1.tasks.length === 2);
  check('server: the other lead in the record is untouched', store['offices/acme/leadChunks/c001'].leads.l2.tasks.length === 1 && store['offices/acme/leadChunks/c001'].leads.l2.name === 'Other');
  check('server: the rep\'s phone hears it, in the phone\'s time zone', sent.length === 1 && sent[0].token === 'tok-abc' && /Pat booked a call/.test(sent[0].webpush.notification.title) && /^Tue, Nov 10, 4:00\sPM your time/.test(sent[0].webpush.notification.body), sent[0] && sent[0].webpush.notification);
  r = await call('GET', { k: K });
  check('server: opening the link again shows the booked time', r.code === 200 && r.body.picked === slots[0]);
  clock = NOW + 5 * M; r = await call('POST', {}, { k: K, at: slots[6] });
  check('server: picking again moves the call (one booked call), push says moved', r.code === 200 && store['offices/acme/leadChunks/c001'].leads.l1.tasks.filter(t => t.booked && !t.done).length === 1 &&
    store['offices/acme/leadChunks/c001'].leads.l1.tasks.find(t => t.booked).dueAt === slots[6] && /moved their call/.test(sent[1].webpush.notification.title));
  clock = NOW;
  for (const [n, f] of [['an expired link', () => { store['offices/acme/leadChunks/c001'].leads.l1.book.exp = NOW - 1; }], ['a turned-off link', () => { store['offices/acme/leadChunks/c001'].leads.l1.book.off = true; }],
    ['a Do Not Call lead', () => { store['offices/acme/leadChunks/c001'].leads.l1.dnc = { at: 1 }; }], ['a turned-off rep', () => { store['offices/acme/members/rep222xyz'].active = false; }],
    ['a paused office', () => { store['offices/acme'].locked = true; }]]) {
    fresh(); f();
    const g = await call('GET', { k: K }), p = await call('POST', {}, { k: K, at: slots[0] });
    check('server: ' + n + ' gets nothing (404), books nothing', g.code === 404 && p.code === 404 && !(store['offices/acme/leadChunks/c001'].leads.l1.tasks || []).some(t => t.booked) && !sent.length, [g.code, p.code]);
  }
  Date.now = realNow;

  // ---- 5. the app: the sheet, the record, the booking coming back ----
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('FAIL playwright missing'); process.exit(1); }
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: NOW });
  await page.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
  await page.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="sms:"]'); if (a) { window.__smsHref = a.getAttribute('href'); e.preventDefault(); } }, true));
  await page.goto(BASE + 'index.html#mockbench'); await page.waitForTimeout(500);
  await page.evaluate(() => { const db = demoSeed(); localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' } }));
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR2', email: 'sam@dovetail-f863c.firebaseapp.com' })); });
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(3000);
  const target = await page.evaluate(() => { const ls = window.__mockLeads(); for (const l of ls) { const f = window.__mockLeadFull(l.id)[0]; if (f && (f.phone || f.phoneRaw) && !f.dnc && /^(CA|TX|NY|FL|IL|AZ|WA|OH|GA)$/.test(f.st || '')) return { id: f.id, name: f.name, st: f.st }; } return null; });
  check('app: a lead to try it on', !!target, target);
  await page.goto(BASE + 'index.html?open=' + target.id); await page.waitForTimeout(3000);
  const row = await page.evaluate(() => { const b = document.querySelector('#leadModalBody .lp-book'); return b ? b.innerText.replace(/\s+/g, ' ') : null; });
  check('app: the profile offers "Let them pick a time"', /^Let \S+ pick a time Text \S+ times to choose from/.test(row || ''), row);
  await page.evaluate(() => document.querySelector('#leadModalBody .lp-book').click()); await page.waitForTimeout(400);
  const sh = await page.evaluate(() => ({ t: document.getElementById('featModalBody').innerText.replace(/\s+/g, ' '), s: document.getElementById('bkS').value, e: document.getElementById('bkE').value,
    days: [...document.querySelectorAll('.bk-day.on')].map(b => b.innerText).join(','), href: (document.getElementById('bkSend') || {}).href || '', prof: document.getElementById('leadModal').classList.contains('show') }));
  check('app: the sheet opens over a closed profile, with your hours (9 AM–6 PM, weekdays)', !sh.prof && /Let \S+ pick a time/.test(sh.t) && sh.s === '540' && sh.e === '1080' && sh.days === 'Mon,Tue,Wed,Thu,Fri', sh);
  check('app: says how many times they\'ll see', /will see \d+ times over the next 7 days/.test(sh.t), sh.t);
  check('app: the text has the link at the end', /^sms:/.test(sh.href) && /vpexdialer\.com%2Fbook%2F%23vb__/.test(sh.href), sh.href.slice(0, 220));
  await page.evaluate(() => { const b = [...document.querySelectorAll('.bk-day')].find(x => x.innerText === 'Sat'); b.click(); }); await page.waitForTimeout(200);
  await page.selectOption('#bkE', '1200'); await page.waitForTimeout(200);
  const sh2 = await page.evaluate(() => ({ days: [...document.querySelectorAll('.bk-day.on')].map(b => b.innerText).join(','), e: document.getElementById('bkE').value, n: (document.getElementById('bkPrev').innerText.match(/(\d+) times/) || [])[1] }));
  check('app: adding Saturday and a later end time widens the offer', sh2.days.includes('Sat') && sh2.e === '1200' && Number(sh2.n) > 0, sh2);
  await page.fill('#bkMsg', 'Hey, pick a time:'); await page.waitForTimeout(100);
  await page.evaluate(() => document.getElementById('bkSend').click()); await page.waitForTimeout(800);
  const href = await page.evaluate(() => window.__smsHref || '');
  const body = decodeURIComponent(href.split(/[&?]body=/)[1] || ''), link = (body.match(/https:\/\/vpexdialer\.com\/book\/#(\S+)/) || [])[1] || '';
  const key = L.bookKey(link);
  check('app: the text goes out with your words and the link', /^Hey, pick a time: https:\/\/vpexdialer\.com\/book\/#vb__/.test(body) && key && key.leadId === target.id, body);
  await page.waitForTimeout(1500);
  let fs = await page.evaluate(() => JSON.parse(localStorage.getItem('__mockfs')));
  const ckOf = (db, id) => Object.keys(db).find(k => /^leadChunks\/[^_]/.test(k) && db[k].leads && db[k].leads[id]);
  const ck = ckOf(fs, target.id), saved = ck ? fs[ck].leads[target.id].book : null;
  check('app: the lead\'s record keeps the SHA-256, never the secret', saved && saved.h === L.sha256hex(key.secret) && !JSON.stringify(fs[ck].leads[target.id].book).includes(key.secret), saved && Object.keys(saved));
  check('app: and your hours, days, time zones and their calling window', saved && saved.hrs[0] === 540 && saved.hrs[1] === 1200 && saved.days.includes(6) && saved.rtz === 'America/New_York' && /^America\//.test(saved.lz) &&
    Object.keys(saved.win).length >= 21 && saved.by.uid === 'dR2' && saved.exp === saved.at + 14 * 86400000, saved);
  // the server books it (functions/ book on this record), then the change reaches the app
  Object.keys(store).forEach(k => delete store[k]);
  Object.keys(fs).forEach(k => { store[k] = fs[k]; }); store['pushTokens/t'] = { uid: 'dR2', token: 'tok-sam', tz: 'America/New_York' }; sent.length = 0;
  Date.now = () => NOW + 2 * M;
  const g = await call('GET', { k: link });
  check('server on the app\'s record: times on offer, Saturday included', g.code === 200 && g.body.slots.length > 0 && g.body.slots.some(t => L.zParts(t, 'America/New_York').wd === 6), [g.code, g.body && g.body.slots && g.body.slots.length]);
  const pickAt = g.body.slots[2];
  const p = await call('POST', {}, { k: link, at: pickAt });
  Date.now = realNow;
  check('server on the app\'s record: booked', p.code === 200 && sent.length === 1, p.code);
  await page.evaluate(([k, d]) => { const db = JSON.parse(localStorage.getItem('__mockfs')); db[k] = d; localStorage.setItem('__mockfs', JSON.stringify(db)); window.dispatchEvent(new StorageEvent('storage', { key: '__mockfs' })); }, [ck, store[ck]]);
  await page.waitForTimeout(1200);
  const toast = await page.evaluate(() => document.getElementById('toast').innerText);
  check('app: the booking shows up with a toast', new RegExp('^' + target.name.split(' ')[0] + ' booked a call for ').test(toast), toast);
  await page.goto(BASE + 'index.html?open=' + target.id); await page.waitForTimeout(3000);
  const pr = await page.evaluate(() => ({ next: (document.querySelector('#leadModalBody .lp-next') || {}).innerText || '', book: (document.querySelector('#leadModalBody .lp-book') || {}).innerText || '' }));
  check('app: the profile\'s next step is the booked call', /Booked call/.test(pr.next), pr.next);
  check('app: the booking row says booked from your link', /Booked for .* from your link/.test(pr.book.replace(/\s+/g, ' ')), pr.book);
  check('app: no page errors', !errs.length, errs);
  await ctx.close();

  // ---- 6. the lead's page ----
  fresh(); const store0 = JSON.parse(JSON.stringify(store));
  for (const c of [{ n: '375-light', w: 375, h: 740, s: 'light' }, { n: '390-dark', w: 390, h: 844, s: 'dark' }]) {
    Object.keys(store).forEach(k => delete store[k]); Object.assign(store, JSON.parse(JSON.stringify(store0))); sent.length = 0;
    const bctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: true, hasTouch: true, timezoneId: 'America/Los_Angeles' });
    const bp = await bctx.newPage(); const berrs = []; bp.on('pageerror', e => berrs.push(e.message)); bp.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) berrs.push(m.text()); });
    await bp.clock.install({ time: NOW });
    let hits = 0;
    await bp.route(/cloudfunctions\.net\/book/, async (route) => {
      hits++; const req = route.request(), u = new URL(req.url());
      Date.now = () => NOW; const r = req.method() === 'POST' ? await call('POST', {}, req.postData() || '') : await call('GET', { k: u.searchParams.get('k') }); Date.now = realNow;
      await route.fulfill({ status: r.code, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(r.body) });
    });
    await bp.goto(BASE + 'book/#' + K); await bp.waitForTimeout(800);
    const v = await bp.evaluate(() => ({ h1: document.getElementById('h1').innerText, sub: document.getElementById('sub').innerText, co: document.getElementById('co').innerText,
      days: document.querySelectorAll('.day').length, slots: [...document.querySelectorAll('.slot')].map(b => b.innerText), go: document.getElementById('go').disabled, wide: document.documentElement.scrollWidth <= innerWidth }));
    check(c.n + ' page: says who will call, for which office, in their time zone', v.h1 === 'Pick a time for Sam to call you' && v.co === 'Acme Funding' && /^Hi Pat\. .*\(PST\)\.$/.test(v.sub), v);
    check(c.n + ' page: days to choose from, times in the lead\'s own time', v.days >= 3 && v.slots[0] === '2:00 PM' && v.go === true && v.wide, v);
    const big = await bp.evaluate(() => [...document.querySelectorAll('.slot, .day, .go')].every(b => b.getBoundingClientRect().height >= 44));
    check(c.n + ' page: every button at least 44 px tall', big);
    await bp.evaluate(() => document.querySelectorAll('.day')[1].click()); await bp.waitForTimeout(150);
    const d2 = await bp.evaluate(() => ({ name: document.getElementById('dayname').innerText, first: document.querySelector('.slot').innerText }));
    check(c.n + ' page: another day shows its own times', /^Thursday, November 12$/.test(d2.name) && d2.first === '8:00 AM', d2);
    await bp.evaluate(() => document.querySelectorAll('.slot')[2].click()); await bp.waitForTimeout(150);
    const pick = await bp.evaluate(() => ({ p: document.getElementById('pick').innerText, go: document.getElementById('go').disabled, sel: document.querySelector('.slot[aria-pressed="true"]').innerText }));
    check(c.n + ' page: picking a time reads it back and turns Book on', pick.p === 'Thursday, November 12 at 9:00 AM' && !pick.go && pick.sel === '9:00 AM', pick);
    await bp.evaluate(() => document.getElementById('go').click()); await bp.waitForTimeout(600);
    const done = await bp.evaluate(() => ({ h1: document.getElementById('h1').innerText, when: (document.querySelector('.when b') || {}).innerText, cal: (document.getElementById('cal') || {}).href || '', bar: document.getElementById('bar').hidden }));
    check(c.n + ' page: booked, with the time and an Add to calendar file', done.h1 === 'You’re booked' && done.when === 'Thursday, November 12 at 9:00 AM' && /^data:text\/calendar/.test(done.cal) && decodeURIComponent(done.cal).includes('DTSTART:20261112T170000Z') && done.bar, done);
    const bk2 = store['offices/acme/leadChunks/c001'].leads.l1.tasks.filter(t => t.booked);
    check(c.n + ' page: the rep\'s follow-up is booked for that time', bk2.length === 1 && bk2[0].dueAt === Date.UTC(2026, 10, 12, 17, 0) && sent.length === 1);
    await bp.evaluate(() => document.getElementById('change').click()); await bp.waitForTimeout(150);
    await bp.evaluate(() => document.querySelectorAll('.slot')[4].click()); await bp.waitForTimeout(100);
    const mv = await bp.evaluate(() => document.getElementById('go').innerText);
    check(c.n + ' page: "Pick a different time" offers to move the call', mv === 'Move my call to this time', mv);
    await bp.evaluate(() => document.getElementById('go').click()); await bp.waitForTimeout(600);
    check(c.n + ' page: moved, still one booked call', store['offices/acme/leadChunks/c001'].leads.l1.tasks.filter(t => t.booked && !t.done).length === 1 && await bp.evaluate(() => document.getElementById('h1').innerText === 'You’re booked'));
    store['offices/acme/leadChunks/c001'].leads.l1.book.off = true;
    await bp.reload(); await bp.waitForTimeout(700);
    const gn = await bp.evaluate(() => ({ h1: document.getElementById('h1').innerText, sub: document.getElementById('sub').innerText }));
    check(c.n + ' page: a turned-off link says it has expired and what to do', gn.h1 === 'This link has expired' && /Reply to the text/.test(gn.sub), gn);
    await bp.goto(BASE + 'book/'); await bp.waitForTimeout(300);
    check(c.n + ' page: no key, no request, a plain message', /incomplete/.test(await bp.evaluate(() => document.getElementById('sub').innerText)));
    const meta = await bp.evaluate(() => ({ robots: document.querySelector('meta[name=robots]').content, csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content, text: document.body.innerText }));
    check(c.n + ' page: not indexed, locked down, no Dovetail on the page', meta.robots === 'noindex, nofollow' && /connect-src https:\/\/us-central1-dovetail-f863c\.cloudfunctions\.net;/.test(meta.csp) && !/dovetail/i.test(meta.text));
    check(c.n + ' page: no errors', !berrs.length, berrs);
    await bctx.close();
  }
  {
    const html = require('fs').readFileSync(__dirname + '/../book/index.html', 'utf8');
    check('link preview: a title that says what it is', /<title>Pick a time for your call<\/title>/.test(html) && /<meta property="og:title" content="Pick a time for your call">/.test(html));
    check('link preview: an icon for Messages (apple-touch-icon, 180 px PNG)', /<link rel="apple-touch-icon" href="\/book\/book-icon-180\.png">/.test(html));
    const png = require('fs').readFileSync(__dirname + '/../book/book-icon-180.png');
    check('link preview: the icon file is a 180 x 180 PNG', png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 180 && png.readUInt32BE(20) === 180);
  }
  check('robots.txt keeps booking pages out of search', /Disallow: \/book\//.test(require('fs').readFileSync(__dirname + '/../robots.txt', 'utf8')));
  await br.close();
  console.log('book_link: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
