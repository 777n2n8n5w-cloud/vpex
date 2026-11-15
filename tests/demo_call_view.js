// VPEX regression check (demo_call_view). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<playwright> node tests/demo_call_view.js
// The demo's welcome says "Tap Call", so on a phone the Call button must be in view: once per visit, if the visitor hasn't
// scrolled, the page brings Call up above the bottom edge (above the US privacy notice, --vc-h) with the lead's name still
// under the header. On phones the demo bar stays at the top while scrolling (Start free trial always in reach) and the app's
// sticky header sits under it. Computers and real offices keep their layout.
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8765/';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const DAY = '2026-11-17T16:30:00Z', NIGHT = '2026-11-18T08:30:00Z';   // Tue 11:30 AM / Wed 3:30 AM in New York

async function open(br, o, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York', reducedMotion: c.calm ? 'reduce' : 'no-preference' });
  await ctx.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cloudfunctions|__consent|__hit/, r => /__/.test(r.request().url()) ? r.fulfill({ status: 204, body: '' }) : r.abort());
  if (c.notice) await ctx.addInitScript(() => { try { localStorage.setItem('vpex_consent_test', 'http://127.0.0.1:8765/__consent'); localStorage.setItem('vpex_hit_test', 'http://127.0.0.1:8765/__hit'); } catch (e) {} });
  await ctx.addInitScript(() => window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (a && !e.defaultPrevented) e.preventDefault(); }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(c.t || DAY) });
  await page.goto(BASE + (o === 'bench' ? '#mockbench' : '#demo-' + o));
  return { ctx, page, errs };
}
const geo = page => page.evaluate(() => {
  const r = e => e ? e.getBoundingClientRect() : null, cb = document.getElementById('callBtn'), card = cb && cb.closest('.card');
  const nm = card && card.querySelector('.lead-name'), hd = document.querySelector('header.top'), dp = document.querySelector('.demo-pill'), tr = document.getElementById('demoTrial');
  const vch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vc-h')) || 0;
  const hit = e => { if (!e) return null; const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!t && (t === e || e.contains(t)); };
  return { sy: scrollY, ih: innerHeight, vch, call: r(cb), name: r(nm), head: r(hd), pill: r(dp), pillPos: dp ? getComputedStyle(dp).position : null,
    headTop: hd ? getComputedStyle(hd).top : null, callHit: hit(cb), trialHit: hit(tr), sw: document.documentElement.scrollWidth, vw: innerWidth };
});

