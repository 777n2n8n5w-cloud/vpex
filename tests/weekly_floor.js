// VPEX regression check (weekly_floor). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/weekly_floor.js
// Mondays at 8:30 in the reader's own time zone, admins and managers get "Your floor last week": calls (with the change
// from the week before), conversations, interested and the top caller, counted from the office's call records for
// Monday to Sunday in their time zone. Reps never get it, it goes out once per Monday, other days only the morning
// summary, and it never stops the morning summary. Tested on the plain logic and on the server function with stand-ins; the app's Notifications sheet lists it
// for admins and managers only (390 dark, 1280 light, on the in-page backend).
const L = require('../functions/lib.js');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NY = 'America/New_York', LA = 'America/Los_Angeles';
const at = (iso) => Date.parse(iso);

// ---- week bounds (Nov 9, 2026 is a Monday; Nov 1 was the clock change) ----
const mon = at('2026-11-09T13:30:00Z');                    // 8:30 AM in New York
check('weekDue Monday 8 o\'clock NY', L.weekDue(L.localParts(mon, NY)));
check('weekDue not at 7 o\'clock', !L.weekDue(L.localParts(at('2026-11-09T12:30:00Z'), NY)));
check('weekDue not on Tuesday', !L.weekDue(L.localParts(at('2026-11-10T13:30:00Z'), NY)));
check('weekDue LA at 8:30 local', L.weekDue(L.localParts(at('2026-11-09T16:30:00Z'), LA)) && !L.weekDue(L.localParts(mon, LA)));
let b = L.lastWeekBounds(mon, NY);
check('last week starts Mon Nov 2 00:00 NY', b.start === at('2026-11-02T05:00:00Z'), new Date(b.start).toISOString());
check('last week ends Mon Nov 9 00:00 NY', b.end === at('2026-11-09T05:00:00Z'), new Date(b.end).toISOString());
const pb = L.lastWeekBounds(b.start + 12 * 3600000, NY);
check('week before spans the clock change (Oct 26 00:00 EDT to Nov 2 00:00 EST)', pb.start === at('2026-10-26T04:00:00Z') && pb.end === b.start, [new Date(pb.start).toISOString()]);
check('UTC dates cover the local week', JSON.stringify(L.weekDates(b)) === JSON.stringify(['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09']), L.weekDates(b));
check('roles: admin and manager only', L.weekLead('admin') && L.weekLead('manager') && !L.weekLead('rep') && !L.weekLead(''));

// ---- counting ----
const call = (id, ts, o, uid, name) => [id, { id, timestamp: ts, outcomeKey: o, by: uid ? { uid, name } : undefined }];
const rec = (...cs) => ({ calls: Object.fromEntries(cs) });
let w = L.weekNew();
L.weekAdd(w, rec(call('a', '2026-11-02T05:00:00.000Z', 'interested', 'uMiaChen', 'Mia Chen'), call('b', '2026-11-02T04:59:59.000Z', 'noanswer', 'uMiaChen', 'Mia Chen'),
  call('c', '2026-11-09T04:59:00.000Z', 'callback', 'uJordanL', 'Jordan Lee'), call('d', '2026-11-09T05:00:00.000Z', 'interested', 'uJordanL', 'Jordan Lee'),
  call('e', '2026-11-04T15:00:00.000Z', 'notinterested', 'uMiaChen', 'Mia Chen'), call('f', '2026-11-04T15:01:00.000Z', 'voicemail', 'uMiaChen', 'Mia Chen'), call('g', 'junk', 'interested')), b);
L.weekAdd(w, rec(call('e', '2026-11-04T15:00:00.000Z', 'notinterested', 'uMiaChen', 'Mia Chen')), b);   // same call in an older-format record
check('counts only calls inside the week, each once', w.calls === 4, w.calls);
check('conversations = interested + not interested + callback', w.talk === 3, w.talk);
check('interested', w.interested === 1, w.interested);
check('per rep', w.reps.uMiaChen.calls === 3 && w.reps.uJordanL.calls === 1, w.reps);

