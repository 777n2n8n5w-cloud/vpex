// VPEX regression check (lead_in): live leads from a website form, Zapier, Make or a Google Sheet (functions/ leadIn).
// The pure parts (functions/lib.js) and the server function itself with stand-ins for Firebase (no network):
// key checks, JSON / web form / lists, cleaning, Do Not Call and duplicates skipped, the record the app reads,
// alerts to the right reps, paused offices, rate limit. No browser needed: node tests/lead_in.js
const L = require('../functions/lib.js'), crypto = require('crypto');
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const SECRET = crypto.randomBytes(32).toString('hex'), KEY = 'vk_acme_' + SECRET, TEAMKEY = 'vk__' + SECRET.split('').reverse().join('');
// ---- pure parts ----
check('key: office and secret', JSON.stringify(L.leadInKey(KEY)) === JSON.stringify({ office: 'acme', secret: SECRET }));
check('key: the original team (no office)', L.leadInKey(TEAMKEY) && L.leadInKey(TEAMKEY).office === '');
check('key: junk refused', !L.leadInKey('') && !L.leadInKey('vk_acme_123') && !L.leadInKey('vk_ACME_' + SECRET) && !L.leadInKey('vk_acme/../x_' + SECRET) && !L.leadInKey(KEY + 'a'));
check('hash compare: same / different / junk', L.sameHash(L.sha256hex('a'), L.sha256hex('a')) && !L.sameHash(L.sha256hex('a'), L.sha256hex('b')) && !L.sameHash('', '') && !L.sameHash(null, L.sha256hex('a')));
check('phone: US formats', ['2125550199', '(212) 555-0199', '+1 212 555 0199', '1-212-555-0199', '212.555.0199 ext 4'].every(p => L.liPhone(p) && L.liPhone(p).phone === '+12125550199'));
check('phone: junk refused', ['', '555-0199', '0125550199', '2120550199', '44 20 7946 0958', 'call me'].every(p => !L.liPhone(p)));
check('parse: one JSON lead', L.leadInParse('application/json', '{"name":"Pat"}').length === 1);
check('parse: a list, or {leads: [...]}', L.leadInParse('application/json', '[{"a":1},{"b":2}]').length === 2 && L.leadInParse('', '{"leads":[{"a":1},{"b":2},{"c":3}]}').length === 3);
check('parse: a web form', (x => x && x[0].first_name === 'Pat' && x[0].phone === '212 555 0199')(L.leadInParse('application/x-www-form-urlencoded', 'first_name=Pat&phone=212+555+0199')));
check('parse: junk, empty, over 100 refused', !L.leadInParse('application/json', 'nope') && !L.leadInParse('application/json', '[]') && !L.leadInParse('application/json', JSON.stringify(Array(101).fill({ a: 1 }))));
const now = Date.UTC(2026, 10, 9, 15, 0);
let c = L.leadInClean({ first_name: 'Pat', last_name: 'Lee', 'Phone Number': '(212) 555-0199', Email: 'PAT@Example.com ', state: 'new york', message: 'Wants a quote', 'Coverage amount': '$250,000', utm_source: 'facebook', gclid: 'x', key: 'secret' }, now, 'ab12cd');
check('clean: name from first + last', c.lead.name === 'Pat Lee', c.lead);
check('clean: phone stored like an uploaded lead', c.lead.phone === '+12125550199' && c.lead.phoneRaw === '(212) 555-0199' && c.key === 'n2125550199');
check('clean: email lower-cased, state as its abbreviation', c.lead.email === 'pat@example.com' && c.lead.st === 'NY', c.lead);
check('clean: message + other fields in the notes, tracking tags and the key left out', c.lead.notes === 'Wants a quote | Coverage amount: $250,000' && !/secret|facebook|gclid/.test(c.lead.notes), c.lead.notes);
check('clean: a new lead at the top of the list, list "Web leads"', c.lead.stage === 'New Lead' && c.lead.status === 'pending' && c.lead.front === true && c.lead.source === 'Web leads' && c.lead.addedAt === now && c.lead.web.at === now);
check('clean: id safe as a field name', /^w[a-z0-9]+$/.test(c.id), c.id);
check('clean: list from the form', L.leadInClean({ name: 'A B', phone: '2125550100', list: 'Facebook <ads>!' }, now, 'x').lead.source === 'Facebook ads');
check('clean: no name → "Web lead"; bad email dropped; unknown state dropped', (l => l.name === 'Web lead' && !l.email && !l.st)(L.leadInClean({ phone: '2125550100', email: 'nope', state: 'Narnia' }, now, 'x').lead));
check('clean: no phone → error', L.leadInClean({ name: 'A' }, now, 'x').error === 'phone');
check('clean: honeypot filled → spam', L.leadInClean({ name: 'A', phone: '2125550100', honeypot: 'http://x' }, now, 'x').error === 'spam');
check('clean: long values cut', L.leadInClean({ name: 'N'.repeat(300), phone: '2125550100', notes: 'x'.repeat(5000) }, now, 'x').lead.notes.length <= 1500);
check('recipients: the list\'s reps when assigned', L.leadInRecipients([{ uid: 'rep111', active: true }, { uid: 'rep222', active: true }, { uid: 'adm333', active: true }], { 'Web leads': { reps: ['rep222'] } }, 'Web leads').map(m => m.uid).join() === 'rep222');
check('recipients: everyone active otherwise', L.leadInRecipients([{ uid: 'rep111', active: true }, { uid: 'rep222', active: false }], {}, 'Web leads').map(m => m.uid).join() === 'rep111');
check('message: one lead', (m => m.title === 'New lead: Pat Lee' && /Web leads · Tap to call now/.test(m.body) && m.link === 'https://vpexdialer.com/?o=acme&open=' + c.id)(L.leadInMessage('acme', [c])));
check('message: several', /^3 new leads$/.test(L.leadInMessage('acme', [c, c, c]).title));
check('record: today\'s, then a new one at 250', L.leadInChunk('20261109', {}) === 'w_20261109' && L.leadInChunk('20261109', { w_20261109: 250 }) === 'w_20261109_2' && L.leadInChunk('20261109', { w_20261109: 249 }) === 'w_20261109');

