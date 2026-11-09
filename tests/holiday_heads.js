// VPEX regression check (holiday_heads). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/holiday_heads.js
// The day before a federal holiday, the Dial tab says which waiting leads are in states that ban sales calls on it (AL, LA, PA, RI)
// and one tap lists the ones callable now; on the holiday it says they wait, and one tap shows Callable now. Holiday names match usHolidays().
const fs = require('fs'), vm = require('vm');
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

// 1) The app's own holiday functions in Node.
const src = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
const ctx = { HOLIDAYS: {} }; vm.createContext(ctx);
vm.runInContext(grab('usHolidays') + '\n' + grab('holidayNames') + '\n' + grab('stList'), ctx);
for (let y = 2026; y <= 2032; y++) {
  const a = Object.keys(ctx.usHolidays(y)).sort().join(), b = Object.keys(ctx.holidayNames(y)).sort().join();
  check('holidayNames(' + y + ') has the same days as usHolidays', a === b, { a, b });
}
check('2026-11-11 is Veterans Day', ctx.holidayNames(2026)['2026-11-11'] === 'Veterans Day');
check('2026-11-26 is Thanksgiving', ctx.holidayNames(2026)['2026-11-26'] === 'Thanksgiving');
check('2027-12-24 is Christmas Day (observed)', ctx.holidayNames(2027)['2027-12-24'] === 'Christmas Day (observed)');
check('2027-12-31 is New Year’s Day (observed)', /New Year.s Day \(observed\)/.test(ctx.holidayNames(2027)['2027-12-31'] || ''));
check('2027-01-18 is Martin Luther King Jr. Day', ctx.holidayNames(2027)['2027-01-18'] === 'Martin Luther King Jr. Day');
check('stList', ctx.stList(['PA']) === 'PA' && ctx.stList(['PA', 'AL']) === 'PA and AL' && ctx.stList(['PA', 'AL', 'RI']) === 'PA, AL and RI');

