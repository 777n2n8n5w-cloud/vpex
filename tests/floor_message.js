// VPEX regression check (floor_message). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/floor_message.js
// "Message your floor": an admin or manager writes a short message ("Back on the phones!") and it goes to every rep's phone.
// 1. The plain logic: the request is checked (sender, age, length), one message every 20 seconds and 60 a day per office,
//    the sender never gets their own message, a picked list narrows it, and the notification reads "From Dana".
// 2. The server function with stand-ins: only an active admin or manager of an open office can send; it reaches the reps'
//    phones, keeps the message in floor/{id} for the open app, writes the sender a receipt and removes the request.
// 3. The app on the in-page backend (390 dark, 1280 light): admins and managers get "Message your floor" in Admin controls;
//    quick messages fill the message, can be saved and removed; Send says who it goes to and is off when there's nothing
//    to send; the request it writes matches the security rules; the receipt shows; reps see a banner once, only for messages
//    meant for them; reps can't send, read someone else's receipt or write floor messages.
const L = require('../functions/lib.js');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const T0 = Date.parse('2026-11-05T15:00:00Z');

// ---- 1. plain logic ----
const rq = (o) => Object.assign({ uid: 'uDana', office: 'harbor-ins', at: T0, body: '  Back on the   phones!  ', to: [] }, o || {});
let r = L.floorRequest(rq(), 'uDana_abc', T0);
check('request: spaces tidied', r && r.body === 'Back on the phones!' && r.office === 'harbor-ins' && r.to.length === 0, r);
check('request: id must start with the sender', L.floorRequest(rq(), 'uMia_abc', T0) === null);
check('request: older than 5 minutes is dropped', L.floorRequest(rq({ at: T0 - 6 * 60000 }), 'uDana_abc', T0) === null);
check('request: empty is dropped', L.floorRequest(rq({ body: '   ' }), 'uDana_abc', T0) === null);
check('request: 180 characters is fine, 181 is not', !!L.floorRequest(rq({ body: 'x'.repeat(180) }), 'uDana_abc', T0) && L.floorRequest(rq({ body: 'x'.repeat(181) }), 'uDana_abc', T0) === null);
check('request: picked list keeps only real ids', JSON.stringify(L.floorRequest(rq({ to: ['uMia', 5, '', null, 'uSam'] }), 'uDana_abc', T0).to) === '["uMia","uSam"]');
let g = L.floorGate(null, T0);
check('gate: first message goes', g.ok && g.next.n === 1 && g.next.last === T0);
check('gate: 19 seconds later waits', L.floorGate(g.next, T0 + 19000).why === 'wait');
check('gate: 20 seconds later goes', L.floorGate(g.next, T0 + 20000).ok);
check('gate: 60 a day, then stop', L.floorGate({ last: T0 - 60000, day: L.utcDate(T0), n: 60 }, T0).why === 'daily' && L.floorGate({ last: T0 - 60000, day: L.utcDate(T0), n: 59 }, T0).ok);
check('gate: a new day starts over', L.floorGate({ last: T0 - 86400000, day: L.utcDate(T0 - 86400000), n: 60 }, T0).ok);
const ppl = [{ uid: 'uDana', name: 'Dana' }, { uid: 'uMia', name: 'Mia' }, { uid: 'uSam', name: 'Sam' }];
check('recipients: never the sender', JSON.stringify(L.floorRecipients(ppl, 'uDana', []).map(p => p.uid)) === '["uMia","uSam"]');
check('recipients: a picked list narrows it (and still not the sender)', JSON.stringify(L.floorRecipients(ppl, 'uDana', ['uSam', 'uDana']).map(p => p.uid)) === '["uSam"]');
let m = L.floorMessage('harbor-ins', 'Dana Cruz', 'Back on the phones!');
check('message: From Dana, the text, one tag so they replace each other', m.title === 'From Dana' && m.body === 'Back on the phones!' && m.tag === 'vpex-floor' && m.kind === 'floor');
check('message: opens the office', m.link === L.APP_URL + '?o=harbor-ins');
check('message: no name', L.floorMessage('', '', 'Hi').title === 'From your manager');
const fm = L.fcmMessage('tok', m, 3600);
check('message: as a phone notification', fm.webpush.notification.title === 'From Dana' && fm.webpush.headers.TTL === '3600' && fm.data.kind === 'floor');

