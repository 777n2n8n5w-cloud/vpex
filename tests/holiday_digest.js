// VPEX regression check (holiday_digest). Node only: node tests/holiday_digest.js
// The weekday morning summary push names follow-ups in states that ban sales calls on a federal holiday (STATE_HOURS hol:
// AL, LA, PA, RI): the day before ("Thanksgiving is tomorrow … Call your 3 leads there today."), on Friday for a Monday
// holiday, and on the day ("… leave your 2 leads there for tomorrow."). The server's holiday list, holiday states, lead
// state reading and state list must equal the app's (index.html), and the push goes out even when only those are waiting.
const fs = require('fs'), path = require('path'), Module = require('module');
const L = require('../functions/lib.js');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const at = (iso) => Date.parse(iso), NY = 'America/New_York', LA = 'America/Los_Angeles';

// ---- the same rules as the app ----
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const grab = (name) => { const i = html.indexOf('function ' + name + '('); let d = 0, j = html.indexOf('{', i); for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}' && !--d) break; } return html.slice(i, j + 1); };
const zi = html.indexOf('var ZONE_OF = {};'), ze = html.indexOf('})();', zi) + 5;
const app = new Function(html.slice(zi, ze) + '\nvar ' + html.slice(html.indexOf('STATE_HOURS = {'), html.indexOf('};', html.indexOf('STATE_HOURS = {')) + 2) + '\n' +
  grab('holidayNames') + '\n' + grab('leadState') + '\nreturn { ZONE_OF, STATE_HOURS, holidayNames, leadState };')();
let same = true;
for (let y = 2026; y <= 2034; y++) if (JSON.stringify(app.holidayNames(y)) !== JSON.stringify(L.holidayNames(y))) { same = false; console.log('year', y); }
check('holiday list (names, observed days) = the app\'s, 2026-2034', same);
const appHol = Object.keys(app.STATE_HOURS).filter(k => app.STATE_HOURS[k].hol || (app.STATE_HOURS[k].before && app.STATE_HOURS[k].before.hol)).sort();
check('holiday-ban states = STATE_HOURS hol', JSON.stringify(appHol) === JSON.stringify(Object.keys(L.HOL_STATES).sort()), appHol);
check('state codes = the app\'s ZONE_OF', JSON.stringify(Object.keys(app.ZONE_OF).sort()) === JSON.stringify(Object.keys(L.ZONE_STATES).sort()));
const notes = ['Pittsburgh PA 15201', 'p.2 | 12 Main St, Mobile, AL 36602', 'Email: a@b.co | Austin TX', 'Bought in pa | Erie, PA', 'call after 5 | ok',
  'Providence RI 02903 | alt: 555-0100', 'Monroe la', 'LA', 'Short note PA ok', 'Baton Rouge, LA 70801 | p.4', '', 'Meet at ME office', 'Dallas tx'];
let rd = true;
notes.forEach(n => { const a = app.leadState({ notes: n }), b = L.leadSt({ notes: n }); if (a !== b) { rd = false; console.log(JSON.stringify(n), a, b); } });
check('lead state read from notes like the app', rd);
check('saved st wins', L.leadSt({ st: 'RI', notes: 'Austin TX' }) === 'RI' && L.leadSt({ st: '', notes: 'Erie PA' }) === '');
check('Thanksgiving 2026 is Thu Nov 26', L.holidayOn('2026-11-26') === 'Thanksgiving' && !L.holidayOn('2026-11-27'));
check('Christmas 2027 observed Fri Dec 24', L.holidayOn('2027-12-24') === 'Christmas Day (observed)');

// ---- counting ----
const task = (uid, iso, note) => ({ id: 't' + Math.random(), type: 'Call', note: note || 'Call back', dueAt: at(iso), assignee: { uid } });
const lead = (name, notes, tasks, extra) => Object.assign({ name, notes, owner: { uid: 'uMiaChen' }, tasks }, extra || {});
const chunks = [{ leads: {
  a: lead('Pat Lee', 'Erie, PA 16501', [task('uMiaChen', '2026-11-25T15:00:00Z')]),                       // today, PA
  b: lead('Ann Cole', 'Mobile AL', [task('uMiaChen', '2026-11-26T16:00:00Z')]),                            // on the holiday, AL
  c: lead('Rui Sousa', 'Pittsburgh PA', [task('uMiaChen', '2026-11-24T15:00:00Z'), task('uMiaChen', '2026-11-25T18:00:00Z')]),  // late + today: one lead
  d: lead('Tom Gray', 'Austin TX', [task('uMiaChen', '2026-11-25T15:00:00Z')]),                            // TX: no ban
  e: lead('Bo Hart', 'Erie PA', [task('uMiaChen', '2026-11-27T15:00:00Z')]),                               // after the holiday
  f: lead('Al Done', 'Erie PA', [Object.assign(task('uMiaChen', '2026-11-25T15:00:00Z'), { done: true })]),
  g: lead('Dee Enc', 'Erie PA', [task('uMiaChen', '2026-11-25T15:00:00Z')], { dnc: true }),
  h: lead('Jo Other', 'Erie PA', [task('uJordanL', '2026-11-25T15:00:00Z')]),                              // someone else's
  i: lead('Appt Only', 'Erie PA', [task('uMiaChen', '2026-11-26T15:00:00Z', 'Appointment with Sam')]),     // appointments aren't follow-ups
  j: lead('Ray Ives', 'x', [task('uMiaChen', '2026-11-25T20:00:00Z')], { st: 'RI' }) } }];
