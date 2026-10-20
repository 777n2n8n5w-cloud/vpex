// VPEX regression check (upload_dnc). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/upload_dnc.js
// The upload preview says VPEX doesn't check the National Do Not Call Registry, with the registry link; and the sales page's
// small links are 44 px to tap.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const CSV = 'Name,Phone,State\nTest Lead One,(305) 555-0191,FL\nTest Lead Two,(512) 555-0192,TX\nTest Lead Three,(212) 555-0193,NY\n';
const lumJs = `const lum = c => { const k = /^color\\(/.test(c) ? 1 : 255; const v = c.replace(/^color\\(srgb/, '').match(/[\\d.]+/g).slice(0, 3).map(Number).map(x => { x /= k; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const bgOf = el => { while (el) { const c = getComputedStyle(el).backgroundColor, a = c.match(/[\\d.]+/g); if (a && (a[3] === undefined || +a[3] > .9)) return c; el = el.parentElement; } return 'rgb(255,255,255)'; };
  const con = el => { const L1 = lum(getComputedStyle(el).color), L2 = lum(bgOf(el)); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };`;
(async () => {
  const br = await chromium.launch();
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const tag = o + '/' + c.n;
    const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await page.goto(BASE + '#demo-' + o); await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('addLeadsBtn').click()); await page.waitForTimeout(400);
    await page.setInputFiles('#leadFileInput', { name: 'cold-list.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await page.waitForSelector('.up-dnc', { timeout: 5000 }).catch(() => {});
    const s = await page.evaluate(new Function(lumJs + `
      const p = document.querySelector('.up-dnc'); if (!p) return null; const a = p.querySelector('a');
      return { text: p.innerText, href: a && a.href, target: a && a.target, rel: a && a.rel, conP: con(p), conA: con(a), sum: (document.querySelector('.up-summary b') || {}).textContent, sw: document.documentElement.scrollWidth, vw: innerWidth };`));
    check(tag + ' preview shows the registry note', !!s && /doesn.t check the National Do Not Call Registry/.test(s.text) && /Not legal advice\.$/.test(s.text), s);
    check(tag + ' 3 new leads previewed', s && s.sum === '3 new leads', s && s.sum);
    check(tag + ' registry link opens in a new tab', s && s.href === 'https://telemarketing.donotcall.gov/' && s.target === '_blank' && /noopener/.test(s.rel), s);
    check(tag + ' note and link contrast >= 4.5', s && s.conP >= 4.5 && s.conA >= 4.5, s && { p: s.conP, a: s.conA });
    check(tag + ' no overflow', s && s.sw <= s.vw, s);
    if (o === 'realestate' && c.n !== 'desk') { const el = await page.$('#uploadPreview'); if (el) await el.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/upload-dnc-' + c.n + '.png' }); }
    await page.evaluate(() => document.getElementById('submitUpload').click()); await page.waitForTimeout(600);
    const added = await page.evaluate(() => /3 (new )?leads? added|Added 3/i.test(document.body.innerText));
    check(tag + ' Add leads still works', added);
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  // Sales page: small links are 44 px tall
  for (const c of [{ n: 'p-light', w: 390, s: 'light' }, { n: 'p-dark', w: 390, s: 'dark' }, { n: 'xs', w: 320, s: 'light' }, { n: 'desk', w: 1280, s: 'dark' }]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const h = sel => { const el = document.querySelector(sel); if (!el || !el.offsetParent) return null; const b = el.getBoundingClientRect(); return Math.round(Math.min(b.width, b.height)); };
      const v = document.getElementById('heroVidBtn'); if (v) v.scrollIntoView({ block: 'center' }); const vb = v && v.getBoundingClientRect();
      const hit = v ? document.elementFromPoint(vb.left - 3, vb.top + vb.height / 2) : null;
      return { signin: h('#heroSignin'), back: h('#suBack'), support: (() => { const el = [...document.querySelectorAll('.auth-support')].find(x => x.offsetParent); return el ? Math.round(el.getBoundingClientRect().height) : null; })(),
        vidEdgeHits: !!hit && (hit === v || v.contains(hit)), sw: document.documentElement.scrollWidth, vw: innerWidth };
    });
    check('sales ' + c.n + ': Sign in 44 px', r.signin >= 44 || r.signin === null, r);
    check('sales ' + c.n + ': "Already have an office?" 44 px', r.back >= 44 || r.back === null, r);
    check('sales ' + c.n + ': support link 44 px', r.support >= 44, r);
    check('sales ' + c.n + ': video pause button taps 3 px outside its circle', r.vidEdgeHits, r);
    check('sales ' + c.n + ': no overflow', r.sw <= r.vw, r);
    check('sales ' + c.n + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close(); console.log(`upload_dnc: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
