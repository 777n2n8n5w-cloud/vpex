// VPEX regression check (consent_space). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<playwright> node tests/consent_space.js
// The privacy notice (consent.js) never hides the page's own buttons: in the US it is a compact notice (same three choices),
// it publishes its height as --vc-h, and the sales page's bottom trial bar, the demo's free-trial card and computer toasts
// sit above it; pages scroll their last lines clear of it. Consent-first regions keep the full banner, lifted the same way.
const { chromium } = require('playwright');
const ROOT = 'http://127.0.0.1:8765';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const MORN = '2026-10-20T15:30:00Z';   // 11:30 AM in New York: demo leads are callable

async function open(br, o) {
  const ctx = await br.newContext({ viewport: { width: o.w, height: 844 }, colorScheme: o.s, isMobile: o.w < 500, hasTouch: o.w < 500, timezoneId: o.tz || 'America/New_York' });
  await ctx.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cloudfunctions|__consent|__hit/, r => /__/.test(r.request().url()) ? r.fulfill({ status: 204, body: '' }) : r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('vpex_consent_test', 'http://127.0.0.1:8765/__consent'); localStorage.setItem('vpex_hit_test', 'http://127.0.0.1:8765/__hit'); } catch (e) {} });
  await ctx.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (a && !e.defaultPrevented) e.preventDefault(); }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  if (o.clock) await page.clock.install({ time: new Date(MORN) });
  return { ctx, page, errs };
}
const bar = page => page.evaluate(() => {
  const b = document.getElementById('vcBar'); if (!b) return null; const r = b.getBoundingClientRect();
  return { top: r.top, h: r.height, left: r.left, right: r.right, compact: b.classList.contains('vc-compact'), vch: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vc-h')) || 0,
    on: document.documentElement.classList.contains('vc-on'), btns: [...b.querySelectorAll('button')].map(x => Math.round(x.getBoundingClientRect().height)),
    labels: [...b.querySelectorAll('button')].map(x => x.textContent), sw: document.documentElement.scrollWidth, vw: innerWidth, ih: innerHeight,
    heading: !!b.querySelector('h2') && b.getAttribute('aria-label') === 'Cookie choices', links: [...b.querySelectorAll('a')].map(a => a.getAttribute('href')) };
});
// does a tap at the middle of el land on el (not on the notice)?
const hits = (page, sel) => page.evaluate(s => { const e = typeof s === 'string' ? document.querySelector(s) : null; if (!e) return 'missing'; const r = e.getBoundingClientRect(); if (!r.height) return 'hidden';
  const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === e || e.contains(t)) ? true : (t && (t.id || t.className || t.tagName)); }, sel);
const above = (page, sel) => page.evaluate(s => { const e = document.querySelector(s), b = document.getElementById('vcBar'); if (!e || !b) return null; return e.getBoundingClientRect().bottom <= b.getBoundingClientRect().top + 0.5; }, sel);

async function demoCall(page, outcome) {
  await page.clock.fastForward(20000); await page.waitForTimeout(150);
  await page.evaluate(() => document.getElementById('callBtn').click()); await page.waitForTimeout(250);
  await page.evaluate(o => document.querySelector('#outcomesRow [data-outcome="' + o + '"]').click(), outcome); await page.waitForTimeout(500);
  await page.evaluate(() => { const l = document.getElementById('tpLater') || document.querySelector('#textPrompt .btn-secondary'); const tp = document.getElementById('textPrompt'); if (tp && tp.style.display !== 'none' && l) l.click(); });
  await page.waitForTimeout(200);
}