// 2) In the demo offices, with a list that has Pennsylvania and Alabama leads.
const CSV = 'Name,Phone,State\nPenny Holt,(215) 555-0141,PA\nPaul Grant,(412) 555-0142,PA\nPia Moss,(610) 555-0143,PA\nAl Brooks,(205) 555-0144,AL\nNora Quinn,(212) 555-0145,NY\n';
const HOL = ['Penny Holt', 'Paul Grant', 'Pia Moss', 'Al Brooks'];
async function open(br, o, c, iso, upload) {
  const cx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await cx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.clock.install({ time: new Date(iso) });
  await page.goto(BASE + '#demo-' + o); await page.waitForTimeout(2500);
  if (upload) {
    await page.evaluate(() => document.getElementById('addLeadsBtn').click()); await page.waitForTimeout(400);
    await page.setInputFiles('#leadFileInput', { name: 'pa-list.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await page.waitForSelector('#submitUpload', { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.getElementById('submitUpload').click()); await page.waitForTimeout(800);
    await page.evaluate(() => { const t = document.querySelector('[data-tab="dial"], #tabDial'); if (t) t.click(); }); await page.waitForTimeout(300);
  }
  return { cx, page, errs };
}
const pill = (page) => page.evaluate(() => { const b = document.querySelector('[data-need="hol"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText, h: r.height, right: r.right, vw: innerWidth }; });
const leadName = (page) => page.evaluate(() => { const n = document.querySelector('#mainArea .card .lead-name, #mainArea .card h2'); return n ? n.textContent.trim() : ''; });
const toast = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map(t => t.innerText).join(' '));

(async () => {
  const br = await chromium.launch();
  const CF = [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }];
  for (const o of (process.env.OFF ? process.env.OFF.split(',') : ['insurance', 'solar', 'mca'])) for (const c of (process.env.CF ? CF.filter(x => x.n === process.env.CF) : CF)) {
    const tag = o + '/' + c.n;
    // No holiday-state leads in the demo seed: nothing shows.
    let { cx, page, errs } = await open(br, o, c, '2026-11-10T16:00:00Z', false);
    check(tag + ' seed only: no holiday pill on Tue Nov 10', !(await pill(page)));
    await cx.close();
    // Tue Nov 10, 11 AM ET: the day before Veterans Day.
    ({ cx, page, errs } = await open(br, o, c, '2026-11-10T16:00:00Z', true));
    let p = await pill(page);
    check(tag + ' Tue: pill names the day, holiday, count and states', p && /^\S+ Wed is Veterans Day · call your 4 leads in PA, AL today$/.test(p.text), p);
    check(tag + ' Tue: pill fits the screen', p && p.right <= p.vw + 1 && p.h >= 34, p);
    await page.click('[data-need="hol"]'); await page.waitForTimeout(500);
    const nm = await leadName(page);
    check(tag + ' Tue tap: the lead on screen is a PA/AL lead', HOL.includes(nm), nm);
    const st = await page.evaluate(() => { const a = document.querySelector('.filter-chip.active[data-qfilter="hol"]'); return { chip: a && a.innerText, pill: !!document.querySelector('[data-need="hol"]'), sw: document.documentElement.scrollWidth, vw: innerWidth }; });
    check(tag + ' Tue tap: "Before the holiday 4" chip active, pill gone', st.chip && /Before the holiday\s+4/.test(st.chip) && !st.pill, st);
    check(tag + ' Tue tap: toast says the rule', /No sales calls on Veterans Day in PA and AL\. Showing the 4 you can call now\./.test(await toast(page)), await toast(page));
    check(tag + ' Tue tap: no sideways scroll', st.sw <= st.vw, st);
    if (o === 'insurance' && c.n === 'p-dark') await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/holiday-tue.png' });
    // All chip goes back to everyone.
    await page.click('.filter-chip[data-qfilter="all"]'); await page.waitForTimeout(300);
    check(tag + ' All brings the pill back', !!(await pill(page)));
    check(tag + ' no page errors (Tue)', !errs.length, errs);
    await cx.close();
    // Tue 9:30 PM ET: PA and AL hours are over; the pill only informs.
    ({ cx, page, errs } = await open(br, o, c, '2026-11-11T02:30:00Z', true));
    p = await pill(page);
    check(tag + ' Tue night: "no sales calls to 4 leads in PA, AL then"', p && /Wed is Veterans Day · no sales calls to 4 leads in PA, AL then$/.test(p.text), p);
    if (p) { await page.click('[data-need="hol"]'); await page.waitForTimeout(400); }
    check(tag + ' Tue night tap: filter unchanged, toast explains', !(await page.$('.filter-chip.active[data-qfilter="hol"]')) && /Their calling hours are over for today/.test(await toast(page)));
    await cx.close();
    // Wed Nov 11, 11 AM ET: the holiday.
    ({ cx, page, errs } = await open(br, o, c, '2026-11-11T16:00:00Z', true));
    p = await pill(page);
    check(tag + ' Wed: "Veterans Day · no sales calls to 4 leads in PA, AL today"', p && /Veterans Day · no sales calls to 4 leads in PA, AL today$/.test(p.text), p);
    if (p) { await page.click('[data-need="hol"]'); await page.waitForTimeout(500); }
    const w = await page.evaluate(() => !!document.querySelector('.filter-chip.active[data-qfilter="now"]'));
    check(tag + ' Wed tap: Callable now on, lead on screen not PA/AL', w && !HOL.includes(await leadName(page)), await leadName(page));
    check(tag + ' Wed tap: toast', /open again tomorrow/.test(await toast(page)));
    check(tag + ' no page errors (Wed)', !errs.length, errs);
    await cx.close();
    // Thu Nov 12: nothing.
    ({ cx, page, errs } = await open(br, o, c, '2026-11-12T16:00:00Z', true));
    check(tag + ' Thu: no pill', !(await pill(page)));
    await cx.close();
  }
  // Wed before Thanksgiving: the right name.
  const { cx, page } = await open(br, 'auto', CF[0], '2026-11-25T16:00:00Z', true);
  const p = await pill(page);
  check('auto Wed Nov 25: Thu is Thanksgiving', p && /Thu is Thanksgiving/.test(p.text), p);
  await cx.close();
  await br.close(); console.log(`holiday_heads: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
