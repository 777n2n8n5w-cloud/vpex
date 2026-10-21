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
console.log(`growth_hit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