(async () => {
  const br = await chromium.launch();
  const phones = [
    { n: '390x664 dark, US notice', w: 390, h: 664, s: 'dark', notice: true },
    { n: '390x664 light', w: 390, h: 664, s: 'light' },
    { n: '390x844 dark night', w: 390, h: 844, s: 'dark', t: NIGHT },
    { n: '360x640 light, US notice, reduced motion', w: 360, h: 640, s: 'light', notice: true, calm: true }
  ];
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) {
    for (const c of phones) {
      const tag = o + ' ' + c.n;
      const { ctx, page, errs } = await open(br, o, c);
      await page.waitForTimeout(600);
      const g0 = await geo(page), hi0 = await page.evaluate(() => !!sessionStorage.getItem('vpex_demo_hi'));
      if (!hi0) check(tag + ': starts at the top', g0.sy === 0, g0.sy);   // (under heavy load the welcome can already be out)
      await page.waitForTimeout(2200);
      const g = await geo(page), bottom = g.ih - g.vch;
      check(tag + ': Call is fully on screen above the notice', g.call && g.call.bottom <= bottom - 4 && g.call.top >= g.head.bottom, { call: g.call && [g.call.top, g.call.bottom], bottom, head: g.head.bottom });
      check(tag + ': a tap on Call lands on Call', g.callHit === true, g.callHit);
      check(tag + ': the lead\'s name stays in view under the header', g.name && g.name.top >= g.head.bottom - 1, { name: g.name && g.name.top, head: g.head.bottom });
      check(tag + ': demo bar at the top, header under it', g.pill && Math.abs(g.pill.top) < 1 && g.head.top >= g.pill.bottom - 1, { pill: g.pill && [g.pill.top, g.pill.bottom], head: g.head.top });
      check(tag + ': Start free trial answers a tap', g.trialHit === true, g.trialHit);
      check(tag + ': scrolled only what was needed', g.sy > 0 && g.sy < 400, g.sy);
      check(tag + ': no sideways scroll', g.sw <= g.vw, [g.sw, g.vw]);
      // further down the page the demo bar stays, and Start free trial still opens the trial form
      await page.evaluate(() => window.scrollBy(0, 700)); await page.waitForTimeout(300);
      const g2 = await geo(page);
      check(tag + ': after scrolling down the demo bar is still at the top', g2.sy > g.sy && g2.pill && Math.abs(g2.pill.top) < 1 && g2.head.top >= g2.pill.bottom - 1 && g2.trialHit === true, { sy: g2.sy, pill: g2.pill && g2.pill.top, trial: g2.trialHit });
      if (c.n.indexOf('dark,') === 4 || c.calm) {
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
        await page.evaluate(() => document.getElementById('callBtn').scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
        await page.tap('#callBtn'); await page.waitForTimeout(400);
        const ready = await page.evaluate(() => !document.getElementById('outcomesRow').classList.contains('disabled') || !!document.querySelector('.modal-overlay.show, .modal.show'));
        check(tag + ': tapping Call starts the demo call (or its time check)', ready);
      }
      check(tag + ': no page errors', !errs.length, errs);
      await ctx.close();
    }
    // a visitor who already scrolled isn't moved (scrolls as soon as the page is up, before the welcome; retried if a slow machine was late)
    for (let tries = 0; tries < 3; tries++) {
      const { ctx, page } = await open(br, o, { w: 390, h: 664, s: 'dark', notice: true });
      await page.waitForFunction(() => !!document.getElementById('callBtn'), null, { timeout: 15000 });
      const early = await page.evaluate(() => { if (sessionStorage.getItem('vpex_demo_hi')) return false; window.scrollTo(0, 40); return true; });
      if (!early && tries < 2) { await ctx.close(); continue; }
      await page.waitForTimeout(2400);
      const sy = (await geo(page)).sy;   // (scroll anchoring may shift it a little; the jump to Call is 200+ px)
      check(o + ': visitor who scrolled first stays about where they are', early && sy >= 20 && sy <= 90, { early, sy });
      await ctx.close(); break;
    }
    // a mouse (no touch screen) in a narrow window: no automatic scroll
    {
      const ctx = await br.newContext({ viewport: { width: 1024, height: 700 }, timezoneId: 'America/New_York' });
      await ctx.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cloudfunctions/, r => r.abort());
      const page = await ctx.newPage(); await page.clock.install({ time: new Date(DAY) });
      await page.goto(BASE + '#demo-' + o); await page.waitForTimeout(2800);
      check(o + ' 1024 mouse: no automatic scroll', (await geo(page)).sy === 0);
      await ctx.close();
    }
    // computers: unchanged (no scroll, the bar isn't sticky, toasts and layout as before)
    {
      const { ctx, page, errs } = await open(br, o, { w: 1280, h: 800, s: 'light', notice: true });
      await page.waitForTimeout(2800);
      const g = await geo(page);
      check(o + ' 1280: no scroll, Call on screen', g.sy === 0 && g.call.bottom <= g.ih, { sy: g.sy, call: g.call.bottom });
      check(o + ' 1280: demo bar keeps its place', g.pillPos === 'relative', g.pillPos);
      check(o + ' 1280: no page errors', !errs.length, errs);
      await ctx.close();
    }
  }
  // a second open in the same visit doesn't move the page again
  {
    const { ctx, page } = await open(br, 'auto', { w: 390, h: 664, s: 'dark', notice: true });
    await page.waitForTimeout(2800);
    check('first open scrolled to Call', (await geo(page)).sy > 0);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(400); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(2600);
    check('reload in the same visit: no second scroll', (await geo(page)).sy === 0);
    await ctx.close();
  }
  // a real office (test bench): no demo bar, header sticky at the very top as before
  {
    const { ctx, page, errs } = await open(br, 'bench', { w: 390, h: 664, s: 'light' });
    await page.waitForTimeout(1500);
    const g = await geo(page);
    check('real office: no demo bar, header top 0px', !g.pill && g.headTop === '0px', g.headTop);
    check('real office: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
