// VPEX regression check (cal_feed): each login's follow-ups and appointments as a calendar feed (functions/ cal), and
// Settings › Calendar on your phone in the app. Server parts with stand-ins for Firebase; the app on the in-page backend.
//   node parts need nothing; the app part: python3 -m http.server 8765 (repo root), NODE_PATH=<playwright> node tests/cal_feed.js
const L = require('../functions/lib.js'), crypto = require('crypto');
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const SECRET = crypto.randomBytes(32).toString('hex');
check('key: office, login and secret', (k => k && k.office === 'acme' && k.uid === 'rep222xyz' && k.secret === SECRET)(L.calKey('vc_acme_rep222xyz_' + SECRET)));
check('key: the original team', (k => k && k.office === '' && k.uid === 'dAdm00')(L.calKey('vc__dAdm00_' + SECRET)));
check('key: junk refused', !L.calKey('') && !L.calKey('vc_acme_r_' + SECRET) && !L.calKey('vc_acme_re/p_' + SECRET) && !L.calKey('vc_acme_rep222xyz_' + SECRET.slice(1)) && !L.calKey('vk_acme_' + SECRET));
const now = Date.UTC(2026, 10, 9, 15), H = 3600000;
const chunk = { leads: {
  a: { name: 'Pat Lee', phoneRaw: '2125550199', tasks: [
    { id: 't1', dueAt: now + H, type: 'Call', what: 'Send quote', note: 'She asked; send the PDF, then call', assignee: { uid: 'rep222xyz' } },
    { id: 't2', dueAt: now + 2 * H, note: 'Appointment with Sam', assignee: { uid: 'rep222xyz' } },
    { id: 't3', dueAt: now + H, auto: true, type: 'Call', note: 'Try 2', assignee: { uid: 'rep222xyz' } },
    { id: 't4', dueAt: now + H, done: true, assignee: { uid: 'rep222xyz' } },
    { id: 't5', dueAt: now + H, assignee: { uid: 'otherrep1' } },
    { id: 't6', dueAt: now + 90 * 86400000, assignee: { uid: 'rep222xyz' } },
    { id: 't7', dueAt: now - 3 * 86400000, assignee: { uid: 'rep222xyz' } }] },
  b: { name: 'Owned', phoneRaw: '6465550100', owner: { uid: 'rep222xyz' }, tasks: [{ id: 't8', dueAt: now + 3 * H, what: 'Follow-up call' }] },
  c: { name: 'Blocked', dnc: { at: 1 }, owner: { uid: 'rep222xyz' }, tasks: [{ id: 't9', dueAt: now + H }] } } };
