// VPEX regression check (growth_hit): the server side of the funnel counter (functions/lib.js). No browser needed:
// node tests/growth_hit.js
const L = require('../functions/lib.js');
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };

const ok = L.parseHit(JSON.stringify({ e: 'visit', s: 'instagram', m: 'bio', c: 'w5', n: 'w5-reel-a', i: 'solar', d: 'm' }));
check('a normal visit parses', ok && ok.e === 'visit' && ok.s === 'instagram' && ok.n === 'w5-reel-a' && ok.i === 'solar' && ok.d === 'm', ok);
check('unknown steps are refused', L.parseHit('{"e":"purchase"}') === null);
check('junk is refused', L.parseHit('not json') === null && L.parseHit('[1,2]') === null && L.parseHit('null') === null && L.parseHit('') === null);
const dirty = L.parseHit(JSON.stringify({ e: 'demo', s: 'Insta<script>gram', m: 'B I O', c: 'x'.repeat(200), n: 'w5/reel.a?b', i: 'hacking', d: 'tablet' }));
check('values are cleaned: letters, numbers, - and _ only', dirty.s === 'insta-script-gram' && dirty.m === 'b-i-o' && dirty.n === 'w5-reel-a-b', dirty);
check('values are capped', dirty.c.length === 40 && dirty.s.length <= 24, dirty);
check('unknown industry and device are dropped', dirty.i === '' && dirty.d === '', dirty);
check('no source means direct', L.parseHit('{"e":"visit"}').s === 'direct');
check('extra fields are ignored', !('email' in L.parseHit('{"e":"visit","email":"a@b.c","name":"Pat"}')));
check('sign-up needs a real office name', L.parseHit('{"e":"signup"}') === null && L.parseHit('{"e":"signup","o":"../x"}') === null);
const su = L.parseHit('{"e":"signup","o":"harbor-insurance","s":"instagram","n":"w5-reel-a"}');
check('sign-up keeps the office', su && su.o === 'harbor-insurance', su);
check('every step is accepted', L.HIT_EVENTS.every(e => L.parseHit(JSON.stringify({ e, o: 'abc-office' }))), L.HIT_EVENTS);
const k = L.hitKey(ok), back = L.unHitKey(k);
check('counter key round-trips', back.e === 'visit' && back.s === 'instagram' && back.m === 'bio' && back.c === 'w5' && back.n === 'w5-reel-a' && back.i === 'solar' && back.d === 'm', { k, back });
check('counter key has no dots or slashes (safe as a field name)', !/[.\/]/.test(k) && !/[.\/]/.test(L.hitKey(dirty)), k);
const blank = L.unHitKey(L.hitKey(L.parseHit('{"e":"visit"}')));
check('empty parts come back empty', blank.m === '' && blank.n === '' && blank.i === '', blank);
// New York day: 03:30 UTC on Oct 21 is still Oct 20 in New York
check('day is New York time', L.nyDate(Date.UTC(2026, 9, 21, 3, 30)) === '2026-10-20' && L.nyDate(Date.UTC(2026, 9, 21, 5, 0)) === '2026-10-21');
const now = Date.UTC(2026, 9, 21, 12);
check('fresh office: created minutes ago', L.freshOffice({ createdAt: now - 5 * 60000 }, now));
check('not fresh: created yesterday', !L.freshOffice({ createdAt: now - 86400000 }, now));
check('not fresh: no date', !L.freshOffice({}, now) && !L.freshOffice(null, now));
check('only vpexdialer.com may send', L.HIT_ORIGINS.join() === 'https://vpexdialer.com,https://www.vpexdialer.com');
// Origin: only the site's own pages; a request with no Origin (a script) is refused.
check('origin: vpexdialer.com and www pass', L.hitOriginOk('https://vpexdialer.com') && L.hitOriginOk('https://www.vpexdialer.com'));
check('origin: missing, null or other sites refused', !L.hitOriginOk('') && !L.hitOriginOk(undefined) && !L.hitOriginOk('null') && !L.hitOriginOk('https://example.com') && !L.hitOriginOk('http://vpexdialer.com'));
// Daily cap on different counters
const full = new Set(); for (let i = 0; i < L.HIT_DAY_KEYS; i++) full.add('visit~junk' + i + '~-~-~-~-~-');
check('cap is well under the 1 MiB document (2,000 counters)', L.HIT_DAY_KEYS === 2000);
check('under the cap a new combination is kept as is', L.capHit(ok, new Set(['x'])) === ok);
const folded = L.capHit(ok, full);
check('past the cap a new combination counts as "other" (step, industry, device kept)', folded.e === 'visit' && folded.s === 'other' && folded.m === '' && folded.c === '' && folded.n === '' && folded.i === 'solar' && folded.d === 'm', folded);
const fullSeen = new Set(full); fullSeen.add(L.hitKey(ok));
check('past the cap a combination already seen today still counts as itself', L.capHit(ok, fullSeen) === ok);
const suF = L.capHit(su, full);
check('a folded sign-up keeps its office', suF.o === 'harbor-insurance' && suF.s === 'other', suF);
check('folded combinations are few (8 steps x 7 industries x 3 devices)', L.hitKey(folded) === 'visit~other~-~-~-~solar~m');