// ---- message ----
w.prev = 2;
let m = L.weekMessage('Dana Cruz', w, 'harbor-ins');
check('title', m.title === 'Your floor last week, Dana', m.title);
check('body', m.body === '4 calls (up 100% from the week before) · 3 conversations · 1 interested · Top caller: Mia, 3.', m.body);
check('opens the office', m.link === 'https://vpexdialer.com/?o=harbor-ins' && m.tag === 'vpex-week' && m.kind === 'week', m);
w = Object.assign(L.weekNew(), { calls: 1240, talk: 312, interested: 42, prev: 1400, reps: { a: { name: 'Mia Chen', calls: 412 }, b: { name: 'Sam Ortiz', calls: 400 } } });
check('thousands and down %', L.weekMessage('', w, '').body === '1,240 calls (down 11% from the week before) · 312 conversations · 42 interested · Top caller: Mia, 412.', L.weekMessage('', w, '').body);
check('no name: plain title; original team link', L.weekMessage('', w, '').title === 'Your floor last week' && L.weekMessage('', w, '').link === 'https://vpexdialer.com/');
w.prev = 1240; check('same as the week before', /\(same as the week before\)/.test(L.weekMessage('', w, '').body));
w.prev = 0; check('no week before: no change shown', /^1,240 calls · /.test(L.weekMessage('', w, '').body));
w.reps.b.calls = 412; check('tie: no top caller', !/Top caller/.test(L.weekMessage('', w, '').body));
w.reps = { a: { name: 'Mia Chen', calls: 1240 } }; check('one caller: no top caller', !/Top caller/.test(L.weekMessage('', w, '').body));
check('one call grammar', L.weekMessage('', Object.assign(L.weekNew(), { calls: 1, talk: 1, interested: 0 }), '').body === '1 call · 1 conversation · 0 interested.');
check('quiet week after a busy one', L.weekMessage('', Object.assign(L.weekNew(), { prev: 80 }), '').body === '0 calls (down 100% from the week before).');
check('nothing either week: no message', L.weekMessage('', L.weekNew(), '') === null);

