// VPEX regression check (calendar): the Calendar tab and the faster, simpler Pipeline and Tasks.
//   Calendar: the month with a count on each day, today picked; a day's agenda lists exactly that day's follow-ups and
//   appointments (by time), today also lists what's still open from earlier days; tap a day, page months, Today, arrow
//   keys; Done / Move / Edit work from the agenda and show on the Tasks tab too; + Add opens a follow-up on that day.
//   Pipeline: each stage shows 20 then "Show all", the leads that need you first; a list of 4,000 leads opens quickly.
//   Tasks: rows are Call / Move / Edit; Delete lives in Edit.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/calendar.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-11-25T16:20:00Z';   // Wed Nov 25, 11:20 AM in New York
async function open(br, c, inflate) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h || 844 }, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  await ctx.route(/gstatic\.com\/firebasejs|cloudfunctions|fonts\.g/, r => r.abort());
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);
  if (inflate) { await page.evaluate(inflateFs, inflate); await page.reload(); await page.waitForTimeout(5000); }
  await page.evaluate(() => document.querySelectorAll('.nt,.toast').forEach(x => x.remove()));
  return { ctx, page, errs };
}
// N more leads in the in-page office, a third with follow-ups, spread over the stages
function inflateFs(N) {
  const fs = JSON.parse(localStorage.getItem('__mockfs')); const base = [];
  Object.keys(fs).filter(k => /leadChunks\/c/.test(k)).forEach(k => Object.values(fs[k].leads || {}).forEach(l => base.push(l)));
  const ST = ['Qualified', 'Pitched', 'Objection', 'Committed', 'New Lead', 'New Lead', 'Closed Lost'], now = Date.now();
  let made = 0, ci = 3;
  while (made < N) {
    const leads = {};
    for (let j = 0; j < 250 && made < N; j++, made++) {
      const b = base[made % base.length], id = 'bx' + made, st = ST[made % ST.length], tasks = [];
      for (let t = 0; t < made % 3; t++) { const at = now + ((made * 7 + t * 13) % 40 - 10) * 3600000 * 6; tasks.push({ id: 'bt' + made + '_' + t, leadId: id, leadName: b.name, type: 'Call', priority: 'Medium', due: new Date(at).toISOString().slice(0, 10), dueAt: at, done: false, auto: t > 0, assignee: b.owner }); }
      leads[id] = Object.assign({}, b, { id, name: b.name + ' ' + made, stage: st, amount: st === 'New Lead' ? 0 : 5000 + (made % 50) * 1000, tasks, texts: [] });
    }
    fs['leadChunks/c' + String(ci++).padStart(3, '0')] = { leads };
  }
  localStorage.setItem('__mockfs', JSON.stringify(fs));
}
const ev = (page, f, a) => page.evaluate(f, a);
const view = async (page, v) => { await ev(page, v => document.querySelector('#viewTabs [data-view="' + v + '"]').click(), v); await page.waitForTimeout(300); };
// what the office's records say is due on a day (everyone's, as the demo admin sees it), straight from the in-page database
const expected = (page, day) => ev(page, day => {
  const fs = JSON.parse(localStorage.getItem('__mockfs')), loc = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  let open = 0, late = 0, appts = 0; const today = loc(Date.now());
  Object.keys(fs).filter(k => /leadChunks\/c/.test(k)).forEach(k => Object.values(fs[k].leads || {}).forEach(l => {
    (l.tasks || []).forEach(t => { const key = t.due || (t.dueAt ? loc(t.dueAt) : ''); if (!key || t.done) return; if (key === day) open++; if (key < today) late++; });
    if (l.handoff && l.handoff.apptAt && loc(l.handoff.apptAt) === day) appts++;
  }));
  return { open, late, appts };
}, day);
const agenda = page => ev(page, () => {
  const v = document.querySelector('.cal-day-view'); if (!v) return null;
  const groups = [...v.querySelectorAll('.cal-group:not(.done)')];
  return {
    head: v.querySelector('h3').innerText, sub: v.querySelector('.cal-day-head p').innerText,
    late: (v.querySelector('.cal-group.late') || { querySelectorAll: () => [] }).querySelectorAll('.cal-item').length,
    lateN: +((v.querySelector('.cal-group.late h4 span') || {}).textContent || 0),
    day: groups.filter(g => !g.classList.contains('late')).reduce((a, g) => a + g.querySelectorAll('.cal-item').length, 0),
    appts: v.querySelectorAll('.cal-group:not(.late) .cal-item.appt').length,
    times: groups.filter(g => !g.classList.contains('late')).flatMap(g => [...g.querySelectorAll('.cal-item')].map(i => i.querySelector('.cal-time').innerText)),
    sel: (document.querySelector('.cal-day.sel') || {}).getAttribute ? document.querySelector('.cal-day.sel').getAttribute('data-cal-day') : null,
    title: (document.querySelector('.cal-title') || {}).innerText
  };
});
const toMin = t => { const m = /(\d+):(\d+) (AM|PM)/.exec(t); return m ? (+m[1] % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2] : -1; };

