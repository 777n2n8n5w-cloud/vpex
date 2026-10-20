// VPEX regression check (call_script). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/call_script.js
// Call script and rebuttals: the admin writes them (or starts from the industry starter), reps open them from the
// Dial card before or during a call, with the lead's and rep's names filled in. Only admins can change them.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-10-20T14:00:00Z';   // Tue Oct 20, 10:00 AM in New York
async function open(br, c, ind) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis/, r => r.abort());
  await page.goto(BASE + '#demo-' + (ind || 'insurance')); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const click = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('missing ' + s); el.click(); }, sel);
const sheet = page => page.evaluate(() => {
  const m = document.getElementById('scriptSheet'), b = document.getElementById('scriptSheetBody');
  return { shown: m.classList.contains('show'), text: b.innerText, tab: (b.querySelector('[data-sc-tab].on') || {}).textContent || '',
    edit: !!document.getElementById('scEdit'), steps: b.querySelectorAll('.sc-st').length, objs: b.querySelectorAll('.sc-o').length,
    visibleObjs: [...b.querySelectorAll('.sc-o')].filter(o => !o.hidden).length, openAns: [...b.querySelectorAll('.sc-a')].filter(a => !a.hidden).map(a => a.innerText),
    find: !!document.getElementById('scFind'), sw: document.documentElement.scrollWidth, vw: innerWidth,
    sheetFits: (() => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0; })() };
});
const bar = page => page.evaluate(() => [...document.querySelectorAll('.sc-bar-b')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
const setField = (page, sel, v) => page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
const openEditorFromHub = async page => {
  await click(page, '#adminBtn'); await page.waitForTimeout(300);
  await click(page, '[data-hub-cat="rules"]'); await page.waitForTimeout(200);
  const row = await page.evaluate(() => { const r = document.getElementById('hubScript'); return r ? r.innerText.replace(/\s+/g, ' ') : null; });
  await click(page, '#hubScript'); await page.waitForTimeout(400);
  return row;
};
(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 320, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const { ctx, page, errs } = await open(br, c);
    // The demo office comes with the insurance starter
    let b = await bar(page);
    check(c.n + ' Dial card shows Script and Rebuttals (6)', b.length === 2 && b[0] === 'Script' && /^Rebuttals 6$/.test(b[1]), b);
    const one = await page.evaluate(() => [...document.querySelectorAll('.sc-bar-b')].every(x => x.getBoundingClientRect().height < 50));
    check(c.n + ' the buttons stay on one line', one);
    await click(page, '#copyBtn'); await page.waitForTimeout(400);           // on a call now
    check(c.n + ' still there during the call', (await bar(page)).length === 2);
    await click(page, '[data-sc-open="script"]'); await page.waitForTimeout(300);
    let s = await sheet(page);
    const leadName = await page.evaluate(() => document.querySelector('.lead-name').textContent);
    const first = leadName.split(' ')[0];
    check(c.n + ' the script opens on the Script tab', s.shown && /^Script/.test(s.tab) && s.steps === 5, s.tab);
    check(c.n + ' names are filled in', s.text.indexOf('Hi ' + first + ', this is Alex with') >= 0 && s.text.indexOf('Talking to ' + leadName) >= 0 && !/\{(first|me|company|name)\}/.test(s.text), s.text.slice(0, 200));
    check(c.n + ' the Medicare step is there', /read your required disclaimer here, before you talk about any plan/.test(s.text));
    check(c.n + ' the question list reads as a list', await page.evaluate(() => document.querySelectorAll('#scriptSheetBody .sc-say li').length === 4));
    check(c.n + ' admin sees Edit', s.edit);
    check(c.n + ' sheet fits the screen', s.sheetFits && s.sw <= s.vw, s);
    await click(page, '[data-sc-tab="rebut"]'); await page.waitForTimeout(200);
    s = await sheet(page);
    check(c.n + ' rebuttals tab lists 6, all closed', s.objs === 6 && s.openAns.length === 0 && !s.find, s);
    await page.evaluate(() => document.querySelectorAll('.sc-q')[1].click()); await page.waitForTimeout(150);
    s = await sheet(page);
    check(c.n + ' tapping an objection shows its answer', s.openAns.length === 1 && /fits your budget/.test(s.openAns[0]), s.openAns);
    await page.evaluate(() => document.querySelectorAll('.sc-q')[0].click()); await page.waitForTimeout(150);
    s = await sheet(page);
    check(c.n + ' one answer open at a time', s.openAns.length === 1 && /side-by-side/.test(s.openAns[0]), s.openAns);
    await page.evaluate(() => document.querySelectorAll('.sc-q')[0].click()); await page.waitForTimeout(150);
    check(c.n + ' tapping again closes it', (await sheet(page)).openAns.length === 0);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(c.n + ' Escape closes the sheet', !(await sheet(page)).shown);
    await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="noanswer"]').click()); await page.waitForTimeout(600);
    check(c.n + ' outcomes still work after', await page.evaluate(() => document.querySelector('.lead-name') && document.querySelector('.lead-name').textContent) !== leadName);
    check(c.n + ' no page errors', errs.length === 0, errs);
    if (c.n !== 'p-dark') { await ctx.close(); continue; }

    // ---- Editing (admin): change a step, add rebuttals, reorder, remove, save ----
    const row = await openEditorFromHub(page);
    check('hub row shows the counts', /Call script & rebuttals 5 steps · 6 rebuttals/.test(row || ''), row);
    let ed = await page.evaluate(() => ({ shown: document.getElementById('scriptModal').classList.contains('show'), cards: document.querySelectorAll('.sce-card').length, starter: !!document.querySelector('.sce-starter') }));
    check('editor opens with the 5 steps', ed.shown && ed.cards === 5 && !ed.starter, ed);
    await setField(page, '[data-sce="s:0:x"]', 'Hey {first}, {me} here from {company}. Got a minute?');
    await click(page, '[data-sce-tab="rebut"]'); await page.waitForTimeout(150);
    for (let i = 0; i < 2; i++) { await click(page, '#sceAdd'); await page.waitForTimeout(100); }
    await setField(page, '[data-sce="o:6:q"]', 'Is this a scam?');
    await setField(page, '[data-sce="o:6:a"]', 'Fair question. You can look us up at [your website] before we go any further.');
    await setField(page, '[data-sce="o:7:q"]', 'Call me next week.');
    await click(page, '#sceSave'); await page.waitForTimeout(200);
    let err = await page.evaluate(() => document.getElementById('sceErr').textContent);
    check('an objection without an answer is caught', /Add what to say for “Call me next week\.”/.test(err), err);
    await setField(page, '[data-sce="o:7:a"]', 'Will do. What day is best, {first}?');
    await click(page, '[data-sce-mv="o:7:-1"]'); await page.waitForTimeout(100);          // move it above "Is this a scam?"
    const order = await page.evaluate(() => [...document.querySelectorAll('[data-sce$=":q"]')].map(i => i.value).slice(5));
    check('Move up reorders', order.join('|') === "I'll ask my kids first.|Call me next week.|Is this a scam?", order);
    await click(page, '[data-sce-del="o:5"]'); await page.waitForTimeout(100);            // remove "I'll ask my kids first."
    check('Remove takes it out', await page.evaluate(() => document.querySelectorAll('.sce-card').length) === 7);
    await click(page, '#sceSave'); await page.waitForTimeout(600);
    const toast = await page.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map(t => t.textContent).join(' | '));
    check('saves for the team', /Script saved — your team has it now/.test(toast) && !(await page.evaluate(() => document.getElementById('scriptModal').classList.contains('show'))), toast);
    b = await bar(page);
    check('the card counts 7 rebuttals', /Rebuttals 7/.test(b[1] || ''), b);
    await click(page, '[data-sc-open="rebut"]'); await page.waitForTimeout(300);
    s = await sheet(page);
    check('opens straight to Rebuttals, with search past 6', /^Rebuttals/.test(s.tab) && s.objs === 7 && s.find, s);
    await setField(page, '#scFind', 'scam'); await page.waitForTimeout(100);
    s = await sheet(page);
    check('search narrows the list', s.visibleObjs === 1, s.visibleObjs);
    await setField(page, '#scFind', 'zzzz'); await page.waitForTimeout(100);
    check('search with no match says so', await page.evaluate(() => !document.getElementById('scNone').hidden));
    await setField(page, '#scFind', ''); await page.waitForTimeout(100);
    await page.evaluate(() => [...document.querySelectorAll('.sc-o')].find(o => /scam/.test(o.innerText)).querySelector('.sc-q').click()); await page.waitForTimeout(100);
    s = await sheet(page);
    check('[brackets] show as gaps to fill', await page.evaluate(() => [...document.querySelectorAll('.sc-a:not([hidden]) .sc-gap')].map(g => g.textContent).join()) === 'your website');
    await click(page, '[data-sc-tab="script"]'); await page.waitForTimeout(100);
    s = await sheet(page);
    check('the edited opener shows', /Hey \w+, Alex here from .+\. Got a minute\?/.test(s.text), s.text.slice(0, 160));
    // ---- Open with every call ----
    await click(page, '#scAuto'); await page.waitForTimeout(100);
    await click(page, '#scClose'); await page.waitForTimeout(150);
    await page.evaluate(() => { const a = document.getElementById('callBtn'); a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await page.waitForTimeout(500);
    s = await sheet(page);
    check('with "Open with every call" on, Call opens the script', s.shown && /^Script/.test(s.tab), s);
    await click(page, '#scClose');
    // ---- It stays after a reload ----
    await page.reload(); await page.waitForTimeout(2500);
    b = await bar(page);
    check('after a reload the 7 rebuttals are still there', /Rebuttals 7/.test(b[1] || ''), b);
    // ---- Remove everything ----
    await openEditorFromHub(page);
    await page.evaluate(() => { for (let i = 0; i < 20; i++) { const d = document.querySelector('[data-sce-del]'); if (!d) break; d.click(); } });
    await click(page, '[data-sce-tab="rebut"]'); await page.waitForTimeout(100);
    await page.evaluate(() => { for (let i = 0; i < 20; i++) { const d = document.querySelector('[data-sce-del]'); if (!d) break; d.click(); } });
    ed = await page.evaluate(() => ({ starter: !!document.querySelector('.sce-starter'), cards: document.querySelectorAll('.sce-card').length }));
    check('empty editor offers the starter', ed.starter && ed.cards === 0, ed);
    await click(page, '#sceSave'); await page.waitForTimeout(600);
    check('removing it all takes the buttons off the card', (await bar(page)).length === 0);
    const row2 = await openEditorFromHub(page);
    check('hub says it is new again', /What reps say on a call, and answers to objections/.test(row2 || '') && /New/.test(row2 || ''), row2);
    await click(page, '#sceStarter'); await page.waitForTimeout(150);
    check('Use the starter fills in the industry script', await page.evaluate(() => document.querySelectorAll('.sce-card').length) === 5);
    await click(page, '#sceCancel'); await page.waitForTimeout(150);
    check('Cancel with changes asks first', await page.evaluate(() => document.getElementById('confirmModal').classList.contains('show')));
    await click(page, '#confirmOkBtn'); await page.waitForTimeout(150);
    check('and then closes without saving', !(await page.evaluate(() => document.getElementById('scriptModal').classList.contains('show'))) && (await bar(page)).length === 0);
    check('no page errors (editing)', errs.length === 0, errs);
    await ctx.close();
  }

  // ---- A rep: reads it, can't change it ----
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' });
    await page.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); fs['members/dAdm'].role = 'rep'; localStorage.setItem('__mockfs', JSON.stringify(fs)); });
    await page.reload(); await page.waitForTimeout(2500);
    const b = await bar(page);
    check('rep: sees Script and Rebuttals', b.length === 2, b);
    await click(page, '[data-sc-open="rebut"]'); await page.waitForTimeout(300);
    const s = await sheet(page);
    check('rep: reads the rebuttals, no Edit', s.shown && s.objs === 6 && !s.edit, s);
    await page.keyboard.press('Escape');
    check('rep: no Call script row in Settings', await page.evaluate(() => document.getElementById('openScriptBtn').hidden));
    await page.evaluate(() => { const a = document.getElementById('adminBtn'); if (a) a.click(); }); await page.waitForTimeout(300);
    check('rep: no Call script row in the hub', await page.evaluate(() => !document.getElementById('hubScript')));
    check('rep: no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---- Real estate edition: the office's own words are never swapped ----
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'light' }, 'realestate');
    let s0 = await page.evaluate(() => document.querySelectorAll('.sc-bar-b').length);
    check('real estate: starter is there', s0 === 2);
    await click(page, '#adminBtn'); await page.waitForTimeout(300);
    await click(page, '[data-hub-cat="rules"]'); await page.waitForTimeout(200);
    await click(page, '#hubScript'); await page.waitForTimeout(300);
    await setField(page, '[data-sce="s:4:x"]', 'Our Investor clients have Committed buyers. Objection handling is on step 3.');
    await click(page, '#sceSave'); await page.waitForTimeout(600);
    await click(page, '[data-sc-open="script"]'); await page.waitForTimeout(400);
    const t = (await sheet(page)).text;
    check('real estate: script text shows exactly as written', /Our Investor clients have Committed buyers\. Objection handling is on step 3\./.test(t), t.slice(0, 300));
    check('real estate: starter talks about the home', /I saw your home was listed for sale/.test(t));
    check('real estate: no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log('call_script: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