// ---- the server function with stand-ins (no network) ----
(async () => {
  const Module = require('module'), store = {}, sent = [];
  let clock = mon; Date.now = () => clock;
  const snap = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, get: (f) => d ? d[f] : undefined, data: () => d }; };
  const docRef = (p) => ({ get: async () => snap(p), create: async (v) => { if (store[p]) { const e = new Error('6 ALREADY_EXISTS: exists'); e.code = 6; throw e; } store[p] = v; } });
  let queries = 0;
  const coll = (c, filters) => ({
    where(f, op, v) { return coll(c, (filters || []).concat([[f, op, v]])); },
    limit() { return this; },
    get: async () => { queries++; const pre = c + '/';
      const docs = Object.keys(store).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).filter(k => (filters || []).every(([f, op, v]) => {
        const val = f === '__id__' ? k.slice(pre.length) : (store[k] || {})[f];
        return op === '==' ? val === v : op === '>=' ? val >= v : op === '<=' ? val <= v : true; })).map(snap);
      return { empty: !docs.length, size: docs.length, docs }; } });
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => ({ doc: docRef, collection: (c) => coll(c) }), { FieldPath: { documentId: () => '__id__' }, FieldValue: { increment: (n) => n } }),
    messaging: () => ({ sendEach: async (b) => { b.forEach(x => sent.push(x)); return { responses: b.map(() => ({ success: true })) }; } }) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: (o, fn) => fn }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => fn }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load;
  Module._load = function (req) { if (stubs[req]) return stubs[req]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  const O = 'offices/harbor-ins/';
  store['offices/harbor-ins'] = { name: 'Harbor Insurance Group', plan: 'paid', paidThrough: mon + 20 * 864e5 };
  store[O + 'members/uDanaCruz'] = { name: 'Dana Cruz', role: 'admin', active: true };
  store[O + 'members/uLeeManag'] = { name: 'Lee Park', role: 'manager', active: true };
  store[O + 'members/uMiaChen'] = { name: 'Mia Chen', role: 'rep', active: true };
  store[O + 'members/uOldAdmin'] = { name: 'Old Admin', role: 'admin', active: false };
  [['t1', 'uDanaCruz', NY], ['t2', 'uLeeManag', LA], ['t3', 'uMiaChen', NY], ['t4', 'uOldAdmin', NY]].forEach(([id, uid, tz]) => store['pushTokens/' + id] = { uid, office: 'harbor-ins', token: 'tok-' + uid, tz });
  // last week: Mia 5 calls (2 interested, 1 callback), Jordan 2 (1 not interested); one record per rep per hour, plus the day counters and activity record
  store[O + 'callDays/2026-11-03_uMiaChen_15'] = rec(call('m1', '2026-11-03T15:01:00.000Z', 'interested', 'uMiaChen', 'Mia Chen'), call('m2', '2026-11-03T15:05:00.000Z', 'noanswer', 'uMiaChen', 'Mia Chen'), call('m3', '2026-11-03T15:09:00.000Z', 'callback', 'uMiaChen', 'Mia Chen'));
  store[O + 'callDays/2026-11-06_uMiaChen_20'] = rec(call('m4', '2026-11-06T20:00:00.000Z', 'interested', 'uMiaChen', 'Mia Chen'), call('m5', '2026-11-06T20:02:00.000Z', 'voicemail', 'uMiaChen', 'Mia Chen'));
  store[O + 'callDays/2026-11-04_uJordanL_14'] = rec(call('j1', '2026-11-04T14:00:00.000Z', 'notinterested', 'uJordanL', 'Jordan Lee'), call('j2', '2026-11-04T14:03:00.000Z', 'noanswer', 'uJordanL', 'Jordan Lee'));
  store[O + 'callDays/2026-11-09_uMiaChen_13'] = rec(call('x1', '2026-11-09T13:00:00.000Z', 'interested', 'uMiaChen', 'Mia Chen'));   // this Monday: not last week
  store[O + 'callDays/n_2026-11-03'] = { calls: {}, c: 3 }; store[O + 'callDays/act_2026-11-03'] = { live: {} };
  // the week before: 5 calls (one on Sunday Nov 1 at 11 PM New York = Nov 2 UTC)
  store[O + 'callDays/2026-10-27_uMiaChen_15'] = rec(...['p1', 'p2', 'p3', 'p4'].map((id, i) => call(id, '2026-10-27T15:0' + i + ':00.000Z', 'noanswer', 'uMiaChen', 'Mia Chen')));
  store[O + 'callDays/2026-11-02_uJordanL_04'] = rec(call('p5', '2026-11-02T04:30:00.000Z', 'noanswer', 'uJordanL', 'Jordan Lee'));
  await F.morningDigest();
  const to = (uid) => sent.filter(x => x.token === 'tok-' + uid);
  const wk = to('uDanaCruz').find(x => x.data.kind === 'week');
  check('admin gets the week at 8:30 Monday', !!wk, to('uDanaCruz').map(x => x.data.kind));
  check('admin week body', wk && wk.webpush.notification.body === '7 calls (up 40% from the week before) · 4 conversations · 2 interested · Top caller: Mia, 5.', wk && wk.webpush.notification.body);
  check('admin week title and tag', wk && wk.webpush.notification.title === 'Your floor last week, Dana' && wk.webpush.notification.tag === 'vpex-week');
  check('rep gets no week', !to('uMiaChen').some(x => x.data.kind === 'week'));
  check('turned-off admin gets nothing', !to('uOldAdmin').length);
  check('manager in LA: not yet at 5:30 AM their time', !to('uLeeManag').length);
  const n1 = sent.length;
  await F.morningDigest();
  check('once per Monday (a second run sends no week)', sent.slice(n1).filter(x => x.data.kind === 'week').length === 0, sent.slice(n1).map(x => x.data.kind));
  clock = at('2026-11-09T16:30:00Z');   // 8:30 AM in Los Angeles
  await F.morningDigest();
  const lw = to('uLeeManag').find(x => x.data.kind === 'week');
  check('manager in LA gets it at 8:30 their time, same floor numbers', lw && /^7 calls \(up 40% from the week before\)/.test(lw.webpush.notification.body), lw && lw.webpush.notification.body);
  clock = at('2026-11-10T13:30:00Z');   // Tuesday 8:30 AM New York
  const n2 = sent.length; await F.morningDigest();
  check('Tuesday: no week', sent.slice(n2).every(x => x.data.kind !== 'week'));
  // the morning summary still goes out on Monday next to the week (a follow-up due today for the admin)
  clock = at('2026-11-16T13:30:00Z');
  store[O + 'leadChunks/c001'] = { leads: { L1: { name: 'Anthony Ross', owner: { uid: 'uDanaCruz' }, tasks: [{ id: 't', type: 'Call', note: 'Call back', dueAt: at('2026-11-16T15:00:00Z'), assignee: { uid: 'uDanaCruz' } }] } } };
  const n3 = sent.length; await F.morningDigest();
  const kinds = sent.slice(n3).filter(x => x.token === 'tok-uDanaCruz').map(x => x.data.kind).sort();
  check('next Monday: both the week and the morning summary', JSON.stringify(kinds) === '["digest","week"]', kinds);
  const quiet = sent.slice(n3).find(x => x.data.kind === 'week');
  check('the next week counts its own calls (this Monday\'s 1 call) against the 7 before', quiet && quiet.webpush.notification.body === '1 call (down 86% from the week before) · 1 conversation · 1 interested.', quiet && quiet.webpush.notification.body);
  // ---- the Notifications sheet in the app ----
  const { chromium } = require('playwright');
  const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
  const db = { 'offices/acme': { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: Date.now() + 5 * 864e5, ownerUid: 'a1', createdAt: Date.now(), invite: 'abc123xyz', locked: false },
    'offices/acme/members/a1': { username: 'boss', name: 'Dana Cruz', role: 'admin', active: true }, 'offices/acme/members/m1': { username: 'lee', name: 'Lee Park', role: 'manager', active: true },
    'offices/acme/members/r1': { username: 'sam', name: 'Sam Rep', role: 'rep', active: true } };
  const AUTH = { 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'lee@acme.vpex.app': { uid: 'm1', pw: 'testpass1' }, 'sam@acme.vpex.app': { uid: 'r1', pw: 'testpass1' } };
  const br = await chromium.launch();
  for (const c of [{ w: 390, s: 'dark' }, { w: 1280, s: 'light' }]) for (const [uid, email, want] of [['a1', 'boss@acme.vpex.app', true], ['m1', 'lee@acme.vpex.app', true], ['r1', 'sam@acme.vpex.app', false]]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, permissions: ['notifications'] });
    // the bench has no Firebase messaging script; stand one in so the sheet shows its "Turn on" state with the list
    await ctx.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'default' }); } catch (e) {} let fb; Object.defineProperty(window, 'firebase', { configurable: true, get: () => fb, set: (v) => { if (v && typeof v.messaging !== 'function') v.messaging = function () {}; fb = v; } }); });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(400);
    await page.evaluate(([db, auth, sess]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth));
      localStorage.setItem('vpex_office', 'acme'); sessionStorage.setItem('__mocksess', JSON.stringify(sess)); }, [db, AUTH, { uid, email }]);
    await page.goto(BASE + '?o=acme'); await page.waitForTimeout(2600);
    await page.waitForTimeout(3300);
    const r = await page.evaluate(() => { const pb = document.getElementById('pushRowBtn'); if (!pb) return { nobtn: 1 }; pb.click(); const t = document.body.innerText; const li = [...document.querySelectorAll('.push-list li')];
      return { week: /Your floor’s week on Monday mornings: calls, conversations, interested and the top caller/.test(t), morning: /A morning summary/.test(t), n: li.length,
        ov: document.documentElement.scrollWidth > innerWidth + 1 }; });
    const tag = c.w + '-' + c.s + ' ' + uid;
    check(tag + ': sheet lists the morning summary', r.morning, r);
    check(tag + (want ? ': lists the Monday week' : ': rep sees no Monday week'), r.week === want, r);
    check(tag + ': no sideways scroll, no page errors', !r.ov && !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`weekly_floor: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
