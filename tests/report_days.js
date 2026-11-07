// Results report: calls-per-day chart has one bar per calendar day with day labels under it,
// including across the Nov 1 clock change (the 30-day view used to start a day early and drop today).
// Run: python3 -m http.server 8765 (repo root), then NODE_PATH=$(npm root -g) node tests/report_days.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const NOW = '2026-11-07T11:00:00-05:00';   // Saturday, the week after clocks fell back
const CONFIGS = [
  { name: '390-dark', w: 390, h: 844, scheme: 'dark' },
  { name: '390-light', w: 390, h: 844, scheme: 'light' },
  { name: '1280-dark', w: 1280, h: 860, scheme: 'dark' },
];
let pass = 0, fail = 0;
function check(n, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } }
const chart = (page) => page.evaluate(() => {
  const svg = document.querySelector('#featModal .rp-bars'), row = document.querySelector('#featModal .rp-days');
  const modal = document.querySelector('#featModal .modal'), mb = modal.getBoundingClientRect();
  const rects = [...svg.querySelectorAll('rect')].map(r => { const b = r.getBoundingClientRect(); return { cx: b.left + b.width / 2, title: r.querySelector('title').textContent }; });
  const spans = [...row.children].map(s => { const b = s.getBoundingClientRect(); const t = s.innerText.trim(); let tb = null;
    if (t) { const rg = document.createRange(); rg.selectNodeContents(s); const x = rg.getBoundingClientRect(); tb = { l: x.left, r: x.right, cx: (x.left + x.right) / 2 }; }
    return { text: t, cx: b.left + (b.width - 3) / 2, tb, color: getComputedStyle(s).color }; });
  const kpi = [...document.querySelectorAll('#featModal .rp-kpi')].find(k => /calls/.test(k.innerText));
  return { aria: svg.getAttribute('aria-label'), rects, spans, mb: { l: mb.left, r: mb.right }, sw: modal.scrollWidth, cw: modal.clientWidth,
    calls: parseInt(kpi.querySelector('b').innerText.replace(/,/g, ''), 10), vw: document.documentElement.scrollWidth, ww: innerWidth };
});
(async () => {
  const browser = await chromium.launch();
  for (const c of CONFIGS) {
    const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, timezoneId: 'America/New_York', isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date(NOW) });
    await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('openReportBtn').click()); await page.waitForTimeout(700);
    // This week: Mon Nov 2 .. Sat Nov 7
    let d = await chart(page);
    check(c.name + ' week: 6 bars Mon-Sat', d.rects.length === 6, d.rects.length);
    check(c.name + ' week: labels are the weekdays', d.spans.map(s => s.text.split('\n').pop()).join(',') === 'Mon,Tue,Wed,Thu,Fri,Sat', d.spans.map(s => s.text));
    const counts = d.spans.map(s => parseInt(s.text.split('\n')[0], 10));
    check(c.name + ' week: day counts add up to the calls tile', counts.reduce((a, b) => a + b, 0) === d.calls, [counts, d.calls]);
    check(c.name + ' week: some calls in the demo', d.calls > 0, d.calls);
    check(c.name + ' week: each label sits under its bar', d.spans.every((s, i) => Math.abs(s.cx - d.rects[i].cx) < 4), d.spans.map((s, i) => Math.round(s.cx - d.rects[i].cx)));
    check(c.name + ' week: bar titles name the day and count', d.rects[0].title === 'Mon, Nov 2: ' + counts[0] + ' call' + (counts[0] === 1 ? '' : 's'), d.rects[0].title);
    check(c.name + ' week: chart is described for screen readers', /^Calls per day: Mon, Nov 2 \d+, .*Sat, Nov 7 \d+$/.test(d.aria), d.aria);
    check(c.name + ' week: labels inside the sheet, no sideways scroll', d.spans.every(s => !s.tb || (s.tb.l >= d.mb.l - 1 && s.tb.r <= d.mb.r + 1)) && d.sw <= d.cw + 1 && d.vw <= d.ww, [d.sw, d.cw]);
    // Last week: Mon Oct 26 .. Sun Nov 1 (the clock-change day once)
    await page.selectOption('#rpKind', 'lastweek'); await page.waitForTimeout(500);
    d = await chart(page);
    check(c.name + ' last week: 7 bars, Mon-Sun, each once', d.rects.length === 7 && d.spans.map(s => s.text.split('\n').pop()).join(',') === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', d.spans.map(s => s.text));
    check(c.name + ' last week: ends on Sun Nov 1', /^Sun, Nov 1:/.test(d.rects[6].title), d.rects[6].title);
    // Last 30 days: Oct 9 .. Nov 7, every date once, today included
    await page.selectOption('#rpKind', '30'); await page.waitForTimeout(500);
    d = await chart(page);
    const dates = d.rects.map(r => r.title.split(':')[0]);
    check(c.name + ' 30 days: 30 bars', d.rects.length === 30, d.rects.length);
    check(c.name + ' 30 days: starts Oct 9, ends today Nov 7', dates[0] === 'Fri, Oct 9' && dates[29] === 'Sat, Nov 7', [dates[0], dates[29]]);
    check(c.name + ' 30 days: no date twice', new Set(dates).size === 30, dates);
    const lab = d.spans.filter(s => s.text);
    check(c.name + ' 30 days: every 5th day labelled, newest last', lab.length === 6 && lab[lab.length - 1].text === 'Nov 7' && lab[0].text === 'Oct 13', lab.map(s => s.text));
    check(c.name + ' 30 days: labels don\'t overlap', lab.every((s, i) => !i || s.tb.l >= lab[i - 1].tb.r + 2), lab.map(s => [Math.round(s.tb.l), Math.round(s.tb.r)]));
    check(c.name + ' 30 days: labels inside the sheet, no sideways scroll', lab.every(s => s.tb.l >= d.mb.l - 1 && s.tb.r <= d.mb.r + 1) && d.sw <= d.cw + 1 && d.vw <= d.ww, [d.sw, d.cw]);
    check(c.name + ' no page errors', !errs.length, errs);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '/report-' + c.name + '.png' });
    await ctx.close();
  }
  { // Spring forward (Mar 14, 2027): 30 days still one bar per date, ending today; last week Mon-Sun
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', timezoneId: 'America/New_York', isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date('2027-03-20T09:00:00-04:00') });
    await page.goto(BASE + '#demo-solar'); await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('openReportBtn').click()); await page.waitForTimeout(700);
    await page.selectOption('#rpKind', '30'); await page.waitForTimeout(500);
    let d = await chart(page); const dates = d.rects.map(r => r.title.split(':')[0]);
    check('spring 30 days: Feb 19 .. Mar 20, each once', dates.length === 30 && dates[0] === 'Fri, Feb 19' && dates[29] === 'Sat, Mar 20' && new Set(dates).size === 30, [dates[0], dates[29], dates.length]);
    await page.selectOption('#rpKind', 'lastweek'); await page.waitForTimeout(500);
    d = await chart(page);
    check('spring last week: Mon Mar 8 .. Sun Mar 14', d.rects.length === 7 && /^Mon, Mar 8:/.test(d.rects[0].title) && /^Sun, Mar 14:/.test(d.rects[6].title), d.rects.map(r => r.title));
    check('spring: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await browser.close();
  console.log('report_days:', pass, 'pass,', fail, 'fail'); process.exit(fail ? 1 : 0);
})();
