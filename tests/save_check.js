// VPEX regression check (save_check): the hourly server check that tells an office's admins when reps' calls aren't
// reaching VPEX. From Nov 15 to Nov 24 every rep's call was refused and nobody knew for 9 days; this finds it within the
// hour. Logging a call sets the lead's calledAt and saves a call record with exactly that timestamp, so a lead called
// in the last day whose record isn't there is a call that never arrived. Phones also report saves they're holding.
// Tested on the plain logic and on the server function with stand-ins (no network). Plain node, no browser:
//   node tests/save_check.js
const L = require('../functions/lib.js');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (process.env.VERBOSE) console.log(ok ? 'ok  ' : 'FAIL', n); if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 500)); } };
const NOW = Date.parse('2026-11-24T19:10:00Z');   // 2:10 PM New York
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const members = { uVince: { name: 'Vincent', role: 'admin', active: true }, uWill: { name: 'William Medina', role: 'rep', active: true }, uLance: { name: 'Lance Sbarra', role: 'rep', active: true }, uGone: { name: 'Old Rep', role: 'rep', active: false } };
const lead = (calledAt, uid, name) => ({ name: 'Lead', status: 'done', outcome: 'noanswer', calledAt, owner: uid ? { uid, name } : undefined });
const callRec = (leadId, ts, uid) => ({ id: 'c' + leadId, leadId, timestamp: ts, outcomeKey: 'noanswer', by: { uid } });

// ---- the rules ----
const tVin = iso(90), tW1 = iso(60), tW2 = iso(45), tW3 = iso(5), tOld = iso(60 * 30);
let chunks = [{ leads: { L1: lead(tVin, 'uVince', 'Vincent'), L2: lead(tW1, 'uWill'), L3: lead(tW2, 'uWill'), L4: lead(tW3, 'uWill'), L5: lead(tOld, 'uWill'), L6: lead(null), L7: { name: 'never called', status: 'pending' } } }];
let calls = [{ calls: { a: callRec('L1', tVin, 'uVince') } }];
let r = L.saveAudit(chunks, calls, [], members, NOW);
check('Vincent\'s saved call is fine', !r.missing.some(x => x.leadId === 'L1'));
check('William\'s two calls with no record are missing (the Nov 15 to 24 problem)', r.missing.filter(x => x.uid === 'uWill').map(x => x.leadId).sort().join() === 'L2,L3', r.missing);
check('a call 5 minutes ago gets time to arrive (not missing yet)', !r.missing.some(x => x.leadId === 'L4'));
check('a call from 30 hours ago is outside the window', !r.missing.some(x => x.leadId === 'L5'));
check('never-called leads are ignored', !r.missing.some(x => x.leadId === 'L6' || x.leadId === 'L7'));
check('per person: William, 2 missing, by his name', r.people.length === 1 && r.people[0].name === 'William Medina' && r.people[0].missing === 2, r.people);
calls.push({ calls: { w1: callRec('L2', tW1, 'uWill'), w2: callRec('L3', tW2, 'uWill') } });
r = L.saveAudit(chunks, calls, [], members, NOW);
check('once his calls are saved, nothing is missing', !r.missing.length && !r.people.length, r);
check('the timestamp must match exactly (an older call to the same lead doesn\'t count)', L.saveAudit([{ leads: { L2: lead(tW1, 'uWill') } }], [{ calls: { x: callRec('L2', iso(300), 'uWill') } }], [], members, NOW).missing.length === 1);
// phones holding saves
const acts = [{ live: { uLance: { s: 'idle', h: { w: 3, u: 1, b: '2027-03-13', at: NOW - 40 * 60000 } }, uWill: { s: 'call', h: { w: 0, u: 0, b: '2027-03-13', at: NOW - 60000 } }, uGone: { h: { w: 5, u: 0, at: NOW - 60000 } } } },
  { live: { uLance: { h: { w: 9, u: 0, at: NOW - 30 * 3600000 } } } }];
r = L.saveAudit(chunks, calls, acts, members, NOW);
check('Lance\'s phone holding 3 calls and 1 change is reported (latest report wins)', r.holding.length === 1 && r.holding[0].uid === 'uLance' && r.holding[0].calls === 3 && r.holding[0].changes === 1, r.holding);
check('a phone reporting all saved isn\'t; a removed rep isn\'t', !r.holding.some(x => x.uid === 'uWill' || x.uid === 'uGone'));
check('Lance is listed with 4 saves waiting', r.people[0].name === 'Lance Sbarra' && r.people[0].holding === 4, r.people);
// dates read
check('call records read for the window (UTC dates)', JSON.stringify(L.saveDates(NOW)) === JSON.stringify(['2026-11-23', '2026-11-24']), L.saveDates(NOW));

