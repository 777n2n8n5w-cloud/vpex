// VPEX regression check (site_health): every public page of vpexdialer.com, on a phone (360 px) and a computer (1366 px).
// Catches the whole class of "a page quietly broke" problems before they go live:
//  - no script errors, no console errors, no missing files (anything this site links or loads answers 200)
//  - every link inside the site goes to a page that exists, and every #section link to a section that exists
//  - nothing runs off the side of the screen; no broken images; no "undefined" / "NaN" shown to a visitor
//  - every page: a title, a description (pages search engines may list), one main heading, a language, unique ids,
//    images with alt text, a canonical address that is its own; links and buttons a finger can hit (24 px)
//  - the sitemap lists exactly the pages search engines may list: none missing, none that don't exist, no noindex page
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/site_health.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const HOST = (process.env.BASE || 'http://127.0.0.1:8765/index.html').replace(/index\.html$/, '');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 900)); } };
const SKIP = /^(\.git|node_modules|tests|tools|studio|instagram|instagram-bot|functions|scripts|vx|sig|fonts)(\/|$)/;
const pages = [];
(function walk(d) { for (const n of fs.readdirSync(path.join(ROOT, d))) { const rel = d ? d + '/' + n : n; if (SKIP.test(rel)) continue;
  if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel); else if (n.endsWith('.html')) pages.push(rel); } })('');
