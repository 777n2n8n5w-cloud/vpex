// VPEX regression check (website_desk). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/website_desk.js
// Sales page on a computer: the "Made for … / Works in the browser" note lines up with the hero copy and mentions computers;
// the "Watch the floor from your desk" feature is there; no empty gap under Office name in the trial form.
// App: Pipeline amounts read as money ($85,000), edit as a plain number, and save.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const ctxFor = (br, c) => br.newContext({ viewport: { width: c.w, height: 900 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: '1280-light', w: 1280, s: 'light' }, { n: '1440-dark', w: 1440, s: 'dark' }, { n: '1920-light', w: 1920, s: 'light' }, { n: '390-dark', w: 390, s: 'dark' }, { n: '390-light', w: 390, s: 'light' }]) {
    const tag = 'sales ' + c.n;
    const ctx = await ctxFor(br, c); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
      const box = el => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
      const works = document.querySelector('.lp-works'), copy = document.querySelector('.lp-hero-copy'), h1 = document.querySelector('.hero-h');
      const feat = [...document.querySelectorAll('.lp-feat')].find(a => /Watch the floor from your desk/.test(a.innerText));
      const slug = document.getElementById('suSlug'), off = document.getElementById('suOffice'), ind = document.querySelector('label[for="suInd"]'), name = document.querySelector('label[for="suName"]'), indSel = document.getElementById('suInd');
      return { works: box(works), copy: box(copy), h1: box(h1), worksText: works.innerText, feat: !!feat, featText: feat ? feat.innerText : '', vig: feat ? box(feat.querySelector('.lp-vig')) : null,
        featCopy: feat ? box(feat.querySelector('.lp-feat-copy')) : null, slugH: slug.getBoundingClientRect().height, gapA: Math.round(ind.getBoundingClientRect().top - off.getBoundingClientRect().bottom),
        gapB: Math.round(name.getBoundingClientRect().top - indSel.getBoundingClientRect().bottom), sw: document.documentElement.scrollWidth, vw: innerWidth };
    });
    check(tag + ': works note mentions computers', /iPhone, Android or computer/.test(r.worksText), r.worksText);
    if (c.w >= 900) check(tag + ': works note lines up with the hero copy', Math.abs(r.works.l - r.h1.l) <= 2, r);
    else check(tag + ': works note centred on phones', Math.abs((r.works.l + r.works.r) / 2 - r.vw / 2) <= 3, r);
    check(tag + ': desk feature shown', r.feat && /on a call now/.test(r.featText) && /Maya is on a call/.test(r.featText), r.featText);
    if (c.w >= 900) check(tag + ': desk feature copy and picture side by side', r.vig && r.featCopy && (r.vig.l >= r.featCopy.r - 2 || r.featCopy.l >= r.vig.r - 2), r);
    check(tag + ': empty Office name hint takes no space', r.slugH === 0, r.slugH);
    check(tag + ': Office name → What you sell gap matches the others', Math.abs(r.gapA - r.gapB) <= 4, { a: r.gapA, b: r.gapB });
    check(tag + ': no sideways scroll', r.sw <= r.vw, r);
    // the hint still shows when there is one
    await page.fill('#suOffice', 'Shoreline Realty Group'); await page.waitForTimeout(300);
    const hint = await page.evaluate(() => { const s = document.getElementById('suSlug'); return { txt: s.textContent, h: s.getBoundingClientRect().height }; });
    check(tag + ': hint appears when typed', !hint.txt || hint.h > 0, hint);
    check(tag + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  for (const office of ['insurance', 'realestate', 'mca', 'auto', 'solar']) for (const c of [{ n: '1440-light', w: 1440, s: 'light' }, { n: '390-dark', w: 390, s: 'dark' }]) {
    const tag = 'pipeline ' + office + ' ' + c.n;
    const ctx = await ctxFor(br, c); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date('2026-10-20T15:30:00Z') });
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#demo-' + office); await page.waitForTimeout(1800);
    await page.click('#viewTabPipeline'); await page.waitForTimeout(600);
    const vals = await page.evaluate(() => [...document.querySelectorAll('.pipe-amount')].map(i => ({ v: i.value, fits: i.scrollWidth <= i.clientWidth + 1 })));
    check(tag + ': amounts read as money', vals.length >= 3 && vals.every(x => /^\$\d{1,3}(,\d{3})*$/.test(x.v)), vals.slice(0, 4));
    check(tag + ': amounts fit their box', vals.every(x => x.fits), vals.filter(x => !x.fits));
    const inp = page.locator('.pipe-amount').first(); const id = await inp.getAttribute('data-pipe-amount');
    await inp.scrollIntoViewIfNeeded(); await inp.click(); await page.waitForTimeout(150);
    const raw = await inp.inputValue();
    check(tag + ': editing shows the plain number', /^\d+$/.test(raw), raw);
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('h3, .pipe-head, body').first().click({ position: { x: 2, y: 2 } }).catch(() => {}); await page.waitForTimeout(250);
    const back = await page.evaluate(id => document.querySelector('[data-pipe-amount="' + id + '"]').value, id);
    check(tag + ': leaving without a change shows it as money again', /^\$/.test(back), back);
    const l2 = page.locator('[data-pipe-amount="' + id + '"]'); await l2.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('123456'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    await page.click('#viewTabHistory'); await page.waitForTimeout(300); await page.click('#viewTabPipeline'); await page.waitForTimeout(400);
    const saved = await page.evaluate(id => ({ v: document.querySelector('[data-pipe-amount="' + id + '"]').value }), id);
    check(tag + ': typed amount saves (kept after switching tabs) and shows $123,456', saved.v === '$123,456', saved);
    const l3 = page.locator('[data-pipe-amount="' + id + '"]'); await l3.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('$2,500'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    const v3 = await page.evaluate(id => document.querySelector('[data-pipe-amount="' + id + '"]').value, id);
    check(tag + ': "$2,500" typed reads as 2500', v3 === '$2,500', v3);
    const l4 = page.locator('[data-pipe-amount="' + id + '"]'); await l4.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    const v4 = await page.evaluate(id => document.querySelector('[data-pipe-amount="' + id + '"]').value, id);
    check(tag + ': cleared amount is $0', v4 === '$0', v4);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    check(tag + ': no sideways scroll', sw);
    check(tag + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('website_desk: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
