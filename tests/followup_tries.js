// VPEX regression check (followup_tries). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/followup_tries.js
// Follow-up rules: the owner picks any number of tries (1-30) before a no-answer lead is parked, and any number of
// warm follow-ups without progress (1-20, or Off). 3, 4 and 6 keep the spacing they always had. Clocks are fixed.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-10-20T14:00:00Z';   // Tue Oct 20, 10:00 AM in New York
async function open(br, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const openRules = async page => {
  await page.evaluate(() => document.getElementById('adminBtn').click()); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-hub-cat="rules"]').click()); await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('hubFollow').click()); await page.waitForTimeout(300);
};
const read = page => page.evaluate(() => ({
  tries: document.getElementById('fuNum_tries').value, stall: document.getElementById('fuNum_stall').value,
  hintT: document.getElementById('fuTriesHint').textContent, hintS: document.getElementById('fuStallHint').textContent,
  minusT: document.querySelector('[data-fu-step="tries"][data-d="-1"]').disabled, plusT: document.querySelector('[data-fu-step="tries"][data-d="1"]').disabled,
  picks: [...document.querySelectorAll('[data-fu-pick="tries"].on')].map(b => b.textContent),
  sw: document.documentElement.scrollWidth, vw: innerWidth }));
const type = (page, k, v) => page.evaluate(([k, v]) => { const i = document.getElementById('fuNum_' + k); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); }, [k, v]);
const toastAfterNoAnswer = async page => {
  await page.evaluate(() => { document.getElementById('copyBtn').click(); }); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="noanswer"]').click()); await page.waitForTimeout(700);
  return page.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map(t => t.textContent).join(' | '));
};
(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 320, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const { ctx, page, errs } = await open(br, c);
    await openRules(page);
    let r = await read(page);
    check(c.n + ' opens on the saved number (4 by default)', r.tries === '4' && r.picks.join() === '4', r);
    check(c.n + ' 4 tries keeps its spacing', /4 tries over 4 business days/.test(r.hintT), r.hintT);
    for (let i = 0; i < 8; i++) await page.evaluate(() => document.querySelector('[data-fu-step="tries"][data-d="1"]').click());
    r = await read(page);
    check(c.n + ' + goes past 6 (to 12)', r.tries === '12' && /12 tries over about 8 weeks/.test(r.hintT) && /6th try/.test(r.hintT), r);
    await type(page, 'tries', '99'); r = await read(page);
    check(c.n + ' typing 99 stops at 30', r.tries === '30' && r.plusT, r);
    await type(page, 'tries', '1'); r = await read(page);
    check(c.n + ' 1 is the least, and reads "1 try"', r.tries === '1' && r.minusT && /^1 try\./.test(r.hintT), r);
    await page.evaluate(() => document.querySelector('[data-fu-pick="tries"][data-v="6"]').click()); r = await read(page);
    check(c.n + ' quick pick 6 keeps the 2-week spacing', r.tries === '6' && /6 tries over about 2 weeks/.test(r.hintT) && !/6th try/.test(r.hintT), r);
    await page.evaluate(() => document.querySelector('[data-fu-pick="stall"][data-v="0"]').click()); r = await read(page);
    check(c.n + ' warm follow-ups can be Off', r.stall === '0' && /^Off/.test(r.hintS), r);
    await type(page, 'stall', '8'); r = await read(page);
    check(c.n + ' warm follow-ups can be 8', r.stall === '8' && /After 8 follow-up calls/.test(r.hintS), r);
    check(c.n + ' fits the screen', r.sw <= r.vw, r);
    if (c.n === 'p-dark') {
      await type(page, 'tries', '12');
      await page.evaluate(() => document.getElementById('fuSave').click()); await page.waitForTimeout(500);
      await page.evaluate(() => { document.getElementById('adminBtn').click(); }); await page.waitForTimeout(300);
      const hub = await page.evaluate(() => document.getElementById('adminModalBody').innerText);
      check('saved: Admin controls says Up to 12 tries', /Up to 12 tries/.test(hub), hub.slice(0, 300));
      await page.evaluate(() => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')));
      let t = await toastAfterNoAnswer(page);
      check('No answer with 12 tries schedules try 2 of 12', /Next try/.test(t), t);
      const note = await page.evaluate(() => { document.querySelector('[data-view="tasks"]').click(); return new Promise(r => setTimeout(() => r(document.getElementById('mainArea').innerText), 400)); });
      check('the follow-up says Try 2 of 12', /Try 2 of 12/.test(note), note.slice(0, 300));
      await page.evaluate(() => document.querySelector('[data-view="dial"]').click()); await page.waitForTimeout(300);
      await openRules(page); await type(page, 'tries', '1');
      await page.evaluate(() => document.getElementById('fuSave').click()); await page.waitForTimeout(500);
      t = await toastAfterNoAnswer(page);
      check('with 1 try, one No answer parks the lead ("1 try", not "1 tries")', /1 try, no answer/.test(t) && !/1 tries/.test(t), t);
      await page.reload(); await page.waitForTimeout(2500);
      await openRules(page); r = await read(page);
      check('the setting is still there after reopening the app', r.tries === '1', r);
    }
    check(c.n + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('PASSED: ' + pass + '  FAILED: ' + fail);
  process.exit(fail ? 1 : 0);
})();
