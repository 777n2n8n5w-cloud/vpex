// VPEX regression check (offhours_tasks). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/offhours_tasks.js
// Tasks: upcoming follow-ups that land outside the lead's calling hours (a holiday or Sunday ban in their state, too early
// or late their time) get a banner with one tap to move each to the first allowed time, with Undo. Also: Pipeline's
// "N need a next step" answers a 44 px tap and the keyboard; dates step by calendar day across clock changes.
// Part 1 runs the app's own functions in Node (the demos have no holiday-state leads); part 2 the demos in Chromium.
process.env.TZ = 'America/New_York';
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function grab(re) { const m = re.exec(src); if (!m) throw new Error('not found: ' + re); let i = src.indexOf('{', m.index), d = 0, j = i; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(m.index, j + 1) + (/^\s*var /.test(m[0]) ? ';' : ''); }
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const at = (iso) => new Date(iso).getTime();
const IANA = { TX: 'America/Chicago', PA: 'America/New_York', RI: 'America/New_York', AL: 'America/Chicago', CA: 'America/Los_Angeles', NY: 'America/New_York' };
const loc = (ts, z) => new Date(ts).toLocaleString('en-US', { timeZone: IANA[z], weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// ---------- part 1: the app's functions ----------
{
  const code = [/var STATE_HOURS = /, /function usHolidays\(/, /function stateRule\(/, /function hourLabel\(/, /function dayWindow\(/, /function zonedParts\(/,
    /function zonedToUtc\(/, /function slotCheck\(/, /function pad2\(/, /function tasksOffHours\(/, /function hoursFixAt\(/, /function localDateStr\(/,
    /function shiftDays\(/, /function dayLabel\(/, /function dayStart\(/, /function weekStart\(/].map(grab).join('\n');
  const ctx = { Date, Intl, Math, Number, String, NOW: 0, IANA, LEADS: {}, DNC: {} };
  vm.createContext(ctx);
  vm.runInContext('var zpFmt = {}, HOLIDAYS = {}; function leadZone(l) { return { st: l.st, iana: IANA[l.st] || null }; } function leadMap() { return LEADS; } function isDnc(l) { return !!DNC[l.id]; }\n' +
    code.replace(/Date\.now\(\)/g, 'NOW').replace(/new Date\(\)/g, 'new Date(NOW)'), ctx);
  ctx.NOW = at('2026-11-08T14:00:00Z');   // Sun Nov 8, 9 AM New York
  const L = (id, st) => (ctx.LEADS[id] = { id, st, name: 'Lead ' + id });
  ['pa', 'pa2', 'pa3', 'ny', 'ri', 'ri2', 'tx', 'ca', 'dnc', 'unk'].forEach(id => L(id, { pa: 'PA', pa2: 'PA', pa3: 'PA', ny: 'NY', ri: 'RI', ri2: 'RI', tx: 'TX', ca: 'CA', dnc: 'NY', unk: '' }[id]));
  ctx.DNC.dnc = 1;
  const T = (id, lead, iso, extra) => Object.assign({ id, leadId: lead, type: 'Call', dueAt: at(iso), due: '' }, extra || {});
  const tasks = [
    T('t1', 'pa', '2026-11-11T15:00:00Z'),                   // PA Veterans Day 10 AM
    T('t2', 'pa2', '2026-11-15T19:00:00Z'),                  // PA Sunday 2 PM
    T('t3', 'pa3', '2026-11-12T01:00:00Z'),                  // PA Wed Nov 11 8 PM (holiday and after 7 PM)
    T('t4', 'ny', '2026-11-10T11:30:00Z'),                   // NY Tue 6:30 AM
    T('t5', 'ri', '2026-11-14T23:00:00Z'),                   // RI Sat 6 PM (after Saturday's 10-5)
    T('t6', 'ri2', '2026-11-15T23:00:00Z'),                  // RI Sunday 6 PM: Monday closes at 6 PM, so Monday 9 AM
    T('t7', 'tx', '2026-11-15T16:00:00Z'),                   // TX Sunday 10 AM: before noon
    T('ok1', 'ca', '2026-11-10T18:00:00Z'),                  // CA Tue 10 AM: fine
    T('ok2', 'ny', '2026-11-11T15:00:00Z'),                  // NY on Veterans Day: no state holiday ban
    T('pin', 'pa', '2026-11-11T15:00:00Z', { pinned: true }), // the lead picked it
    T('mail', 'pa', '2026-11-11T15:00:00Z', { type: 'Email' }),
    T('docs', 'pa', '2026-11-11T15:00:00Z', { type: 'Docs' }),
    T('done', 'pa', '2026-11-11T15:00:00Z', { done: true }),
    T('past', 'ny', '2026-11-08T08:00:00Z'),                 // already late: not this banner's business
    T('dnc', 'dnc', '2026-11-10T11:30:00Z'),
    T('unk', 'unk', '2026-11-10T11:30:00Z'),
    T('notime', 'pa', '2026-11-11T15:00:00Z', { dueAt: null, due: '2026-11-11' }),
  ];
  const out = ctx.tasksOffHours(tasks, ctx.NOW), by = {};
  out.forEach(x => (by[x.t.id] = x));
  check('unit: exactly the 7 off-hours follow-ups', Object.keys(by).sort().join() === 't1,t2,t3,t4,t5,t6,t7', Object.keys(by));
  const want = { t1: ['PA', 'Thu, Nov 12, 10:00 AM', /holiday/], t2: ['PA', 'Mon, Nov 16, 2:00 PM', /Sundays/], t3: ['PA', 'Thu, Nov 12, 9:00 AM', /holiday/],
    t4: ['NY', 'Tue, Nov 10, 8:00 AM', /before calling hours/], t5: ['RI', 'Mon, Nov 16, 9:00 AM', /after RI calling hours/],
    t6: ['RI', 'Mon, Nov 16, 9:00 AM', /Sundays/], t7: ['TX', 'Sun, Nov 15, 12:00 PM', /before TX calling hours/] };
  Object.keys(want).forEach(k => { const x = by[k]; check('unit: ' + k + ' moves to ' + want[k][1] + ' (' + want[k][0] + ' time)', x && loc(x.to, want[k][0]) === want[k][1] && want[k][2].test(x.c.why) && x.c.st === want[k][0], x && [loc(x.to, want[k][0]), x.c.why]); });
  out.forEach(x => { const c = ctx.slotCheck(x.l, x.to); check('unit: ' + x.t.id + ' new time is inside hours', c && c.ok, c); check('unit: ' + x.t.id + ' new time is later', x.to > x.t.dueAt); });
  // calendar days: the spring-forward day is 23 hours long, the fall-back day 25
  ctx.NOW = at('2027-03-15T03:30:00Z');   // Sun Mar 14 2027, 11:30 PM EDT (clocks went forward that morning)
  check('dayLabel: Mon Mar 15 is Tomorrow at 11:30 PM on the spring-forward Sunday', ctx.dayLabel(new Date(2027, 2, 15, 9)) === 'Tomorrow', ctx.dayLabel(new Date(2027, 2, 15, 9)));
  check('dayLabel: Tue Mar 16 is not Tomorrow', ctx.dayLabel(new Date(2027, 2, 16, 9)) !== 'Tomorrow');
  ctx.NOW = at('2026-11-02T05:30:00Z');   // Mon Nov 2 2026, 12:30 AM EST (the day after fall back)
  check('dayLabel: Sun Nov 1 is Yesterday at 12:30 AM after the fall-back Sunday', ctx.dayLabel(new Date(2026, 10, 1, 9)) === 'Yesterday', ctx.dayLabel(new Date(2026, 10, 1, 9)));
  ctx.NOW = at('2026-11-04T15:00:00Z');   // Wed Nov 4 10 AM EST: last week started Mon Oct 26 at midnight EDT, not 1 AM
  const lwFrom = ctx.shiftDays(ctx.weekStart(), -7), lwTo = ctx.shiftDays(ctx.NOW, -7);
  check('coach: last week starts Mon Oct 26 00:00 (calendar days)', new Date(lwFrom).toString().indexOf('Mon Oct 26 2026 00:00:00') === 0, new Date(lwFrom).toString());
  check('coach: this point last week is Wed Oct 28 10:00 AM', new Date(lwTo).toString().indexOf('Wed Oct 28 2026 10:00:00') === 0, new Date(lwTo).toString());
  check('source: no 24-hour steps left in dayLabel, the coach or the scoreboard', !/Date\.now\(\) [+-] 86400000\)\)\) return "(Tomorrow|Yesterday)"/.test(src) && !/lwFrom = ws - 7 \* 86400000/.test(src) && !/localDateStr\(new Date\(Date\.now\(\) \+ 86400000\)\)/.test(src));
}

// ---------- part 2: the demos ----------
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
const NOW = '2026-11-09T15:00:00Z';   // Mon Nov 9, 10:00 AM in New York
(async () => {
  const br = await chromium.launch();
  const sizes = [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'dark' }];
  for (const o of ['insurance', 'solar', 'mca']) for (const c of sizes) {
    if (o !== 'insurance' && c.n !== 'p-dark') continue;
    const tag = o + '/' + c.n;
    const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date(NOW) });
    await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await page.goto(BASE + '#demo-' + o); await page.waitForTimeout(2500);
    const tasks = async () => { await page.evaluate(() => document.querySelector('[data-view="tasks"]').click()); await page.waitForTimeout(400); };
    const read = () => page.evaluate(() => {
      const b = document.querySelector('.tk-offhours'), btn = document.getElementById('tkOffHours'), r = btn && btn.getBoundingClientRect();
      const lum = c => { const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
      const bgOf = el => { while (el) { const c = getComputedStyle(el).backgroundColor; const a = c.match(/[\d.]+/g); if (a && (a[3] === undefined || +a[3] > .9)) return c; el = el.parentElement; } return 'rgb(255,255,255)'; };
      const con = el => { const L1 = lum(getComputedStyle(el).color), L2 = lum(bgOf(el)); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
      const tags = [...document.querySelectorAll('.task-due .tk-wait')].filter(x => x.textContent === 'outside their calling hours').length;
      return { shown: !!b, text: b ? b.innerText : '', btnH: r && r.height, btnW: r && r.width, conB: b ? con(b.querySelector('b')) : 0, conS: b ? con(b.querySelector('span')) : 0,
        tags, sw: document.documentElement.scrollWidth, vw: innerWidth, inView: b ? b.getBoundingClientRect().right <= innerWidth : true };
    });
    await tasks();
    let s = await read();
    check(tag + ' demo seed: no off-hours banner (seeded follow-ups are inside hours)', !s.shown, s.text);
    // a rep books Tuesday 5:30 AM their time for the first lead (outside every US lead's hours) past the warning
    await page.evaluate(() => document.getElementById('addTaskBtn').click()); await page.waitForTimeout(300);
    const leadName = await page.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
      const sel = document.getElementById('taskLeadSelect'); set('taskTypeSelect', 'Call'); set('taskDueInput', '2026-11-10'); set('taskTimeInput', '05:30');
      document.getElementById('taskNoteInput').value = 'offhours-test'; const n = sel.options[sel.selectedIndex].text; document.getElementById('submitTask').click(); return n; });
    await page.waitForTimeout(500);
    s = await read();
    check(tag + ' banner after booking 5:30 AM', s.shown && /^1 upcoming follow-up lands outside calling hours\./.test(s.text), s.text);
    check(tag + ' banner names the lead, state and their time', s.text.indexOf(leadName + ' (') >= 0 && /\([A-Z]{2}\): Tue \d+:30 AM, before (?:[A-Z]{2} )?calling hours/.test(s.text) && /Move it to the first allowed time\./.test(s.text), s.text);
    check(tag + ' Move it button 44 px', s.btnH >= 44 && s.btnW >= 44, s);
    check(tag + ' banner text contrast >= 4.5', s.conB >= 4.5 && s.conS >= 4.5, { b: s.conB, s: s.conS });
    check(tag + ' the row is tagged', s.tags === 1, s.tags);
    check(tag + ' no sideways scroll', s.sw <= s.vw && s.inView, s);
    if (o === 'insurance' && c.n !== 'p-light') await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/offhours-' + c.n + '.png' });
    const dueBefore = await page.evaluate(() => { const r = [...document.querySelectorAll('.task-item')].find(x => /offhours-test/.test(x.innerText)); return r && r.querySelector('.task-due').innerText; });
    await page.evaluate(() => document.getElementById('tkOffHours').click()); await page.waitForTimeout(400);
    s = await read();
    const after = await page.evaluate(() => ({ body: document.body.innerText }));
    const dueAfter = await page.evaluate(() => { const r = [...document.querySelectorAll('.task-item')].find(x => /offhours-test/.test(x.innerText)); return r && r.querySelector('.task-due').innerText; });
    check(tag + ' Move it: banner gone, toast', !s.shown && /Moved 1 follow-up into calling hours/.test(after.body), s.text);
    check(tag + ' the follow-up moved off 5:30 AM to an hour on the dot', dueBefore && /5:30/.test(dueBefore) && dueAfter && !/5:30/.test(dueAfter) && /\d:00/.test(dueAfter), [dueBefore, dueAfter]);
    check(tag + ' no tag left on the row', s.tags === 0, s.tags);
    // Undo puts it back
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Undo'); if (b) b.click(); }); await page.waitForTimeout(400);
    s = await read();
    check(tag + ' Undo: back at 5:30 AM with the banner', s.shown && /^1 upcoming/.test(s.text), s.text);
    // Pipeline: "N need a next step" answers a tap 20 px above/below its middle on touch, and Enter
    await page.evaluate(() => document.querySelector('[data-view="pipeline"]').click()); await page.waitForTimeout(400);
    const pw = await page.evaluate(() => { const w = document.querySelector('.pipe-summary .warn'); if (!w) return null; w.scrollIntoView({ block: 'center' }); const r = w.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = dy => { const e = document.elementFromPoint(x, y + dy); return !!(e && (e === w || w.contains(e))); };
      return { h: r.height, mid: hit(0), up: hit(-20), down: hit(20), role: w.getAttribute('role'), tab: w.tabIndex }; });
    check(tag + ' need-a-next-step is a button', pw && pw.role === 'button' && pw.tab === 0, pw);
    if (c.w < 500) check(tag + ' need-a-next-step answers taps 20 px above and below (44 px)', pw && pw.mid && pw.up && pw.down, pw);
    else check(tag + ' need-a-next-step: no extra frame for the mouse', pw && pw.mid && !pw.up && !pw.down, pw);
    await page.evaluate(() => document.querySelector('.pipe-summary .warn').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const pf = await page.evaluate(() => { const a = document.querySelector('[data-pipe-f].active'); return a && a.getAttribute('data-pipe-f'); });
    check(tag + ' Enter filters to No next step', pf === 'none', pf);
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`offhours_tasks: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
