// vpexdialer.com/calling-hours/holidays/: every date equals the app's usHolidays() from the compliance month to the end of next year, the states equal
// STATE_HOURS hol, the app's compliance line, linked from the checker and the holiday-ban state pages only, in the sitemap, tagged links,
// the "Next" box and hidden past days at fixed clocks, phone fit, 44 px taps, contrast, demo attribution.
//   python3 -m http.server 8765   (in the repo root)
//   NODE_PATH=<dir with playwright> node tests/holiday_page.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = 'http://127.0.0.1:8765/', REPO = path.join(__dirname, '..'), P = 'calling-hours/holidays/';
const { holidays, NAMES } = require(path.join(REPO, 'tools', 'build_calling_hours.js'));
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }
function lum(c) { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
(async () => {
  const app = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const html = fs.readFileSync(path.join(REPO, P, 'index.html'), 'utf8');
  const sm = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
  check('page equals a fresh build', html === holidays());
  // The app's own rules as the reference
  function grab(re) { const m = re.exec(app); let i = app.indexOf('{', m.index), d = 0, j = i; for (; j < app.length; j++) { if (app[j] === '{') d++; else if (app[j] === '}' && !--d) break; } return app.slice(m.index, j + 1) + (/^\s*var /.test(m[0]) ? ';' : ''); }
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(grab(/var STATE_HOURS = /) + '\nvar HOLIDAYS = {};\n' + grab(/function usHolidays\(/) + '\nthis.SH = STATE_HOURS; this.UH = usHolidays;', ctx);
  const line = (app.match(/Based on published state rules as of [A-Z][a-z]+ 20\d\d\. Not legal advice\./) || [])[0];
  check('compliance line equals the app\'s', !!line && html.indexOf(line) > -1, line);
  const month = /as of ([A-Z][a-z]+) (\d{4})/.exec(line), y0 = +month[2], m0 = ('0' + (new Date(month[1] + ' 1, 2000').getMonth() + 1)).slice(-2);
  const want = [];
  [y0, y0 + 1].forEach(y => Object.keys(ctx.UH(y)).sort().forEach(d => { if (d >= y0 + '-' + m0 + '-01') want.push(d); }));
  const got = (html.match(/data-d="([\d-]+)"/g) || []).map(x => x.slice(8, -1));
  check('dates = app usHolidays from ' + month[1] + ' ' + y0 + ' to Dec ' + (y0 + 1), JSON.stringify(got) === JSON.stringify(want), { got, want });
  check('Thanksgiving 2026 Thu Nov 26, Christmas 2027 observed Fri Dec 24, New Year 2028 observed Fri Dec 31',
    /data-d="2026-11-26"><td>Thu, Nov 26, 2026<\/td><td>Thanksgiving/.test(html) && /data-d="2027-12-24"><td>Fri, Dec 24, 2027<\/td><td>Christmas Day \(observed\)/.test(html) && /data-d="2027-12-31"[^>]*><td>Fri, Dec 31, 2027<\/td><td>New Year’s Day \(observed\)/.test(html));
  const hol = Object.keys(ctx.SH).filter(s => ctx.SH[s].hol).map(s => NAMES[s]).sort();
  check('holiday states = STATE_HOURS hol (' + hol.join(', ') + ')', hol.length >= 1 && html.indexOf(hol.slice(0, -1).join(', ') + ' and ' + hol[hol.length - 1]) > -1, hol);
  check('states that only limit autodialed/prerecorded calls named as not covering hand dialing', /only for autodialed or prerecorded calls/.test(html));
  check('day after Thanksgiving flagged as check-yourself, not a VPEX ban', /Day after Thanksgiving \(Fri, Nov 27, 2026\)/.test(html) && /VPEX treats it as a normal day/.test(html));
  check('honest: federal holidays only; no National DNC check', /VPEX checks federal holidays only/.test(html) && /doesn't check the National Do Not Call Registry/.test(html));
  check('sources dated with links', /Sources, checked [A-Z][a-z]+ \d+, 20\d\d: <a href="https:/.test(html));
  check('no Dovetail, no leftover placeholders', !/dovetail/i.test(html) && !/\{\{/.test(html));
  check('sitemap lists it', sm.indexOf('<loc>https://vpexdialer.com/' + P + '</loc>') > -1);
  check('canonical', html.indexOf('<link rel="canonical" href="https://vpexdialer.com/' + P + '">') > -1);
  const site = html.match(/href="\/\?[^"]*"/g) || [];
  check('every app link tagged utm_campaign=holidays', site.length >= 8 && site.every(h => /utm_source=calling-hours/.test(h) && /utm_campaign=holidays/.test(h)), site.length);
  // Linked from the checker and exactly the holiday-ban states' pages
  const checker = fs.readFileSync(path.join(REPO, 'calling-hours/index.html'), 'utf8');
  check('checker links it', checker.indexOf('href="/' + P + '"') > -1);
  const holSt = Object.keys(ctx.SH).filter(s => ctx.SH[s].hol);
  Object.keys(NAMES).forEach(st => {
    const pg = fs.readFileSync(path.join(REPO, 'calling-hours', NAMES[st].toLowerCase().replace(/[^a-z]+/g, '-'), 'index.html'), 'utf8');
    const has = pg.indexOf('class="hol" href="/' + P + '"') > -1;
    if (has !== holSt.includes(st)) check(st + ' page links it only if it bans holidays', false, has);
  });
  check('holiday-ban state pages link it (' + holSt.join(', ') + ')', true);

  const b = await chromium.launch();
  const confs = [{ w: 390, h: 844, s: 'dark', m: true }, { w: 390, h: 844, s: 'light', m: true }, { w: 320, h: 640, s: 'light', m: true }, { w: 1280, h: 860, s: 'dark', m: false }];
  const clocks = [['2026-11-14T12:00:00-05:00', 'Next: Thanksgiving', 'in 12 days', '2026-11-11'], ['2026-11-25T10:00:00-05:00', 'Next: Thanksgiving', 'tomorrow', '2026-11-11'],
    ['2026-11-26T09:00:00-05:00', 'Today: Thanksgiving', 'No sales calls today', '2026-11-11'], ['2027-06-01T12:00:00-04:00', 'Next: Juneteenth (observed)', 'in 17 days', '2027-05-31']];
  for (const c of confs) {
    const tag = c.w + ' ' + c.s;
    const ctx2 = await b.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.m, hasTouch: c.m, timezoneId: 'America/New_York' });
    await ctx2.clock.install({ time: new Date(clocks[0][0]) });
    const p = await ctx2.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const t0 = Date.now();
    const r = await p.goto(ROOT + P, { waitUntil: 'load' });
    check(tag + ' loads 200 under 3 s', r.status() === 200 && Date.now() - t0 < 3000, Date.now() - t0);
    const info = await p.evaluate(() => {
      const acc = [...document.querySelectorAll('button')].find(x => /Accept all/.test(x.textContent)); if (acc) acc.click();
      const out = { sw: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelector('h1').textContent, small: [], low: [], words: /undefined|NaN|\{\{/.test(document.body.innerText),
        next: document.getElementById('next').innerText, nextOn: getComputedStyle(document.getElementById('next')).display !== 'none',
        vets: getComputedStyle(document.querySelector('tr[data-d="2026-11-11"]')).display, tg: document.querySelector('tr[data-d="2026-11-26"]').className, tableFits: true };
      const tb = document.querySelector('.hols table').getBoundingClientRect(); out.tableFits = tb.right <= innerWidth + 0.5;
      const bg = getComputedStyle(document.body).backgroundColor;
      document.querySelectorAll('main a, main button').forEach(a => { const r = a.getBoundingClientRect(); if (r.width && r.height < 43.5) out.small.push(a.textContent.trim().slice(0, 30) + ':' + Math.round(r.height)); });
      // the first background behind the text, with see-through tints laid over what's behind them
      function bgOf(e) { while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { const m = c.match(/[\d.]+/g).map(Number); if (m.length < 4 || m[3] >= 1) return c;
        const u = bgOf(e.parentElement).match(/[\d.]+/g).map(Number), a = m[3]; return 'rgb(' + [0, 1, 2].map(i => Math.round(m[i] * a + u[i] * (1 - a))).join(', ') + ')'; } e = e.parentElement; } return bg; }
      document.querySelectorAll('main p, main li, main b, main span, main a, main h1, main h2, main td, main th').forEach(e => { if (!e.textContent.trim() || !e.getClientRects().length) return; out.low.push([e.tagName + ':' + e.textContent.trim().slice(0, 24), getComputedStyle(e).color, bgOf(e)]); });
      return out;
    });
    check(tag + ' no sideways scroll', !info.sw);
    check(tag + ' table fits the screen', info.tableFits);
    check(tag + ' H1', /Can I make sales calls on a holiday\?/.test(info.h1), info.h1);
    check(tag + ' tap targets ≥ 44 px', !info.small.length, info.small);
    check(tag + ' no leftover words', !info.words);
    const lows = info.low.filter(x => !/rgba\(\d+, \d+, \d+, 0\)/.test(x[1]) && ratio(x[1].replace(/rgba?\(([^)]+)\)/, 'rgb($1)'), x[2].replace(/rgba?\(([^)]+)\)/, 'rgb($1)')) < 4.5);
    check(tag + ' text contrast ≥ 4.5', !lows.length, lows.slice(0, 4));
    check(tag + ' Sat Nov 14: Next is Thanksgiving in 12 days', info.nextOn && info.next.indexOf('Next: Thanksgiving') > -1 && info.next.indexOf('in 12 days') > -1, info.next);
    check(tag + ' past Veterans Day hidden, Thanksgiving marked', info.vets === 'none' && info.tg === 'nx', [info.vets, info.tg]);
    check(tag + ' no page errors', !errs.length, errs);
    if (c.w === 390 && c.s === 'dark') {
      await p.screenshot({ path: process.env.SHOT || '/dev/null', fullPage: true }).catch(() => {});
      for (const k of clocks.slice(1)) {
        const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/New_York' });
        await c3.clock.install({ time: new Date(k[0]) });
        const p3 = await c3.newPage(); await p3.goto(ROOT + P, { waitUntil: 'load' });
        const s = await p3.evaluate(d => ({ t: document.getElementById('next').innerText, past: getComputedStyle(document.querySelector('tr[data-d="' + d + '"]')).display }), k[3]);
        check(k[0].slice(0, 10) + ': ' + k[1] + ' / ' + k[2] + ', earlier days hidden', s.t.indexOf(k[1]) > -1 && s.t.indexOf(k[2]) > -1 && s.past === 'none', s);
        await c3.close();
      }
      // The Pennsylvania page's link opens it, and the explainer link is still the only a.more
      await p.goto(ROOT + 'calling-hours/pennsylvania/', { waitUntil: 'load' });
      check('PA page: one a.more (law explainer) kept', await p.locator('a.more').count() === 1);
      const hl = p.locator('a.hol'), bx = await hl.boundingBox();
      check('PA page: holiday link ≥ 44 px', bx && bx.height >= 44, bx);
      await hl.click(); await p.waitForLoadState('load');
      check('PA page: holiday link opens the page', p.url() === ROOT + P, p.url());
      // The checker's link is 44 px
      await p.goto(ROOT + 'calling-hours/', { waitUntil: 'load' });
      const cb = await p.locator('a.inl[href="/' + P + '"]').boundingBox();
      check('checker: holiday link ≥ 44 px', cb && cb.height >= 44, cb);
      // A demo link lands in the demo credited to this page
      await p.goto(ROOT + P, { waitUntil: 'load' });
      await p.locator('a[data-cta="demo-insurance"]').click();
      await p.waitForTimeout(2500);
      const attr = await p.evaluate(() => { try { return localStorage.getItem('vpex_attr') || ''; } catch (e) { return ''; } });
      check('demo link credited to calling-hours/holidays', /calling-hours/.test(attr) && /holidays/.test(attr), attr);
      check('demo link lands in the insurance demo', /#demo-insurance/.test(p.url()), p.url());
    }
    await ctx2.close();
  }
  await b.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