// ---- 2. the server function with stand-ins ----
(async () => {
  const Module = require('module'), store = {}, sent = [];
  let clock = T0; const realNow = Date.now; Date.now = () => clock;
  const snap = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, get: (f) => d ? d[f] : undefined, data: () => d, ref: docRef(p) }; };
  function docRef(p) { return { path: p, get: async () => snap(p), set: async (v) => { store[p] = JSON.parse(JSON.stringify(v)); }, delete: async () => { delete store[p]; },
    create: async (v) => { if (store[p]) { const e = new Error('exists'); e.code = 6; throw e; } store[p] = v; } }; }
  const coll = (c, filters) => ({
    where(f, op, v) { return coll(c, (filters || []).concat([[f, op, v]])); },
    limit() { return this; },
    get: async () => { const pre = c + '/';
      const docs = Object.keys(store).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).filter(k => (filters || []).every(([f, op, v]) => {
        const val = (store[k] || {})[f]; return op === '==' ? val === v : op === '>=' ? val >= v : op === '<' ? val < v : op === '<=' ? val <= v : true; })).sort().map(snap);
      return { empty: !docs.length, size: docs.length, docs }; } });
  const fakeDb = { doc: docRef, collection: (c) => coll(c),
    runTransaction: async (fn) => fn({ get: (ref) => ref.get(), set: (ref, v) => { store[ref.path] = v; } }) };
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => fakeDb, { FieldPath: { documentId: () => '__id__' }, FieldValue: { increment: (n) => n } }),
    messaging: () => ({ sendEach: async (b) => { b.forEach(x => sent.push(x)); return { responses: b.map(() => ({ success: true })) }; } }) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: (o, fn) => fn },
    'firebase-functions/v2/scheduler': { onSchedule: (o, fn) => fn }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => fn }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load;
  Module._load = function (req) { if (stubs[req]) return stubs[req]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  process.env.TEST_DELAY_MS = '0';
  const O = 'offices/harbor-ins/';
  store['offices/harbor-ins'] = { name: 'Harbor Insurance Group', plan: 'paid', paidThrough: T0 + 20 * 864e5 };
  store[O + 'members/uDana'] = { name: 'Dana Cruz', role: 'admin', active: true };
  store[O + 'members/uLee'] = { name: 'Lee Park', role: 'manager', active: true };
  store[O + 'members/uMia'] = { name: 'Mia Chen', role: 'rep', active: true };
  store[O + 'members/uSam'] = { name: 'Sam Ortiz', role: 'rep', active: true };
  store[O + 'members/uOld'] = { name: 'Old Rep', role: 'rep', active: false };
  [['t1', 'uDana'], ['t2', 'uLee'], ['t3', 'uMia'], ['t3b', 'uMia'], ['t5', 'uOld']].forEach(([id, uid]) => store['pushTokens/' + id] = { uid, office: 'harbor-ins', token: 'tok-' + id, tz: 'America/New_York' });
  store[O + 'floor/uDana_old'] = { by: 'uDana', body: 'Old', at: T0 - 3 * 86400000 };
  const fire = async (id, d) => { store['pushFloor/' + id] = d; await F.sendFloor({ data: snap('pushFloor/' + id), params: { id } }); };
  const toks = () => sent.map(x => x.token).sort();

  await fire('uDana_a1', { uid: 'uDana', office: 'harbor-ins', at: T0, body: 'Back on the phones! 📞', to: [] });
  check('server: request removed', !store['pushFloor/uDana_a1']);
  check('server: every active rep phone, not the sender, not a turned-off login', JSON.stringify(toks()) === '["tok-t2","tok-t3","tok-t3b"]', toks());
  check('server: notification reads From Dana', sent[0] && sent[0].webpush.notification.title === 'From Dana' && sent[0].webpush.notification.body === 'Back on the phones! 📞');
  let rc = store['pushFloorDone/uDana_a1'];
  check('server: receipt: 3 people, 2 reached (Sam has no phone on)', rc && rc.status === 'sent' && rc.people === 3 && rc.reached === 2 && rc.phones === 3 && JSON.stringify(rc.off) === '["Sam Ortiz"]' && rc.uid === 'uDana', rc);
  const fd = store[O + 'floor/uDana_a1'];
  check('server: kept for the open app', fd && fd.by === 'uDana' && fd.byName === 'Dana Cruz' && fd.body === 'Back on the phones! 📞' && fd.at === T0 && Array.isArray(fd.to), fd);
  check('server: messages older than two days removed', !store[O + 'floor/uDana_old']);

  sent.length = 0; clock = T0 + 5000;
  await fire('uLee_a2', { uid: 'uLee', office: 'harbor-ins', at: clock, body: 'Again', to: [] });
  check('server: 5 seconds later (same office) waits', store['pushFloorDone/uLee_a2'] && store['pushFloorDone/uLee_a2'].status === 'wait' && !sent.length, store['pushFloorDone/uLee_a2']);
  clock = T0 + 25000;
  await fire('uLee_a3', { uid: 'uLee', office: 'harbor-ins', at: clock, body: 'Huddle in 5', to: ['uMia', 'uLee'] });
  check('server: a manager can send; picked list (never themself)', JSON.stringify(toks()) === '["tok-t3","tok-t3b"]' && store['pushFloorDone/uLee_a3'].people === 1 && sent[0].webpush.notification.title === 'From Lee', toks());

  sent.length = 0; clock = T0 + 60000;
  await fire('uMia_a4', { uid: 'uMia', office: 'harbor-ins', at: clock, body: 'Go home', to: [] });
  check('server: a rep can\'t send', store['pushFloorDone/uMia_a4'].status === 'not-allowed' && !sent.length && !store[O + 'floor/uMia_a4']);
  await fire('uMia_a5', { uid: 'uDana', office: 'harbor-ins', at: clock, body: 'Pretending', to: [] });
  check('server: someone else\'s name on the request: dropped, no receipt', !sent.length && !store['pushFloorDone/uMia_a5'] && !store['pushFloor/uMia_a5']);
  store[O + 'members/uLee'].active = false; clock = T0 + 120000;
  await fire('uLee_a6', { uid: 'uLee', office: 'harbor-ins', at: clock, body: 'Hi', to: [] });
  check('server: a turned-off manager can\'t send', store['pushFloorDone/uLee_a6'].status === 'not-allowed' && !sent.length);
  store['offices/harbor-ins'].paidThrough = T0 - 30 * 864e5;
  await fire('uDana_a7', { uid: 'uDana', office: 'harbor-ins', at: clock, body: 'Hi', to: [] });
  check('server: a paused office can\'t send', store['pushFloorDone/uDana_a7'].status === 'closed' && !sent.length);
  // the original team (top-level collections)
  store['members/uBoss'] = { name: 'Vincent Nickel', role: 'admin', active: true }; store['members/uRep'] = { name: 'Rae', role: 'rep', active: true };
  store['pushTokens/t9'] = { uid: 'uRep', office: '', token: 'tok-t9' };
  await fire('uBoss_a8', { uid: 'uBoss', office: '', at: clock, body: 'Back on the phones!', to: [] });
  check('server: original team works too', JSON.stringify(toks()) === '["tok-t9"]' && store['floor/uBoss_a8'] && store['pushFloorDone/uBoss_a8'].reached === 1 && sent[0].webpush.notification.title === 'From Vincent', toks());
  Date.now = realNow;

  // ---- 3. the app ----
  const { chromium } = require('playwright');
  const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
  const now = Date.now();
  const db0 = () => ({ 'offices/acme': { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: now + 5 * 864e5, ownerUid: 'a1', createdAt: now, invite: 'abc123xyz', locked: false },
    'offices/acme/members/a1': { username: 'boss', name: 'Dana Cruz', role: 'admin', active: true }, 'offices/acme/members/m1': { username: 'lee', name: 'Lee Park', role: 'manager', active: true },
    'offices/acme/members/r1': { username: 'sam', name: 'Sam Rep', role: 'rep', active: true }, 'offices/acme/members/r2': { username: 'mia', name: 'Mia Chen', role: 'rep', active: true },
    'offices/acme/leadChunks/_team': { roster: [{ uid: 'a1', name: 'Dana Cruz', role: 'admin', active: true }, { uid: 'm1', name: 'Lee Park', role: 'manager', active: true },
      { uid: 'r1', name: 'Sam Rep', role: 'rep', active: true }, { uid: 'r2', name: 'Mia Chen', role: 'rep', active: true }] } });
  const AUTH = { 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'lee@acme.vpex.app': { uid: 'm1', pw: 'testpass1' }, 'sam@acme.vpex.app': { uid: 'r1', pw: 'testpass1' } };
  const br = await chromium.launch();
  async function signIn(c, uid, email, db) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h || 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(400);
    await page.evaluate(([db, auth, sess]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth));
      localStorage.setItem('vpex_office', 'acme'); sessionStorage.setItem('__mocksess', JSON.stringify(sess)); }, [db, AUTH, { uid, email }]);
    await page.goto(BASE + '?o=acme'); await page.waitForTimeout(2600);
    return { ctx, page, errs };
  }
  const ev = (page, f, a) => page.evaluate(f, a);
  const fs = (page) => ev(page, () => JSON.parse(localStorage.getItem('__mockfs') || '{}'));
  // what the server would do: write into the in-page backend and tell the app
  const serverWrite = (page, docs) => ev(page, (docs) => { const d = JSON.parse(localStorage.getItem('__mockfs') || '{}'); Object.assign(d, docs); localStorage.setItem('__mockfs', JSON.stringify(d)); window.dispatchEvent(new StorageEvent('storage', { key: '__mockfs' })); }, docs);
  const label = (page) => ev(page, () => { const b = document.getElementById('flSend'); return { t: document.getElementById('flSendL').textContent, off: b.disabled }; });
  const typeMsg = (page, t) => ev(page, (t) => { const ta = document.getElementById('flText'); ta.value = t; ta.dispatchEvent(new Event('input')); }, t);

  for (const c of [{ w: 390, s: 'dark' }, { w: 1280, h: 800, s: 'light' }]) {
    const tag = ' (' + c.w + ')';
    // admin
    let { ctx, page, errs } = await signIn(c, 'a1', 'boss@acme.vpex.app', db0());
    await ev(page, () => document.getElementById('adminBtn').click()); await page.waitForTimeout(400);
    check('admin: Message your floor on the Admin controls home' + tag, await ev(page, () => !!document.getElementById('hubFloor') && !!document.getElementById('hubFloorRow')));
    await ev(page, () => document.getElementById('hubFloor').click()); await page.waitForTimeout(400);
    check('admin: sheet opens with six quick messages, the first filled in' + tag, await ev(page, () => document.querySelectorAll('#floorSheet [data-fl-p]').length === 6 && document.getElementById('flText').value === 'Back on the phones! 📞'));
    check('admin: everyone but me (3)' + tag, JSON.stringify(await label(page)) === '{"t":"Send to everyone (3)","off":false}', await label(page));
    check('admin: preview reads From Dana with the message' + tag, await ev(page, () => document.querySelector('.fl-note-ti').textContent === 'From Dana' && document.getElementById('flPrevB').textContent === 'Back on the phones! 📞'));
    const fits = await ev(page, () => { const b = document.getElementById('flSend').getBoundingClientRect(); return b.bottom <= innerHeight && b.top > 0 && b.height >= 44; });
    check('admin: Send is on screen without scrolling' + tag, fits);
    await ev(page, () => document.querySelectorAll('#floorSheet [data-fl-p]')[2].click()); await page.waitForTimeout(100);
    check('admin: tapping a quick message fills it in and marks it' + tag, await ev(page, () => document.getElementById('flText').value === 'Lunch is over. Let’s dial.' && document.querySelectorAll('#floorSheet .fl-chip.on').length === 1));
    await typeMsg(page, 'x'.repeat(185));
    check('admin: too long: Send is off and says by how much' + tag, JSON.stringify(await label(page)) === '{"t":"Too long by 5","off":true}', await label(page));
    await typeMsg(page, '   ');
    check('admin: empty: Send is off' + tag, (await label(page)).off && (await label(page)).t === 'Write a message');
    await typeMsg(page, 'Phones up, 50 dials by 3! 💪');
    check('admin: a new message can be saved' + tag, await ev(page, () => !document.getElementById('flSave').hidden));
    await ev(page, () => document.getElementById('flSave').click()); await page.waitForTimeout(300);
    let d = await fs(page);
    check('admin: saved for the whole team' + tag, (d['offices/acme/leadChunks/_team'].floorPresets || []).length === 7 && d['offices/acme/leadChunks/_team'].floorPresets[6] === 'Phones up, 50 dials by 3! 💪');
    check('admin: saved one is marked, no Save link' + tag, await ev(page, () => document.querySelectorAll('#floorSheet [data-fl-p]').length === 7 && document.getElementById('flSave').hidden && document.querySelector('#floorSheet .fl-chip.on [data-fl-del="6"]') !== null));
    await ev(page, () => document.getElementById('flEdit').click()); await page.waitForTimeout(100);
    await ev(page, () => document.querySelector('#floorSheet [data-fl-del="4"]').click()); await page.waitForTimeout(200);
    d = await fs(page);
    check('admin: Edit removes one (Huddle in 5 minutes.)' + tag, d['offices/acme/leadChunks/_team'].floorPresets.length === 6 && d['offices/acme/leadChunks/_team'].floorPresets.indexOf('Huddle in 5 minutes.') < 0);
    await ev(page, () => document.getElementById('flEdit').click()); await page.waitForTimeout(100);
    await ev(page, () => document.querySelector('[data-fl-to="pick"]').click()); await page.waitForTimeout(100);
    check('admin: Pick reps starts with everyone ticked' + tag, await ev(page, () => document.querySelectorAll('#floorSheet [data-fl-u]').length === 3 && document.querySelectorAll('#floorSheet [data-fl-u]:checked').length === 3));
    await ev(page, () => document.querySelectorAll('#floorSheet [data-fl-u]').forEach(x => { if (x.checked) x.click(); })); await page.waitForTimeout(100);
    check('admin: nobody picked: Send is off' + tag, JSON.stringify(await label(page)) === '{"t":"Pick at least one rep","off":true}', await label(page));
    await ev(page, () => document.querySelector('#floorSheet [data-fl-u="r1"]').click()); await page.waitForTimeout(100);
    check('admin: one picked: Send to Sam' + tag, (await label(page)).t === 'Send to Sam');
    await ev(page, () => document.getElementById('flSend').click()); await page.waitForTimeout(400);
    d = await fs(page);
    const reqs = Object.keys(d).filter(k => k.startsWith('pushFloor/'));
    const rqd = reqs.length === 1 ? d[reqs[0]] : null;
    check('admin: request written as the rules allow' + tag, rqd && /^pushFloor\/a1_[a-z0-9]+$/.test(reqs[0]) && JSON.stringify(Object.keys(rqd).sort()) === '["at","body","office","to","uid"]' && rqd.uid === 'a1' && rqd.office === 'acme' && rqd.body === 'Phones up, 50 dials by 3! 💪' && JSON.stringify(rqd.to) === '["r1"]', [reqs, rqd]);
    check('admin: Sending… while it goes' + tag, JSON.stringify(await label(page)) === '{"t":"Sending…","off":true}', await label(page));
    const id = reqs[0].split('/')[1];
    await serverWrite(page, { ['pushFloorDone/' + id]: { uid: 'a1', at: Date.now(), status: 'sent', people: 1, reached: 0, phones: 0, off: ['Sam Rep'] },
      ['offices/acme/floor/' + id]: { by: 'a1', byName: 'Dana Cruz', body: rqd.body, to: ['r1'], at: Date.now() } });
    await page.waitForTimeout(500);
    const res = await ev(page, () => (document.querySelector('#flRes .fl-res') || {}).innerText || '');
    check('admin: receipt says nobody has notifications on and they\'ll see it in the app' + tag, /Sent, but no phones have notifications on/.test(res) && /when they open VPEX/.test(res), res);
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/floor_admin_' + c.w + '.png' });
    check('admin: Send turns into Done' + tag, JSON.stringify(await label(page)) === '{"t":"Done","off":false}', await label(page));
    check('admin: sent message listed under Sent recently (to 1 rep)' + tag, await ev(page, () => { const r = document.querySelector('.fl-rec'); return !!r && /50 dials/.test(r.innerText) && /1 rep/.test(r.innerText); }));
    check('admin: no banner for my own message' + tag, await ev(page, () => !document.getElementById('floorBanner').classList.contains('show')));
    await ev(page, () => document.getElementById('flSend').click()); await page.waitForTimeout(300);
    check('admin: Done closes the sheet' + tag, await ev(page, () => !document.getElementById('featModal').classList.contains('show')));
    // a receipt for a busy office
    await ev(page, () => { document.getElementById('adminBtn').click(); document.getElementById('hubFloor').click(); }); await page.waitForTimeout(300); await typeMsg(page, 'Again');
    await ev(page, () => document.getElementById('flSend').click()); await page.waitForTimeout(300);
    d = await fs(page); const id2 = Object.keys(d).filter(k => k.startsWith('pushFloor/') && k.split('/')[1] !== id).map(k => k.split('/')[1])[0];
    await serverWrite(page, { ['pushFloorDone/' + id2]: { uid: 'a1', at: Date.now(), status: 'wait' } }); await page.waitForTimeout(400);
    check('admin: too soon: says so and Send stays usable' + tag, /One message every 20 seconds/.test(await ev(page, () => document.getElementById('flRes').innerText)) && !(await label(page)).off);
    check('admin: no page errors' + tag, !errs.length, errs);
    await ctx.close();

    // rep: sees a banner once, only for messages to them; can't send
    const db = db0(), t = Date.now();
    db['offices/acme/floor/a1_x1'] = { by: 'a1', byName: 'Dana Cruz', body: 'Back on the phones! 📞', to: [], at: t - 120000 };
    db['offices/acme/floor/a1_x0'] = { by: 'a1', byName: 'Dana Cruz', body: 'Earlier one', to: [], at: t - 600000 };
    db['offices/acme/floor/m1_x2'] = { by: 'm1', byName: 'Lee Park', body: 'Only for Mia', to: ['r2'], at: t - 60000 };
    db['offices/acme/floor/a1_x3'] = { by: 'a1', byName: 'Dana Cruz', body: 'Yesterday', to: [], at: t - 13 * 3600000 };
    ({ ctx, page, errs } = await signIn(c, 'r1', 'sam@acme.vpex.app', db));
    await page.waitForTimeout(600);
    const bn = await ev(page, () => { const b = document.getElementById('floorBanner'); return { show: b.classList.contains('show'), t: b.innerText }; });
    check('rep: banner with the newest message meant for them' + tag, bn.show && /From Dana/.test(bn.t) && /Back on the phones!/.test(bn.t) && /2 min ago/.test(bn.t) && /1 earlier message/.test(bn.t) && !/Only for Mia/.test(bn.t), bn);
    const top = await ev(page, () => { const b = document.getElementById('floorBanner').getBoundingClientRect(); return b.top >= 0 && b.bottom < innerHeight / 2 && b.left >= 0 && b.right <= innerWidth; });
    check('rep: banner on screen at the top' + tag, top);
    if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/floor_rep_' + c.w + '.png' });
    await ev(page, () => document.querySelector('#floorBanner .fb-ok').click()); await page.waitForTimeout(500);
    check('rep: Got it hides it' + tag, await ev(page, () => !document.getElementById('floorBanner').classList.contains('show')));
    await serverWrite(page, { 'offices/acme/floor/m1_x4': { by: 'm1', byName: 'Lee Park', body: 'Power hour starts now', to: [], at: Date.now() } }); await page.waitForTimeout(600);
    const bn2 = await ev(page, () => { const b = document.getElementById('floorBanner'); return { show: b.classList.contains('show'), t: b.innerText }; });
    check('rep: a new message pops up live' + tag, bn2.show && /From Lee/.test(bn2.t) && /Power hour/.test(bn2.t) && /now/.test(bn2.t) && !/earlier/.test(bn2.t), bn2);
    await ev(page, () => document.querySelector('#floorBanner .fb-ok').click()); await page.waitForTimeout(300);
    await page.reload(); await page.waitForTimeout(2800);
    check('rep: seen ones don\'t come back after reopening' + tag, await ev(page, () => !document.getElementById('floorBanner').classList.contains('show')));
    check('rep: no Admin controls, no way to send' + tag, await ev(page, () => getComputedStyle(document.getElementById('adminBtn')).display === 'none'));
    const sec = await ev(page, async () => {
      const db = firebase.app().firestore(), out = {};
      const tryIt = async (k, f) => { try { await f(); out[k] = 'ok'; } catch (e) { out[k] = e.code || 'err'; } };
      await tryIt('extraKey', () => db.collection('pushFloor').doc('r1_zz').set({ uid: 'r1', office: 'acme', at: Date.now(), body: 'hi', to: [], role: 'admin' }));
      await tryIt('asSomeoneElse', () => db.collection('pushFloor').doc('r1_zy').set({ uid: 'a1', office: 'acme', at: Date.now(), body: 'hi', to: [] }));
      await tryIt('tooLong', () => db.collection('pushFloor').doc('r1_zx').set({ uid: 'r1', office: 'acme', at: Date.now(), body: 'x'.repeat(181), to: [] }));
      await tryIt('otherReceipt', () => db.collection('pushFloorDone').doc('a1_abc').get());
      await tryIt('writeFloor', () => db.collection('offices').doc('acme').collection('floor').doc('r1_fake').set({ by: 'a1', byName: 'Dana', body: 'Go home', to: [], at: Date.now() }));
      await tryIt('readFloor', () => db.collection('offices').doc('acme').collection('floor').get());
      return out;
    });
    check('rep: rules: no extra fields, no sending as someone else, 180 max, no one else\'s receipt, no writing floor messages; reading is fine' + tag,
      sec.extraKey === 'permission-denied' && sec.asSomeoneElse === 'permission-denied' && sec.tooLong === 'permission-denied' && sec.otherReceipt === 'permission-denied' && sec.writeFloor === 'permission-denied' && sec.readFloor === 'ok', sec);
    check('rep: notifications sheet mentions manager messages' + tag, (require('fs').readFileSync(require('path').join(__dirname, '../index.html'), 'utf8').includes('<b>Messages from your manager</b>')));
    check('rep: no page errors' + tag, !errs.length, errs);
    await ctx.close();

    // manager: can send to the shared roster; own quick messages stay on this phone
    ({ ctx, page, errs } = await signIn(c, 'm1', 'lee@acme.vpex.app', db0()));
    await ev(page, () => document.getElementById('adminBtn').click()); await page.waitForTimeout(400);
    check('manager: has Message your floor' + tag, await ev(page, () => !!document.getElementById('hubFloor')));
    await ev(page, () => document.getElementById('hubFloor').click()); await page.waitForTimeout(300);
    check('manager: everyone but me (3)' + tag, (await label(page)).t === 'Send to everyone (3)', await label(page));
    await typeMsg(page, 'Manager special'); await ev(page, () => document.getElementById('flSave').click()); await page.waitForTimeout(300);
    d = await fs(page);
    check('manager: saved on this phone, not the team list' + tag, !(d['offices/acme/leadChunks/_team'].floorPresets) && await ev(page, () => JSON.parse(localStorage.getItem('vpex_floor_presets_m1') || '[]').indexOf('Manager special') >= 0));
    await ev(page, () => document.getElementById('flSend').click()); await page.waitForTimeout(300);
    d = await fs(page);
    const mr = Object.keys(d).filter(k => k.startsWith('pushFloor/m1_'));
    check('manager: request goes out to everyone (empty list)' + tag, mr.length === 1 && JSON.stringify(d[mr[0]].to) === '[]');
    check('manager: no page errors' + tag, !errs.length, errs);
    await ctx.close();
  }

  // demo office: sending shows what would happen
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);
    await ev(page, () => { document.getElementById('adminBtn').click(); document.getElementById('hubFloor').click(); }); await page.waitForTimeout(300);
    await ev(page, () => document.getElementById('flSend').click()); await page.waitForTimeout(1400);
    const r = await ev(page, () => ({ res: document.getElementById('flRes').innerText, b: document.getElementById('floorBanner').innerText, show: document.getElementById('floorBanner').classList.contains('show') }));
    check('demo: receipt says nothing went to real phones, banner previews it', /Demo: nothing went to real phones/.test(r.res) && r.show && /Preview/.test(r.b), r);
    check('demo: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`floor_message: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