const wed = at('2026-11-25T13:30:00Z');   // Wed 8:30 AM New York, Thanksgiving tomorrow
let h = L.holidayHeads(chunks, 'uMiaChen', wed, NY);
check('day before: tomorrow, Thanksgiving', h && h.when === 'tomorrow' && h.name === 'Thanksgiving' && h.ymd === '2026-11-26', h);
check('counts the rep\'s own open follow-ups due by the end of the holiday, in ban states, each lead once', h && h.n === 4, h);
check('states by count', h && JSON.stringify(h.states) === '["PA","AL","RI"]', h && h.states);
const line = L.holidayLine(h);
check('line', line === 'Thanksgiving is tomorrow: no sales calls in PA, AL and RI then. Call your 4 leads there today.', line);
let c = L.digestCounts(chunks, 'uMiaChen', wed, NY); c.hol = h;
let m = L.digestMessage('Mia Chen', c, 'harbor-ins', NY);
check('push body adds the line and still ends with Tap to start dialing', m && m.body === c.waiting + ' follow-ups waiting (' + c.today + ' new today). ' + line + ' Tap to start dialing.', m && m.body);
check('nothing else waiting: still sent for the holiday', (() => { const x = L.digestMessage('Mia Chen', { waiting: 0, today: 0, appts: 0, hol: h }, '', NY); return x && x.body === line + ' Tap to start dialing.' && x.title === 'Good morning, Mia'; })());
check('appointment only + holiday', (() => { const x = L.digestMessage('Mia', { waiting: 0, today: 0, appts: 1, firstAppt: at('2026-11-25T15:30:00Z'), hol: h }, '', NY); return x && x.body === '1 appointment today, first at 10:30 AM. ' + line + ' Tap to start dialing.'; })());
check('no holiday: message unchanged', L.digestMessage('Mia', { waiting: 2, today: 1, appts: 0 }, '', NY).body === '2 follow-ups waiting (1 new today). Tap to start dialing.' &&
  L.digestMessage('Mia', { waiting: 0, today: 0, appts: 1, firstAppt: at('2026-11-25T15:30:00Z') }, '', NY).body === '1 appointment today, first at 10:30 AM.');
check('one lead wording', L.holidayLine({ when: 'tomorrow', name: 'Christmas Day', n: 1, states: ['PA'] }) === 'Christmas Day is tomorrow: no sales calls in PA then. Call your 1 lead there today.');
const thu = at('2026-11-26T13:30:00Z');
h = L.holidayHeads(chunks, 'uMiaChen', thu, NY);
check('on the day: today, only what\'s due by tonight', h && h.when === 'today' && h.n === 4, h);   // a, b, c, j (all late or due today)
check('on the day line', L.holidayLine(h) === 'Thanksgiving: no sales calls in PA, AL and RI today, so leave your 4 leads there for tomorrow.', L.holidayLine(h));
c = L.digestCounts(chunks, 'uMiaChen', thu, NY); c.hol = h; m = L.digestMessage('Mia', c, '', NY);
check('on the day body', m && /AM\. Thanksgiving: no sales calls in PA, AL and RI today, so leave your 4 leads there for tomorrow\. Tap to start dialing\.$/.test(m.body), m && m.body);
check('Tue Nov 24: nothing (2 days ahead)', L.holidayHeads(chunks, 'uMiaChen', at('2026-11-24T13:30:00Z'), NY) === null);
check('Fri Nov 27: nothing', L.holidayHeads(chunks, 'uMiaChen', at('2026-11-27T13:30:00Z'), NY) === null);
check('other rep with no ban-state leads: nothing', L.holidayHeads(chunks, 'uNobody', wed, NY) === null);
check('Los Angeles rep at 8:30 their time', (L.holidayHeads(chunks, 'uMiaChen', at('2026-11-25T16:30:00Z'), LA) || {}).when === 'tomorrow');
// Friday before Martin Luther King Jr. Day (Mon Jan 18, 2027)
const mlk = [{ leads: { a: lead('Pat Lee', 'Erie PA', [task('uMiaChen', '2027-01-18T15:00:00Z')]), b: lead('Lu Ng', 'Mobile AL', [task('uMiaChen', '2027-01-19T15:00:00Z')]) } }];
h = L.holidayHeads(mlk, 'uMiaChen', at('2027-01-15T13:30:00Z'), NY);
check('Friday before a Monday holiday', h && h.when === 'Monday' && h.name === 'Martin Luther King Jr. Day' && h.n === 1, h);
check('Friday line', L.holidayLine(h) === 'Martin Luther King Jr. Day is Monday: no sales calls in PA then. Call your 1 lead there today.', L.holidayLine(h));
check('Thursday before MLK: nothing', L.holidayHeads(mlk, 'uMiaChen', at('2027-01-14T13:30:00Z'), NY) === null);
// Christmas 2026 is Friday: Thursday Dec 24 morning says tomorrow
h = L.holidayHeads([{ leads: { a: lead('Pat Lee', 'Erie PA', [task('uMiaChen', '2026-12-24T15:00:00Z')]) } }], 'uMiaChen', at('2026-12-24T13:30:00Z'), NY);
check('Christmas Eve: Christmas Day is tomorrow', h && h.when === 'tomorrow' && h.name === 'Christmas Day', h);

