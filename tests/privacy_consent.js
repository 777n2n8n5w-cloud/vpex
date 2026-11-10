// VPEX regression check (privacy_consent): cookie consent (consent.js), the legal pages, and the consent records' server side.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/privacy_consent.js
// Consent first outside the US: nothing optional (Google Fonts, visit counts, the 30-day attribution memory) before a choice;
// Accept all turns them on and sends what waited; Reject all and withdrawing remove what was stored. In the US: on with a
// notice, and Global Privacy Control turns statistics and attribution off. Every choice leaves a record. Works on a phone
// and a computer, by keyboard, and on every kind of page (app, calling hours, industry, compare, Instagram, 404, legal).
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const L = require('../functions/lib.js');
const ROOT = 'http://127.0.0.1:8765';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const HIT = 'http://127.0.0.1:8765/__hit', CONSENT = 'http://127.0.0.1:8765/__consent';

async function open(br, o) {
  const ctx = await br.newContext({ viewport: { width: o.w || 390, height: 844 }, timezoneId: o.tz, isMobile: (o.w || 390) < 500, hasTouch: (o.w || 390) < 500, colorScheme: o.scheme || 'dark' });
  const hits = [], consents = [], fonts = [];
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => { fonts.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
  await ctx.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await ctx.route(/__hit/, r => { hits.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 204, body: '' }); });
  await ctx.route(/__consent/, r => { consents.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 204, body: '' }); });
  await ctx.addInitScript(([h, c, gpc]) => {
    try { localStorage.setItem('vpex_hit_test', h); localStorage.setItem('vpex_consent_test', c); } catch (e) {}
    if (gpc) Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });
  }, [HIT, CONSENT, !!o.gpc]);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (/Content Security Policy|Refused to/.test(m.text())) errs.push('CSP: ' + m.text()); });
  return { ctx, page, hits, consents, fonts, errs };
}
const ls = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
const vis = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
const fontLinks = page => page.evaluate(() => [...document.querySelectorAll('link[data-consent-href]')].filter(l => l.getAttribute('rel') === 'stylesheet').map(l => !!l.getAttribute('href')));

