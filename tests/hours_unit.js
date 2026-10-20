// VPEX regression check (hours_unit): the app's own calling-hours code from index.html, run in Node against fixed clocks.
// Covers what the demo offices can't (their leads aren't in Sunday-ban or holiday states). Run: node tests/hours_unit.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function grab(re) { const m = re.exec(src); if (!m) throw new Error('not found: ' + re); let i = src.indexOf('{', m.index), d = 0, j = i; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(m.index, j + 1) + (/^\s*var /.test(m[0]) ? ';' : ''); }
const code = [/var STATE_HOURS = /, /var HOLIDAYS = /, /function usHolidays\(/, /function stateRule\(/, /function hourLabel\(/, /function dayWindow\(/, /function zonedParts\(/,
  /function zonedToUtc\(/, /function addBusinessDays\(/, /function slotAt\(/, /function slotCheck\(/, /function pad2\(/].map(r => r.source === 'var HOLIDAYS = ' ? 'var HOLIDAYS = {};' : grab(r)).join('\n');
const IANA = { TX: 'America/Chicago', PA: 'America/New_York', RI: 'America/New_York', AL: 'America/Chicago', LA: 'America/Chicago', CA: 'America/Los_Angeles', NY: 'America/New_York' };
const ctx = { Date, Intl, Math, Number, String, NOW: 0 };
vm.createContext(ctx);
vm.runInContext('var zpFmt = {}; function leadZone(l) { return { st: l.st, iana: IANA[l.st] || null }; } function leadIana(l) { return IANA[l.st]; }\n' + code.replace(/Date\.now\(\)/g, 'NOW'), Object.assign(ctx, { IANA }));
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const at = (iso) => new Date(iso).getTime();
const loc = (ts, z) => new Date(ts).toLocaleString('en-US', { timeZone: IANA[z], weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
ctx.NOW = at('2026-10-20T14:00:00Z');
const sc = (st, iso) => ctx.slotCheck({ st }, at(iso));
let r;
r = sc('NY', '2026-10-21T14:00:00Z'); check('NY Wed 10 AM ok', r.ok, r);
r = sc('NY', '2026-10-21T11:00:00Z'); check('NY Wed 7 AM: before calling hours (8 AM–9 PM), fix 8 AM same day', !r.ok && r.why === 'before calling hours (8 AM–9 PM)' && loc(r.fix, 'NY') === 'Wed, Oct 21, 8:00 AM', [r, loc(r.fix, 'NY')]);
r = sc('NY', '2026-10-22T01:30:00Z'); check('NY Wed 9:30 PM: after, fix Thu 8 AM', !r.ok && /^after /.test(r.why) && loc(r.fix, 'NY') === 'Thu, Oct 22, 8:00 AM', [r, loc(r.fix, 'NY')]);
r = sc('PA', '2026-10-25T18:00:00Z'); check('PA Sunday 2 PM: Sunday ban, fix Mon 9 AM', !r.ok && r.why === 'no sales calls on Sundays in PA' && loc(r.fix, 'PA') === 'Mon, Oct 26, 9:00 AM', [r, loc(r.fix, 'PA')]);
r = sc('PA', '2026-10-21T23:30:00Z'); check('PA Wed 7:30 PM: after PA hours (9 AM–7 PM)', !r.ok && r.why === 'after PA calling hours (9 AM–7 PM)', r);
r = sc('PA', '2026-10-17T23:30:00Z'); check('PA Sat Oct 17 7:30 PM: old rule (before Oct 18), ok', r.ok, r);
r = sc('RI', '2026-11-11T15:00:00Z'); check('RI Veterans Day: holiday, fix Thu 9 AM', !r.ok && /holiday/.test(r.why) && loc(r.fix, 'RI') === 'Thu, Nov 12, 9:00 AM', [r, loc(r.fix, 'RI')]);
r = sc('RI', '2026-10-24T14:30:00Z'); check('RI Saturday 10:30 AM ok (10–5 Saturdays)', r.ok, r);
r = sc('RI', '2026-10-24T13:30:00Z'); check('RI Saturday 9:30 AM: before, fix 10 AM', !r.ok && loc(r.fix, 'RI') === 'Sat, Oct 24, 10:00 AM', [r, loc(r.fix, 'RI')]);
r = sc('RI', '2026-10-24T22:00:00Z'); check('RI Saturday 6 PM: after, Sunday banned, fix Mon 9 AM', !r.ok && loc(r.fix, 'RI') === 'Mon, Oct 26, 9:00 AM', [r, loc(r.fix, 'RI')]);
r = sc('TX', '2026-10-25T15:00:00Z'); check('TX Sunday 10 AM: before TX hours (12 PM–9 PM), fix noon', !r.ok && r.why === 'before TX calling hours (12 PM–9 PM)' && loc(r.fix, 'TX') === 'Sun, Oct 25, 12:00 PM', [r, loc(r.fix, 'TX')]);
r = sc('AL', '2026-12-25T18:00:00Z'); check('AL Christmas: holiday', !r.ok && /holiday/.test(r.why), r);
r = ctx.slotCheck({ st: '' }, at('2026-10-21T11:00:00Z')); check('unknown location: no check', r === null, r);
// slotAt skips banned holidays in AL/LA/RI (Tue Nov 10 -> next business day would be Veterans Day)
ctx.NOW = at('2026-11-10T16:00:00Z');
const s1 = ctx.slotAt({ st: 'RI' }, 1, 10); check('slotAt RI: skips Veterans Day to Thu 10 AM', loc(s1, 'RI') === 'Thu, Nov 12, 10:00 AM', loc(s1, 'RI'));
const s2 = ctx.slotAt({ st: 'AL' }, 1, 16); check('slotAt AL: skips Veterans Day to Thu 4 PM', loc(s2, 'AL') === 'Thu, Nov 12, 4:00 PM', loc(s2, 'AL'));
const s3 = ctx.slotAt({ st: 'NY' }, 1, 10); check('slotAt NY: Veterans Day stays (federal rule has no holiday ban)', loc(s3, 'NY') === 'Wed, Nov 11, 10:00 AM', loc(s3, 'NY'));
const s4 = ctx.slotAt({ st: 'TX' }, 2, 10); check('slotAt TX: 2 business days', loc(s4, 'TX') === 'Thu, Nov 12, 10:00 AM', loc(s4, 'TX'));
ctx.NOW = at('2026-12-23T16:00:00Z');
const s5 = ctx.slotAt({ st: 'LA', }, 2, 10); check('slotAt LA from Wed Dec 23, 2 days: Christmas skipped to Mon Dec 28', loc(s5, 'AL') === 'Mon, Dec 28, 10:00 AM', loc(s5, 'AL'));
console.log(`hours_unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