// ---- the server function with stand-ins ----
(async () => {
  const store = {}, sent = [];
  let clock = wed; const realNow = Date.now; Date.now = () => clock;
  const snap = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, get: (f) => d ? d[f] : undefined, data: () => d }; };
  const docRef = (p) => ({ get: async () => snap(p), create: async (v) => { if (store[p]) { const e = new Error('6 ALREADY_EXISTS: exists'); e.code = 6; throw e; } store[p] = v; } });
  const coll = (cn, filters) => ({ where(f, op, v) { return coll(cn, (filters || []).concat([[f, op, v]])); }, limit() { return this; },
    get: async () => { const pre = cn + '/'; const docs = Object.keys(store).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).filter(k => (filters || []).every(([f, op, v]) => {
      const val = f === '__id__' ? k.slice(pre.length) : (store[k] || {})[f]; return op === '==' ? val === v : op === '>=' ? val >= v : op === '<=' ? val <= v : true; })).map(snap);
      return { empty: !docs.length, size: docs.length, docs }; } });
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => ({ doc: docRef, collection: (x) => coll(x) }), { FieldPath: { documentId: () => '__id__' }, FieldValue: { increment: (n) => n } }),
    messaging: () => ({ sendEach: async (b) => { b.forEach(x => sent.push(x)); return { responses: b.map(() => ({ success: true })) }; } }) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: (o, fn) => fn }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => fn }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load;
  Module._load = function (req) { if (stubs[req]) return stubs[req]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  const O = 'offices/harbor-ins/';
  store['offices/harbor-ins'] = { name: 'Harbor Insurance Group', plan: 'paid', paidThrough: wed + 20 * 864e5 };
  store[O + 'members/uMiaChen'] = { name: 'Mia Chen', role: 'rep', active: true };
  store[O + 'members/uJordanL'] = { name: 'Jordan Lee', role: 'rep', active: true };
  store['pushTokens/t1'] = { uid: 'uMiaChen', office: 'harbor-ins', token: 'tok-mia', tz: NY };
  store['pushTokens/t2'] = { uid: 'uJordanL', office: 'harbor-ins', token: 'tok-jordan', tz: NY };
  // Mia: only a follow-up due on Thanksgiving for a PA lead (nothing due today); Jordan: one TX follow-up today
  store[O + 'leadChunks/c001'] = { leads: {
    a: lead('Pat Lee', 'Erie, PA 16501', [task('uMiaChen', '2026-11-26T16:00:00Z')]),
    d: lead('Tom Gray', 'Austin TX', [task('uJordanL', '2026-11-25T15:00:00Z')], { owner: { uid: 'uJordanL' } }) } };
  store[O + 'leadChunks/_team'] = { script: {} };
  await F.morningDigest();
  const mia = sent.find(x => x.token === 'tok-mia'), jo = sent.find(x => x.token === 'tok-jordan');
  check('server: Mia gets a push for the holiday alone', mia && mia.webpush.notification.body === 'Thanksgiving is tomorrow: no sales calls in PA then. Call your 1 lead there today. Tap to start dialing.', mia && mia.webpush.notification.body);
  check('server: title and tag unchanged', mia && mia.webpush.notification.title === 'Good morning, Mia' && mia.webpush.notification.tag === 'vpex-digest');
  check('server: Jordan (TX only) gets the plain summary', jo && jo.webpush.notification.body === '1 follow-up waiting. Tap to start dialing.', jo && jo.webpush.notification.body);
  const n = sent.length; await F.morningDigest();
  check('server: once a day', sent.length === n);
  Date.now = realNow;
  console.log('holiday_digest: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
