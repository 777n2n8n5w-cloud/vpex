// VPEX regression check (calling_hours_page). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/calling_hours_page.js
// vpexdialer.com/calling-hours/: the free "can I call this lead now?" checker. It must match the app's own rules:
// the committed page equals a fresh build from index.html, and for every state at many moments (Sundays, holidays,
// Pennsylvania before and after Oct 18, 2026) the page's answer equals the app's dayWindow. Plus the copy, links, layout.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html').replace(/index\.html$/, '');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const { build, NAMES } = require(path.join(ROOT, 'tools', 'build_calling_hours.js'));
const committed = fs.readFileSync(path.join(ROOT, 'calling-hours', 'index.html'), 'utf8');
check('committed page is up to date with index.html (run node tools/build_calling_hours.js)', committed === build());
// The app's rules, straight from index.html, as the reference
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
function grab(re) { const m = re.exec(src); let i = src.indexOf('{', m.index), d = 0, j = i; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(m.index, j + 1) + (/^\s*var /.test(m[0]) ? ';' : ''); }
const zs = src.indexOf('  var ZONE_OF = {};'), ze = src.indexOf('  })();', zs);
const ref = {}; vm.createContext(ref);
vm.runInContext([src.slice(zs, ze + 7), grab(/var STATE_HOURS = /), 'var HOLIDAYS = {};', grab(/function usHolidays\(/), grab(/function stateRule\(/), grab(/function hourLabel\(/), grab(/function dayWindow\(/),
  'this.ZONE_OF = ZONE_OF; this.STATE_HOURS = STATE_HOURS; this.dayWindow = dayWindow;'].join('\n'), ref);
function refOpen(st, ts) {
  const iana = ref.ZONE_OF[st].iana, p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: iana, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date(ts)).forEach(x => { p[x.type] = x.value; });
  const t = { hour: Number(p.hour) % 24, min: Number(p.minute), wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), ymd: p.year + '-' + p.month + '-' + p.day };
  const w = ref.dayWindow(st, t), h = t.hour + t.min / 60;
  return !w.closed && h >= w.open && h < w.close;
}
const legal = /Based on published state rules as of [A-Z][a-z]+ \d{4}\. Not legal advice\./.exec(src)[0];
(async () => {
  const br = await chromium.launch();
  // 1. Every state, many moments: page == app
  {
    const ctx = await br.newContext(); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/fonts\.googleapis/, r => r.abort());
    await page.goto(BASE + 'calling-hours/'); await page.waitForTimeout(400);
    const moments = [];
    for (const day of ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-24', '2026-11-11', '2026-11-26', '2026-12-25', '2027-01-01', '2027-03-08', '2027-07-05'])
      for (let hUtc = 0; hUtc < 24; hUtc += 1) for (const m of [0, 30]) moments.push(Date.parse(day + 'T' + String(hUtc).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00Z'));
    const states = Object.keys(NAMES);
    const got = await page.evaluate(([states, moments]) => states.map(st => moments.map(ts => window.vpexHours.isOpen(st, ts).open)), [states, moments]);
    let bad = [];
    states.forEach((st, i) => moments.forEach((ts, j) => { if (got[i][j] !== refOpen(st, ts)) bad.push(st + ' ' + new Date(ts).toISOString()); }));
    check('page answers match the app for 51 states x ' + moments.length + ' moments', bad.length === 0, bad.slice(0, 8));
    check('every state has a time zone in the app', states.every(st => ref.ZONE_OF[st]), states.filter(st => !ref.ZONE_OF[st]));
    // next opening is really the first open minute
    const nx = await page.evaluate(() => { const H = window.vpexHours, out = []; for (const [st, iso] of [['PA', '2026-10-25T18:00:00Z'], ['TX', '2026-10-25T15:00:00Z'], ['RI', '2026-10-24T13:30:00Z'], ['AL', '2026-12-25T18:00:00Z'], ['NY', '2026-10-22T01:30:00Z']]) {
      const t = Date.parse(iso), n = H.nextOpen(st, t); out.push({ st, n, open: H.isOpen(st, n).open, before: H.isOpen(st, n - 60000).open }); } return out; });
    check('next opening is open and the minute before is not', nx.every(x => x.n && x.open && !x.before), nx);
    const loc = (ts, st) => new Date(ts).toLocaleString('en-US', { timeZone: ref.ZONE_OF[st].iana, weekday: 'short', hour: 'numeric', minute: '2-digit' });
    check('PA Sunday 2 PM -> Mon 9:00 AM', loc(nx[0].n, 'PA') === 'Mon 9:00 AM', loc(nx[0].n, 'PA'));
    check('TX Sunday 10 AM -> Sun 12:00 PM', loc(nx[1].n, 'TX') === 'Sun 12:00 PM', loc(nx[1].n, 'TX'));
    check('RI Saturday 9:30 AM -> Sat 10:00 AM', loc(nx[2].n, 'RI') === 'Sat 10:00 AM', loc(nx[2].n, 'RI'));
    check('AL Christmas (Fri) -> Sat 8:00 AM (Saturdays allowed, Sundays not)', loc(nx[3].n, 'AL') === 'Sat 8:00 AM', loc(nx[3].n, 'AL'));
    check('NY 9:30 PM -> Thu 8:00 AM', loc(nx[4].n, 'NY') === 'Thu 8:00 AM', loc(nx[4].n, 'NY'));
    // the table
    const tb = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)));
    const SH = ref.STATE_HOURS;
    check('table lists every stricter state', tb.length === Object.keys(SH).length, tb.length);
    const row = n => tb.find(r => r[0] === n) || [];
    check('table: Pennsylvania 9 AM–7 PM from Oct 18, no Sunday calls', row('Pennsylvania')[1] === '9 AM–7 PM (from Oct 18, 2026)' && row('Pennsylvania')[3] === 'No calls', row('Pennsylvania'));
    check('table: Texas Sunday noon', row('Texas')[3] === '12 PM–9 PM', row('Texas'));
    check('table: Rhode Island Saturday 10–5, holidays', row('Rhode Island')[2] === '10 AM–5 PM' && row('Rhode Island')[4] === 'No calls', row('Rhode Island'));
    check('table: Florida 3 per 24 hours', row('Florida')[5] === '3 per 24 hours' && row('Florida')[1] === '8 AM–8 PM', row('Florida'));
    const txt = await page.evaluate(() => document.body.innerText);
    check('compliance line matches the app', txt.includes(legal), legal);
    check('no leftover words', !/undefined|NaN|\{\{|Dovetail/.test(txt));
    check('no page errors (sweep)', !errs.length, errs);
    await ctx.close();
  }
  // 2. The checker at phone and computer sizes, with fixed clocks
  const CASES = [
    { st: 'PA', t: '2026-10-25T18:00:00Z', open: false, re: /No sales calls on Sundays in PA/, next: /Calls open again tomorrow at 9:00 AM/ },
    { st: 'TX', t: '2026-10-25T15:00:00Z', open: false, re: /Too early: Texas allows 12 PM to 9 PM today/, next: /today at 12:00 PM/ },
    { st: 'NY', t: '2026-10-21T14:00:00Z', open: true, re: /allowed until 9:00 PM/ },
    { st: 'FL', t: '2026-10-21T14:00:00Z', open: true, re: /until 8:00 PM/, extra: /only 3 sales calls/ },
    { st: 'AL', t: '2026-12-25T18:00:00Z', open: false, re: /Holiday, no sales calls in AL today/ },
    { st: 'CA', t: '2026-10-21T13:00:00Z', open: false, re: /Too early: California allows 8 AM to 9 PM today/, next: /today at 8:00 AM/ }];
  for (const c of [{ n: '390-dark', w: 390, s: 'dark' }, { n: '390-light', w: 390, s: 'light' }, { n: '320-light', w: 320, s: 'light' }, { n: '1280-dark', w: 1280, s: 'dark' }]) {
    for (const k of CASES) {
      const tag = c.n + ' ' + k.st + ' ' + k.t;
      const ctx = await br.newContext({ viewport: { width: c.w, height: 860 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.clock.install({ time: new Date(k.t) });
      await page.route(/fonts\.googleapis/, r => r.abort());
      await page.goto(BASE + 'calling-hours/?st=' + k.st.toLowerCase()); await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const v = document.getElementById('verdict'), s = document.getElementById('st'); return { cls: v.className, txt: v.innerText, sel: s.value, selH: Math.round(s.getBoundingClientRect().height), sw: document.documentElement.scrollWidth, vw: innerWidth, url: location.search }; });
      check(tag + ': ?st= preselects the state', r.sel === k.st && r.url === '?st=' + k.st, r);
      check(tag + ': verdict ' + (k.open ? 'yes' : 'no'), r.cls.includes(k.open ? 'ok' : 'no') && (k.open ? /Yes, you can call now/ : /No, not right now/).test(r.txt), r.txt);
      check(tag + ': reason', k.re.test(r.txt), r.txt);
      if (k.next) check(tag + ': next opening', k.next.test(r.txt), r.txt);
      if (k.extra) check(tag + ': 3-call note', k.extra.test(r.txt), r.txt);
      check(tag + ': compliance line in the answer', r.txt.includes(legal));
      check(tag + ': select is a 44 px+ target', r.selH >= 44, r.selH);
      check(tag + ': no sideways scroll', r.sw <= r.vw, r);
      check(tag + ': no page errors', !errs.length, errs);
      await ctx.close();
    }
  }
  // 3. Links out carry the source; a demo link lands in the demo with "calling-hours" remembered for sign-up credit
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + 'calling-hours/'); await page.waitForTimeout(300);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map(a => ({ h: a.getAttribute('href'), size: Math.round(Math.min(a.getBoundingClientRect().height, 999)) })));
    check('every link to the site carries utm_source=calling-hours', links.length >= 8 && links.every(l => /utm_source=calling-hours&utm_medium=tool/.test(l.h)), links.filter(l => !/utm_source=calling-hours/.test(l.h)));
    check('links are 44 px+ tap targets', links.every(l => l.size >= 44), links.filter(l => l.size < 44));
    await page.click('a[data-cta="demo-solar"]'); await page.waitForTimeout(2500);
    const d = await page.evaluate(() => ({ hash: location.hash, attr: JSON.parse(localStorage.getItem('vpex_attr') || 'null'), bar: !!document.querySelector('.demo-pill'), q: location.search }));
    check('demo link opens the solar demo', d.hash === '#demo-solar' && d.bar, d);
    check('the visit is credited to calling-hours / tool / demo-solar', d.attr && d.attr.s === 'calling-hours' && d.attr.m === 'tool' && d.attr.n === 'demo-solar', d.attr);
    check('utm tags removed from the address bar', !/utm_/.test(d.q), d.q);
    check('no page errors (links)', !errs.length, errs);
    await ctx.close();
  }
  // 4. The sales page links to the checker; robots and sitemap list it
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + 'index.html#mockbench'); await page.waitForTimeout(1800);
    const l = await page.evaluate(() => { const a = document.querySelector('a.lp-inlink[href="/calling-hours/"]'); return a ? Math.round(a.getBoundingClientRect().height) : 0; });
    check('sales page links to /calling-hours/ (44 px)', l >= 44, l);
    await ctx.close();
  }
  check('robots.txt points to the sitemap', /Sitemap: https:\/\/vpexdialer\.com\/sitemap\.xml/.test(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8')));
  check('sitemap lists the checker', /https:\/\/vpexdialer\.com\/calling-hours\//.test(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8')));
  await br.close();
  console.log('calling_hours_page: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