pages.sort();
const urlPath = p => '/' + (p === 'index.html' ? '' : p.replace(/index\.html$/, ''));
const fileFor = u => { let p = decodeURIComponent(u.split('#')[0].split('?')[0]).replace(/^\//, '');
  const cands = p === '' ? ['index.html'] : p.endsWith('/') ? [p + 'index.html'] : [p, p + '/index.html'];
  return cands.find(c => fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile()) || null; };
const APP_ROUTE = /^#(demo-[a-z]+|mockbench|join=.*|office=.*|trial.*|signup|login)$/;   // the app's own screens, not sections

(async () => {
  const br = await chromium.launch();
  const R = {};
  for (const w of [360, 1366]) {
    const ctx = await br.newContext({ viewport: { width: w, height: w < 500 ? 780 : 900 }, isMobile: w < 500, hasTouch: w < 500, timezoneId: 'America/New_York' });
    await ctx.route(/fonts\.(googleapis|gstatic)|gstatic\.com\/firebasejs|googletagmanager|google-analytics|cloudfunctions|firebaseio|googleapis\.com|youtube|vimeo/, r => r.abort());
    for (const p of pages) {
      const pg = await ctx.newPage(); const errs = [], missing = [];
      pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
      pg.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|ERR_BLOCKED|Failed to load resource|firebase|fonts\.g/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
      pg.on('response', r => { if (r.url().startsWith(HOST) && r.status() >= 400 && !(p === '404.html' && r.url() === HOST + '404.html')) missing.push(r.status() + ' ' + r.url().slice(HOST.length - 1)); });
      try { await pg.goto(HOST + urlPath(p).slice(1), { waitUntil: 'load', timeout: 30000 }); } catch (e) { errs.push('load: ' + e.message.slice(0, 120)); }
      await pg.waitForTimeout(p === 'index.html' ? 2500 : 600);
      R[p + '@' + w] = Object.assign({ errs, missing }, await pg.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const scrollsX = e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return true; return false; };
        const ids = {}, dup = []; document.querySelectorAll('[id]').forEach(e => { if (ids[e.id]) dup.push(e.id); ids[e.id] = 1; });
        const robots = (document.querySelector('meta[name=robots]') || {}).content || '';
        return {
          title: document.title.trim(), desc: ((document.querySelector('meta[name=description]') || {}).content || '').trim(), robots,
          canon: (document.querySelector('link[rel=canonical]') || {}).href || '', lang: document.documentElement.lang,
          h1: [...document.querySelectorAll('h1')].filter(vis).length, h1all: document.querySelectorAll('h1').length, sw: document.documentElement.scrollWidth, vw: innerWidth,
          over: [...document.querySelectorAll('body *')].filter(e => vis(e) && e.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed' && !scrollsX(e)).slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]),
          noAlt: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src')),
          brokenImg: [...document.querySelectorAll('img')].filter(i => vis(i) && i.complete && !i.naturalWidth).map(i => i.getAttribute('src')),
          dup: [...new Set(dup)], ids: Object.keys(ids),
          links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
          tiny: [...document.querySelectorAll('a[href],button,select,input:not([type=hidden])')].filter(e => vis(e) && !e.closest('p,li,td,dd,figcaption,blockquote,.legal,.fine,.sr-only') && getComputedStyle(e).display !== 'inline')
            .filter(e => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).slice(0, 3).map(e => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30)),
          unnamed: [...document.querySelectorAll('a[href],button')].filter(e => vis(e) && !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.querySelector('img[alt]:not([alt=""]),svg[aria-label],[aria-label]'))).slice(0, 3).map(e => e.outerHTML.slice(0, 90)),
          junk: ((document.body.innerText || '').match(/.{0,40}(\bundefined\b|\bNaN\b|\[object Object\]|\{\{[A-Z_]+\}\}).{0,30}/) || [''])[0]
        };
      }));
      await pg.close();
    }
    await ctx.close();
  }
  await br.close();

  for (const p of pages) for (const w of [360, 1366]) {
    const r = R[p + '@' + w], t = p + ' @' + w;
    check(t + ': no script or console errors', !r.errs.length, r.errs);
    check(t + ': every file it loads is there', !r.missing.length, r.missing);
    check(t + ': nothing runs off the side', r.sw <= r.vw && !r.over.length, { sw: r.sw, vw: r.vw, over: r.over });
    check(t + ': images load and have alt text', !r.brokenImg.length && !r.noAlt.length, { broken: r.brokenImg, noAlt: r.noAlt });
    check(t + ': no "undefined", "NaN" or unfilled {{PLACEHOLDER}} on the page', !r.junk, r.junk);
    check(t + ': links and buttons are big enough to tap (24 px)', !r.tiny.length, r.tiny);
    check(t + ': every link and button has a name', !r.unnamed.length, r.unnamed);
  }
  for (const p of pages) {
    const r = R[p + '@1366'], listed = !/noindex/i.test(r.robots);
    check(p + ': has a title, a language and unique ids', !!r.title && !!r.lang && !r.dup.length, { title: r.title, lang: r.lang, dup: r.dup });
    if (listed) {
      // Google shows about the first 155 characters and doesn't penalize more; the pages put what matters first
      check(p + ': has a description for search results (50 to 320 characters)', r.desc.length >= 50 && r.desc.length <= 320, { len: r.desc.length, desc: r.desc });
      // the home page's heading sits in the sign-in screen, drawn once the sign-in service answers (blocked here)
      check(p + ': one main heading', p === 'index.html' ? r.h1all === 1 : r.h1 === 1, r.h1);
      if (r.canon) check(p + ': canonical address is its own', new URL(r.canon).pathname === urlPath(p), { canon: r.canon });
    }
    // links inside the site
    const bad = [];
    for (const h of r.links) {
      if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(h)) continue;
      let u;
      if (/^https?:\/\//i.test(h)) { if (!/^https?:\/\/(www\.)?vpexdialer\.com/i.test(h)) continue; u = new URL(h); }
      else u = new URL(h, 'https://vpexdialer.com' + urlPath(p));
      const target = fileFor(u.pathname);
      if (!target) { bad.push(h + ' (no such page)'); continue; }
      const hash = decodeURIComponent(u.hash.slice(1));
      if (!hash || APP_ROUTE.test('#' + hash) || /=/.test(hash)) continue;
      const tr = R[target + '@1366'];
      if (tr && !tr.ids.includes(hash)) bad.push(h + ' (no section #' + hash + ')');
    }
    check(p + ': every link inside the site works', !bad.length, [...new Set(bad)]);
  }
  // the sitemap
  const sm = (fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').match(/<loc>[^<]+<\/loc>/g) || []).map(x => new URL(x.slice(5, -6)).pathname);
  const shouldList = pages.filter(p => p !== '404.html' && !/noindex/i.test(R[p + '@1366'].robots)).map(urlPath);
  check('sitemap: every listed address is a real page', sm.every(u => fileFor(u)), sm.filter(u => !fileFor(u)));
  check('sitemap: no page that asks not to be listed (noindex)', sm.every(u => { const f = fileFor(u); return !f || !/noindex/i.test((R[f + '@1366'] || {}).robots || ''); }), sm.filter(u => /noindex/i.test((R[fileFor(u) + '@1366'] || {}).robots || '')));
  check('sitemap: every page search engines may list is in it (add it to siteUrls() in tools/build_calling_hours.js)', shouldList.every(u => sm.includes(u)), shouldList.filter(u => !sm.includes(u)));
  check('sitemap: no address twice', new Set(sm).size === sm.length);
  console.log('site_health: ' + pass + ' passed, ' + fail + ' failed (' + pages.length + ' pages)');
  process.exit(fail ? 1 : 0);
})();
