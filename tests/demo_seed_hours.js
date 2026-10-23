// VPEX regression check (demo_seed_hours). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/demo_seed_hours.js
// The demo offices' seeded follow-ups and appointments land inside each lead's calling hours, whatever time a visitor opens the demo
// (before, a demo opened at night showed follow-ups like "3:04 AM MA their time"). The Tasks card's lead name is a 44 px tap target.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const OFFICES = ['insurance', 'realestate', 'mca', 'auto', 'solar'];
// Rep clock (zone, instant). Fri Oct 23 2026 3:30 AM / 11:30 AM / 8:45 PM in New York, Sun Oct 25 7:00 AM in New York, Fri 6:00 AM in Los Angeles.
const CLOCKS = [['America/New_York', '2026-10-23T07:30:00Z'], ['America/New_York', '2026-10-23T15:30:00Z'], ['America/New_York', '2026-10-24T00:45:00Z'],
  ['America/New_York', '2026-10-25T11:00:00Z'], ['America/Los_Angeles', '2026-10-23T13:00:00Z']];
// The demo states' published hours (index.html STATE_HOURS for FL and TX; the federal 8 AM–9 PM for the rest).
const ZN = { NY: 'America/New_York', NJ: 'America/New_York', FL: 'America/New_York', MA: 'America/New_York', GA: 'America/New_York', TX: 'America/Chicago', IL: 'America/Chicago', CA: 'America/Los_Angeles', AZ: 'America/Phoenix', CO: 'America/Denver' };
function allowed(st, ts) {
  const o = {}; new Intl.DateTimeFormat('en-US', { timeZone: ZN[st], hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date(ts)).forEach(p => { o[p.type] = p.value; });
  const h = (Number(o.hour) % 24) + Number(o.minute) / 60;
  const w = st === 'FL' ? [8, 20] : st === 'TX' ? (o.weekday === 'Sun' ? [12, 21] : [9, 21]) : [8, 21];
  return { ok: h >= w[0] && h < w[1], at: o.weekday + ' ' + o.hour + ':' + o.minute + ' ' + st };
}
async function open(br, office, c, zone, at) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: zone });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(at) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
  await page.goto(BASE + '#demo-' + office); await page.waitForTimeout(1600);
  return { ctx, page, errs };
}
(async () => {
  const br = await chromium.launch();
  // 1. The seeded data, at every clock, in every office
  for (const o of OFFICES) for (const [zone, at] of CLOCKS) {
    const tag = o + '@' + zone.split('/')[1] + ' ' + at;
    const { ctx, page, errs } = await open(br, o, { w: 390, s: 'dark' }, zone, at);
    const d = await page.evaluate(() => {
      const fs = JSON.parse(localStorage.getItem('__mockfs') || '{}'), tasks = [], appts = [];
      Object.keys(fs).filter(k => /^leadChunks\/c/.test(k)).forEach(k => Object.values(fs[k].leads || {}).forEach(L => {
        (L.tasks || []).forEach(t => { if (!t.done) tasks.push({ st: L.st, dueAt: t.dueAt, due: t.due }); });
        if (L.handoff && L.handoff.apptAt) appts.push({ st: L.st, at: L.handoff.apptAt });
      }));
      return { tasks, appts, now: Date.now() };
    });
    const badT = d.tasks.filter(t => !allowed(t.st, t.dueAt).ok).map(t => allowed(t.st, t.dueAt).at);
    const badA = d.appts.filter(a => !allowed(a.st, a.at).ok).map(a => allowed(a.st, a.at).at);
    check(tag + ' seeded follow-ups (' + d.tasks.length + ') all inside the lead’s calling hours', d.tasks.length >= 10 && !badT.length, badT.slice(0, 4));
    check(tag + ' seeded appointments all inside the lead’s calling hours', !badA.length, badA.slice(0, 4));
    check(tag + ' due date matches the due time', d.tasks.every(t => t.due === new Date(t.dueAt).toISOString().slice(0, 10)));
    check(tag + ' still a mix of late and upcoming follow-ups', d.tasks.some(t => t.dueAt < d.now - 86400000) && d.tasks.some(t => t.dueAt > d.now));
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  // 2. The Tasks tab at night: what the visitor sees, and the lead name's tap area
  for (const o of OFFICES) for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const tag = o + '/' + c.n;
    const { ctx, page, errs } = await open(br, o, c, 'America/New_York', CLOCKS[0][1]);
    check(tag + ' late follow-ups pill still on Dial', /Call \d+ late follow-up/.test(await page.evaluate(() => document.body.innerText)));
    await page.evaluate(() => document.querySelector('[data-view="tasks"]').click()); await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector('[data-tscope="all"]'); if (b) b.click(); }); await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const dues = [...document.querySelectorAll('.task-due')].map(e => e.textContent);
      const n = document.querySelector('.task-lead-name.linkish'); n.scrollIntoView({ block: 'center' });
      const b = n.getBoundingClientRect(), x = b.left + b.width / 2;
      const hit = y => { const e = document.elementFromPoint(x, y); return !!e && (e === n || n.contains(e)); };
      return { dues, h: Math.round(b.height), top: hit(b.top + b.height / 2 - 21), bot: hit(b.top + b.height / 2 + 21), sw: document.documentElement.scrollWidth, vw: innerWidth };
    });
    const night = r.dues.filter(t => { const m = t.match(/(\d+):\d+ (AM|PM) [A-Z]{2} their time/) || t.match(/(\d+):\d+ (AM|PM)/); if (!m) return false; /* no "their time": same zone as the rep (New York) */ const h = Number(m[1]) % 12 + (m[2] === 'PM' ? 12 : 0); return h < 8 || h >= 21; });
    check(tag + ' Tasks shows follow-ups', r.dues.length >= 5, r.dues.length);
    check(tag + ' no follow-up at night in the lead’s time', !night.length, night.slice(0, 3));
    check(tag + ' lead name answers a tap 21 px above and below its middle (44 px)', r.top && r.bot, r);
    check(tag + ' no sideways overflow', r.sw <= r.vw, r);
    // the extra tap area doesn't cover the Mark done box
    const box = await page.evaluate(() => { const k = document.querySelector('.task-check'); const b = k.getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!e && (e === k || k.contains(e)); });
    check(tag + ' Mark done box still answers its own tap', box);
    const name = await page.evaluate(() => document.querySelector('.task-lead-name.linkish').textContent);
    const nb = await page.locator('.task-lead-name.linkish').first().boundingBox();
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2 + 19); await page.waitForTimeout(500);
    check(tag + ' tap just under the name opens that lead', await page.evaluate(n => document.getElementById('leadModal').classList.contains('show') && document.getElementById('leadModal').innerText.indexOf(n) >= 0, name));
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('demo_seed_hours: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