(async () => {
  const br = await chromium.launch();
  const sizes = [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'p-320', w: 320, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }];

  // ---------- US sales page: compact notice, the bottom trial bar above it ----------
  for (const c of sizes) {
    const tag = 'us sales/' + c.n;
    const { ctx, page, errs } = await open(br, c);
    await page.goto(ROOT + '/?cs=1#mockbench'); await page.waitForTimeout(2500);
    let b = await bar(page);
    check(tag + ' notice shows, compact', !!b && b.compact, b);
    if (b) {
      check(tag + ' notice is short (phone <= 150 px, 320 px <= 165, computer <= 100 px)', b.h <= (c.w < 360 ? 165 : c.w < 500 ? 150 : 100), b.h);
      check(tag + ' same three choices, each >= 44 px', b.labels.join('|') === 'Accept all|Reject all|Choose' && b.btns.every(h => h >= 44), b);
      check(tag + ' still named for screen readers, policy links kept', b.heading && b.links.includes('/cookies/') && b.links.includes('/privacy/'), b);
      check(tag + ' fits the screen, no sideways scroll', b.left >= 0 && b.right <= b.vw + 0.5 && b.sw <= b.vw, b);
      check(tag + ' --vc-h = height + gap', b.on && Math.abs(b.vch - (b.ih - b.top)) <= 1.5, b);
    }
    if (c.w < 500) {
      await page.evaluate(() => { document.querySelector('#authScreen').scrollTop = 1400; }); await page.waitForTimeout(900);
      const dockOn = await page.evaluate(() => { const d = document.querySelector('.lp-dock'); return !!d && d.classList.contains('on'); });
      check(tag + ' bottom trial bar shows after scrolling', dockOn);
      check(tag + ' bottom trial bar sits above the notice', await above(page, '.lp-dock'));
      check(tag + ' its Start my free trial answers a tap', (await hits(page, '.lp-dock .btn-primary')) === true, await hits(page, '.lp-dock .btn-primary'));
      await page.evaluate(() => { const s = document.querySelector('#authScreen'); s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(700);
      check(tag + ' end of the page scrolls clear of the notice', await page.evaluate(() => { const s = document.querySelector('#authScreen'), b = document.getElementById('vcBar').getBoundingClientRect();
        const kids = [...s.querySelectorAll('.auth-faq, .lp-foot, footer, .legal-links')].filter(e => e.getBoundingClientRect().height); const last = kids[kids.length - 1] || s.lastElementChild;
        return last.getBoundingClientRect().bottom <= b.top + 1; }));
      await page.evaluate(() => { document.querySelector('#authScreen').scrollTop = 1400; }); await page.waitForTimeout(700);
    }
    await page.click('#vcBar [data-vc="accept"]'); await page.waitForTimeout(400);
    b = await bar(page);
    check(tag + ' Accept all: notice gone, --vc-h cleared', b === null && await page.evaluate(() => !document.documentElement.classList.contains('vc-on') && !document.documentElement.style.getPropertyValue('--vc-h')));
    if (c.w < 500) check(tag + ' trial bar back at the bottom edge', await page.evaluate(() => { const r = document.querySelector('.lp-dock').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) <= 1; }));
    await page.reload(); await page.waitForTimeout(1500);
    check(tag + ' choice remembered: no notice after reload', (await bar(page)) === null);
    check(tag + ' no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------- US demo: the free-trial card after the 3rd call stays above the notice ----------
  for (const o of ['insurance', 'solar']) for (const c of [sizes[0], sizes[1], sizes[3]]) {
    const tag = 'us demo-' + o + '/' + c.n;
    const { ctx, page, errs } = await open(br, Object.assign({ clock: true }, c));
    await page.goto(ROOT + '/#demo-' + o); await page.waitForTimeout(1600);
    check(tag + ' notice shows, compact', !!(await bar(page)) && (await bar(page)).compact);
    check(tag + ' demo bar Start free trial answers a tap', (await hits(page, '#demoTrial')) === true, await hits(page, '#demoTrial'));
    for (const out of ['noanswer', 'voicemail', 'noanswer']) await demoCall(page, out);
    const shown = await page.evaluate(() => { const n = document.getElementById('demoNudge'); return !!n && n.style.display !== 'none'; });
    check(tag + ' 3rd call: trial card shows', shown);
    if (shown) {
      check(tag + ' trial card sits above the notice', await above(page, '#demoNudge'));
      check(tag + ' trial card on screen', await page.evaluate(() => { const r = document.getElementById('demoNudge').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
      check(tag + ' its Start free trial answers a tap', (await hits(page, '#dnTrial')) === true, await hits(page, '#dnTrial'));
    }
    if (c.w >= 1100) check(tag + ' computer toasts sit above the notice', await page.evaluate(() => { const t = document.getElementById('toast'), b = document.getElementById('vcBar');
      return parseFloat(getComputedStyle(t).bottom) >= innerHeight - b.getBoundingClientRect().top; }));
    if (c.w < 500) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(300);
      check(tag + ' Dial screen scrolls its last line clear of the notice', await page.evaluate(() => { const b = document.getElementById('vcBar').getBoundingClientRect();
        const els = [...document.querySelectorAll('#app *, main *, .view *')].filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.height > 0 && s.position !== 'fixed' && !e.closest('#vpexConsent,#demoNudge,#textPrompt,#toast'); });
        const maxB = Math.max(0, ...els.map(e => e.getBoundingClientRect().bottom)); return maxB <= b.top + 1; }));
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    check(tag + ' no sideways scroll', sw);
    check(tag + ' no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------- consent first (Berlin): the full banner stays, lifted the same way ----------
  for (const c of [sizes[0], sizes[3]]) {
    const tag = 'berlin/' + c.n;
    const { ctx, page, errs } = await open(br, Object.assign({ tz: 'Europe/Berlin', clock: true }, c));
    await page.goto(ROOT + '/#demo-auto'); await page.waitForTimeout(1600);
    const b = await bar(page);
    check(tag + ' full banner (not compact), with its heading visible', !!b && !b.compact && await page.evaluate(() => document.getElementById('vcBarH').getBoundingClientRect().height > 10), b);
    check(tag + ' --vc-h set', !!b && b.on && Math.abs(b.vch - (b.ih - b.top)) <= 1.5, b);
    for (const out of ['noanswer', 'voicemail', 'noanswer']) await demoCall(page, out);
    check(tag + ' trial card above the banner and tappable', (await above(page, '#demoNudge')) && (await hits(page, '#dnTrial')) === true);
    check(tag + ' no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------- static pages (US phone): compact notice, nothing sideways ----------
  for (const p of ['/ig/', '/calling-hours/pennsylvania/', '/power-dialer-for-solar-sales/', '/privacy/']) {
    const { ctx, page, errs } = await open(br, sizes[0]);
    await page.goto(ROOT + p); await page.waitForTimeout(1200);
    const b = await bar(page);
    check('us ' + p + ' compact notice <= 150 px, fits', !!b && b.compact && b.h <= 150 && b.sw <= b.vw, b);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(200);
    check('us ' + p + ' footer scrolls clear of the notice', await page.evaluate(() => { const b = document.getElementById('vcBar').getBoundingClientRect();
      const f = document.querySelector('footer') || document.body.lastElementChild; return f.getBoundingClientRect().bottom <= b.top + 1; }));
    check('us ' + p + ' no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  await br.close();
  console.log(`consent_space: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
