// vpexdialer.com/power-dialer-for-insurance-agents/ (industry landing page): claims backed by the app, honest limits, tagged links, phone fit.
//   python3 -m http.server 8765   (in the repo root)
//   NODE_PATH=<dir with playwright> node tests/industry_page.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = 'http://127.0.0.1:8765/', DIR = 'power-dialer-for-insurance-agents';
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }
function lum(c) { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', DIR, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sm = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
  check('sitemap lists the page', sm.includes('<loc>https://vpexdialer.com/' + DIR + '/</loc>'));
  check('canonical', html.includes('<link rel="canonical" href="https://vpexdialer.com/' + DIR + '/">'));
  check('no Dovetail', !/dovetail/i.test(html));
  check('price matches the sales page ($49)', /<b>\$49<\/b><span>per rep/.test(app) && /<b>\$49<\/b><span>per agent a month/.test(html));
  // The compliance line is the app's own, word for word
  const line = (app.match(/Based on published state rules as of [A-Z][a-z]+ 20\d\d\. Not legal advice\./) || [])[0];
  check('compliance line equals the app\'s', line && html.includes(line), line);
  // Every claim the page makes is in the app
  const Q = app.slice(app.indexOf('var QUALIFY = {'), app.indexOf('realestate: [', app.indexOf('var QUALIFY = {')));
  for (const k of ['Term life', 'Whole life', 'Final expense', 'IUL', 'Annuity', 'Medicare', 'Home & auto', 'Age', 'Coverage', 'Budget a month', 'Tobacco', 'Current carrier', 'Renewal or X-date']) check('app asks insurance: ' + k, Q.includes('"' + k + '"'));
  check('app has the Medicare Scope of Appointment note', /Medicare[^"]*Scope of Appointment on record/.test(app));
  check('app script has the Medicare disclaimer spot', app.includes('read your required disclaimer here, before you talk about any plan\'s benefits'));
  for (const o of ['I already have coverage.', 'It\'s too expensive.', 'Just mail me something.']) check('app has the rebuttal: ' + o, app.includes('["' + o));
  const SH = app.slice(app.indexOf('FL: { h:'), app.indexOf('OR: { h:') + 40);
  check('3-call states in the app are FL, MD, OK, OR', ['FL', 'MD', 'OK', 'OR'].every(s => new RegExp(s + ': \\{[^}]*max3: true').test(app)) && (app.match(/max3: true/g) || []).length === 4);
  check('stricter-state count (20) matches STATE_HOURS', (() => { const blk = app.slice(app.indexOf('var STATE_HOURS'), app.indexOf('};', app.indexOf('var STATE_HOURS'))); return (blk.match(/^\s+[A-Z]{2}: \{/gm) || []).length === 20; })());
  const CONFIGS = [{ n: '390-dark', w: 390, h: 844, s: 'dark' }, { n: '390-light', w: 390, h: 844, s: 'light' }, { n: '320-light', w: 320, h: 640, s: 'light' }, { n: '1280-dark', w: 1280, h: 860, s: 'dark' }];
  const br = await chromium.launch();
  for (const c of CONFIGS) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); await page.route(/fonts\.g/, r => r.abort());
    const t0 = Date.now(); await page.goto(ROOT + DIR + '/', { waitUntil: 'load' }); const lt = Date.now() - t0;
    check(c.n + ': loads under 3 s', lt < 3000, lt);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth, cs = getComputedStyle(document.body);
      return { sw: document.documentElement.scrollWidth > vw, txt: document.body.innerText, title: document.title, h1: document.querySelector('h1').textContent,
        small: [...document.querySelectorAll('a, button')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height < 44 && !e.closest('.feat, .comp, .fine, .list'); }).map(e => e.textContent.trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height)),
        links: [...document.querySelectorAll('a[data-cta]')].map(a => a.getAttribute('href')), bg: cs.backgroundColor, text: cs.color,
        dim: getComputedStyle(document.querySelector('.feat span')).color, card: getComputedStyle(document.querySelector('.feat li')).backgroundColor, gold: getComputedStyle(document.querySelector('h1 em')).color,
        btn: [...document.querySelectorAll('a.cta, a.topcta')].map(a => { const c = getComputedStyle(a); return [c.color, c.backgroundColor]; }) };
    });
    check(c.n + ': no sideways scroll', !r.sw);
    check(c.n + ': title and H1', /Power dialer for insurance agents/.test(r.title) && /power dialer for insurance agents/i.test(r.h1), r.h1);
    check(c.n + ': buttons and nav links >= 44 px', r.small.length === 0, r.small);
    check(c.n + ': 3 tagged links (top, demo, trial)', r.links.length === 3 && r.links.every(h => h.includes('utm_source=landing&utm_medium=page&utm_campaign=insurance&utm_content=')), r.links);
    check(c.n + ': trial links open the form with insurance picked', r.links.filter(h => /trial=insurance/.test(h)).length === 2);
    check(c.n + ': honest about what VPEX lacks', /No call recording/.test(r.txt) && /No voicemail drop/.test(r.txt) && /National Do Not Call Registry/.test(r.txt));
    check(c.n + ': no leftover words', !/undefined|NaN|null/.test(r.txt));
    check(c.n + ': contrast (text 7, dim on cards 4.5, gold 4.5)', ratio(r.text, r.bg) >= 7 && ratio(r.dim, r.card) >= 4.5 && ratio(r.gold, r.bg) >= 4.5, [ratio(r.text, r.bg), ratio(r.dim, r.card), ratio(r.gold, r.bg)]);
    check(c.n + ': every button\'s text >= 4.5 on its own background', r.btn.length === 3 && r.btn.every(([f, b]) => !/rgba\(0, 0, 0, 0\)/.test(b) && ratio(f, b) >= 4.5), r.btn);
    check(c.n + ': no page errors', errs.length === 0, errs);
    if (c.n === '390-dark') {
      const href = r.links.find(h => /demo-insurance/.test(h));
      await page.goto(ROOT + 'index.html' + href.slice(1)); await page.waitForTimeout(2500);
      const d = await page.evaluate(() => ({ url: location.href, attr: localStorage.getItem('vpex_attr'), demo: !!document.querySelector('#demoBar, .demo-bar') || /Demo/.test(document.body.innerText) }));
      check('demo link: opens the insurance demo, tags stripped', !/utm_/.test(d.url) && /demo-insurance/.test(d.url) && d.demo, d);
      check('demo link: source remembered as landing/insurance', /"s":"landing"/.test(d.attr || '') && /"c":"insurance"/.test(d.attr || ''), d.attr);
      const fx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const fp = await fx.newPage(); await fp.route(/gstatic|googleapis/, q => q.abort());
      await fp.goto(ROOT + r.links.find(h => /utm_content=trial/.test(h)).slice(1) + '#mockbench'); await fp.waitForTimeout(2600);
      const f = await fp.evaluate(() => ({ ind: (document.getElementById('suInd') || {}).value, url: location.href }));
      check('trial link: form opens with Insurance picked, tags removed', f.ind === 'insurance' && !/trial=|utm_/.test(f.url), f); await fx.close();
    }
    await ctx.close();
  }
  // Sales page links the page with a 44 px tap target
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); await p.route(/gstatic|googleapis/, r => r.abort());
  await p.goto(ROOT + 'index.html#mockbench'); await p.waitForTimeout(1500);
  const s = await p.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === '/power-dialer-for-insurance-agents/'); if (!a) return {}; a.scrollIntoView({ block: 'center' });
    const b = a.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { h: b.height, hit: !!(hit && a.contains(hit)), t: a.textContent }; });
  check('sales page: insurance link >= 44 px and answers a tap', s.h >= 44 && s.hit, s);
  await br.close();
  console.log(`industry_page: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
