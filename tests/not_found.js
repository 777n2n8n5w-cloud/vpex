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
const HITS = [];   // beacons the pages send to the counter (pointed here with localStorage vpex_hit_test)
const server = http.createServer((req, res) => {
  if (req.url === '/__hit') { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { HITS.push(JSON.parse(b)); } catch (e) {} res.writeHead(204); res.end(); }); return; }
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
  check('noindex, no Dovetail (apart from the counter address)', /<meta name="robots" content="noindex">/.test(html) && !/dovetail/i.test(html.split('https://us-central1-dovetail-f863c.cloudfunctions.net/hit').join('')));
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
  // 4. Counting (functions/ "hit", step "lost") and passing an outside source on to the app pages
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('vpex_hit_test', location.origin + '/__hit'); } catch (e) {} });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(block, r => r.abort());
    const lostHits = () => HITS.filter(h => h.e === 'lost');
    const waitHit = async n => { for (let i = 0; i < 40 && lostHits().length < n; i++) await page.waitForTimeout(50); return lostHits()[n - 1]; };
    HITS.length = 0;
    await page.goto(BASE + '/some/Old-Link', { referer: 'https://www.google.com/search?q=x' });
    let h = await waitHit(1);
    check('count: a not-found address from Google is counted once (lost, google, 404, the address)', h && h.s === 'google' && h.m === '404' && h.c === 'some/old-link' && h.n === '' && /^[md]$/.test(h.d) && lostHits().length === 1, HITS);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href')));
    const app = links.filter(x => /^\/(\?|#|$)/.test(x)), other = links.filter(x => !/^\/(\?|#|$)/.test(x));
    check('source: links to the sales page, demos and trial carry utm_source=google&utm_medium=referral', app.length >= 8 && app.every(x => /utm_source=google&utm_medium=referral/.test(x)), app);
    check('source: the demo hash stays at the end', links.includes('/?utm_source=google&utm_medium=referral#demo-auto') && links.includes('/?trial=start&utm_source=google&utm_medium=referral'), app);
    check('source: links to the static pages stay as they are (they tag their own links)', other.length >= 9 && other.every(x => !/utm_/.test(x)), other);
    await page.click('a[href$="#demo-solar"]'); await page.waitForTimeout(2500);
    check('source: the demo opened from the 404 page credits Google', await page.evaluate(() => { try { const a = JSON.parse(localStorage.getItem('vpex_attr')); return a.s === 'google' && a.m === 'referral' && location.hash === '#demo-solar' && !/utm_/.test(location.search); } catch (e) { return false; } }));
    // A shortcut that moves on: counted as "moved", the outside source passed on
    HITS.length = 0;
    const navs = []; const onNav = f => { if (f === page.mainFrame()) navs.push(f.url()); }; page.on('framenavigated', onNav);
    await page.goto(BASE + '/trial', { referer: 'https://www.bing.com/' }); h = await waitHit(1); await page.waitForTimeout(800); page.off('framenavigated', onNav);
    check('count: /trial from Bing is counted as moved', h && h.s === 'bing' && h.m === 'moved' && h.c === 'trial', HITS);
    check('source: /trial from Bing lands on the trial form credited to Bing', navs.some(u => { const q = new URL(u); return q.pathname === '/' && q.searchParams.get('trial') === 'start' && q.searchParams.get('utm_source') === 'bing' && q.searchParams.get('utm_medium') === 'referral'; }), navs);
    // Tags already on the link win; a static target keeps them as they were
    HITS.length = 0;
    await page.goto(BASE + '/calling-hours/pa?utm_source=ig&utm_campaign=w6', { referer: 'https://www.google.com/' }); h = await waitHit(1); await page.waitForTimeout(300);
    const u = new URL(page.url());
    check('count: a tagged link counts its own source', h && h.s === 'ig' && h.m === 'moved' && h.c === 'calling-hours/pa', HITS);
    check('source: tags already there are kept, nothing added', u.pathname === '/calling-hours/pennsylvania/' && u.searchParams.get('utm_source') === 'ig' && u.searchParams.get('utm_campaign') === 'w6' && !u.searchParams.get('utm_medium'), u.href);
    // A broken link on VPEX's own pages: counted as vpexdialer, links not tagged
    HITS.length = 0;
    await page.goto(BASE + '/pricing', { referer: BASE + '/calling-hours/' }); h = await waitHit(1);
    check('count: a broken link on our own site is counted as vpexdialer', h && h.s === 'vpexdialer' && h.m === '404' && h.c === 'pricing', HITS);
    check('source: own-site visits leave the links untagged', await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].every(a => !/utm_/.test(a.getAttribute('href')))));
    // Typed in: direct, untagged
    HITS.length = 0;
    await page.goto(BASE + '/Call/Pat.Smith@Example.com/5551234567/x'); h = await waitHit(1);
    check('count: typed-in address is direct; anything with @ and long digit runs left out', h && h.s === 'direct' && h.c === 'call/email/n/x' && !/pat|example|555/i.test(JSON.stringify(h)), h);
    check('source: typed-in visits leave the links untagged', await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].every(a => !/utm_/.test(a.getAttribute('href')))));
    check('count: the server takes it (step lost is known, address tokenized)', (() => { const L = require(path.join(ROOT, 'functions', 'lib.js')); const p = L.parseHit(JSON.stringify(h)); return p && p.e === 'lost' && p.c === 'call-email-n-x'; })());
    check('no page errors (counting)', !errs.length, errs);
    await ctx.close();
    // Counting is off unless the page is on vpexdialer.com (or a test turns it on)
    const c2 = await br.newContext(); const p2 = await c2.newPage(); await p2.route(block, r => r.abort());
    HITS.length = 0; await p2.goto(BASE + '/nothing-here'); await p2.waitForTimeout(400);
    check('count: off on other hosts', !HITS.length, HITS);
    await c2.close();
  }

  // $49 on the 404 page equals the sales page
  check('$49 matches the sales page', /\$49<\/b><span>per rep<br>per month/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));

  await br.close(); server.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