// The server function itself, with stand-ins for Firebase (no network).
(async () => {
  const Module = require('module'), store = {}; let reads = 0;
  let clock = Date.UTC(2026, 9, 30, 16, 0); Date.now = () => clock;   // fixed noon ET; the 1,200-a-minute limit is per minute
  const docRef = (p) => ({
    get: async () => { reads++; const d = store[p]; return { exists: !!d, get: (f) => d ? d[f] : undefined, data: () => d }; },
    set: async (v, o) => { const d = store[p] = store[p] || {}; for (const k in v) { if (k === 'c') { d.c = d.c || {}; for (const ck in v.c) d.c[ck] = (d.c[ck] || 0) + 1; } else if (k === 't') d.t = (d.t || 0) + 1; else d[k] = v[k]; } },
    create: async (v) => { if (store[p]) throw new Error('exists'); store[p] = v; } });
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => ({ doc: docRef, collection: () => ({}) }), { FieldValue: { increment: (n) => ({ inc: n }), serverTimestamp: () => 0, delete: () => null } }), messaging: () => ({}) };
  const handlers = {};
  const stubs = {
    'firebase-admin': fakeAdmin,
    'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: () => () => {} },
    'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (opts, fn) => fn, onCall: (opts, fn) => fn },
    'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load;
  Module._load = function (req, parent, isMain) { if (stubs[req]) return stubs[req]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  const call = async (origin, body, method) => { let code = 0; const res = { status(c) { code = c; return this; }, end() {} };
    await F.hit({ method: method || 'POST', get: (h) => h.toLowerCase() === 'origin' ? origin : undefined, rawBody: Buffer.from(body) }, res); return code; };
  clock -= 86400000;   // the day before, so this doesn't touch today's counters
  check('handler: the 1,201st beacon in a minute is refused (429)', await (async () => { let c = 0; for (let i = 0; i < 1201; i++) c = await call('https://vpexdialer.com', '{"e":"visit","s":"rate"}'); return c; })() === 429);
  clock += 86400000 + 61000; reads = 0;
  check('handler: a beacon from the site is counted (204)', await call('https://vpexdialer.com', '{"e":"visit","s":"instagram"}') === 204);
  check('handler: no Origin is refused (403)', await call(undefined, '{"e":"visit","s":"instagram"}') === 403);
  check('handler: another site is refused (403)', await call('https://example.com', '{"e":"visit"}') === 403);
  check('handler: junk is refused (400)', await call('https://vpexdialer.com', '{"e":"purchase"}') === 400);
  check('handler: GET is refused (405)', await call('https://vpexdialer.com', '', 'GET') === 405);
  const day = L.nyDate(Date.now()), doc = () => store['growth/days/items/' + day];
  check('handler: counted under its key', doc() && doc().c['visit~instagram~-~-~-~-~-'] === 1 && doc().t === 1, doc());
  for (let i = 0; i < L.HIT_DAY_KEYS + 50; i++) { if (i % 1000 === 0) clock += 61000; await call('https://www.vpexdialer.com', JSON.stringify({ e: 'visit', s: 'junk' + i })); }
  const keys = Object.keys(doc().c);
  check('handler: a flood of made-up sources stops at the cap (+ one "other")', keys.length === L.HIT_DAY_KEYS + 1 && doc().c['visit~other~-~-~-~-~-'] === 51, keys.length);
  check('handler: every beacon still counts in the day total', doc().t === 1 + L.HIT_DAY_KEYS + 50, doc().t);
  await call('https://vpexdialer.com', '{"e":"visit","s":"instagram"}');
  check('handler: a source seen earlier today still counts as itself past the cap', doc().c['visit~instagram~-~-~-~-~-'] === 2);
  check('handler: today\'s counters were read once, not per beacon', reads === 1, reads);
  console.log(`growth_hit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL handler test crashed', String(e && e.stack || e)); process.exit(1); });