// ---- the server function, with stand-ins for Firebase ----
(async () => {
  const Module = require('module'), store = {}, sent = [];
  let clock = now; Date.now = () => clock;
  const deep = (a, b) => { for (const k in b) { const v = b[k]; if (v && v.__inc) a[k] = (a[k] || 0) + v.__inc; else if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') deep(a[k], v); else a[k] = JSON.parse(JSON.stringify(v === undefined ? null : v)); } return a; };
  const snap = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, get: f => d ? d[f] : undefined, data: () => d, ref: docRef(p) }; };
  const docRef = (p) => ({ get: async () => snap(p), set: async (v, o) => { store[p] = o && o.merge && store[p] ? deep(store[p], v) : deep({}, v); }, delete: async () => { delete store[p]; } });
  const col = (p, filt) => ({ get: async () => { const docs = Object.keys(store).filter(k => k.startsWith(p + '/') && k.slice(p.length + 1).indexOf('/') < 0).map(snap).filter(s => !filt || filt(s)); return { docs, empty: !docs.length, size: docs.length }; },
    where: (f, op, v) => col(p, s => s.get(f) === v), limit: () => col(p, filt) });
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => ({ doc: docRef, collection: (p) => col(p) }), { FieldValue: { increment: (n) => ({ __inc: n }), delete: () => null } }),
    messaging: () => ({ sendEach: async (b) => { b.forEach(m => sent.push(m)); return { responses: b.map(() => ({ success: true })) }; } }) };
  const stubs = { 'firebase-admin': fakeAdmin,
    'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: () => () => {} }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => fn }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load; Module._load = function (r) { if (stubs[r]) return stubs[r]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  const call = async (body, o = {}) => { let code = 0, json = null; const res = { status(c) { code = c; return this; }, json(j) { json = j; return this; }, end() {} };
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    await F.leadIn({ method: o.method || 'POST', query: o.query || {}, get: h => ({ 'x-vpex-key': o.key, 'content-type': o.ct || 'application/json' })[h.toLowerCase()], rawBody: Buffer.from(raw) }, res); return { code, json }; };
  // an open office with two reps (one assigned to "Facebook ads"), a lead already on the list and a number on Do Not Call
  store['offices/acme'] = { plan: 'trial', trialEnds: now + 5 * 86400000, locked: false };
  store['offices/acme/leadChunks/_team'] = { leadIn: { h: L.sha256hex(SECRET), at: now - 1000 }, lists: { 'Facebook ads': { reps: ['rep222'] } }, script: { steps: [] } };
  store['offices/acme/leadChunks/_dnc'] = { nums: { n2125550144: { at: 1 } } };
  store['offices/acme/leadChunks/c001'] = { leads: { l1: { name: 'Old Lead', phone: '+12125550111', phoneRaw: '212-555-0111' } } };
  ['adm111', 'rep222', 'rep333'].forEach(u => { store['offices/acme/members/' + u] = { active: true, role: u === 'adm111' ? 'admin' : 'rep' }; store['pushTokens/t' + u] = { uid: u, token: 'tok-' + u }; });
  store['offices/acme/members/rep444'] = { active: false, role: 'rep' }; store['pushTokens/trep444'] = { uid: 'rep444', token: 'tok-rep444' };
  let r = await call({ name: 'Pat Lee', phone: '212-555-0199' }, { key: 'vk_acme_' + 'f'.repeat(64) });
  check('server: wrong key refused (401) and nothing written', r.code === 401 && !Object.keys(store).some(k => k.includes('/w_')), r);
  r = await call({ name: 'Pat Lee', phone: '212-555-0199' }, {});
  check('server: no key refused (401)', r.code === 401);
  r = await call('', { key: KEY, method: 'GET' });
  check('server: GET refused (405)', r.code === 405);
  r = await call('not json', { key: KEY });
  check('server: junk refused (400)', r.code === 400 && /No leads found/.test(r.json.error), r);
  r = await call({ name: 'Pat Lee', phone: '212-555-0199', state: 'NJ', notes: 'From the website' }, { key: KEY });
  const day = L.nyDate(now).replace(/-/g, ''), rec = () => store['offices/acme/leadChunks/w_' + day];
  check('server: a lead with the key in the header is added (200, added 1)', r.code === 200 && r.json.ok && r.json.added === 1, r);
  const id1 = rec() && Object.keys(rec().leads)[0], l1 = id1 && rec().leads[id1];
  check('server: saved in today\'s web-lead record the app listens to', !!l1 && l1.name === 'Pat Lee' && l1.st === 'NJ' && l1.front === true && l1.source === 'Web leads' && Array.isArray(l1.tasks), l1);
  check('server: counted on the office (last, n)', store['offices/acme/leadChunks/_team'].leadIn.n === 1 && store['offices/acme/leadChunks/_team'].leadIn.last === now && store['offices/acme/leadChunks/_team'].leadIn.h === L.sha256hex(SECRET));
  check('server: other office settings untouched', !!store['offices/acme/leadChunks/_team'].script && !!store['offices/acme/leadChunks/_team'].lists);
  const toks = sent.map(m => m.token).sort().join();
  check('server: "New lead" alert to every active login (no list assigned)', toks === 'tok-adm111,tok-rep222,tok-rep333', toks);
  check('server: the alert names the lead and opens it', sent[0].webpush.notification.title === 'New lead: Pat Lee' && sent[0].data.link === 'https://vpexdialer.com/?o=acme&open=' + id1 && sent[0].data.leadId === id1, sent[0]);
  sent.length = 0;
  r = await call({ name: 'Pat Again', phone: '(212) 555-0199' }, { key: KEY });
  check('server: same number again → duplicate, not added', r.code === 200 && r.json.added === 0 && r.json.duplicate === 1 && Object.keys(rec().leads).length === 1 && !sent.length, r.json);
  r = await call([{ name: 'Old', phone: '2125550111' }, { name: 'Blocked', phone: '2125550144' }, { name: 'No phone' }, { name: 'Sam Ortiz', phone: '2125550177', list: 'Facebook ads' }, { name: 'Twice', phone: '2125550188' }, { name: 'Twice', phone: '2125550188' }], { key: KEY });
  check('server: a list: 2 added, duplicates (on file and in the batch), Do Not Call and a missing phone skipped', r.json.added === 2 && r.json.duplicate === 2 && r.json.doNotCall === 1 && r.json.invalid === 1 && r.json.errors[0].index === 2, r.json);
  check('server: alert for a list assigned to one rep goes only to that rep', sent.filter(m => /Sam Ortiz/.test(m.webpush.notification.title)).map(m => m.token).join() === 'tok-rep222', sent.map(m => [m.token, m.webpush.notification.title]));
  sent.length = 0;
  r = await call('first_name=Dana&last_name=Price&phone=212+555+0122&email=dana%40example.com&key=' + KEY, { ct: 'application/x-www-form-urlencoded' });
  check('server: a plain web form with the key as a field', r.code === 200 && r.json.added === 1 && Object.values(rec().leads).some(l => l.name === 'Dana Price' && l.email === 'dana@example.com' && !/vk_/.test(l.notes)), r.json);
  r = await call({ name: 'Q Key', phone: '2125550133' }, { query: { key: KEY } });
  check('server: key in the address (?key=) works too', r.code === 200 && r.json.added === 1);
  // a lead marked Do Not Call on its own record counts too
  store['offices/acme/leadChunks/c001'].leads.l2 = { name: 'Marked', phone: '+12125550155', dnc: { at: 1 } };
  r = await call({ name: 'Marked', phone: '2125550155' }, { key: KEY });
  check('server: a lead marked Do Not Call on the list is skipped', r.json.doNotCall === 1 && r.json.added === 0, r.json);
  // the original team: root records, no office check
  store['leadChunks/_team'] = { leadIn: { h: L.sha256hex(L.leadInKey(TEAMKEY).secret) } }; store['members/v1'] = { active: true }; store['pushTokens/tv1'] = { uid: 'v1x0000', token: 'tok-v' };
  r = await call({ name: 'Team Lead', phone: '2125550166' }, { key: TEAMKEY });
  check('server: the original team\'s key adds to its own records', r.code === 200 && r.json.added === 1 && store['leadChunks/w_' + day] && Object.values(store['leadChunks/w_' + day].leads)[0].name === 'Team Lead');
  check('server: the office key can\'t write to the original team and vice versa', (await call({ name: 'X', phone: '2125550170' }, { key: 'vk__' + SECRET })).code === 401 && (await call({ name: 'X', phone: '2125550171' }, { key: 'vk_acme_' + L.leadInKey(TEAMKEY).secret })).code === 401);
  // a paused office
  store['offices/acme'].locked = true;
  r = await call({ name: 'Paused', phone: '2125550181' }, { key: KEY });
  check('server: paused office refused (403)', r.code === 403 && /paused/.test(r.json.error));
  store['offices/acme'].locked = false;
  // turning live leads off (no leadIn on the office) → old key stops
  const saved = store['offices/acme/leadChunks/_team'].leadIn; delete store['offices/acme/leadChunks/_team'].leadIn;
  check('server: after Turn off the key stops working', (await call({ name: 'Off', phone: '2125550182' }, { key: KEY })).code === 401);
  store['offices/acme/leadChunks/_team'].leadIn = saved;
  // rate limit: 300 leads a minute per office
  clock += 120000;
  const many = Array.from({ length: 100 }, (_, i) => ({ name: 'Bulk ' + i, phone: '646555' + String(1000 + i).slice(-4) }));
  const codes = []; for (let i = 0; i < 4; i++) codes.push((await call(many.map((x, j) => ({ name: x.name, phone: '7' + String(18 + i).padStart(2, '0') + '555' + String(1000 + j).slice(-4) })), { key: KEY })).code);
  check('server: 300 leads a minute, then 429', codes.join() === '200,200,200,429', codes);
  check('server: too big a request refused (413)', (await call(JSON.stringify({ name: 'x', notes: 'y'.repeat(120000), phone: '2125550199' }), { key: KEY })).code === 413);
  check('server: no web-lead record over 350 leads', Object.keys(store).filter(k => k.startsWith('offices/acme/leadChunks/w_')).every(k => Object.keys(store[k].leads).length <= 350), Object.keys(store).filter(k => k.includes('/w_')).map(k => Object.keys(store[k].leads).length));
  console.log(`lead_in: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', String(e && e.stack || e)); process.exit(1); });
