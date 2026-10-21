// VPEX regression check (growth_beacons): the anonymous funnel counts the site sends to VPEX's own counter.
// Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/growth_beacons.js
// On localhost the app only sends when localStorage.vpex_hit_test names a URL; here that URL is caught and recorded.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html'), OUT = (process.env.SHOTS || require('os').tmpdir());
const HIT = 'http://127.0.0.1:8765/__hit';
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
async function mk(br, opt = {}) {
  const ctx = await br.newContext({ viewport: { width: opt.w || 390, height: 844 }, isMobile: (opt.w || 390) < 500, hasTouch: (opt.w || 390) < 500,
    userAgent: opt.ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', colorScheme: 'dark' });
  if (opt.test !== false) await ctx.addInitScript(u => { try { if (!localStorage.getItem('vpex_hit_test')) localStorage.setItem('vpex_hit_test', u); } catch (e) {} }, HIT);
  if (opt.init) await ctx.addInitScript(opt.init);
  const p = await ctx.newPage(); const errs = [], hits = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await ctx.route(HIT, r => { try { hits.push(JSON.parse(r.request().postData())); } catch (e) { hits.push({ bad: r.request().postData() }); } r.fulfill({ status: 204, body: '' }); });
  return { ctx, p, errs, hits };
}
const of = (hits, e) => hits.filter(h => h.e === e);
(async () => {
  const br = await chromium.launch();

  // 1. A post's link lands on the sales page: one visit with the post's tags; tags leave the address bar; the source is remembered
  {
    const { ctx, p, errs, hits } = await mk(br);
    await p.goto(BASE + '?utm_source=instagram&utm_medium=bio&utm_campaign=w5&utm_content=w5-reel-a#mockbench'); await p.waitForTimeout(2500);
    const v = of(hits, 'visit');
    check('sales: one visit', v.length === 1, hits);
    check('sales: visit carries the post tags', v[0] && v[0].s === 'instagram' && v[0].m === 'bio' && v[0].c === 'w5' && v[0].n === 'w5-reel-a' && v[0].d === 'm', v[0]);
    const st = await p.evaluate(() => ({ url: location.href, attr: JSON.parse(localStorage.getItem('vpex_attr') || 'null') }));
    check('sales: tags removed, hash kept', !/utm_/.test(st.url) && /#mockbench$/.test(st.url), st.url);
    check('sales: source remembered on the phone', st.attr && st.attr.s === 'instagram' && st.attr.n === 'w5-reel-a', st.attr);
    check('sales: nothing personal in a beacon', hits.every(h => Object.keys(h).every(k => ['e', 's', 'm', 'c', 'n', 'i', 'o', 'd'].includes(k))), hits);
    await p.click('#heroCta'); await p.waitForTimeout(700); await p.click('#heroCta'); await p.waitForTimeout(400);
    check('trial form: counted once', of(hits, 'trial_view').length === 1 && of(hits, 'trial_view')[0].n === 'w5-reel-a', of(hits, 'trial_view'));
    await p.reload(); await p.waitForTimeout(2200);
    check('reload: no second visit in the same visit', of(hits, 'visit').length === 1, hits.length);
    // sign up: credited to the post that brought them
    const id = 'gb' + Date.now().toString(36).slice(-5);
    await p.fill('#suOffice', 'Harbor Growth ' + id); await p.selectOption('#suInd', 'solar'); await p.fill('#suName', 'Sam Test');
    await p.fill('#suPhone', '(212) 555-0142'); await p.fill('#suEmail', id + '@example.com'); await p.fill('#suUser', 'sam');
    await p.fill('#suPw', 'longpassword1'); await p.fill('#suPw2', 'longpassword1');
    await p.click('#suGo'); await p.waitForTimeout(4000);
    const su = of(hits, 'signup');
    check('signup: one beacon with the office and its source', su.length === 1 && su[0].o === 'harbor-growth-' + id && su[0].i === 'solar' && su[0].s === 'instagram' && su[0].n === 'w5-reel-a', su);
    check('signup: no email, name or phone sent', !JSON.stringify(hits).match(/example\.com|Sam Test|555-0142|longpassword/), '');
    const inApp = await p.evaluate(() => getComputedStyle(document.getElementById('authScreen')).display === 'none');
    check('signup: still gets into the app', inApp);
    check('sales flow: no page errors', !errs.length, errs);
    await ctx.close();
  }

  // 2. A tile straight to a demo: visit + demo with the industry; the first call in the demo counts once
  {
    const { ctx, p, errs, hits } = await mk(br);
    await p.goto(BASE + '?utm_source=threads&utm_medium=post&utm_campaign=w5&utm_content=w5-car-b#demo-solar'); await p.waitForTimeout(2600);
    check('demo: visit and demo', of(hits, 'visit').length === 1 && of(hits, 'demo').length === 1, hits);
    const d = of(hits, 'demo')[0] || {};
    check('demo: industry and source', d.i === 'solar' && d.s === 'threads' && d.n === 'w5-car-b', d);
    check('demo: still a demo after the tags are removed', await p.locator('#demoTrial').isVisible().catch(() => false));
    for (let k = 0; k < 2; k++) {
      await p.evaluate(() => { const c = document.getElementById('copyBtn'); if (c) c.click(); }); await p.waitForTimeout(250);
      await p.evaluate(() => { const b = document.querySelector('#outcomesRow [data-outcome="noanswer"]'); if (b) b.click(); }); await p.waitForTimeout(700);
    }
    check('demo: first call counted once', of(hits, 'demo_call').length === 1 && of(hits, 'demo_call')[0].i === 'solar', of(hits, 'demo_call'));
    // Start free trial from the demo: the trial form counts, still credited to the post
    const nav = p.waitForURL(/\?trial=/, { timeout: 5000 }).catch(() => null);
    await p.click('#demoTrial'); await nav;
    check('demo → trial: lands on ?trial=solar', /\?trial=solar/.test(p.url()), p.url());
    await p.goto(BASE + '?trial=solar#mockbench'); await p.reload(); await p.waitForTimeout(2600);   // the same page, with the stand-in sign-in service
    const tv = of(hits, 'trial_view');
    check('demo → trial form: counted with the same source', tv.length === 1 && tv[0].s === 'threads' && tv[0].n === 'w5-car-b', tv);
    check('demo flow: no page errors', !errs.length, errs);
    await ctx.close();
  }

  // 3. No tags: the site that sent them is the source; an old source (over 30 days) is dropped
  {
    const { ctx, p, errs, hits } = await mk(br);
    await p.goto(BASE + '#mockbench', { referer: 'https://l.instagram.com/?u=x' }); await p.waitForTimeout(2200);
    const v = of(hits, 'visit')[0] || {};
    check('referrer: Instagram link without tags counts as instagram', v.s === 'instagram' && v.m === 'referral', v);
    await ctx.close();
    const b = await mk(br, { init: () => { try { localStorage.setItem('vpex_attr', JSON.stringify({ s: 'facebook', m: 'bio', c: '', n: 'old', t: Date.now() - 31 * 86400000 })); } catch (e) {} } });
    await b.p.goto(BASE + '#mockbench'); await b.p.waitForTimeout(2200);
    const v2 = of(b.hits, 'visit')[0] || {};
    check('old source: over 30 days counts as direct', v2.s === 'direct' && !v2.n, v2);
    const c = await mk(br, { init: () => { try { localStorage.setItem('vpex_attr', JSON.stringify({ s: 'facebook', m: 'bio', c: 'w4', n: 'w4-x', t: Date.now() - 2 * 86400000 })); } catch (e) {} } });
    await c.p.goto(BASE + '#mockbench'); await c.p.waitForTimeout(2200);
    const v3 = of(c.hits, 'visit')[0] || {};
    check('recent source: two days later still credited', v3.s === 'facebook' && v3.n === 'w4-x', v3);
    check('referrer cases: no page errors', !errs.length && !b.errs.length && !c.errs.length, [errs, b.errs, c.errs]);
    await b.ctx.close(); await c.ctx.close();
  }

  // 4. Computer vs phone; Home Screen launch counted once per phone
  {
    const { ctx, p, hits } = await mk(br, { w: 1280, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' });
    await p.goto(BASE + '#mockbench'); await p.waitForTimeout(2000);
    check('computer: d=d', (of(hits, 'visit')[0] || {}).d === 'd', hits);
    await ctx.close();
    const h = await mk(br, { init: () => { try { Object.defineProperty(navigator, 'standalone', { get: () => true }); } catch (e) {} } });
    await h.p.goto(BASE + '#mockbench'); await h.p.waitForTimeout(2000);
    check('home screen: first launch counted', of(h.hits, 'home_screen').length === 1, h.hits);
    await h.p.reload(); await h.p.waitForTimeout(1500);
    check('home screen: not again on this phone', of(h.hits, 'home_screen').length === 1, h.hits.length);
    check('home screen: no page errors', !h.errs.length, h.errs);
    await h.ctx.close();
  }

  // 5. Off unless it's vpexdialer.com (here: no test URL set) — nothing leaves the phone
  {
    const { ctx, p, errs, hits } = await mk(br, { test: false });
    let any = 0; await ctx.route(/cloudfunctions\.net\/hit/, r => { any++; r.abort(); });
    await p.goto(BASE + '?utm_source=instagram#demo-insurance'); await p.waitForTimeout(2200);
    check('off on other hosts: no beacons', hits.length === 0 && any === 0, { hits, any });
    check('off: no page errors', !errs.length, errs);
    await ctx.close();
  }

  await br.close(); console.log(`growth_beacons: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
