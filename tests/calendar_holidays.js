// VPEX regression check (calendar_holidays): the Calendar marks holidays and flags follow-ups that land on a state's holiday ban.
//   Every federal holiday gets a ring marker (and "holiday" in the legend that month); Thanksgiving, Christmas and New Year's Day
//   (closed days that automatic follow-ups skip) also get a dashed frame. A holiday's agenda says which states ban sales calls on
//   it (the states with hol in STATE_HOURS) and how many of that day's items are for leads there; each such item says
//   "Holiday: no sales calls in PA that day". Normal days and leads in other states get nothing.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/calendar_holidays.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-11-27T16:30:00Z';   // Fri Nov 27, 11:30 AM in New York
// the states whose rules ban sales calls on federal holidays, straight from STATE_HOURS in index.html
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const BLOCK = SRC.slice(SRC.indexOf('var STATE_HOURS = {'), SRC.indexOf('};', SRC.indexOf('var STATE_HOURS = {')));
const BAN = [...BLOCK.matchAll(/^\s*([A-Z]{2}): \{[^\n]*\bhol: true/gm)].map(m => m[1]).sort();
const ev = (p, f, a) => p.evaluate(f, a);
function seed(add) {   // three demo leads get a state and a follow-up on/near Christmas
  const fs = JSON.parse(localStorage.getItem('__mockfs')); const keys = Object.keys(fs).filter(k => /leadChunks\/c/.test(k)); const ls = [];
  keys.forEach(k => Object.values(fs[k].leads || {}).forEach(l => ls.push([k, l])));
  const pick = ls.filter(x => x[1].stage !== 'Closed Lost').slice(0, 3);
  pick.forEach(([k, l], i) => {
    const a = add[i]; l.st = a.st; l.name = a.name;
    l.tasks = (l.tasks || []).concat([{ id: 'hx' + i, leadId: l.id, leadName: a.name, type: 'Call', priority: 'Medium', what: 'Follow-up call', due: a.day, dueAt: new Date(a.at).getTime(), done: false, assignee: l.owner }]);
    fs[k].leads[l.id] = l;
  });
  localStorage.setItem('__mockfs', JSON.stringify(fs));
}
const ADD = [{ st: 'PA', name: 'Holly Penn', day: '2026-12-25', at: '2026-12-25T15:00:00Z' }, { st: 'NY', name: 'Nora York', day: '2026-12-25', at: '2026-12-25T16:00:00Z' },
  { st: 'PA', name: 'Paul Penn', day: '2026-12-24', at: '2026-12-24T16:00:00Z' }];
function lum(c) {   // relative luminance of "rgb(...)" / "color(srgb ...)"
  let v = (/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c) || []).slice(1).map(Number);
  if (!v.length) v = (/rgba?\((\d+), (\d+), (\d+)/.exec(c) || []).slice(1).map(x => x / 255);
  const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  const br = await chromium.launch();
  check('STATE_HOURS has holiday-ban states', BAN.length >= 4 && BAN.includes('PA'), BAN);
  for (const c of [{ n: '390 dark', w: 390, s: 'dark' }, { n: '390 light', w: 390, s: 'light' }, { n: '1280 light', w: 1280, h: 800, s: 'light' }]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h || 844 }, isMobile: c.w < 500, hasTouch: c.w < 500, colorScheme: c.s, timezoneId: 'America/New_York' });
    await ctx.route(/gstatic\.com\/firebasejs|cloudfunctions|fonts\.g/, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(NOW) });
    await p.goto(BASE + '#demo-insurance'); await p.waitForTimeout(2500);
    await ev(p, seed, ADD); await p.reload(); await p.waitForTimeout(3500);
    await ev(p, () => document.querySelectorAll('.nt,.toast').forEach(x => x.remove()));
    const tag = c.n + ':';
    await ev(p, () => document.querySelector('#viewTabs [data-view="calendar"]').click()); await p.waitForTimeout(400);
    const cell = k => ev(p, k => { const b = document.querySelector('[data-cal-day="' + k + '"]'); return b ? { hol: b.classList.contains('hol'), closed: b.classList.contains('closed'), ring: !!b.querySelector('.cal-hm'), label: b.getAttribute('aria-label') } : null; }, k);
    const legend = () => ev(p, () => document.querySelector('.cal-legend').innerText);
    // November: Veterans Day marked, Thanksgiving marked and framed, an ordinary day not
    let x = await cell('2026-11-11'); check(tag + ' Nov 11 marked as Veterans Day, not a closed day', x && x.hol && x.ring && !x.closed && /Veterans Day/.test(x.label), x);
    x = await cell('2026-11-26'); check(tag + ' Thanksgiving marked and framed', x && x.hol && x.ring && x.closed && /Thanksgiving/.test(x.label), x);
    x = await cell('2026-11-27'); check(tag + ' an ordinary day is not marked', x && !x.hol && !x.ring && !x.closed, x);
    check(tag + ' legend explains the marker', /holiday/.test(await legend()), await legend());
    check(tag + ' today (no holiday) has no holiday note', await ev(p, () => !document.querySelector('.cal-hol-note')));
    // December
    await ev(p, () => document.querySelector('[data-cal-nav="1"]').click()); await p.waitForTimeout(300);
    x = await cell('2026-12-25'); check(tag + ' Christmas marked and framed', x && x.hol && x.ring && x.closed && /Christmas Day/.test(x.label), x);
    x = await cell('2026-12-24'); check(tag + ' Christmas Eve not marked', x && !x.hol && !x.ring, x);
    await ev(p, () => document.querySelector('[data-cal-day="2026-12-25"]').click()); await p.waitForTimeout(400);
    const d = await ev(p, () => {
      const v = document.querySelector('.cal-day-view'), n = v.querySelector('.cal-hol-note');
      const rows = [...v.querySelectorAll('.cal-item')].map(r => ({ name: (r.querySelector('.cal-name') || {}).textContent, warn: (r.querySelector('.cal-warn') || {}).textContent || '' }));
      const w = v.querySelector('.cal-warn'), bg = el => { while (el) { const b = getComputedStyle(el).backgroundColor; const al = /\/ ([\d.]+)\)|rgba\([^)]*, ([\d.]+)\)/.exec(b); if (b && !/transparent/.test(b) && !(al && +(al[1] || al[2]) < 0.5)) return b; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
      return { note: n ? n.innerText : null, rows, warnC: w ? getComputedStyle(w).color : null, warnBg: w ? bg(w) : null, noteC: n ? getComputedStyle(n).color : null, noteBg: n ? bg(n) : null,
        sw: document.documentElement.scrollWidth > innerWidth + 1, noteRight: n ? n.getBoundingClientRect().right <= innerWidth : false };
    });
    check(tag + ' Christmas agenda: note names the holiday and says floors are closed', d.note && /^Christmas Day\./.test(d.note) && /Most floors are closed; automatic follow-ups skip this day/.test(d.note), d.note);
    const st = BAN.length === 2 ? BAN.join(' and ') : BAN.slice(0, -1).join(', ') + ' and ' + BAN[BAN.length - 1];
    check(tag + ' note lists exactly the STATE_HOURS holiday-ban states', d.note && d.note.includes('No sales calls in ' + st + ' on this holiday.'), { note: d.note, st });
    check(tag + ' note counts the one item for a lead there', d.note && / 1 below is for a lead in those states\. Move it\./.test(d.note), d.note);
    const pa = d.rows.find(r => r.name === 'Holly Penn'), ny = d.rows.find(r => r.name === 'Nora York');
    check(tag + ' PA lead on Christmas is flagged', pa && pa.warn === 'Holiday: no sales calls in PA that day', d.rows);
    check(tag + ' NY lead on Christmas is not flagged', ny && !ny.warn, d.rows);
    check(tag + ' warning text readable (4.5:1)', d.warnC && ratio(d.warnC, d.warnBg) >= 4.5, { c: d.warnC, bg: d.warnBg, r: d.warnC && ratio(d.warnC, d.warnBg) });
    check(tag + ' note text readable (4.5:1)', d.noteC && ratio(d.noteC, d.noteBg) >= 4.5, { c: d.noteC, bg: d.noteBg });
    check(tag + ' no sideways scroll, note fits', !d.sw && d.noteRight, d);
    if (c.w === 390) await ev(p, () => document.querySelector('.cal-day-view').scrollIntoView());
    if (c.w === 390) await p.screenshot({ path: (process.env.OUT || '/tmp') + '/calendar_holidays_' + c.s + '.png', fullPage: false }).catch(() => {});
    // Christmas Eve: PA lead's follow-up is fine
    await ev(p, () => document.querySelector('[data-cal-day="2026-12-24"]').click()); await p.waitForTimeout(300);
    const e = await ev(p, () => ({ note: !!document.querySelector('.cal-hol-note'), rows: [...document.querySelectorAll('.cal-day-view .cal-item')].map(r => ({ name: (r.querySelector('.cal-name') || {}).textContent, warn: !!r.querySelector('.cal-warn') })) }));
    check(tag + ' Christmas Eve: no note, PA lead not flagged', !e.note && e.rows.some(r => r.name === 'Paul Penn' && !r.warn), e);
    // Veterans Day: states line without the closed-day line
    await ev(p, () => document.querySelector('[data-cal-nav="-1"]').click()); await p.waitForTimeout(300);
    await ev(p, () => document.querySelector('[data-cal-day="2026-11-11"]').click()); await p.waitForTimeout(300);
    const v = await ev(p, () => (document.querySelector('.cal-hol-note') || {}).innerText || '');
    check(tag + ' Veterans Day note: states, no closed-floor line', /^Veterans Day\./.test(v) && v.includes('No sales calls in ' + st) && !/Most floors/.test(v), v);
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
