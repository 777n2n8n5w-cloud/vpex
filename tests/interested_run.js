// VPEX regression check (interested_run). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/interested_run.js
// 1. A lead stays interested after a follow-up goes to voicemail (it used to drop off the Interested run).
// 2. History > Interested turns the calls into people and says why each one is or isn't in the run; its button matches the run.
// 3. Three Interested calls with no stage change park a lead; it's listed as parked, and "parked ones too" brings it back.
// 4. After Interested or Callback later, a sheet books the exact follow-up: every time offered is inside the lead's calling
//    hours, the booked time lands on the task (Booked), the thank-you text quotes it in the lead's time, and the run
//    leaves a lead alone until the time they picked. Skip keeps the suggested time. Clocks are fixed; the rep is in New York.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-11-03T15:20:00Z';   // Tue Nov 3, 10:20 AM in New York
async function open(br, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h || 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const ev = (page, f, a) => page.evaluate(f, a);
const view = async (page, v) => { await ev(page, v => document.querySelector('#viewTabs [data-view="' + v + '"]').click(), v); await page.waitForTimeout(300); };
const sheetOpen = page => ev(page, () => document.getElementById('fuSheet').classList.contains('show'));
const clearPrompts = page => ev(page, () => { ['tpLater', 'dnLater'].forEach(id => { const b = document.getElementById(id); if (b) b.click(); }); });
// Call the lead on screen and log an outcome; the follow-up sheet (if any) is left open unless `skip`.
async function log(page, o, skip) {
  await page.clock.fastForward(25000); await page.waitForTimeout(80);
  const name = await ev(page, () => (document.querySelector('.lead-name') || {}).textContent);
  await ev(page, () => document.getElementById('callBtn').click()); await page.waitForTimeout(250);
  await ev(page, o => document.querySelector('.out-btn[data-outcome="' + o + '"]').click(), o); await page.waitForTimeout(500);
  if (skip && await sheetOpen(page)) { await ev(page, () => document.getElementById('fuKeep').click()); await page.waitForTimeout(200); }
  await clearPrompts(page);
  return name;
}
async function summary(page) {
  await view(page, 'history');
  await ev(page, () => document.querySelector('#filterRow [data-filter="interested"]').click()); await page.waitForTimeout(300);
  const r = await ev(page, () => {
    const s = document.querySelector('.int-sum'); if (!s) return null;
    const rows = {}; s.querySelectorAll('.is-rows li').forEach(li => { rows[li.innerText.replace(/^\s*\d+\s*/, '').trim()] = +li.querySelector('b').textContent; });
    const head = s.querySelector('.is-head b').textContent, m = /(\d+) interested calls? · (\d+) (?:people|person)/.exec(head);
    const chip = +document.querySelector('#filterRow [data-filter="interested"] .chip-n').textContent;
    return { calls: m && +m[1], people: m && +m[2], chip, rows, run: (document.getElementById('histIntRun') || {}).textContent || '', parked: (document.getElementById('histIntParked') || {}).textContent || '', none: (s.querySelector('.is-none') || {}).textContent || '' };
  });
  await view(page, 'dial');
  return r;
}
const runChip = async (page, fresh) => {
  await ev(page, () => { const c = document.querySelector('[data-qfilter="int"]'); if (c) c.click(); }); await page.waitForTimeout(300);
  if (fresh) { await ev(page, () => { const b = document.getElementById('intRestartBtn'); if (b) b.click(); }); await page.waitForTimeout(300); }
};
const runLeft = page => ev(page, () => { const t = (document.querySelector('.queue-tag') || {}).textContent || ''; const m = /Interested · (\d+) left/.exec(t); return m ? +m[1] : (document.getElementById('intExitBtn') ? 0 : -1); });

(async () => {
  const br = await chromium.launch();
  // ---------- the run keeps every interested lead; History explains the numbers ----------
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' });
    await view(page, 'dial');
    const first = await log(page, 'interested', true);
    for (let i = 0; i < 2; i++) await log(page, 'interested', true);
    let s = await summary(page);
    check('3 Interested: the summary counts 3 ready and the button calls 3', s && s.rows['ready to call'] === 3 && /Call 3 interested leads now/.test(s.run), s);
    check('people never outnumber calls, and the head matches the chip', s && s.people <= s.calls && s.calls === s.chip, s);
    const sum = s ? Object.values(s.rows).reduce((a, b) => a + b, 0) : -1;
    check('every person is in exactly one row', s && sum === s.people, { s, sum });
    await runChip(page);
    check('the run lines up all 3', await runLeft(page) === 3, await runLeft(page));
    const vm = await log(page, 'voicemail');
    s = await summary(page);
    check('a follow-up that goes to voicemail keeps the lead interested (still 3 ready)', s && s.rows['ready to call'] === 3, { vm, s });
    // park one lead: 3 follow-up calls logged Interested with no stage change, a day apart (after the first Interested in the main queue)
    let calledAgain = 0;
    for (let day = 0; day < 3; day++) {
      await page.clock.fastForward(24 * 3600000); await page.waitForTimeout(200);
      await ev(page, () => document.querySelector('[data-qfilter="all"]').click()); await page.waitForTimeout(200);
      await runChip(page);   // a new day starts a new round
      for (let k = 0; k < 8; k++) {
        const on = await ev(page, () => (document.querySelector('.lead-name') || {}).textContent);
        if (on === first) { await log(page, 'interested', true); calledAgain++; break; }
        await ev(page, () => { const b = document.getElementById('skipBtn'); if (b) b.click(); }); await page.waitForTimeout(200);
      }
    }
    check('the same lead came up again in the run on each of the next 3 days', calledAgain === 3, calledAgain);
    s = await summary(page);
    check('3 follow-ups with no progress park the lead, and it shows as parked', s && s.rows['parked: follow-ups stalled or they stopped answering'] === 1 && s.rows['ready to call'] === 2, s);
    check('"parked ones too" offers all 3', s && /Call all 3, parked ones too/.test(s.parked), s);
    await view(page, 'history');
    await ev(page, () => document.querySelector('#filterRow [data-filter="interested"]').click()); await page.waitForTimeout(300);
    await ev(page, () => { const b = document.getElementById('histIntParked'); if (b) b.click(); }); await page.waitForTimeout(400);
    const v = await ev(page, () => document.body.getAttribute('data-view') || (document.getElementById('viewTabDial').classList.contains('active') ? 'dial' : ''));
    check('the parked button opens Dial with the parked lead in the run', v === 'dial' && await runLeft(page) >= 1, { v, left: await runLeft(page) });
    check('no page errors (run)', !errs.length, errs);
    await ctx.close();
  }
  // ---------- the follow-up sheet ----------
  for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-small', w: 320, h: 640, s: 'light' }, { n: 'desk', w: 1280, h: 860, s: 'light' }]) {
    const { ctx, page, errs } = await open(br, c);
    await view(page, 'dial');
    for (let i = 0; i < 12; i++) { const w = await ev(page, () => document.querySelector('.lead-where').textContent); if (/\bTX\b/.test(w)) break; await ev(page, () => document.getElementById('skipBtn').click()); await page.waitForTimeout(120); }
    const who = await log(page, 'interested');
    let st = await ev(page, () => {
      const b = document.getElementById('fuBody'), r = b.getBoundingClientRect();
      const chips = [...b.querySelectorAll('.fu-chip')].map(x => x.getBoundingClientRect().height);
      return { open: document.getElementById('fuSheet').classList.contains('show'), title: b.querySelector('h3').textContent, focus: document.activeElement && document.activeElement.id,
        theirs: [...b.querySelectorAll('[data-fu-at] small')].map(x => x.textContent), n: b.querySelectorAll('[data-fu-at]').length,
        minChip: Math.min(...chips), fits: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, sw: document.documentElement.scrollWidth, vw: innerWidth,
        book: document.getElementById('fuBook').getBoundingClientRect() };
    });
    check(c.n + ' Interested opens the follow-up sheet, Book focused', st.open && /follow-up with/.test(st.title) && st.focus === 'fuBook', st);
    // TX allows 8 AM-9 PM their time: every time offered is inside it
    const hrs = st.theirs.map(t => { const m = /(\d+)(?::(\d+))? (AM|PM)/.exec(t); let h = +m[1] % 12 + (m[3] === 'PM' ? 12 : 0); return h + (+(m[2] || 0)) / 60; });
    check(c.n + ' every time offered is inside Texas calling hours, shown in their time', st.n > 5 && hrs.length === st.n && hrs.every(h => h >= 8 && h < 21), { n: st.n, theirs: st.theirs });
    check(c.n + ' chips are easy to tap (44 px) and the sheet fits the screen', st.minChip >= 43 && st.sw <= st.vw && st.book.bottom <= (c.h || 844), st);
    // pick the 3rd day, 2:30 PM, a stage and a note, then Enter
    await ev(page, () => document.querySelectorAll('[data-fu-day]')[2].click()); await page.waitForTimeout(120);
    const picked = await ev(page, () => { const b = [...document.querySelectorAll('[data-fu-at]')].find(x => /^2:30 PM/.test(x.querySelector('b').textContent)); b.click(); return b.querySelector('small').textContent; });
    await page.waitForTimeout(120);
    const vis = await ev(page, () => { const on = document.querySelector('.fu-times .on').getBoundingClientRect(), row = document.querySelector('.fu-times').getBoundingClientRect(); return on.left >= row.left - 1 && on.right <= row.right + 1; });
    check(c.n + ' the chosen time stays in view', vis, vis);
    await ev(page, () => document.querySelector('[data-fu-stage="Pitched"]').click()); await page.waitForTimeout(100);
    await page.fill('#fuNote', 'Wife decides; call when she is home');
    await page.press('#fuNote', 'Enter'); await page.waitForTimeout(500);
    const after = await ev(page, () => ({ open: document.getElementById('fuSheet').classList.contains('show'), text: (document.getElementById('textPrompt') || {}).innerText || '' }));
    check(c.n + ' Enter books it and the thank-you text quotes the time in their zone', !after.open && after.text.indexOf('at ' + picked.replace(' TX', '')) !== -1, { after, picked });
    await clearPrompts(page);
    await view(page, 'tasks');
    const task = await ev(page, n => { const it = [...document.querySelectorAll('.task-item')].find(x => x.innerText.indexOf(n) !== -1); return it ? it.innerText : ''; }, who);
    check(c.n + ' Tasks shows it Booked, with the note and both times', /Booked/.test(task) && /Wife decides/.test(task) && /2:30 PM/.test(task) && /1:30 PM TX/.test(task), task);
    await view(page, 'history');
    const stage = await ev(page, n => { const it = [...document.querySelectorAll('#histListWrap .hist-item')].find(x => x.innerText.indexOf(n) !== -1); return it ? it.innerText : ''; }, who);
    check(c.n + ' the stage moved to Pitched (Quoted in insurance)', /Quoted|Pitched/.test(stage), stage);
    // a booked lead waits for its time: not in the run, listed as booked
    const s = await summary(page);
    check(c.n + ' a lead with a booked time isn\'t in the run until then', s && s.rows['booked for a time they picked · next Thu, Nov 5 2:30 PM'] === 1, s);
    // Callback later opens the same sheet (no stage row); Skip keeps the suggested time
    await view(page, 'dial');
    await log(page, 'callback');
    st = await ev(page, () => ({ open: document.getElementById('fuSheet').classList.contains('show'), title: document.querySelector('#fuBody h3').textContent, stages: !!document.querySelector('#fuBody .fu-stages') }));
    check(c.n + ' Callback later asks when to call back (no stage row)', st.open && /call .* back/.test(st.title) && !st.stages, st);
    await ev(page, () => document.getElementById('fuKeep').click()); await page.waitForTimeout(300);
    check(c.n + ' Skip closes the sheet', !(await sheetOpen(page)));
    await clearPrompts(page);
    // Escape closes it too
    await log(page, 'interested'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check(c.n + ' Escape closes the sheet', !(await sheetOpen(page)));
    check(c.n + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('PASSED: ' + pass + '  FAILED: ' + fail);
  process.exitCode = fail ? 1 : 0;
})();
