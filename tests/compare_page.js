// vpexdialer.com/phoneburner-alternative/ (the comparison page) and the sales page's looks count.
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
  // Static: sitemap lists the page; the page is hand-written but its prices must agree with the sales page
  const html = fs.readFileSync(path.join(__dirname, '..', 'phoneburner-alternative', 'index.html'), 'utf8');
  const sm = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
  check('sitemap lists /phoneburner-alternative/', sm.includes('<loc>https://vpexdialer.com/phoneburner-alternative/</loc>'));
  check('canonical', html.includes('<link rel="canonical" href="https://vpexdialer.com/phoneburner-alternative/">'));
  check('says when PhoneBurner prices were checked and links the sources', /checked <span id="checked">[A-Z][a-z]+ \d{1,2}, 20\d\d<\/span>/.test(html) && html.includes('https://www.phoneburner.com/pricing') && html.includes('https://www.phoneburner.com/faq'));
  check('not affiliated note', /isn't affiliated/.test(html));
  check('no Dovetail', !/dovetail/i.test(html));
  const app = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('VPEX price on the page matches the sales page ($49)', /<b>\$49<\/b><span>per rep/.test(app) && /var VPEX = 49,/.test(html));

  const br = await chromium.launch();
  for (const c of CONFIGS) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/fonts\.g/, r => r.abort());
    const t0 = Date.now(); await page.goto(ROOT + 'phoneburner-alternative/', { waitUntil: 'load' }); const lt = Date.now() - t0;
    check(c.name + ': loads under 3 s', lt < 3000, lt);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const small = [...document.querySelectorAll('a, button, input')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height < 44; }).map(e => (e.textContent || e.id).trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height));
      const links = [...document.querySelectorAll('a[data-cta]')].map(a => a.getAttribute('href'));
      const cs = getComputedStyle(document.body);
      const dim = getComputedStyle(document.querySelector('.lede')).color, gold = getComputedStyle(document.querySelector('h1 em')).color;
      const card = getComputedStyle(document.querySelector('.card')).backgroundColor;
      const okc = getComputedStyle(document.querySelector('.rows .vp + dd')).color;
      return { sw: document.documentElement.scrollWidth > vw, small, links, bg: cs.backgroundColor, text: cs.color, dim, gold, card, okc,
        txt: document.body.innerText, h1: document.querySelector('h1').textContent, title: document.title,
        vals: ['cVpex', 'cPbM', 'cPbA'].map(id => document.getElementById(id).textContent), save: document.getElementById('saveLine').textContent };
    });
    check(c.name + ': no sideways scroll', !r.sw);
    const tw = await page.evaluate(() => { const t = document.querySelector('.tw'); return t.scrollWidth - t.clientWidth; });
    check(c.name + ': the side-by-side table fits without scrolling', tw <= 1, tw);
    check(c.name + ': every tap target >= 44 px', r.small.length === 0, r.small);
    check(c.name + ': title and H1', /PhoneBurner alternative/.test(r.title) && /PhoneBurner alternative at \$49 per rep/.test(r.h1.replace(/\s+/g, ' ')), r.h1);
    check(c.name + ': 10 reps by default: $490 / $1,650 / $1,400', JSON.stringify(r.vals) === '["$490","$1,650","$1,400"]', r.vals);
    check(c.name + ': saving line', /\$1,160 less a month.*\(\$13,920 a year\)/.test(r.save), r.save);
    check(c.name + ': honest about what VPEX lacks', /Call recording\s+No/.test(r.txt) && /Voicemail drop\s+No/.test(r.txt) && /When PhoneBurner is the better pick/.test(r.txt));
    check(c.name + ': no leftover words', !/undefined|NaN|null/.test(r.txt));
    check(c.name + ': 7 tagged links (top, 5 demos, trial)', r.links.length === 7 && r.links.every(h => /utm_source=compare&utm_medium=page&utm_campaign=phoneburner&utm_content=/.test(h)), r.links);
    check(c.name + ': text contrast >= 7', ratio(r.text, r.bg) >= 7, ratio(r.text, r.bg));
    check(c.name + ': dim text and gold >= 4.5 on the page', ratio(r.dim, r.bg) >= 4.5 && ratio(r.gold, r.bg) >= 4.5, [ratio(r.dim, r.bg), ratio(r.gold, r.bg)]);
    check(c.name + ': VPEX total colour >= 4.5 on the card', ratio(r.okc, r.card) >= 4.5, ratio(r.okc, r.card));
    // Calculator: + and − and typing
    await page.click('#plus'); await page.click('#plus');
    let v = await page.evaluate(() => [document.getElementById('reps').value, document.getElementById('cVpex').textContent, document.getElementById('cPbM').textContent, document.getElementById('saveLine').textContent]);
    check(c.name + ': + twice → 12 reps, $588 vs $1,980, $1,392 less', v[0] === '12' && v[1] === '$588' && v[2] === '$1,980' && /\$1,392 less a month.*\$16,704 a year/.test(v[3]), v);
    await page.fill('#reps', '1'); await page.click('#minus');
    v = await page.evaluate(() => [document.getElementById('reps').value, document.getElementById('cVpex').textContent, document.getElementById('cPbA').textContent]);
    check(c.name + ': never below 1 rep', v[0] === '1' && v[1] === '$49' && v[2] === '$140', v);
    await page.evaluate(() => { const i = document.getElementById('reps'); i.value = ''; i.dispatchEvent(new Event('change')); });
    v = await page.evaluate(() => [document.getElementById('reps').value, document.getElementById('cVpex').textContent]);
    check(c.name + ': emptied box → 1 rep', v[0] === '1' && v[1] === '$49', v);
    await page.fill('#reps', '250');
    v = await page.evaluate(() => document.getElementById('cPbM').textContent);
    check(c.name + ': 250 reps → $41,250', v === '$41,250', v);
    check(c.name + ': no page errors', errs.length === 0, errs);
    if (c.name === '390-dark') {
      // The trial link opens the trial form; a demo link lands in the demo with the source remembered and the tags stripped
      await page.goto(ROOT + 'phoneburner-alternative/');
      const href = await page.getAttribute('a[data-cta="demo-solar"]', 'href');
      await page.goto(ROOT + 'index.html' + href.slice(1)); await page.waitForTimeout(2500);
      const d = await page.evaluate(() => ({ url: location.href, attr: localStorage.getItem('vpex_attr'), demo: !!document.querySelector('#demoBar, .demo-bar') }));
      check('demo link: utm tags stripped from the address', !/utm_/.test(d.url), d.url);
      check('demo link: source remembered as compare/page/phoneburner', /"s":"compare"/.test(d.attr || '') && /"c":"phoneburner"/.test(d.attr || ''), d.attr);
    }
    await ctx.close();
  }
  // Sales page: the looks count equals the public themes (All chip − Auto), and the compare link is 44 px and works
  for (const c of [CONFIGS[0], CONFIGS[3]]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.scheme, isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic|googleapis/, r => r.abort());
    await page.goto(ROOT + 'index.html#mockbench'); await page.waitForTimeout(1500);
    const s = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === '/phoneburner-alternative/');
      a && a.scrollIntoView({ block: 'center' });
      const b = a && a.getBoundingClientRect(); const hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const t = document.body.innerText;
      return { h: b ? b.height : 0, hit: !!(hit && a.contains(hit)), text: a ? a.textContent : '', looks: (t.match(/(\d+) looks, one for every rep/) || [])[1], incl: (t.match(/All (\d+) looks/) || [])[1] };
    });
    check(c.name + ' sales page: compare link >= 44 px and answers a tap', s.h >= 44 && s.hit, s);
    check(c.name + ' sales page: compare link text', /Coming from PhoneBurner\? Compare the cost/.test(s.text), s.text);
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
