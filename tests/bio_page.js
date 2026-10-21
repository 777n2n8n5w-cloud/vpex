// VPEX regression check (bio_page): vpexdialer.com/ig, the page the Instagram, Threads and Facebook bio links open.
// Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/bio_page.js
const { chromium } = require('playwright');
const ROOT = (process.env.ROOT || 'http://127.0.0.1:8765'), OUT = (process.env.SHOTS || require('os').tmpdir());
const HIT = ROOT + '/__hit';
const feed = require('../ig/feed.json');
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0';
const NOW = new Date('2026-10-24T16:00:00-04:00');   // a Saturday afternoon in week 4b
async function mk(br, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, userAgent: c.w < 500 ? IPHONE : undefined });
  await ctx.addInitScript(u => { try { localStorage.setItem('vpex_hit_test', u); } catch (e) {} }, HIT);
  const p = await ctx.newPage(); const errs = [], hits = [];
  await p.clock.install({ time: NOW });
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await ctx.route(HIT, r => { try { hits.push(JSON.parse(r.request().postData())); } catch (e) {} r.fulfill({ status: 204, body: '' }); });
  return { ctx, p, errs, hits };
}
(async () => {
  const br = await chromium.launch();
  const due = feed.tiles.filter(t => Date.parse(t.at) <= NOW.getTime());
  for (const c of [{ n: 'phone-dark', w: 390, s: 'dark' }, { n: 'phone-light', w: 390, s: 'light' }, { n: 'small', w: 320, s: 'dark' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const { ctx, p, errs, hits } = await mk(br, c); const tag = c.n;
    await p.goto(ROOT + '/ig/'); await p.waitForTimeout(1200);
    const s = await p.evaluate(() => {
      const tiles = [...document.querySelectorAll('#grid a')];
      const small = [...document.querySelectorAll('a,button')].filter(e => e.offsetParent && !e.closest('#grid') && !e.closest('footer')).map(e => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44);
      return { n: tiles.length, ids: tiles.map(a => a.getAttribute('data-n')), hrefs: tiles.map(a => a.getAttribute('href')),
        inds: [...document.querySelectorAll('.inds a')].map(a => a.getAttribute('href')), trial: document.querySelector('.trial').getAttribute('href'),
        sw: document.documentElement.scrollWidth, vw: innerWidth, small, more: !document.getElementById('more').hidden,
        imgs: tiles.slice(0, 6).every(a => a.querySelector('img').complete && a.querySelector('img').naturalWidth > 0) };
    });
    check(tag + ' shows only posts already out (' + due.length + ' by Sat 4 PM), newest first', s.n === Math.min(due.length, 24) && s.ids[0] === due[0].id && s.ids.every(i => due.some(t => t.id === i)), { n: s.n, first: s.ids[0] });
    check(tag + ' no post from the future', !s.ids.includes('w4b-v') && !s.ids.includes('w4b-auto'), s.ids.slice(0, 3));
    check(tag + ' previews load', s.imgs);
    const w4bins = s.hrefs[s.ids.indexOf('w4b-ins')] || '';
    check(tag + ' an insurance post opens the insurance demo, tagged with the post', /^\/\?utm_source=instagram&utm_medium=bio&utm_content=w4b-ins&utm_campaign=w4b#demo-insurance$/.test(w4bins), w4bins);
    const gen = s.hrefs[s.ids.indexOf('w4-r')] || '';
    check(tag + ' a general post opens the sales page, tagged', /^\/\?utm_source=instagram&utm_medium=bio&utm_content=w4-r&utm_campaign=w4$/.test(gen), gen);
    check(tag + ' 5 industry demos', s.inds.length === 5 && s.inds.every(h => /utm_content=bio-demo-[a-z]+.*#demo-(insurance|realestate|mca|auto|solar)$/.test(h)), s.inds);
    check(tag + ' trial button goes to the form', /trial=start/.test(s.trial) && /utm_content=bio-trial/.test(s.trial), s.trial);
    check(tag + ' no sideways scroll', s.sw <= s.vw, s);
    check(tag + ' buttons at least 44 px tall', !s.small.length, s.small);
    check(tag + ' one page view counted', hits.filter(h => h.e === 'bio_view').length === 1 && hits[0].s === 'instagram' && hits[0].m === 'bio', hits);
    await p.screenshot({ path: `${OUT}/bio-${c.n}.png`, fullPage: c.n !== 'desk' });
    if (c.n === 'phone-dark') {
      // tap a post: counted, then the demo opens and counts the visit for that post
      await p.click('#grid a[data-n="w4b-ins"]'); await p.waitForTimeout(2600);
      const tap = hits.find(h => h.e === 'bio_tap');
      check('tap: counted with the post and industry', tap && tap.n === 'w4b-ins' && tap.i === 'insurance' && tap.c === 'w4b', tap);
      const demo = hits.find(h => h.e === 'demo');
      check('tap: the demo opens and counts for the same post', demo && demo.s === 'instagram' && demo.m === 'bio' && demo.n === 'w4b-ins' && demo.i === 'insurance', hits.map(h => h.e + ':' + h.n));
      check('tap: address bar is clean', !/utm_/.test(p.url()) && /#demo-insurance$/.test(p.url()), p.url());
    }
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  // Threads and Facebook bio links name themselves
  { const { ctx, p, errs, hits } = await mk(br, { w: 390, s: 'dark' });
    await p.goto(ROOT + '/ig/?s=threads'); await p.waitForTimeout(1000);
    const h = await p.evaluate(() => document.querySelector('.inds a').getAttribute('href'));
    check('threads: links say utm_source=threads', /utm_source=threads/.test(h) && hits[0] && hits[0].s === 'threads', [h, hits[0]]);
    check('threads: no errors', !errs.length, errs); await ctx.close(); }
  // Older posts: 24 at first, then Show older posts
  { const { ctx, p } = await mk(br, { w: 390, s: 'dark' }); await p.clock.setSystemTime(new Date('2026-11-30T12:00:00-05:00'));
    await p.goto(ROOT + '/ig/'); await p.waitForTimeout(1000);
    const a = await p.evaluate(() => document.querySelectorAll('#grid a').length);
    await p.click('#more'); await p.waitForTimeout(300);
    const b = await p.evaluate(() => ({ n: document.querySelectorAll('#grid a').length, more: !document.getElementById('more').hidden }));
    check('paging: 24, then all ' + feed.tiles.length, a === Math.min(24, feed.tiles.length) && b.n === feed.tiles.length && !b.more, { a, b }); await ctx.close(); }
  // Before any post is out: the posts section stays hidden
  { const { ctx, p, errs } = await mk(br, { w: 390, s: 'dark' }); await p.clock.setSystemTime(new Date('2026-01-01T12:00:00-05:00'));
    await p.goto(ROOT + '/ig/'); await p.waitForTimeout(900);
    check('no posts yet: section hidden, demos still there', await p.evaluate(() => document.getElementById('posts').hidden && document.querySelectorAll('.inds a').length === 5));
    check('no posts yet: no errors', !errs.length, errs); await ctx.close(); }
  await br.close(); console.log(`bio_page: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
