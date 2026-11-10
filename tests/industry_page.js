// vpexdialer.com/power-dialer-for-*/ (five industry pages): built from tools/build_industry_pages.py, every claim backed by index.html,
// honest limits, tagged links that open that industry's demo and trial form, phone fit, contrast.
//   python3 -m http.server 8765   (in the repo root)
//   NODE_PATH=<dir with playwright> node tests/industry_page.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = 'http://127.0.0.1:8765/', REPO = path.join(__dirname, '..');
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }
function lum(c) { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// What each page claims, and where the app backs it (QUALIFY labels, pipeline words/steps, rebuttals, the lead notes, texts)
const PAGES = [
  { k: 'insurance', dir: 'power-dialer-for-insurance-agents', h1: /power dialer for insurance agents/i,
    q: ['Term life', 'Whole life', 'Final expense', 'IUL', 'Annuity', 'Medicare', 'Home & auto', 'Age', 'Coverage', 'Budget a month', 'Tobacco', 'Current carrier', 'Renewal or X-date'],
    words: [], reb: ['I already have coverage.', 'It\'s too expensive.', 'Just mail me something.'], notes: [/Medicare[^"]*Scope of Appointment on record/, /read your required disclaimer here, before you talk about any plan's benefits/],
    text: ['your insurance quote', 'your policy review'] },
  { k: 'realestate', dir: 'power-dialer-for-real-estate-agents', h1: /power dialer for real estate agents/i,
    q: ['Buying or selling', 'Property', 'Price range', 'Timeframe', 'Financing', 'Has an agent', 'Why moving'],
    words: ['Appointment set', 'Negotiating', 'Under contract', 'Sold', 'Offer accepted', 'Inspection done', 'Appraisal in', 'Deal closed'],
    reb: ['I\'m going to sell it myself.', 'Your commission is too high.', 'Call me in a few months.'], notes: [/Don.t pitch your services while they.re under an agreement with someone else/], text: ['your property', 'your appointment'] },
  { k: 'mca', dir: 'power-dialer-for-business-funding', h1: /power dialer for business funding floors/i,
    q: ['Business', 'Industry', 'Monthly revenue', 'Time in business', 'Credit', 'Open advances', 'Amount needed'],
    words: ['App sent', 'Negotiating', 'Submitted', 'Approved', 'Offer accepted', 'Contract signed', 'Funded'],
    reb: ['I don\'t need money right now.', 'The rates are too high.', 'I already have an advance.'], notes: [/if \(!name\) name = at\(row, map\.company\) \|\| qf\.business/], text: ['funding for your business', 'your funding call'] },
  { k: 'auto', dir: 'power-dialer-for-auto-sales', h1: /power dialer for auto sales teams/i,
    q: ['Vehicle wanted', 'New or used', 'Trade-in', 'Payment budget', 'Credit', 'Buying', 'Lease or loan ends'],
    words: ['Appointment set', 'Test drive', 'Negotiating', 'Sold', 'Delivered', 'Credit app in', 'Approved', 'Deal signed'],
    reb: ['Just send me your best price.', 'My credit isn\'t great.', 'The price is too high.'], notes: [], text: ['the vehicle you were looking at', 'your visit'] },
  { k: 'solar', dir: 'power-dialer-for-solar-sales', h1: /power dialer for solar sales teams/i,
    q: ['Owns the home', 'Electric bill a month', 'Utility', 'Roof age', 'Shade', 'Credit 650+', 'All owners at the appointment'],
    words: ['Proposal sent', 'Financing', 'Signed', 'Installed', 'Activated', 'Cancel period over', 'Site survey', 'Permit approved', 'Permission to operate'],
    reb: ['It\'s too expensive.', 'My roof is old.', 'I rent my home.'], notes: [/Only the homeowner can sign for solar/], text: ['lowering your electric bill', 'your solar consultation'] },
];
(async () => {
  const app = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const sm = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
  let built = true; try { execFileSync('python3', [path.join(REPO, 'tools/build_industry_pages.py'), REPO, 'check'], { stdio: 'pipe' }); } catch (e) { built = false; }
  check('the five pages equal a fresh build (tools/build_industry_pages.py)', built);
  const line = (app.match(/Based on published state rules as of [A-Z][a-z]+ 20\d\d\. Not legal advice\./) || [])[0];
  check('3-call states in the app are FL, MD, OK, OR', ['FL', 'MD', 'OK', 'OR'].every(s => new RegExp(s + ': \\{[^}]*max3: true').test(app)) && (app.match(/max3: true/g) || []).length === 4);
  check('stricter-state count (20) matches STATE_HOURS', (() => { const blk = app.slice(app.indexOf('var STATE_HOURS'), app.indexOf('};', app.indexOf('var STATE_HOURS'))); return (blk.match(/^\s+[A-Z]{2}: \{/gm) || []).length === 20; })());
  const qStart = app.indexOf('var QUALIFY = {');
  for (const P of PAGES) {
    const html = fs.readFileSync(path.join(REPO, P.dir, 'index.html'), 'utf8');
    check(P.k + ': sitemap lists the page', sm.includes('<loc>https://vpexdialer.com/' + P.dir + '/</loc>'));
    check(P.k + ': canonical', html.includes('<link rel="canonical" href="https://vpexdialer.com/' + P.dir + '/">'));
    check(P.k + ': no Dovetail', !/dovetail/i.test(html));
    check(P.k + ': price matches the sales page ($49)', /<b>\$49<\/b><span>per rep/.test(app) && /<b>\$49<\/b><span>per [a-z]+ a month/.test(html));
    check(P.k + ': compliance line equals the app\'s', line && html.includes(line), line);
    check(P.k + ': links the other four pages', PAGES.filter(o => o !== P).every(o => html.includes('href="/' + o.dir + '/"')));
    const qs = app.indexOf('    ' + P.k + ': [', qStart), Q = app.slice(qs, app.indexOf('\n    ],', qs));
    check(P.k + ': every detail it names is a question in the app', P.q.every(x => Q.includes('"' + x + '"')), P.q.filter(x => !Q.includes('"' + x + '"')));
    const ind = app.slice(app.indexOf('    ' + P.k + ': {', app.indexOf('var INDUSTRIES')), app.indexOf('demo: {', app.indexOf('    ' + P.k + ': {', app.indexOf('var INDUSTRIES'))));
    check(P.k + ': pipeline words and closing steps are the app\'s', P.words.every(w => ind.includes('"' + w + '"')), P.words.filter(w => !ind.includes('"' + w + '"')));
    check(P.k + ': rebuttals are in the app', P.reb.every(o => app.includes('["' + o)), P.reb.filter(o => !app.includes('["' + o)));
    check(P.k + ': notes and reminders are in the app', P.notes.every(r => r.test(app)));
    check(P.k + ': texts are about what the app\'s texts are about', P.text.every(t => app.includes('"' + t + '"')));
  }
  const CONFIGS = [{ n: '390-dark', w: 390, h: 844, s: 'dark' }, { n: '390-light', w: 390, h: 844, s: 'light' }, { n: '320-light', w: 320, h: 640, s: 'light' }, { n: '1280-dark', w: 1280, h: 860, s: 'dark' }];
  const br = await chromium.launch();
  for (const P of PAGES) for (const c of CONFIGS) {
    const N = P.k + ' ' + c.n;
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });   // US visitor: attribution on by default (consent.js)
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); await page.route(/fonts\.g/, r => r.abort());
    const t0 = Date.now(); await page.goto(ROOT + P.dir + '/', { waitUntil: 'load' }); const lt = Date.now() - t0;
    check(N + ': loads under 3 s', lt < 3000, lt);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth, cs = getComputedStyle(document.body);
      return { sw: document.documentElement.scrollWidth > vw, txt: document.body.innerText, title: document.title, h1: document.querySelector('h1').textContent,
        small: [...document.querySelectorAll('a, button')].filter(e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width && (b.height + parseFloat(s.marginTop) * 0 < 44) && !(e.closest('.comp, .fine') && b.height >= 40); }).map(e => e.textContent.trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height)),
        links: [...document.querySelectorAll('a[data-cta]')].map(a => a.getAttribute('href')), bg: cs.backgroundColor, text: cs.color,
        dim: getComputedStyle(document.querySelector('.feat span')).color, card: getComputedStyle(document.querySelector('.feat li')).backgroundColor, gold: getComputedStyle(document.querySelector('h1 em')).color,
        btn: [...document.querySelectorAll('a.cta, a.topcta')].map(a => { const s = getComputedStyle(a); return [s.color, s.backgroundColor]; }) };
    });
    check(N + ': no sideways scroll', !r.sw);
    check(N + ': title and H1', /^Power dialer for /.test(r.title) && /\$49 per (rep|agent)/.test(r.title) && P.h1.test(r.h1), [r.title, r.h1]);
    check(N + ': every tap target >= 44 px (inline links >= 40 px)', r.small.length === 0, r.small);
    check(N + ': 3 tagged links (top, demo, trial)', r.links.length === 3 && r.links.every(h => h.includes('utm_source=landing&utm_medium=page&utm_campaign=' + P.k + '&utm_content=')), r.links);
    check(N + ': demo link opens the ' + P.k + ' demo; trial links pick ' + P.k, r.links.filter(h => h.endsWith('#demo-' + P.k)).length === 1 && r.links.filter(h => h.endsWith('trial=' + P.k)).length === 2, r.links);
    check(N + ': honest about what VPEX lacks', /No call recording/.test(r.txt) && /No voicemail drop/.test(r.txt) && /National Do Not Call Registry/.test(r.txt));
    check(N + ': no leftover words', !/undefined|NaN|null|\{|\}/.test(r.txt));
    check(N + ': contrast (text 7, dim on cards 4.5, gold 4.5)', ratio(r.text, r.bg) >= 7 && ratio(r.dim, r.card) >= 4.5 && ratio(r.gold, r.bg) >= 4.5, [ratio(r.text, r.bg), ratio(r.dim, r.card), ratio(r.gold, r.bg)]);
    check(N + ': every button\'s text >= 4.5 on its own background', r.btn.length === 3 && r.btn.every(([f, b]) => !/rgba\(0, 0, 0, 0\)/.test(b) && ratio(f, b) >= 4.5), r.btn);
    check(N + ': no page errors', errs.length === 0, errs);
    if (c.n === '390-dark') {
      const href = r.links.find(h => /#demo-/.test(h));
      await page.goto(ROOT + 'index.html' + href.slice(1)); await page.waitForTimeout(2500);
      const d = await page.evaluate(() => ({ url: location.href, attr: localStorage.getItem('vpex_attr') }));
      check(P.k + ' demo link: opens the demo, tags stripped', !/utm_/.test(d.url) && new RegExp('demo-' + P.k).test(d.url), d);
      check(P.k + ' demo link: source remembered as landing/' + P.k, /"s":"landing"/.test(d.attr || '') && new RegExp('"c":"' + P.k + '"').test(d.attr || ''), d.attr);
      const fx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const fp = await fx.newPage(); await fp.route(/gstatic|googleapis/, q => q.abort());
      await fp.goto(ROOT + r.links.find(h => /utm_content=trial/.test(h)).slice(1) + '#mockbench'); await fp.waitForTimeout(2600);
      const f = await fp.evaluate(() => ({ ind: (document.getElementById('suInd') || {}).value, url: location.href }));
      check(P.k + ' trial link: form opens with ' + P.k + ' picked, tags removed', f.ind === P.k && !/trial=|utm_/.test(f.url), f); await fx.close();
    }
    await ctx.close();
  }
  // Sales page links all five, each a 44 px tap target that answers its own tap
  for (const [w, s] of [[390, 'dark'], [1280, 'light']]) {
    const ctx = await br.newContext({ viewport: { width: w, height: 844 }, colorScheme: s, isMobile: w < 500, hasTouch: w < 500 });
    const p = await ctx.newPage(); await p.route(/gstatic|googleapis/, r => r.abort());
    await p.goto(ROOT + 'index.html#mockbench'); await p.waitForTimeout(1500);
    for (const P of PAGES) {
      const s2 = await p.evaluate(href => { const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === href); if (!a) return {}; a.scrollIntoView({ block: 'center' });
        const b = a.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { h: b.height, hit: !!(hit && a.contains(hit)), t: a.textContent }; }, '/' + P.dir + '/');
      check(w + ' sales page: ' + P.k + ' link >= 44 px and answers a tap', s2.h >= 44 && s2.hit, s2);
    }
    await ctx.close();
  }
  await br.close();
  console.log(`industry_page: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
