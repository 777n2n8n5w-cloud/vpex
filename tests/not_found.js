// 404.html: GitHub Pages serves it (status 404) for any address that doesn't exist on vpexdialer.com.
// Short or mistyped addresses go straight to the right page; anything else gets a page that leads to the demos, the trial, the checker and the industry pages.
// This test runs its own small server that behaves like GitHub Pages (folder → index.html, anything missing → 404.html with status 404).
//   NODE_PATH=<dir with playwright> node tests/not_found.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
const { notFound, siteUrls, NAMES, slug } = require(path.join(ROOT, 'tools', 'build_calling_hours.js'));
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(400); return res.end(); }
  try { if (fs.statSync(f).isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '') }); return res.end(); } f = path.join(f, 'index.html'); } } catch (e) {}
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(fs.readFileSync(path.join(ROOT, '404.html'))); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(buf);
  });
});

(async () => {
  await new Promise(r => server.listen(8771, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:8771';

  // 1. Up to date, and every page it may send people to exists (no redirect loops)
  check('404.html is up to date (run node tools/build_calling_hours.js)', fs.readFileSync(path.join(ROOT, '404.html'), 'utf8') === notFound());
  const pages = siteUrls().filter(u => u !== '/').concat(['/ig/']);
  check('every known page exists', pages.every(u => fs.existsSync(path.join(ROOT, u, 'index.html'))), pages.filter(u => !fs.existsSync(path.join(ROOT, u, 'index.html'))));
  const html = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  check('noindex, no Dovetail', /<meta name="robots" content="noindex">/.test(html) && !/dovetail/i.test(html));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => h.startsWith('/'));
  check('every link is absolute and points at a real page', hrefs.length >= 15 && hrefs.every(h => { const p = h.split(/[?#]/)[0]; return fs.existsSync(path.join(ROOT, p, p.endsWith('/') ? 'index.html' : '')); }), hrefs.filter(h => { const p = h.split(/[?#]/)[0]; return !fs.existsSync(path.join(ROOT, p, p.endsWith('/') ? 'index.html' : '')); }));

  const br = await chromium.launch();
  const block = /gstatic\.com\/firebasejs|fonts\.googleapis|fonts\.gstatic|cloudfunctions|googletagmanager/;

  // 2. Redirects: the address bar ends where it should, ?utm tags kept
  const CASES = [
    ['/calling-hours/pa', '/calling-hours/pennsylvania/'], ['/calling-hours/PA/', '/calling-hours/pennsylvania/'], ['/calling-hours/tx', '/calling-hours/texas/'],
    ['/calling-hours/New_York', '/calling-hours/new-york/'], ['/calling-hours/newyork/', '/calling-hours/new-york/'], ['/calling-hours/dc', '/calling-hours/district-of-columbia/'],
    ['/calling-hours/Texas', '/calling-hours/texas/'], ['/Calling-Hours/', '/calling-hours/'], ['/hours/fl', '/calling-hours/florida/'], ['/florida-calling-hours', '/calling-hours/florida/'],
    ['/calling-hours/ohio.html', '/calling-hours/ohio/'], ['/hours', '/calling-hours/'],
    ['/IG', '/ig/'], ['/Power-Dialer-For-Solar-Sales', '/power-dialer-for-solar-sales/'], ['/solar', '/power-dialer-for-solar-sales/'], ['/insurance/', '/power-dialer-for-insurance-agents/'],
    ['/real-estate', '/power-dialer-for-real-estate-agents/'], ['/mca', '/power-dialer-for-business-funding/'], ['/auto', '/power-dialer-for-auto-sales/'],
    ['/phoneburner', '/phoneburner-alternative/'], ['/mojo', '/mojo-dialer-alternative/'], ['/batchdialer/', '/batchdialer-alternative/'],
  ];
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(block, r => r.abort());
    const bad = [];
    for (const [from, to] of CASES) {
      await page.goto(BASE + from + '?utm_source=test&utm_medium=x'); await page.waitForLoadState('load'); await page.waitForTimeout(150);
      const u = new URL(page.url());
      if (u.pathname !== to || u.searchParams.get('utm_source') !== 'test' || u.searchParams.get('utm_medium') !== 'x') bad.push(from + ' → ' + u.pathname + u.search);
    }
    check('short and mistyped addresses land on the right page with tags kept (' + CASES.length + ')', !bad.length, bad);
    // Every state by abbreviation and by name
    const tgt = await (async () => { await page.goto(BASE + '/nope-' + Date.now()); return page.evaluate(names => Object.keys(names).map(st => [st, window.vpex404Target('/calling-hours/' + st.toLowerCase()), window.vpex404Target('/calling-hours/' + names[st].replace(/ /g, ''))]), NAMES); })();
    const wrong = tgt.filter(([st, a, b]) => a !== '/calling-hours/' + slug(st) + '/' || b !== a);
    check('all 51 states by abbreviation and name', tgt.length === 51 && !wrong.length, wrong.slice(0, 5));
    // App jumps
    const jumps = [['/trial', '/', 'trial=start', ''], ['/signup?utm_source=ig', '/', 'trial=start', ''], ['/login', '/', '', ''], ['/demo/solar', '/', '', '#demo-solar'], ['/demo-insurance', '/', '', '#demo-insurance'], ['/demos/real-estate', '/', '', '#demo-realestate']];
    const jb = [];
    for (const [from, p, q, h] of jumps) {
      const t = await page.evaluate(f => window.vpex404Target(f.split('?')[0]), from);
      const want = p + (q ? '?' + q : '') + h;
      if (t !== want) jb.push(from + ' → ' + t);
    }
    check('trial, sign-in and demo shortcuts', !jb.length, jb);
    // The trial shortcut keeps the source tags too
    const navs = []; const onNav = f => { if (f === page.mainFrame()) navs.push(f.url()); }; page.on('framenavigated', onNav);
    await page.goto(BASE + '/trial?utm_source=ig&utm_campaign=w6'); await page.waitForTimeout(1500); page.off('framenavigated', onNav);
    check('/trial?utm… → the sales page with the form and tags', navs.some(u => { const q = new URL(u); return q.pathname === '/' && q.searchParams.get('trial') === 'start' && q.searchParams.get('utm_source') === 'ig' && q.searchParams.get('utm_campaign') === 'w6'; }), navs);
    await page.goto(BASE + '/nope-again');
    // Things that must NOT redirect
    const none = ['/wp-admin', '/calling-hours/zz', '/calling-hours/atlantis/', '/pricing-old', '/a/b/c', '/demo/pizza', '/x-calling-hours'];
    const nb = [];
    for (const f of none) if (await page.evaluate(f => window.vpex404Target(f), f)) nb.push(f);
    check('unknown addresses stay on the page (no guessing)', !nb.length, nb);
    check('no page errors (redirects)', !errs.length, errs);
    await ctx.close();
  }

  // 3. The page itself, at phone and computer sizes, dark and light
  const CONF = [{ n: '390 dark', w: 390, h: 844, s: 'dark', m: true }, { n: '390 light', w: 390, h: 844, s: 'light', m: true }, { n: '320 light', w: 320, h: 640, s: 'light', m: true }, { n: '1280 dark', w: 1280, h: 860, s: 'dark', m: false }];
  for (const c of CONF) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.m, hasTouch: c.m });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(block, r => r.abort());
    const t0 = Date.now();
    const resp = await page.goto(BASE + '/some/old-link'); const ms = Date.now() - t0;
    const r = await page.evaluate(() => {
      const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const bgOf = el => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
      const low = [];
      for (const el of document.querySelectorAll('h1, h2, p, a')) { const cr = ratio(getComputedStyle(el).color, bgOf(el)); if (cr < 4.5) low.push(el.textContent.trim().slice(0, 30) + ':' + cr.toFixed(2)); }
      return { h1: document.querySelector('h1').textContent, vis: getComputedStyle(document.body).visibility, url: location.pathname,
        small: [...document.querySelectorAll('a')].filter(a => a.getBoundingClientRect().height < 44).map(a => a.textContent.trim()),
        demos: document.querySelectorAll('a[href^="/#demo-"]').length, ind: document.querySelectorAll('a[href^="/power-dialer-for-"]').length,
        trial: document.querySelectorAll('a[href="/?trial=start"]').length, hours: !!document.querySelector('a[href="/calling-hours/"]'),
        sw: document.documentElement.scrollWidth, vw: innerWidth, low, txt: document.body.innerText };
    });
    const tag = '404 ' + c.n;
    check(tag + ': status 404 and the page shows (no redirect)', resp.status() === 404 && r.vis === 'visible' && r.url === '/some/old-link' && r.h1 === "That page isn't here.", { st: resp.status(), vis: r.vis, url: r.url });
    check(tag + ': 5 demos, trial, checker, 5 industry pages', r.demos === 5 && r.trial >= 2 && r.hours && r.ind === 5, r);
    check(tag + ': every link 44 px+', !r.small.length, r.small);
    check(tag + ': no sideways scroll', r.sw <= r.vw, { sw: r.sw, vw: r.vw });
    check(tag + ': contrast ≥ 4.5', !r.low.length, r.low);
    check(tag + ': $49 matches, no leftover words', r.txt.includes('$49 per rep per month') && !/undefined|NaN|\[object|\{\{/.test(r.txt));
    check(tag + ': loads under 2 s', ms < 2000, ms);
    check(tag + ': no page errors', !errs.length, errs);
    if (c.n === '390 dark') await page.screenshot({ path: process.env.SHOT_404 || '/dev/null' }).catch(() => {});
    // A demo link opens the demo office
    if (c.n === '390 light') {
      await page.click('a[href="/#demo-auto"]'); await page.waitForTimeout(2500);
      check(tag + ': demo link opens the auto demo', await page.evaluate(() => location.hash === '#demo-auto' && !!document.querySelector('.demo-pill, #demoExit')));
    }
    await ctx.close();
  }
  // $49 on the 404 page equals the sales page
  check('$49 matches the sales page', /\$49<\/b><span>per rep<br>per month/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));

  await br.close(); server.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
