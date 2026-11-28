// VPEX regression check (demo_closed_days): the demo offices don't put calls, follow-ups or appointments on Thanksgiving,
//   Christmas or New Year's Day. Automatic follow-ups skip those days and the Calendar frames them as closed, so the demo's
//   seeded history shows no calls on them, and a seeded follow-up or closer appointment that would land on one moves off it
//   (earlier if overdue, later if upcoming), still inside the lead's calling hours. Other days keep their calls.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/demo_closed_days.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const CLOSED = ['2026-11-26', '2026-12-25', '2027-01-01'];
const ZN = { NY: 'America/New_York', NJ: 'America/New_York', FL: 'America/New_York', MA: 'America/New_York', GA: 'America/New_York', TX: 'America/Chicago', IL: 'America/Chicago', CA: 'America/Los_Angeles', AZ: 'America/Phoenix', CO: 'America/Denver' };
const ymdIn = (ts, z) => new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
const partsIn = (ts, z) => { const o = {}; new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', hour: '2-digit', weekday: 'short' }).formatToParts(new Date(ts)).forEach(q => { o[q.type] = q.value; }); return { h: Number(o.hour) % 24, wd: o.weekday }; };
// Each clock puts a closed day where the old seed used to land something: overdue follow-ups (2 days back), upcoming ones (1 and 3 days
// ahead), closer appointments (1 to 3 days after a recent call) and two weeks of call history.
const CLOCKS = [
  { n: 'Sat Nov 28 (Thanksgiving 2 days back)', t: '2026-11-28T15:00:00Z', o: 'insurance' },
  { n: 'Thu Dec 24 (Christmas tomorrow)', t: '2026-12-24T15:00:00Z', o: 'realestate' },
  { n: 'Tue Dec 29 (Christmas last Friday)', t: '2026-12-29T15:00:00Z', o: 'mca' },
  { n: 'Thu Dec 31 (New Year’s Day tomorrow)', t: '2026-12-31T15:00:00Z', o: 'solar' },
  { n: 'Mon Dec 21 (Christmas Friday)', t: '2026-12-21T15:00:00Z', o: 'auto' },
];

(async () => {
  const br = await chromium.launch();
  for (const k of CLOCKS) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark', timezoneId: 'America/New_York' });
    await ctx.route(/gstatic\.com\/firebasejs|cloudfunctions|fonts\.g/, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date(k.t) });
    await p.goto(BASE + '#demo-' + k.o); await p.waitForTimeout(2500);
    const fs = await p.evaluate(() => JSON.parse(localStorage.getItem('__mockfs')));
    const tag = k.n + ':';
    const now = Date.parse(k.t);
    // call history
    const perDay = {};
    Object.keys(fs).filter(x => /^callDays\/\d{4}-\d\d-\d\d$/.test(x)).forEach(x => { perDay[x.slice(9)] = Object.keys(fs[x].calls || {}).length; });
    const onClosed = Object.keys(perDay).filter(d => CLOSED.includes(d) && perDay[d]);
    check(tag + ' no seeded calls on a closed day', !onClosed.length, onClosed.map(d => d + ':' + perDay[d]));
    const busy = Object.keys(perDay).filter(d => perDay[d] > 20).length;
    check(tag + ' other weekdays keep their calls (8+ busy days)', busy >= 8, perDay);
    // follow-ups and appointments
    const leads = []; Object.keys(fs).filter(x => /^leadChunks\/c\d+$/.test(x)).forEach(x => Object.values(fs[x].leads).forEach(l => leads.push(l)));
    const items = [];
    leads.forEach(l => {
      (l.tasks || []).forEach(t => { if (!t.done) items.push({ w: 'follow-up', at: t.dueAt, due: t.due, st: l.st, nm: l.name }); });
      if (l.handoff && l.handoff.apptAt) items.push({ w: 'appointment', at: l.handoff.apptAt, st: l.st, nm: l.name });
    });
    check(tag + ' seeded follow-ups and appointments exist', items.filter(i => i.w === 'follow-up').length >= 10 && items.some(i => i.w === 'appointment'), items.length);
    const bad = items.filter(i => CLOSED.includes(ymdIn(i.at, ZN[i.st])));
    check(tag + ' none on Thanksgiving, Christmas or New Year’s Day (lead’s time)', !bad.length, bad.map(i => i.w + ' ' + i.nm + ' ' + i.st + ' ' + new Date(i.at).toISOString()));
    const outHours = items.filter(i => { const q = partsIn(i.at, ZN[i.st]); return !(q.h >= (q.wd === 'Sun' ? 12 : 9) && q.h < 20); });
    check(tag + ' all inside the lead’s calling hours', !outHours.length, outHours.map(i => i.nm + ' ' + new Date(i.at).toISOString()));
    check(tag + ' follow-up due dates match their times', items.filter(i => i.w === 'follow-up').every(i => i.due === new Date(i.at).toISOString().slice(0, 10)));
    // the Calendar agrees: a closed day in this month has nothing on it
    await p.evaluate(() => document.querySelectorAll('.nt,.toast').forEach(x => x.remove()));
    await p.evaluate(() => document.querySelector('#viewTabs [data-view="calendar"]').click()); await p.waitForTimeout(500);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Everyone/.test(x.textContent.trim())); if (b) b.click(); }); await p.waitForTimeout(400);
    const cal = await p.evaluate(() => [...document.querySelectorAll('.cal-day.closed:not(.other)')].map(d => ({ k: d.dataset.calDay, n: ({}).x || '', l: d.getAttribute('aria-label') })));
    check(tag + ' Calendar shows a closed day this month', cal.length >= 1, cal);
    check(tag + ' closed days on the Calendar carry no to-dos', cal.every(d => !/\d+ scheduled/.test(d.l)), cal);
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`demo_closed_days: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