// ---- when to tell the admins ----
const bad = L.saveAudit(chunks, [{ calls: { a: callRec('L1', tVin, 'uVince') } }], [], members, NOW);
check('first time: alert', L.saveDecision(bad, null, NOW) === 'alert');
const sent = { open: true, sig: bad.sig, at: NOW };
check('same problem an hour later: no repeat', L.saveDecision(bad, sent, NOW + 3600000) === null);
check('still going 4 hours later: remind', L.saveDecision(bad, sent, NOW + 4 * 3600000) === 'alert');
const worse = L.saveAudit([{ leads: Object.assign({}, chunks[0].leads, { L9: lead(iso(30), 'uLance') }) }], [{ calls: { a: callRec('L1', tVin, 'uVince') } }], [], members, NOW);
check('a new missing call: alert at once', L.saveDecision(worse, sent, NOW + 600000) === 'alert');
const fixed = L.saveAudit([{ leads: {} }], [], [], members, NOW);
check('all saved after an alert: "saving again", once', L.saveDecision(fixed, sent, NOW) === 'clear' && L.saveDecision(fixed, { open: false }, NOW) === null);
check('nothing wrong, nothing sent', L.saveDecision(fixed, null, NOW) === null);
// the words
let m = L.saveMessage('alert', bad, 'acme');
check('alert names the rep and the count, says what to do', m.title === 'Calls not saving' && /^William: 2 calls didn't reach VPEX\. Ask them to open VPEX with signal/.test(m.body) && /Live rep tracker/.test(m.body), m.body);
check('alert opens the office in the app', m.link === 'https://vpexdialer.com/?o=acme' && m.tag === 'vpex-savecheck', m.link);
m = L.saveMessage('alert', r, '');
check('holding wording, original team link', /Lance: 4 saves waiting on their phone/.test(m.body) && m.link === 'https://vpexdialer.com/', m.body + ' ' + m.link);
check('"saving again" wording', L.saveMessage('clear', fixed, '').title === 'Calls are saving again');
const many = { people: ['Ann A', 'Bo B', 'Cy C', 'Di D', 'Ed E'].map(n => ({ name: n, missing: 1, holding: 0 })) };
check('more than 3 reps: the first 3 and "+2 more"', /\(\+2 more\)/.test(L.saveMessage('alert', many, '').body));

// ---- the server function with stand-ins (no network) ----
(async () => {
  const Module = require('module'), store = {}, pushed = [];
  let clock = NOW; Date.now = () => clock;
  const snap = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, get: (f) => d ? d[f] : undefined, data: () => d }; };
  const docRef = (p) => ({ get: async () => snap(p), set: async (v) => { store[p] = v; }, create: async (v) => { if (store[p]) { const e = new Error('exists'); e.code = 6; throw e; } store[p] = v; }, delete: async () => { delete store[p]; } });
  let writes = 0;
  const coll = (c, filters) => ({
    where(f, op, v) { return coll(c, (filters || []).concat([[f, op, v]])); },
    limit() { return this; },
    get: async () => { const pre = c + '/';
      const docs = Object.keys(store).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).filter(k => (filters || []).every(([f, op, v]) => {
        const val = f === '__id__' ? k.slice(pre.length) : (store[k] || {})[f];
        return op === '==' ? val === v : op === '>=' ? val >= v : op === '<=' ? val <= v : true; })).map(p => Object.assign(snap(p), { ref: docRef(p) }));
      return { empty: !docs.length, size: docs.length, docs }; } });
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => ({ doc: (p) => { const r = docRef(p); const s = r.set; r.set = async (v) => { writes++; return s(v); }; return r; }, collection: (c) => coll(c) }), { FieldPath: { documentId: () => '__id__' }, FieldValue: { increment: (n) => n } }),
    messaging: () => ({ sendEach: async (b) => { b.forEach(x => pushed.push(x)); return { responses: b.map(() => ({ success: true })) }; } }) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: (o, fn) => fn }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => fn }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load;
  Module._load = function (req) { if (stubs[req]) return stubs[req]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  check('the server has the hourly saveCheck job', typeof F.saveCheck === 'function');
  // the original team (top level): Vincent admin with notifications on; William's calls not saved
  Object.entries(members).forEach(([uid, m]) => store['members/' + uid] = m);
  store['pushTokens/t1'] = { uid: 'uVince', office: '', token: 'tok-vince', tz: 'America/New_York' };
  store['pushTokens/t2'] = { uid: 'uWill', office: '', token: 'tok-will', tz: 'America/New_York' };
  store['leadChunks/_team'] = { roster: [] };
  store['leadChunks/c001'] = { leads: { L1: lead(tVin, 'uVince', 'Vincent'), L2: lead(tW1, 'uWill'), L3: lead(tW2, 'uWill') } };
  store['callDays/2026-11-24_uVince_17'] = { calls: { a: callRec('L1', tVin, 'uVince') } };
  store['callDays/n_2026-11-24'] = { calls: {}, c: 1 };
  store['callDays/act_2026-11-24'] = { calls: {}, live: {} };
  // an office: paid, admin with notifications on, everything saved
  store['offices/acme'] = { name: 'Acme', plan: 'paid', paidThrough: NOW + 20 * 864e5 };
  store['offices/acme/members/aBoss'] = { name: 'Dana Cruz', role: 'admin', active: true };
  store['offices/acme/members/aRep'] = { name: 'Mia Chen', role: 'rep', active: true };
  store['pushTokens/t3'] = { uid: 'aBoss', office: 'acme', token: 'tok-dana', tz: 'America/Chicago' };
  store['offices/acme/leadChunks/c001'] = { leads: { M1: lead(iso(50), 'aRep', 'Mia Chen') } };
  store['offices/acme/callDays/2026-11-24_aRep_18'] = { calls: { m: callRec('M1', iso(50), 'aRep') } };
  // a closed office with a problem: not checked
  store['offices/gone'] = { name: 'Gone', plan: 'trial', trialEnds: NOW - 864e5 };
  store['offices/gone/members/gBoss'] = { name: 'G Boss', role: 'admin', active: true };
  store['pushTokens/t4'] = { uid: 'gBoss', office: 'gone', token: 'tok-gone', tz: 'America/New_York' };
  store['offices/gone/leadChunks/c001'] = { leads: { G1: lead(iso(50), 'gx') } };

  await F.saveCheck();
  const to = t => pushed.filter(x => x.token === t);
  check('Vincent gets "Calls not saving" naming William', to('tok-vince').length === 1 && /^William: 2 calls didn't reach VPEX/.test(to('tok-vince')[0].webpush.notification.body), to('tok-vince').map(x => x.webpush.notification.body));
  check('the rep doesn\'t get the admin alert', !to('tok-will').length);
  check('an office where everything saved: no alert', !to('tok-dana').length);
  check('a closed office isn\'t checked', !to('tok-gone').length);
  check('it remembers what it sent', store['pushMeta/save__team'] && store['pushMeta/save__team'].open === true && store['pushMeta/save__team'].missing === 2, store['pushMeta/save__team']);
  clock += 3600000; await F.saveCheck();
  check('an hour later, same problem: no repeat', to('tok-vince').length === 1);
  // William opens the app with signal: his phone sends the two calls
  store['callDays/2026-11-24_uWill_18'] = { calls: { w1: callRec('L2', tW1, 'uWill'), w2: callRec('L3', tW2, 'uWill') } };
  clock += 3600000; await F.saveCheck();
  check('once saved: "Calls are saving again", once', to('tok-vince').length === 2 && to('tok-vince')[1].webpush.notification.title === 'Calls are saving again', to('tok-vince').map(x => x.webpush.notification.title));
  clock += 3600000; await F.saveCheck();
  check('and nothing more after that', to('tok-vince').length === 2);
  // overnight: found at 2 AM New York, sent at 8 AM
  store['leadChunks/c001'].leads.L8 = lead(new Date(Date.parse('2026-11-25T06:30:00Z')).toISOString(), 'uWill');
  clock = Date.parse('2026-11-25T07:10:00Z'); await F.saveCheck();
  check('found overnight: no 2 AM ping', to('tok-vince').length === 2);
  clock = Date.parse('2026-11-25T13:10:00Z'); await F.saveCheck();
  check('sent at 8 AM instead', to('tok-vince').length === 3 && /^William: 1 call didn't reach VPEX/.test(to('tok-vince')[2].webpush.notification.body), to('tok-vince').map(x => x.webpush.notification.body));
  check('it reads, and writes only its own note', Object.keys(store).filter(k => k.startsWith('pushMeta/')).length === 1);
  console.log('save_check: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
