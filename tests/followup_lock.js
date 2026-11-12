// VPEX regression check (followup_lock): a follow-up time is picked once, saved at once, and kept.
//  - Picking a time in the follow-up sheet saves it on the tap (no Book button to remember); closing keeps it.
//  - Until it's due, a lead with an arranged follow-up is never fed back: not in the dial list, the Interested or Hot
//    runs, the due follow-ups run or its nudges. Calling sooner asks first ("Call before your booked time?").
//  - Calling early and getting voicemail keeps the booked time.
//  - Two of a rep's follow-ups can't share a half hour: taken times show as Taken and a typed taken time can't be saved.
//  - Booking link (functions/lib.js): every arranged follow-up holds its time, a pick replaces the lead's older follow-ups,
//    the page shows the time as the rep has it now, and a link can be changed only so many times.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/followup_lock.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const NOW = '2026-11-05T15:00:00Z';   // Thu 10:00 AM in New York
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const ev = (page, f, a) => page.evaluate(f, a);
const shown = (page, id) => ev(page, i => document.getElementById(i).classList.contains('show'), id);

async function call(page) { await page.clock.fastForward(25000); await page.waitForTimeout(60); await ev(page, () => document.getElementById('callBtn').click()); await page.waitForTimeout(200); }
async function out(page, o) { await ev(page, o => document.querySelector('.out-btn[data-outcome="' + o + '"]').click(), o); await page.waitForTimeout(400); }
async function clearPrompts(page) { await ev(page, () => { ['tpLater', 'dnLater'].forEach(id => { const b = document.getElementById(id); if (b) b.click(); }); }); }

function libChecks() {
  const L = require('../functions/lib.js'), now = Date.parse(NOW), H = 3600000;
  const lead = (tasks) => ({ name: 'Dana Price', tasks });
  const at = now + 26 * H;
  const busy = L.bookBusy([{ leads: {
    a: lead([{ dueAt: at, pinned: true, assignee: { uid: 'rep1AbCdEf' } }]),                       // picked in the app's follow-up sheet
    b: lead([{ dueAt: at + 2 * H, auto: false, assignee: { uid: 'rep1AbCdEf' } }]),                // set by hand
    c: lead([{ dueAt: at + 4 * H, auto: true, assignee: { uid: 'rep1AbCdEf' } }]),                 // an automatic retry: doesn't hold time
    d: lead([{ dueAt: at + 6 * H, pinned: true, assignee: { uid: 'rep2AbCdEf' } }]) } }], 'rep1AbCdEf', now, 'z');
  check('lib: follow-ups picked in the app or set by hand hold their time on the booking link', busy.indexOf(at) >= 0 && busy.indexOf(at + 2 * H) >= 0, busy);
  check('lib: automatic retries and other reps’ follow-ups don’t', busy.indexOf(at + 4 * H) < 0 && busy.indexOf(at + 6 * H) < 0, busy);
  const book = { h: 'a'.repeat(64), tag: 'abc123def', exp: now + 9 * 86400000, by: { uid: 'rep1AbCdEf', name: 'Sam' }, rtz: 'America/New_York' };
  const before = { name: 'Dana Price', book, tasks: [
    { id: 'old', leadId: 'L', dueAt: at + 8 * H, pinned: true, done: false },
    { id: 'retry', leadId: 'L', dueAt: now + H, auto: true, done: false },
    { id: 'appt', leadId: 'L', dueAt: at + 30 * H, note: 'Appointment: site survey', done: false }] };
  const next = L.bookApply(before, 'L', at, now), open = next.tasks.filter(t => !t.done);
  check('lib: a pick replaces the lead’s older follow-ups (appointments stay)', open.length === 2 && open.some(t => t.bookH === 'abc123def' && t.dueAt === at) && open.some(t => t.id === 'appt') &&
    next.tasks.filter(t => t.superseded).length === 2, next.tasks.map(t => [t.id, t.done, !!t.superseded]));
  check('lib: each pick is counted', next.book.n === 1, next.book.n);
  const moved = Object.assign({}, next, { tasks: next.tasks.map(t => t.bookH ? Object.assign({}, t, { dueAt: at + 3 * H }) : t) });
  check('lib: the page shows the time as the rep has it now (moved in the app)', L.bookView(moved, moved.book, '', [], now).picked === at + 3 * H);
  const doneCall = Object.assign({}, next, { tasks: next.tasks.map(t => t.bookH ? Object.assign({}, t, { done: true }) : t) });
  check('lib: a booked call that’s done shows nothing booked', L.bookView(doneCall, doneCall.book, '', [], now).picked === null);
  check('lib: picks left counts down to zero', L.bookView(next, Object.assign({}, book, { n: L.BOOK_PICKS }), '', [], now).left === 0 && L.bookView(next, book, '', [], now).left === L.BOOK_PICKS);
}