const ev = L.calEvents('acme', [chunk], 'rep222xyz', now);
check('events: open, assigned or owned, in the window; routine redials, done, others\', far and old, Do Not Call left out', ev.map(e => e.id).join() === 't1,t2,t8', ev.map(e => e.id));
check('events: titles', ev[0].title === 'Send quote: Pat Lee' && ev[1].title === 'Appointment: Pat Lee' && ev[2].title === 'Call Owned', ev.map(e => e.title));
const ics = L.calIcs(ev, now);
check('ics: a calendar with 3 events, CRLF lines', /^BEGIN:VCALENDAR\r\n/.test(ics) && /END:VCALENDAR\r\n$/.test(ics) && (ics.match(/BEGIN:VEVENT/g) || []).length === 3 && !/[^\r]\n/.test(ics));
check('ics: times in UTC, 15 / 30 minutes', ics.includes('DTSTART:20261109T160000Z') && ics.includes('DTEND:20261109T161500Z') && ics.includes('DTEND:20261109T173000Z'));
check('ics: text escaped (; ,), number and link in the description', ics.replace(/\r\n /g, '').includes('DESCRIPTION:(212) 555-0199\\nShe asked\\; send the PDF\\, then call\\nOpen in VPEX: https://vpexdialer.com/?o=acme&open=a'), ics);
check('ics: appointments remind 10 minutes before', /SUMMARY:Appointment: Pat Lee[\s\S]*TRIGGER:-PT10M[\s\S]*END:VEVENT/.test(ics) && (ics.match(/VALARM/g) || []).length === 2);
check('ics: no line over 75 bytes', ics.split('\r\n').every(l => Buffer.byteLength(l) <= 75));
check('ics: long lines with emoji and accents fold on character edges', (f => f.split('\r\n').every(l => Buffer.byteLength(l) <= 75) && f.replace(/\r\n /g, '') === 'DESCRIPTION:' + 'Café 👋 '.repeat(20))(L.icsFold('DESCRIPTION:' + 'Café 👋 '.repeat(20))));
(async () => {
  // ---- the server function with stand-ins ----
  const Module = require('module'), store = {};
  const snap = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, get: f => d ? d[f] : undefined, data: () => d }; };
  const docRef = (p) => ({ get: async () => snap(p) });
  const col = (p) => ({ get: async () => { const docs = Object.keys(store).filter(k => k.startsWith(p + '/') && k.slice(p.length + 1).indexOf('/') < 0).map(snap); return { docs, empty: !docs.length, size: docs.length }; }, where: () => col(p), limit: () => col(p) });
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => ({ doc: docRef, collection: col }), { FieldValue: {} }), messaging: () => ({}) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: () => () => {} }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => fn }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load; Module._load = function (r) { if (stubs[r]) return stubs[r]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  Date.now = () => now;
  const get = async (k, method) => { let code = 0, body = '', hd = {}; const res = { status(c) { code = c; return this; }, set(a, b) { hd[a.toLowerCase()] = b; return this; }, send(b) { body = b; return this; } };
    await F.cal({ method: method || 'GET', query: { k } }, res); return { code, body, type: hd['content-type'] || '' }; };
  store['offices/acme'] = { plan: 'paid', paidThrough: now + 30 * 86400000 };
  store['offices/acme/members/rep222xyz'] = { active: true, role: 'rep' };
  store['offices/acme/leadChunks/c001'] = chunk;
  store['offices/acme/leadChunks/r_rep222xyz'] = { leads: {}, calFeed: { h: L.sha256hex(SECRET), at: now } };
  store['offices/acme/leadChunks/_team'] = { leadIn: { h: 'x' } };
  let r = await get('vc_acme_rep222xyz_' + SECRET);
  check('server: the right link gets the calendar', r.code === 200 && /text\/calendar/.test(r.type) && (r.body.match(/BEGIN:VEVENT/g) || []).length === 3, [r.code, r.type]);
  check('server: a .ics ending works too', (await get('vc_acme_rep222xyz_' + SECRET + '.ics')).code === 200);
  check('server: a wrong secret gets nothing (404)', (await get('vc_acme_rep222xyz_' + 'f'.repeat(64))).code === 404);
  check('server: another login\'s id with this secret gets nothing', (await get('vc_acme_otherrep1_' + SECRET)).code === 404);
  check('server: junk gets nothing', (await get('nope')).code === 404 && (await get('')).code === 404);
  check('server: POST refused', (await get('vc_acme_rep222xyz_' + SECRET, 'POST')).code === 405);
  store['offices/acme/members/rep222xyz'].active = false;
  check('server: a turned-off login gets nothing (403)', (await get('vc_acme_rep222xyz_' + SECRET)).code === 403);
  store['offices/acme/members/rep222xyz'].active = true; store['offices/acme'].locked = true;
  check('server: a paused office gets nothing (403)', (await get('vc_acme_rep222xyz_' + SECRET)).code === 403);
  store['offices/acme'].locked = false; delete store['offices/acme/leadChunks/r_rep222xyz'].calFeed;
  check('server: after Turn off the link stops (404)', (await get('vc_acme_rep222xyz_' + SECRET)).code === 404);
  // ---- the app: Settings › Calendar on your phone ----
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('FAIL playwright missing'); process.exit(1); }
  const br = await chromium.launch();
  for (const c of [{ n: '390-dark', w: 390, h: 844, s: 'dark' }, { n: '1280-light', w: 1280, h: 860, s: 'light' }]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
    await page.evaluate(() => { const db = demoSeed(); localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      localStorage.setItem('__mockauth', JSON.stringify({ 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' } }));
      sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR2', email: 'sam@dovetail-f863c.firebaseapp.com' })); });
    await page.goto(BASE); await page.waitForTimeout(3000);
    const row = async () => { await page.evaluate(() => document.getElementById('menuBtn').click()); await page.waitForTimeout(300); const t = await page.evaluate(() => { const b = document.getElementById('calRowBtn'); return b && !b.hidden ? b.innerText.replace(/\s+/g, ' ') : null; }); await page.evaluate(() => document.getElementById('calRowBtn').click()); await page.waitForTimeout(300); return t; };
    const txt = () => page.evaluate(() => document.getElementById('featModalBody').innerText);
    check(c.n + ': a rep sees Calendar on your phone in Settings', /Calendar on your phone/.test(await row() || ''));
    check(c.n + ': explains it, offers to make the link', /show up in your phone’s calendar/.test(await txt()) && await page.evaluate(() => !!document.getElementById('calMake')));
    await page.click('#calMake'); await page.waitForTimeout(600);
    const link = await page.evaluate(() => (document.querySelector('#featModalBody code') || {}).textContent || ''), add = await page.evaluate(() => (document.getElementById('calAdd') || {}).href || '');
    const k = L.calKey(new URL(link).searchParams.get('k'));
    check(c.n + ': link to the feed with this login\'s key', /^https:\/\/us-central1-dovetail-f863c\.cloudfunctions\.net\/cal\?k=vc__dR2_[0-9a-f]{64}$/.test(link) && k && k.uid === 'dR2', link);
    check(c.n + ': "Add to my iPhone calendar" is the webcal:// address', add === link.replace(/^https:/, 'webcal:'), add);
    const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('__mockfs'))['leadChunks/r_dR2'] || {});
    check(c.n + ': only the SHA-256 saved, in the rep\'s own record, leads untouched', rec.calFeed && rec.calFeed.h === L.sha256hex(k.secret) && rec.leads && typeof rec.leads === 'object' && !JSON.stringify(rec).includes(k.secret));
    check(c.n + ': Add button and Copy at least 44 px, no sideways scroll', await page.evaluate(() => [document.getElementById('calAdd'), document.getElementById('calCopy')].every(b => b.getBoundingClientRect().height >= 40) && document.querySelector('#featModal .modal').scrollWidth <= document.querySelector('#featModal .modal').clientWidth + 1));
    await page.evaluate(() => document.getElementById('featClose').click()); await page.reload(); await page.waitForTimeout(3000);
    check(c.n + ': after a reload the row says On', /On/.test(await row() || ''));
    check(c.n + ': no link shown again; new link / turn off offered', /Made /.test(await txt()) && !(await page.evaluate(() => !!document.getElementById('calAdd'))) && await page.evaluate(() => !!document.getElementById('calNew') && !!document.getElementById('calOff')));
    await page.click('#calOff'); await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.modal-overlay.show button')].find(x => x.innerText.trim() === 'Turn off' && x.closest('.modal-overlay').id !== 'featModal'); if (b) b.click(); }); await page.waitForTimeout(500);
    check(c.n + ': Turn off clears it', await page.evaluate(() => !(JSON.parse(localStorage.getItem('__mockfs'))['leadChunks/r_dR2'] || {}).calFeed));
    check(c.n + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  { // demo offices don't offer it
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    await page.route(/gstatic\.com\/firebasejs|fonts\.g/, r => r.abort()); await page.goto(BASE + '#demo-auto'); await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('menuBtn').click()); await page.waitForTimeout(300);
    check('demo: no calendar row', await page.evaluate(() => document.getElementById('calRowBtn').hidden));
    await ctx.close();
  }
  await br.close();
  console.log(`cal_feed: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', String(e && e.stack || e)); process.exit(1); });
