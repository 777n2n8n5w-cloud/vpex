// vpexdialer.com/calling-hours/pennsylvania/2026-law-changes/ (the SB 992 explainer): facts match the app's PA rule,
// the app's compliance line, linked from the PA page and the sitemap, tagged links, phone fit, 44 px taps, contrast.
//   python3 -m http.server 8765   (in the repo root)
//   NODE_PATH=<dir with playwright> node tests/pa_law_page.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = 'http://127.0.0.1:8765/', REPO = path.join(__dirname, '..'), P = 'calling-hours/pennsylvania/2026-law-changes/';
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }
function lum(c) { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
(async () => {
  const app = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const html = fs.readFileSync(path.join(REPO, P, 'index.html'), 'utf8');
  const pa = fs.readFileSync(path.join(REPO, 'calling-hours/pennsylvania/index.html'), 'utf8');
  const sm = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
  // The page's facts are the app's PA rule
  const rule = (app.match(/PA: \{ h: \[(\d+), (\d+)\], sun: (false|true), hol: (true|false), from: "([\d-]+)", before: \{ h: \[(\d+), (\d+)\]/) || []);
  check('STATE_HOURS PA found', rule.length === 8, rule);
  check('app: 9 AM–7 PM', rule[1] === '9' && rule[2] === '19');
  check('app: no Sundays, holidays banned', rule[3] === 'false' && rule[4] === 'true');
  check('app: from Oct 18, 2026, 8–9 before', rule[5] === '2026-10-18' && rule[6] === '8' && rule[7] === '21');
  check('page: 9 AM to 7 PM, 8 AM to 9 PM before', /Calls only 9 AM to 7 PM/.test(html) && /It was 8 AM to 9 PM before/.test(html));
  check('page: Sundays and legal holidays', /No sales calls on Sundays/.test(html) && /No sales calls on legal holidays/.test(html));
  check('page: effective Oct 18, 2026, signed July 20, 2026', /took effect October 18, 2026/.test(html) && /signed July 20, 2026/.test(html));
  const line = (app.match(/Based on published state rules as of [A-Z][a-z]+ 20\d\d\. Not legal advice\./) || [])[0];
  check('compliance line equals the app\'s', !!line && html.indexOf(line) > -1, line);
  check('sources dated, at least 2 law-firm/bill links', /Sources, checked [A-Z][a-z]+ \d+, 20\d\d/.test(html) && (html.match(/class="fine src"[\s\S]*?<\/p>/)[0].match(/href="https:/g) || []).length >= 2);
  check('honest: VPEX does not check National or PA Do Not Call lists', /doesn't check the National or Pennsylvania Do Not Call lists/.test(html));
  check('honest: no autodialer, voicemail drop or prerecorded messages', /no autodialer, voicemail drop or prerecorded messages/.test(html));
  check('no Dovetail', !/dovetail/i.test(html));
  check('sitemap lists it', sm.indexOf('<loc>https://vpexdialer.com/' + P + '</loc>') > -1);
  check('canonical', html.indexOf('<link rel="canonical" href="https://vpexdialer.com/' + P + '">') > -1);
  check('PA page links it', pa.indexOf('href="/' + P + '"') > -1);
  check('only PA links it', fs.readdirSync(path.join(REPO, 'calling-hours')).filter(d => d !== 'pennsylvania' && fs.existsSync(path.join(REPO, 'calling-hours', d, 'index.html')))
    .every(d => fs.readFileSync(path.join(REPO, 'calling-hours', d, 'index.html'), 'utf8').indexOf(P) < 0));
  const site = html.match(/href="\/\?[^"]*"/g) || [];
  check('every vpexdialer.com app link tagged utm_campaign=pa-law', site.length >= 8 && site.every(h => /utm_source=calling-hours/.test(h) && /utm_campaign=pa-law/.test(h)), site.length);

  const b = await chromium.launch();
  const confs = [{ w: 390, h: 844, s: 'dark', m: true }, { w: 390, h: 844, s: 'light', m: true }, { w: 320, h: 640, s: 'light', m: true }, { w: 1280, h: 860, s: 'dark', m: false }];
  for (const c of confs) {
    const tag = c.w + ' ' + c.s;
    const ctx = await b.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.m, hasTouch: c.m, timezoneId: 'America/New_York' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const t0 = Date.now();
    const r = await p.goto(ROOT + P, { waitUntil: 'load' });
    check(tag + ' loads 200 under 3 s', r.status() === 200 && Date.now() - t0 < 3000, Date.now() - t0);
    const info = await p.evaluate(() => {
      // accept the US notice so it doesn't sit over the page
      const acc = [...document.querySelectorAll('button')].find(x => /Accept all/.test(x.textContent)); if (acc) acc.click();
      const out = { sw: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelector('h1').textContent, small: [], low: [], words: /undefined|NaN|\{\{/.test(document.body.innerText) };
      const bg = getComputedStyle(document.body).backgroundColor;
      document.querySelectorAll('main a, main button').forEach(a => { const r = a.getBoundingClientRect(); if (r.width && r.height < 43.5) out.small.push(a.textContent.trim().slice(0, 30) + ':' + Math.round(r.height)); });
      function bgOf(e) { while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return bg; }
      document.querySelectorAll('main p, main li, main b, main span, main a, main h1, main h2').forEach(e => { if (!e.textContent.trim() || !e.getClientRects().length) return; out.low.push([e.tagName + ':' + e.textContent.trim().slice(0, 24), getComputedStyle(e).color, bgOf(e)]); });
      return out;
    });
    check(tag + ' no sideways scroll', !info.sw);
    check(tag + ' H1', /Pennsylvania's new telemarketing law/.test(info.h1));
    check(tag + ' tap targets ≥ 44 px', !info.small.length, info.small);
    check(tag + ' no leftover words', !info.words);
    const lows = info.low.filter(x => !/rgba\(\d+, \d+, \d+, 0\)/.test(x[1]) && ratio(x[1].replace(/rgba?\(([^)]+)\)/, 'rgb($1)'), x[2].replace(/rgba?\(([^)]+)\)/, 'rgb($1)')) < 4.5);
    check(tag + ' text contrast ≥ 4.5', !lows.length, lows.slice(0, 4));
    check(tag + ' no page errors', !errs.length, errs);
    if (c.w === 390 && c.s === 'dark') {
      await p.screenshot({ path: process.env.SHOT || '/dev/null', fullPage: false }).catch(() => {});
      // the PA page's link opens it
      await p.goto(ROOT + 'calling-hours/pennsylvania/', { waitUntil: 'load' });
      const more = p.locator('a.more');
      const bx = await more.boundingBox();
      check('PA page: link ≥ 44 px', bx && bx.height >= 44, bx);
      await more.click();
      await p.waitForLoadState('load');
      check('PA page: link opens the explainer', p.url() === ROOT + P, p.url());
      // the demo link lands in the demo credited to this page
      await p.locator('a[data-cta="demo-solar"]').click();
      await p.waitForTimeout(2500);
      const attr = await p.evaluate(() => { try { return localStorage.getItem('vpex_attr') || ''; } catch (e) { return ''; } });
      check('demo link → solar demo credited calling-hours/pa-law', /#demo-solar/.test(p.url()) && /calling-hours/.test(attr) && /pa-law/.test(attr), [p.url(), attr]);
    }
    await ctx.close();
  }
  await b.close();
  console.log('pa_law_page: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
