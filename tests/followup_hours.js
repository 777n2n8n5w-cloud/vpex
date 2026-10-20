// VPEX regression check (followup_hours). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/followup_hours.js
// The follow-up sheet shows the lead's own time under the time box and warns, with a one-tap fix, when it's outside
// their state's calling hours. The rep is in New York (America/New_York); clocks are fixed.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-10-20T14:00:00Z';   // Tue Oct 20, 10:00 AM in New York
async function open(br, office, c, url) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(url || (BASE + '#demo-' + office)); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
async function openSheet(page) {
  await page.evaluate(() => { const t = document.querySelector('[data-view="tasks"]'); if (t) t.click(); }); await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('addTaskBtn').click()); await page.waitForTimeout(400);
}
// set lead/type/date/time the way a rep would (change events), return the box state
const setAndRead = (page, v) => page.evaluate(v => {
  const set = (id, val) => { if (val === undefined) return; const el = document.getElementById(id); el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); };
  set('taskLeadSelect', v.lead); set('taskTypeSelect', v.type); set('taskDueInput', v.date); set('taskTimeInput', v.time);
  const b = document.getElementById('taskWin'), f = document.getElementById('taskWinFix');
  const lum = c => { const k = /^color\(/.test(c) ? 1 : 255; const m = c.replace(/^color\(srgb/, '').match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= k; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
  const bgOf = el => { while (el) { const c = getComputedStyle(el).backgroundColor; const a = c.match(/[\d.]+/g); if (a && (a[3] === undefined || +a[3] > .9)) return c; el = el.parentElement; } return 'rgb(255,255,255)'; };
  const con = el => { if (!el) return null; const L1 = lum(getComputedStyle(el).color), L2 = lum(bgOf(el.parentElement)); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
  const r = f && f.getBoundingClientRect();
  return { shown: getComputedStyle(b).display !== 'none', bad: b.classList.contains('bad'), text: b.innerText, fix: f ? f.textContent : null, fixH: r && r.height,
    conB: con(b.querySelector('b')), conT: b.innerText ? con(b) : null, sw: document.documentElement.scrollWidth, vw: innerWidth };
}, v);
(async () => {
  const br = await chromium.launch();
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const tag = o + '/' + c.n;
    const { ctx, page, errs } = await open(br, o, c);
    await openSheet(page);
    const leads = await page.evaluate(() => [...document.getElementById('taskLeadSelect').options].map(x => x.value));
    // 1. 8:30 AM New York on a weekday: find a lead it's too early for (Central, Mountain, Pacific or a 9 AM state) and one it's fine for
    let badLead = null, okSame = null, info = {};
    for (const id of leads.slice(0, 60)) {
      const s = await setAndRead(page, { lead: id, type: 'Call', date: '2026-10-21', time: '08:30' });
      if (s.bad && !badLead) { badLead = id; info.bad = s; }
      if (!s.shown && !okSame) okSame = id;
      if (badLead && okSame) break;
    }
    check(tag + ' a lead it is too early for gets the warning', !!badLead, info);
    check(tag + ' a same-zone lead in hours: nothing shown', !!okSame);
    if (badLead) {
      const s = info.bad;
      check(tag + ' warning names the state and hours', /Outside calling hours\. That.s Wed \d+:\d\d AM for .+ \([A-Z]{2}\), before (?:[A-Z]{2} )?calling hours \(\d+ AM–\d+ PM\)\./.test(s.text), s.text);
      check(tag + ' one-tap fix offered, 44 px', !!s.fix && /^Move to /.test(s.fix) && s.fixH >= 44, s);
      check(tag + ' warning text contrast >= 4.5', s.conT >= 4.5 && s.conB >= 4.5, { t: s.conT, b: s.conB });
      check(tag + ' no overflow', s.sw <= s.vw, s);
      if (o === 'solar' && c.n !== 'desk') await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/fu-hours-' + c.n + '.png' });
      await page.click('#taskWinFix'); await page.waitForTimeout(300);
      const after = await setAndRead(page, {});
      const tm = await page.evaluate(() => [document.getElementById('taskDueInput').value, document.getElementById('taskTimeInput').value]);
      check(tag + ' fix moves the time into their hours (no warning)', !after.bad && tm[0] === '2026-10-21' && tm[1] > '08:30', { after, tm });
      check(tag + ' after the fix, shows their time', after.shown && /^That.s Wed \d+:00 AM for .+ \([A-Z]{2}\)\.$/.test(after.text), after.text);
      const e = await setAndRead(page, { type: 'Email', time: '06:00' });
      check(tag + ' Email: never warned', !e.shown, e);
      const late = await setAndRead(page, { lead: okSame, type: 'Call', time: '21:30' });
      check(tag + ' 11:30 PM: after calling hours, fix is the next morning', late.bad && /after/.test(late.text) && /^Move to Thu/.test(late.fix || ''), late);
      // Save: the follow-up keeps the fixed time
      if (late.fix) await page.click('#taskWinFix'); await page.waitForTimeout(200);
      await page.evaluate(() => document.getElementById('submitTask').click()); await page.waitForTimeout(500);
      const sv = await page.evaluate(() => ({ open: document.getElementById('taskModal').classList.contains('show'), body: document.body.innerText }));
      check(tag + ' saves (sheet closes, Follow-up added)', !sv.open && /Follow-up added/.test(sv.body), sv.open);
    }
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  // 2. Sunday and holiday bans, with the fix on the next open day, across the demo offices
  {
    let sun = null, hol = null, tx = null, n = 0;
    for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) {
      const { ctx, page, errs } = await open(br, o, { w: 390, s: 'dark' });
      await openSheet(page);
      const leads = await page.evaluate(() => [...document.getElementById('taskLeadSelect').options].map(x => x.value));
      for (const id of leads) {
        if (!sun) { const s = await setAndRead(page, { lead: id, type: 'Call', date: '2026-10-25', time: '14:00' }); if (s.bad && /Sundays/.test(s.text)) sun = s; }
        if (!hol) { const s = await setAndRead(page, { lead: id, type: 'Call', date: '2026-11-11', time: '14:00' }); if (s.bad && /holiday/.test(s.text)) hol = s; }
        if (!tx) { const s = await setAndRead(page, { lead: id, type: 'Call', date: '2026-10-25', time: '11:30' }); if (s.bad && /\(TX\)/.test(s.text)) tx = s; }
        n++;
      }
      check(o + ' Sunday/holiday sweep no page errors', !errs.length, errs);
      await ctx.close();
    }
    console.log('sweep', n, 'leads; found', { sun: !!sun, hol: !!hol, tx: !!tx });
    check('Sunday-ban state: says so, fix is Monday', !sun || (/no sales calls on Sundays in (AL|LA|MS|PA|RI|SD)/.test(sun.text) && /^Move to Mon/.test(sun.fix || '')), sun);
    check('holiday state (Veterans Day): says so, fix is Thursday', !hol || (/holiday, no sales calls in (AL|LA|RI)/.test(hol.text) && /^Move to Thu/.test(hol.fix || '')), hol);
    check('TX Sunday before noon: TX hours, fix at noon', !tx || (/before TX calling hours \(12 PM–9 PM\)/.test(tx.text) && /\(12:00 PM TX\)/.test(tx.fix || '')), tx);
    check('at least one ban case found in the demos', !!(sun || hol || tx));
  }
  // 3. Signup: the office-name example follows the industry
  {
    const { ctx, page, errs } = await open(br, null, { w: 390, s: 'light' }, BASE.replace('index.html', 'index.html?trial=solar#mockbench'));
    let ph = await page.evaluate(() => [document.getElementById('suInd').value, document.getElementById('suOffice').placeholder]);
    check('signup ?trial=solar: Solar picked, solar example', ph[0] === 'solar' && ph[1] === 'Bright Sun Solar', ph);
    for (const [k, want] of [['auto', 'Route 9 Motors'], ['realestate', 'Shoreline Realty Group'], ['mca', 'Summit Business Funding'], ['insurance', 'Harbor Insurance Group']]) {
      ph = await page.evaluate(k => { const s = document.getElementById('suInd'); s.value = k; s.dispatchEvent(new Event('change')); return document.getElementById('suOffice').placeholder; }, k);
      check('signup ' + k + ' example', ph === want, ph);
    }
    check('signup no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close(); console.log(`followup_hours: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