(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: 'phone', w: 390 }, { n: 'computer', w: 1440, h: 900 }]) {
    const { ctx, page, errs } = await open(br, c);
    const tag = c.n + ':';
    check(tag + ' Calendar tab is there', await ev(page, () => !!document.getElementById('viewTabCalendar')));
    await view(page, 'calendar');
    let a = await agenda(page), want = await expected(page, '2026-11-25');
    check(tag + ' opens on this month with today picked', a && a.title === 'November 2026' && a.sel === '2026-11-25' && a.head === 'Today', a);
    check(tag + ' today lists every follow-up and appointment due today', a.day === want.open + want.appts && a.appts === want.appts && want.open + want.appts > 0, { a, want });
    check(tag + ' and what is still open from earlier days', a.lateN === want.late && a.late === Math.min(5, want.late), { a, want });
    check(tag + ' in time order (anytime first)', a.times.filter(t => t !== 'Anytime').map(toMin).every((m, i, x) => !i || x[i - 1] <= m), a.times);
    // each day's count on the month matches what that day lists
    const cells = await ev(page, () => [...document.querySelectorAll('.cal-day')].map(d => ({ k: d.getAttribute('data-cal-day'), n: +((d.querySelector('.cal-c:not(.done)') || {}).textContent || 0) })));
    const busy = cells.filter(x => x.n && x.k > '2026-11-25');
    check(tag + ' upcoming days carry a count', busy.length >= 2, cells.filter(x => x.n));
    for (const d of busy.slice(0, 3)) {
      await page.locator('[data-cal-day="' + d.k + '"]').click(); await page.waitForTimeout(150);
      a = await agenda(page); want = await expected(page, d.k);
      check(tag + ' ' + d.k + ': the day lists what its count says, and only that', a.sel === d.k && a.day === d.n && a.day === want.open + want.appts && a.late === 0, { a, d, want });
    }
    // months and Today
    await page.locator('[data-cal-nav="1"]').click(); await page.waitForTimeout(150);
    check(tag + ' next month', (await agenda(page)).title === 'December 2026');
    await page.locator('[data-cal-nav="-1"]').click(); await page.locator('[data-cal-nav="-1"]').click(); await page.waitForTimeout(150);
    check(tag + ' back two months', (await agenda(page)).title === 'October 2026');
    await page.locator('[data-cal-today]').click(); await page.waitForTimeout(150);
    a = await agenda(page);
    check(tag + ' Today brings it back', a.title === 'November 2026' && a.sel === '2026-11-25', a);
    // keyboard: arrows move a day or a week
    await page.locator('.cal-day.sel').focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
    a = await agenda(page);
    check(tag + ' arrow keys move the day (and keep focus on it)', a.sel === '2026-12-03' && a.title === 'December 2026' && await ev(page, () => document.activeElement && document.activeElement.getAttribute('data-cal-day')) === '2026-12-03', a);
    await page.locator('[data-cal-today]').click(); await page.waitForTimeout(150);
    // Done from the agenda: off the open list, onto Done, and the Tasks tab agrees
    const first = await ev(page, () => { const it = [...document.querySelectorAll('.cal-group:not(.late):not(.done) .cal-item:not(.appt)')][0]; return it && { name: it.querySelector('.cal-name').innerText, id: it.querySelector('[data-toggle-task]').getAttribute('data-toggle-task') }; });
    const before = await agenda(page);
    await page.locator('.cal-group:not(.late):not(.done) .cal-item:not(.appt) [data-toggle-task]').first().click(); await page.waitForTimeout(250);
    a = await agenda(page);
    check(tag + ' Done takes it off the day and counts it done', a.day === before.day - 1 && /1 done/.test(a.sub), { before, a });
    await view(page, 'tasks');
    const onTasks = await ev(page, id => !![...document.querySelectorAll('[data-toggle-task="' + id + '"]')].find(b => !b.classList.contains('done')), first.id);
    check(tag + ' the Tasks tab shows it done too', !onTasks);
    await view(page, 'calendar');
    // + Add: a follow-up on the picked day
    const fut = busy[0].k;
    await page.locator('[data-cal-day="' + fut + '"]').click(); await page.waitForTimeout(150);
    await page.locator('[data-cal-add]').click(); await page.waitForTimeout(200);
    const modal = await ev(page, () => ({ show: document.getElementById('taskModal').classList.contains('show'), due: document.getElementById('taskDueInput').value, del: document.getElementById('deleteTask').hidden }));
    check(tag + ' + Add opens a follow-up on that day', modal.show && modal.due === fut && modal.del, modal);
    await ev(page, () => document.getElementById('cancelTask').click());
    // Move opens the follow-up sheet for that follow-up
    await page.locator('.cal-day-view [data-move-task]').first().click(); await page.waitForTimeout(300);
    check(tag + ' Move opens the time picker', await ev(page, () => document.getElementById('fuSheet').classList.contains('show')));
    await ev(page, () => { const k = document.getElementById('fuKeep') || document.querySelector('#fuSheet .close-x'); if (k) k.click(); document.getElementById('fuSheet').classList.remove('show'); });
    // Edit holds Delete now (rows are Call / Move / Edit)
    await view(page, 'tasks');
    const rowBtns = await ev(page, () => { const r = document.querySelector('.task-item:not(:has(.task-check.done))'); return r ? [...r.querySelectorAll('.task-actions > *')].map(b => b.getAttribute('aria-label') || b.title) : []; });
    check(tag + ' a task row has Call, Move, Edit (no trash)', rowBtns.length === 3 && rowBtns.some(x => /^Edit or delete$/.test(x)) && !rowBtns.some(x => /^Delete$/.test(x)), rowBtns);
    const nBefore = await ev(page, () => document.querySelectorAll('.task-item').length), tid = await ev(page, () => document.querySelector('.task-item [data-edit-task]').getAttribute('data-edit-task'));
    await page.locator('.task-item [data-edit-task]').first().click(); await page.waitForTimeout(200);
    check(tag + ' Edit shows Delete', await ev(page, () => !document.getElementById('deleteTask').hidden));
    await page.locator('#deleteTask').click(); await page.waitForTimeout(200);
    await ev(page, () => document.getElementById('confirmOkBtn').click()); await page.waitForTimeout(250);
    check(tag + ' Delete from Edit removes it', await ev(page, id => !document.querySelector('[data-edit-task="' + id + '"]'), tid) && await ev(page, () => document.querySelectorAll('.task-item').length) === nBefore - 1);
    // fits
    await view(page, 'calendar');
    const fit = await ev(page, () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, small: [...document.querySelectorAll('.cal-wrap button, .cal-wrap a')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.width < 30 || r.height < 30); }).map(b => b.className).slice(0, 4) }));
    check(tag + ' fits, no sideways scroll, nothing too small to tap', fit.sw <= fit.cw + 1 && !fit.small.length, fit);
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  // a big office: Pipeline pages each stage and opens fast; Tasks and Calendar stay quick
  {
    const { ctx, page, errs } = await open(br, { w: 390 }, 4000);
    const time = sel => ev(page, sel => { const t0 = performance.now(); document.querySelector(sel).click(); return Math.round(performance.now() - t0); }, sel);
    await time('#viewTabPipeline'); await time('#viewTabDial');
    const tp = await time('#viewTabPipeline');
    const p = await ev(page, () => ({ nodes: document.querySelectorAll('#mainArea *').length, stages: [...document.querySelectorAll('.stage-section')].map(s => ({ st: s.getAttribute('data-stage'), n: s.querySelectorAll('.pipe-item').length, more: (s.querySelector('[data-pipe-more]') || {}).textContent || '' })),
      order: [...document.querySelectorAll('.stage-section')][1] ? [...[...document.querySelectorAll('.stage-section')][1].querySelectorAll('.pipe-item')].map(i => (i.querySelector('.nx-line') || {}).className || '') : [] }));
    check('big: Pipeline opens fast (' + tp + ' ms) and light', tp < 1200 && p.nodes < 8000, { tp, nodes: p.nodes });
    const q = p.stages.find(s => s.st === 'Qualified');
    check('big: a stage shows 20, then Show all', q && q.n === 20 && /Show all \d+/.test(q.more), p.stages);
    const rank = c => /nx-over/.test(c) ? 0 : /nx-today/.test(c) ? 1 : /nx-none/.test(c) ? 2 : 3;
    check('big: the leads that need you come first', p.order.map(rank).every((r, i, x) => !i || x[i - 1] <= r), p.order.slice(0, 20));
    await page.locator('.stage-section[data-stage="Qualified"] [data-pipe-more]').click(); await page.waitForTimeout(300);
    check('big: Show all lists the whole stage', await ev(page, () => document.querySelectorAll('.stage-section[data-stage="Qualified"] .pipe-item').length) > 20);
    const lost = await ev(page, () => { const s = document.querySelector('.stage-section[data-stage="Closed Lost"]'); return s ? { items: s.querySelectorAll('.pipe-item').length, btn: !!s.querySelector('[data-pipe-lost]') } : null; });
    check('big: Closed Lost stays folded until asked', lost && lost.items === 0 && lost.btn, lost);
    // stage change and amount still save from a card
    const id = await ev(page, () => document.querySelector('.stage-section[data-stage="Qualified"] .pipe-item').getAttribute('data-pipe-id'));
    await page.selectOption('[data-pipe-stage="' + id + '"]', 'Pitched'); await page.waitForTimeout(400);
    check('big: changing a stage moves the card', await ev(page, id => { const it = document.querySelector('[data-pipe-id="' + id + '"]'); return it && it.closest('.stage-section').getAttribute('data-stage'); }, id) === 'Pitched');
    await time('#viewTabDial'); const tt = await time('#viewTabTasks'); await time('#viewTabDial'); const tc = await time('#viewTabCalendar');
    check('big: Tasks (' + tt + ' ms) and Calendar (' + tc + ' ms) open fast', tt < 1200 && tc < 1200, { tt, tc });
    check('big: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('calendar:', pass, 'passed,', fail, 'failed'); process.exit(fail ? 1 : 0);
})();