(async () => {
  libChecks();
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);

  // ---------- 1. picked once, saved at once ----------
  const L1 = await ev(page, () => window.__fuCurrent());
  await call(page); await out(page, 'interested');
  check('Interested opens the follow-up sheet', await shown(page, 'fuSheet'));
  await page.locator('.fu-days [data-fu-day]').nth(1).click(); await page.waitForTimeout(150);
  await page.locator('[data-fu-part="pm"]').click(); await page.waitForTimeout(150);
  const chip = page.locator('.fu-times [data-fu-at]').nth(2);
  const ts1 = Number(await chip.getAttribute('data-fu-at'));
  await chip.click(); await page.waitForTimeout(200);
  let tk = (await ev(page, id => window.__fuTasks(id), L1.id)).filter(t => !t.done);
  check('tapping a time saves it right away (pinned, that exact time, nothing else to tap)', tk.length === 1 && tk[0].dueAt === ts1 && tk[0].pinned, tk);
  let ui = await ev(page, () => ({ b: document.getElementById('fuBook').textContent, skip: !!document.getElementById('fuKeep'), sum: document.querySelector('.fu-sum').textContent }));
  check('the sheet says Saved and its button just closes (Done, no Skip)', ui.b === 'Done' && !ui.skip && /Saved/.test(ui.sum), ui);
  await page.locator('#fuX').click(); await page.waitForTimeout(300); await clearPrompts(page);
  tk = (await ev(page, id => window.__fuTasks(id), L1.id)).filter(t => !t.done);
  check('closing the sheet keeps the saved time', tk.length === 1 && tk[0].dueAt === ts1, tk);

  // ---------- 2. never fed back before its time ----------
  let ls = await ev(page, () => window.__fuLists());
  check('held until its time: not in the dial list, the Interested or Hot runs, or due follow-ups', ls.held.includes(L1.id) && !ls.pending.includes(L1.id) && !ls.int.includes(L1.id) && !ls.hot.includes(L1.id) && !ls.due.includes(L1.id), ls);
  check('the next lead on the Dial tab is someone else', (await ev(page, () => window.__fuCurrent())).id !== L1.id);

  // ---------- 3. calling early is a deliberate choice, and keeps the booked time ----------
  await ev(page, () => document.querySelector('[data-view="tasks"]').click()); await page.waitForTimeout(400);
  const callRow = async () => { await page.clock.fastForward(25000); await page.waitForTimeout(60); return ev(page, n => { const it = [...document.querySelectorAll('.task-item')].find(x => (x.querySelector('.task-lead-name') || {}).textContent === n); const a = it && it.querySelector('.task-call'); if (a) a.click(); return !!a; }, L1.name); };
  check('the booked follow-up is on the Tasks tab with a Call button', await callRow()); await page.waitForTimeout(300);
  let g = await ev(page, () => ({ open: document.getElementById('infoModal').classList.contains('show'), t: (document.querySelector('#infoModalBody h3') || {}).textContent, p: (document.querySelector('#infoModalBody .modal-sub') || {}).textContent }));
  check('calling before the booked time asks first', g.open && /before your booked time/.test(g.t) && /The booked time stays/.test(g.p), g);
  await ev(page, () => document.getElementById('gateNo').click()); await page.waitForTimeout(200);
  check('"Wait" calls no one', !(await ev(page, () => document.getElementById('infoModal').classList.contains('show'))) && !(await ev(page, () => document.body.classList.contains('st-live'))));
  await callRow(); await page.waitForTimeout(300);
  await ev(page, () => document.querySelector('#infoModalBody .gate-call').click());
  let onCall = null;
  for (let i = 0; i < 30 && onCall !== L1.name; i++) { await page.waitForTimeout(150); onCall = await ev(page, () => !!document.querySelector('.out-btn[data-outcome="voicemail"]') && document.querySelector('.lead-name') && document.querySelector('.lead-name').textContent); }
  check('"Call anyway" calls them', onCall === L1.name, onCall);
  await out(page, 'voicemail'); await clearPrompts(page);
  tk = (await ev(page, id => window.__fuTasks(id), L1.id)).filter(t => !t.done);
  check('an early call that hits voicemail keeps the booked time', tk.length === 1 && tk[0].dueAt === ts1 && tk[0].pinned, tk);
  ls = await ev(page, () => window.__fuLists());
  check('and they stay held until then', ls.held.includes(L1.id) && !ls.pending.includes(L1.id));

  // ---------- 4. no double booking ----------
  await ev(page, () => document.querySelector('[data-view="dial"]').click()); await page.waitForTimeout(400);
  const L2 = await ev(page, () => window.__fuCurrent());
  await call(page); await out(page, 'interested');
  const ymd1 = await ev(page, t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }, ts1);
  await page.locator('.fu-days [data-fu-day="' + ymd1 + '"]').click(); await page.waitForTimeout(150);
  await page.locator('[data-fu-part="pm"]').click(); await page.waitForTimeout(150);
  g = await ev(page, t => ({ free: !!document.querySelector('[data-fu-at="' + t + '"]'), taken: [...document.querySelectorAll('.fu-taken')].map(b => b.getAttribute('aria-label')) }), ts1);
  check('a time you already booked shows as Taken for the next lead', !g.free && g.taken.some(x => new RegExp(L1.name).test(x)), g);
  const hhmm = await ev(page, t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }, ts1);
  await ev(page, v => { const i = document.getElementById('fuTimeIn'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }, hhmm); await page.waitForTimeout(200);
  g = await ev(page, () => ({ dis: document.getElementById('fuBook').disabled, sum: document.querySelector('.fu-sum').textContent }));
  tk = (await ev(page, id => window.__fuTasks(id), L2.id)).filter(t => !t.done);
  check('typing a taken time explains it and saves nothing', g.dis && /Pick another time/.test(g.sum) && !tk.some(t => t.dueAt === ts1), { g, tk });
  await page.locator('.fu-times [data-fu-at]').first().click(); await page.waitForTimeout(200);
  tk = (await ev(page, id => window.__fuTasks(id), L2.id)).filter(t => !t.done && t.pinned);
  check('a free time right next to it books', tk.length === 1 && Math.abs(tk[0].dueAt - ts1) >= 30 * 60000, tk);
  await page.locator('#fuBook').click(); await page.waitForTimeout(300);
  check('Done closes the sheet', !(await shown(page, 'fuSheet')));

  // ---------- 5. Move and Set next step save on the tap too ----------
  await clearPrompts(page);
  await ev(page, () => document.querySelector('[data-view="tasks"]').click()); await page.waitForTimeout(400);
  const before2 = (await ev(page, id => window.__fuTasks(id), L2.id)).filter(t => !t.done)[0];
  await ev(page, n => { const it = [...document.querySelectorAll('.task-item')].find(x => (x.querySelector('.task-lead-name') || {}).textContent === n); it.querySelector('[data-move-task]').click(); }, L2.name); await page.waitForTimeout(400);
  check('Move opens the sheet', await shown(page, 'fuSheet'));
  await page.locator('.fu-days [data-fu-day]').nth(2).click(); await page.waitForTimeout(150);
  const mchip = page.locator('.fu-times [data-fu-at]').first(); const tsM = Number(await mchip.getAttribute('data-fu-at'));
  await mchip.click(); await page.waitForTimeout(200);
  let after2 = (await ev(page, id => window.__fuTasks(id), L2.id)).filter(t => !t.done);
  check('Move saves the new time on the tap (same follow-up, no second one)', after2.length === 1 && after2[0].id === before2.id && after2[0].dueAt === tsM, after2);
  await page.locator('#fuX').click(); await page.waitForTimeout(300);
  after2 = (await ev(page, id => window.__fuTasks(id), L2.id)).filter(t => !t.done);
  check('closing after a Move keeps the new time', after2.length === 1 && after2[0].dueAt === tsM, after2);
  await ev(page, () => document.querySelector('[data-view="pipeline"]').click()); await page.waitForTimeout(500);
  const L3 = await ev(page, () => { const b = document.querySelector('[data-set-next]'); return b ? b.getAttribute('data-set-next') : null; });
  if (L3) {
    await ev(page, id => document.querySelector('[data-set-next="' + id + '"]').click(), L3); await page.waitForTimeout(400);
    await page.locator('.fu-days [data-fu-day]').nth(1).click(); await page.waitForTimeout(150);
    const schip = page.locator('.fu-times [data-fu-at]').first(); const tsS = Number(await schip.getAttribute('data-fu-at'));
    await schip.click(); await page.waitForTimeout(200);
    await page.locator('#fuX').click(); await page.waitForTimeout(300);
    const t3 = (await ev(page, id => window.__fuTasks(id), L3)).filter(t => !t.done);
    check('Set next step saves on the tap and stays after closing (set by hand, so it holds the time)', t3.length === 1 && t3[0].dueAt === tsS && t3[0].auto === false, t3);
    check('that lead is held until then too', (await ev(page, () => window.__fuLists())).held.includes(L3));
  } else check('pipeline offers Set next step for a lead without one', false);

  // ---------- 6. due: it comes back on time ----------
  const nowIn = await ev(page, () => Date.now()); await page.clock.fastForward(ts1 - nowIn + 60000); await page.waitForTimeout(400);
  ls = await ev(page, () => window.__fuLists());
  check('at its time it comes back as a due follow-up', !ls.held.includes(L1.id) && ls.due.includes(L1.id), ls);
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('followup_lock: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
