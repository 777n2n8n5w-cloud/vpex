// vpexdialer.com/phoneburner-alternative/, /batchdialer-alternative/ and /mojo-dialer-alternative/ (the comparison pages) and the sales page's looks count.
//   python3 -m http.server 8765   (in the repo root)
//   NODE_PATH=<dir with playwright> node tests/compare_page.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = 'http://127.0.0.1:8765/';
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }
const CONFIGS = [
  { name: '390-dark', w: 390, h: 844, scheme: 'dark' }, { name: '390-light', w: 390, h: 844, scheme: 'light' },
  { name: '320-light', w: 320, h: 640, scheme: 'light' }, { name: '1280-dark', w: 1280, h: 860, scheme: 'dark' },
];
function lum(c) { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

(async () => {
  // Each comparison page: hand-written, but its prices must agree with the sales page and its maths with its own rival prices
  const PAGES = [
    { slug: 'phoneburner', name: 'PhoneBurner', dir: 'phoneburner-alternative', ids: ['cVpex', 'cPbM', 'cPbA'], m: 165, a: 140,
      src: ['https://www.phoneburner.com/pricing', 'https://www.phoneburner.com/faq'], tier: 'PhoneBurner Standard', other: '/batchdialer-alternative/' },
    { slug: 'batchdialer', name: 'BatchDialer', dir: 'batchdialer-alternative', ids: ['cVpex', 'cRvM', 'cRvA'], m: 119, a: 95,
      src: ['https://batchdialer.com/pricing'], tier: 'BatchDialer Starter', other: '/phoneburner-alternative/' },
    // Mojo: no yearly price; the third row is Triple Line + Agent Access ($139 + $10), the first Single Line + Agent Access ($89 + $10)
    { slug: 'mojo', name: 'Mojo Dialer', dir: 'mojo-dialer-alternative', ids: ['cVpex', 'cRvM', 'cRvA'], m: 99, a: 149,
      src: ['https://www.mojosells.com/pricing/', 'https://www.mojosells.com/faq/'], tier: 'Mojo Single Line', other: '/phoneburner-alternative/' },
  ];
  // Every comparison page links every other one
  for (const P of PAGES) { const h = fs.readFileSync(path.join(__dirname, '..', P.dir, 'index.html'), 'utf8');
    for (const Q of PAGES) if (Q !== P) check(P.slug + ': footer links /' + Q.dir + '/', h.includes('href="/' + Q.dir + '/"')); }
  const sm = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const money = n => '$' + n.toLocaleString('en-US');
  const br = await chromium.launch();
  for (const P of PAGES) {
    const html = fs.readFileSync(path.join(__dirname, '..', P.dir, 'index.html'), 'utf8');
    check(P.slug + ': sitemap lists /' + P.dir + '/', sm.includes('<loc>https://vpexdialer.com/' + P.dir + '/</loc>'));
    check(P.slug + ': canonical', html.includes('<link rel="canonical" href="https://vpexdialer.com/' + P.dir + '/">'));
    check(P.slug + ': says when prices were checked and links the sources', /checked <span id="checked">[A-Z][a-z]+ \d{1,2}, 20\d\d<\/span>/.test(html) && P.src.every(u => html.includes(u)));
    check(P.slug + ': not affiliated note', /isn't affiliated/.test(html));
    check(P.slug + ': no Dovetail', !/dovetail/i.test(html));
    check(P.slug + ': VPEX price on the page matches the sales page ($49)', /<b>\$49<\/b><span>per rep/.test(app) && /var VPEX = 49,/.test(html));
    check(P.slug + ': links the other comparison page', html.includes('href="' + P.other + '"'));
    for (const c of CONFIGS) {
      const N = P.slug + ' ' + c.name;
      const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });   // a US visitor: attribution on by default (consent.js)
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route(/fonts\.g/, r => r.abort());
      const t0 = Date.now(); await page.goto(ROOT + P.dir + '/', { waitUntil: 'load' }); const lt = Date.now() - t0;
      check(N + ': loads under 3 s', lt < 3000, lt);
      const r = await page.evaluate((ids) => {
        const vw = document.documentElement.clientWidth;
        const small = [...document.querySelectorAll('a, button, input')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height < 44; }).map(e => (e.textContent || e.id).trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height));
        const links = [...document.querySelectorAll('a[data-cta]')].map(a => a.getAttribute('href'));
        const cs = getComputedStyle(document.body);
        const dim = getComputedStyle(document.querySelector('.lede')).color, gold = getComputedStyle(document.querySelector('h1 em')).color;
        const card = getComputedStyle(document.querySelector('.card')).backgroundColor;
        const okc = getComputedStyle(document.querySelector('.rows .vp + dd')).color;
        return { sw: document.documentElement.scrollWidth > vw, small, links, bg: cs.backgroundColor, text: cs.color, dim, gold, card, okc,
          txt: document.body.innerText, h1: document.querySelector('h1').textContent, title: document.title,
          vals: ids.map(id => document.getElementById(id).textContent), save: document.getElementById('saveLine').textContent };
      }, P.ids);
      check(N + ': no sideways scroll', !r.sw);
      const tw = await page.evaluate(() => { const t = document.querySelector('.tw'); return t.scrollWidth - t.clientWidth; });
      check(N + ': the side-by-side table fits without scrolling', tw <= 1, tw);
      check(N + ': every tap target >= 44 px', r.small.length === 0, r.small);
      check(N + ': title and H1', new RegExp(P.name + ' alternative').test(r.title) && new RegExp(P.name + ' alternative at \\$49 per rep').test(r.h1.replace(/\s+/g, ' ')), r.h1);
      check(N + ': 10 reps by default', JSON.stringify(r.vals) === JSON.stringify([money(490), money(10 * P.m), money(10 * P.a)]), r.vals);
      const d10 = 10 * P.m - 490;
      check(N + ': saving line', r.save.includes(money(d10) + ' less a month') && r.save.includes(P.tier) && r.save.includes('(' + money(d10 * 12) + ' a year)'), r.save);
      check(N + ': honest about what VPEX lacks', /Call recording\s+No/.test(r.txt) && /Voicemail drop\s+No/.test(r.txt) && new RegExp('When ' + P.name + ' is the better pick').test(r.txt));
      check(N + ': no leftover words', !/undefined|NaN|null/.test(r.txt));
      check(N + ': 7 tagged links (top, 5 demos, trial)', r.links.length === 7 && r.links.every(h => h.includes('utm_source=compare&utm_medium=page&utm_campaign=' + P.slug + '&utm_content=')), r.links);
      check(N + ': text contrast >= 7', ratio(r.text, r.bg) >= 7, ratio(r.text, r.bg));
      check(N + ': dim text and gold >= 4.5 on the page', ratio(r.dim, r.bg) >= 4.5 && ratio(r.gold, r.bg) >= 4.5, [ratio(r.dim, r.bg), ratio(r.gold, r.bg)]);
      check(N + ': VPEX total colour >= 4.5 on the card', ratio(r.okc, r.card) >= 4.5, ratio(r.okc, r.card));
      await page.click('#plus'); await page.click('#plus');
      let v = await page.evaluate(ids => [document.getElementById('reps').value].concat(ids.map(id => document.getElementById(id).textContent), [document.getElementById('saveLine').textContent]), P.ids);
      const d12 = 12 * P.m - 588;
      check(N + ': + twice → 12 reps', v[0] === '12' && v[1] === '$588' && v[2] === money(12 * P.m) && v[3] === money(12 * P.a) && v[4].includes(money(d12) + ' less a month') && v[4].includes(money(d12 * 12) + ' a year'), v);
      await page.fill('#reps', '1'); await page.click('#minus');
      v = await page.evaluate(ids => [document.getElementById('reps').value].concat(ids.map(id => document.getElementById(id).textContent)), P.ids);
      check(N + ': never below 1 rep', v[0] === '1' && v[1] === '$49' && v[3] === money(P.a), v);
      await page.evaluate(() => { const i = document.getElementById('reps'); i.value = ''; i.dispatchEvent(new Event('change')); });
      v = await page.evaluate(() => [document.getElementById('reps').value, document.getElementById('cVpex').textContent]);
      check(N + ': emptied box → 1 rep', v[0] === '1' && v[1] === '$49', v);
      await page.fill('#reps', '250');
      v = await page.evaluate(id => document.getElementById(id).textContent, P.ids[1]);
      check(N + ': 250 reps', v === money(250 * P.m), v);
      check(N + ': no page errors', errs.length === 0, errs);
      if (c.name === '390-dark') {
        await page.goto(ROOT + P.dir + '/');
        const href = await page.getAttribute('a[data-cta="demo-solar"]', 'href');
        await page.goto(ROOT + 'index.html' + href.slice(1)); await page.waitForTimeout(2500);
        const d = await page.evaluate(() => ({ url: location.href, attr: localStorage.getItem('vpex_attr') }));
        check(P.slug + ' demo link: utm tags stripped from the address', !/utm_/.test(d.url), d.url);
        check(P.slug + ' demo link: source remembered as compare/' + P.slug, /"s":"compare"/.test(d.attr || '') && new RegExp('"c":"' + P.slug + '"').test(d.attr || ''), d.attr);
      }
      await ctx.close();
    }
  }
  // Sales page: the looks count equals the public themes (All chip − Auto), and the compare link is 44 px and works
  for (const c of [CONFIGS[0], CONFIGS[3]]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic|googleapis/, r => r.abort());
    await page.goto(ROOT + 'index.html#mockbench'); await page.waitForTimeout(1500);
    for (const [href, label] of [['/phoneburner-alternative/', /Coming from PhoneBurner\? Compare the cost/], ['/batchdialer-alternative/', /Coming from BatchDialer\? Compare the cost/], ['/mojo-dialer-alternative/', /Coming from Mojo\? Compare the cost/]]) {
      const s = await page.evaluate((href) => {
        const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === href);
        a && a.scrollIntoView({ block: 'center' });
        const b = a && a.getBoundingClientRect(); const hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { h: b ? b.height : 0, hit: !!(hit && a.contains(hit)), text: a ? a.textContent : '' };
      }, href);
      check(c.name + ' sales page: ' + href + ' link >= 44 px and answers a tap', s.h >= 44 && s.hit, s);
      check(c.name + ' sales page: ' + href + ' link text', label.test(s.text), s.text);
    }
    const s = await page.evaluate(() => { const t = document.body.innerText; return { looks: (t.match(/(\d+) looks, one for every rep/) || [])[1], incl: (t.match(/All (\d+) looks/) || [])[1] }; });
    // Count the public themes from the picker (needs an app screen): open a demo and read the All chip
    const p2 = await ctx.newPage(); await p2.route(/gstatic|googleapis/, r => r.abort());
    await p2.goto(ROOT + 'index.html#demo-insurance'); await p2.waitForTimeout(2000);
    await p2.evaluate(() => document.getElementById('openThemesBtn').click()); await p2.waitForTimeout(400);
    const all = await p2.evaluate(() => Number(document.querySelector('[data-themecat="all"]').textContent.replace(/\D+/g, '')));
    check(c.name + ' sales page: "N looks" = public themes (' + (all - 1) + ')', Number(s.looks) === all - 1 && Number(s.incl) === all - 1, [s.looks, s.incl, all]);
    check(c.name + ' sales page: no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`compare_page: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