(async () => {
  // ---------- server side: the consent record parser and retention ----------
  const ok = L.parseConsent(JSON.stringify({ id: 'Abcdefghijklmnop12345', v: '2026-11-10', s: true, t: false, f: true, m: 'save', r: 'optin', g: false, d: 'm' }));
  check('server: a choice parses', ok && ok.s === true && ok.t === false && ok.f === true && ok.m === 'save' && ok.r === 'optin', ok);
  check('server: bad ids, versions, methods and missing choices are refused', [
    { id: 'x', v: '2026-11-10', s: true, t: true, f: true, m: 'save' },
    { id: 'Abcdefghijklmnop12345', v: 'latest', s: true, t: true, f: true, m: 'save' },
    { id: 'Abcdefghijklmnop12345', v: '2026-11-10', s: true, t: true, f: true, m: 'sell' },
    { id: 'Abcdefghijklmnop12345', v: '2026-11-10', s: 'yes', t: true, f: true, m: 'save' },
    { id: 'Abc<script>defghijklmnop', v: '2026-11-10', s: true, t: true, f: true, m: 'save' }].every(x => L.parseConsent(JSON.stringify(x)) === null));
  check('server: junk is refused', L.parseConsent('nope') === null && L.parseConsent('[]') === null && L.parseConsent('null') === null);
  check('server: nothing extra is kept (no IP, no user agent)', Object.keys(ok).sort().join() === 'd,f,g,id,m,r,s,t,v', Object.keys(ok));
  check('server: retention matches the Privacy Policy', L.RETAIN.consent === 3 * 365 * 86400000 && L.RETAIN.pushSent === 30 * 86400000 && L.RETAIN.pushMeta === 14 * 86400000);

  // ---------- legal pages are built from tools/build_legal_pages.py ----------
  let built = true; try { execSync('python3 tools/build_legal_pages.py . check', { cwd: path.join(__dirname, '..'), stdio: 'pipe' }); } catch (e) { built = false; }
  check('legal pages are up to date with their builder', built);

  const br = await chromium.launch();

  // ---------- consent first (Berlin): nothing optional before a choice ----------
  for (const w of [390, 1280]) {
    const n = w < 500 ? 'phone' : 'desk';
    const { ctx, page, hits, consents, fonts, errs } = await open(br, { tz: 'Europe/Berlin', w });
    await page.goto(ROOT + '/?utm_source=instagram&utm_medium=bio&utm_content=w9#demo-insurance'); await page.waitForTimeout(2500);
    check(n + ' optin: the banner shows', await vis(page, '#vcBar'));
    check(n + ' optin: Reject all is as easy as Accept all (both on the banner, same style)', await page.evaluate(() => {
      const a = document.querySelector('#vcBar [data-vc="accept"]'), r = document.querySelector('#vcBar [data-vc="reject"]');
      return !!a && !!r && a.className === r.className && getComputedStyle(a).backgroundColor === getComputedStyle(r).backgroundColor; }));
    check(n + ' optin: no Google Fonts before a choice', fonts.length === 0 && (await fontLinks(page)).every(x => !x), fonts);
    check(n + ' optin: no visit counts before a choice', hits.length === 0, hits);
    check(n + ' optin: the link that brought them is not remembered', (await ls(page, 'vpex_attr')) === null);
    check(n + ' optin: the banner fits the screen', await page.evaluate(() => { const b = document.getElementById('vcBar').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 0.5 && document.documentElement.scrollWidth <= innerWidth; }));
    check(n + ' optin: buttons are big enough to tap', await page.evaluate(() => [...document.querySelectorAll('#vcBar button')].every(b => b.getBoundingClientRect().height >= 44)));
    await page.click('#vcBar [data-vc="accept"]'); await page.waitForTimeout(600);
    check(n + ' optin: Accept all hides the banner', !(await vis(page, '#vcBar')));
    check(n + ' optin: then the fonts load', (await fontLinks(page)).every(x => x) && fonts.length > 0, fonts.length);
    check(n + ' optin: then the counts that waited are sent, with where they came from', hits.some(h => h.e === 'visit' && h.s === 'instagram') && hits.some(h => h.e === 'demo'), hits);
    check(n + ' optin: then the attribution is remembered', /instagram/.test(await ls(page, 'vpex_attr') || ''));
    check(n + ' optin: a consent record goes to the server', consents.length === 1 && consents[0].m === 'accept_all' && consents[0].s && consents[0].t && consents[0].f && consents[0].r === 'optin' && !!L.parseConsent(JSON.stringify(consents[0])), consents);
    const rec = JSON.parse(await ls(page, 'vpex_consent'));
    check(n + ' optin: the choice is kept on the device with the policy version', rec && rec.v === '2026-11-10' && rec.c.stats && rec.m === 'accept_all' && rec.id === consents[0].id, rec);
    await page.reload(); await page.waitForTimeout(1500);
    check(n + ' optin: no banner after a choice', !(await vis(page, '#vcBar')));
    // withdraw: open settings from Settings in the app? here: the API, then the panel
    await page.evaluate(() => window.VPEXConsent.open()); await page.waitForTimeout(200);
    check(n + ' settings: the panel opens as a dialog with focus inside', await page.evaluate(() => { const d = document.querySelector('#vcPanel[role="dialog"][aria-modal="true"]'); return !!d && d.contains(document.activeElement); }));
    check(n + ' settings: three switches, all on, plus Essential always on', await page.evaluate(() => { const s = [...document.querySelectorAll('[data-vc-cat]')]; return s.length === 3 && s.every(x => x.checked) && /Always on/.test(document.getElementById('vcPanel').textContent); }));
    await page.evaluate(() => { const i = document.querySelector('[data-vc-cat="attribution"]'); i.click(); const s = document.querySelector('[data-vc-cat="stats"]'); s.click(); });
    await page.click('#vcPanel [data-vc="save"]'); await page.waitForTimeout(300);
    check(n + ' withdraw: recorded as withdrawn', consents.length === 2 && consents[1].m === 'withdraw' && consents[1].s === false && consents[1].t === false && consents[1].f === true, consents[1]);
    check(n + ' withdraw: the stored attribution is deleted', (await ls(page, 'vpex_attr')) === null);
    const before = hits.length;
    await page.evaluate(() => window.VPEXConsent && 0); await page.reload(); await page.waitForTimeout(1500);
    check(n + ' withdraw: no more counts', hits.length === before, hits.slice(before));
    check(n + ' no page errors or blocked scripts', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------- Reject all (Toronto: consent first too) ----------
  {
    const { ctx, page, hits, consents, fonts, errs } = await open(br, { tz: 'America/Toronto', w: 390 });
    await page.goto(ROOT + '/calling-hours/texas/?utm_source=google'); await page.waitForTimeout(1500);
    check('canada: consent first', await vis(page, '#vcBar') && fonts.length === 0);
    await page.click('#vcBar [data-vc="reject"]'); await page.waitForTimeout(300);
    check('reject: recorded, everything off', consents.length === 1 && consents[0].m === 'reject_all' && !consents[0].s && !consents[0].t && !consents[0].f, consents);
    check('reject: no fonts, no counts', fonts.length === 0 && hits.length === 0);
    // the footer link reopens the settings
    await page.evaluate(() => document.querySelector('footer [data-cookie-settings]').click()); await page.waitForTimeout(200);
    check('footer: Cookie settings opens the panel', await vis(page, '#vcPanel'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check('keyboard: Escape closes the panel', !(await vis(page, '#vcPanel')));
    check('reject: no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------- the US: on with a notice; Global Privacy Control honored ----------
  {
    const { ctx, page, hits, fonts, errs } = await open(br, { tz: 'America/Chicago', w: 1280 });
    await page.goto(ROOT + '/?utm_source=facebook'); await page.waitForTimeout(2500);
    check('us: a notice shows', await vis(page, '#vcBar'));
    check('us: fonts load unless turned off', fonts.length > 0, { fonts: fonts.length });
    check('us: no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  {
    const { ctx, page, hits, consents, errs } = await open(br, { tz: 'America/Los_Angeles', w: 390, gpc: true });
    await page.goto(ROOT + '/?utm_source=facebook#demo-solar'); await page.waitForTimeout(2500);
    check('gpc: statistics and attribution off', hits.length === 0 && (await ls(page, 'vpex_attr')) === null, hits);
    check('gpc: recorded once as the visitor\'s choice', consents.length === 1 && consents[0].m === 'gpc' && consents[0].g === true && !consents[0].s && !consents[0].t, consents);
    check('gpc: no banner needed', !(await vis(page, '#vcBar')));
    check('gpc: no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------- every kind of page has the manager and the legal links ----------
  const PAGES = ['/', '/calling-hours/', '/calling-hours/florida/', '/power-dialer-for-solar-sales/', '/phoneburner-alternative/', '/ig/', '/privacy/', '/terms/', '/cookies/'];
  {
    const { ctx, page, errs } = await open(br, { tz: 'Europe/Paris', w: 390 });
    for (const p of PAGES) {
      await page.goto(ROOT + p); await page.waitForTimeout(p === '/' ? 2000 : 500);
      const r = await page.evaluate(() => ({ cm: !!window.VPEXConsent, links: ['/privacy/', '/terms/', '/cookies/'].every(h => document.querySelector('a[href="' + h + '"]')), set: !!document.querySelector('[data-cookie-settings]'),
        csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'), wide: document.documentElement.scrollWidth <= innerWidth }));
      check(p + ': consent manager, legal links, Cookie settings, content policy', r.cm && r.links && r.set && r.csp, r);
      check(p + ': fits a phone', r.wide);
    }
    check('pages: no errors', errs.length === 0, errs);
    // the cookie page opens settings from #settings and shows the visitor's own record
    await page.goto(ROOT + '/cookies/#settings'); await page.waitForTimeout(500);
    check('cookies page: #settings opens the panel', await vis(page, '#vcPanel'));
    await page.click('#vcPanel [data-vc="accept"]'); await page.waitForTimeout(300);
    check('cookies page: shows the current choice and consent ID', await page.evaluate(() => /Visit statistics: on/.test(document.getElementById('cookieNow').textContent) && /consent ID [A-Za-z0-9_-]{16,}/.test(document.getElementById('cookieNow').textContent)));
    await ctx.close();
  }

  // ---------- the app: sign-up agreement, billing renewal notice, legal links in Settings ----------
  {
    const { ctx, page, errs } = await open(br, { tz: 'America/New_York', w: 390 });
    await page.goto(ROOT + '/'); await page.waitForTimeout(2000);
    check('sign-up: agreement next to Start my free trial, linking Terms and Privacy', await page.evaluate(() => { const g = document.getElementById('suGo'), a = g && g.previousElementSibling; return !!a && a.classList.contains('legal-agree') && !!a.querySelector('a[href="/terms/"]') && !!a.querySelector('a[href="/privacy/"]'); }));
    check('join: agreement next to Join the team', await page.evaluate(() => { const a = document.getElementById('jnGo').previousElementSibling; return a && a.classList.contains('legal-agree'); }));
    check('sales page: auto-renewal is stated with the price', await page.evaluate(() => /renews every month until you cancel/i.test(document.querySelector('.lp-renew').textContent)));
    check('paused screen: auto-renewal next to Add payment', await page.evaluate(() => /Renews automatically until you cancel/.test(document.getElementById('pausedScreen').textContent)));
    check('settings: Privacy, Terms, Cookies and Cookie settings', await page.evaluate(() => { const n = document.querySelector('.set-legal'); return !!n && ['/privacy/', '/terms/', '/cookies/'].every(h => n.querySelector('a[href="' + h + '"]')) && !!n.querySelector('[data-cookie-settings]'); }));
    check('app: no errors', errs.length === 0, errs);
    await ctx.close();
  }

  await br.close();
  console.log('privacy_consent: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
