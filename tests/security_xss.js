// VPEX security check (security_xss): lead data is untrusted (uploads, pasted lists, lead forms, other reps), so every
// field is filled with script-injection payloads and the app is walked through every view on a phone and a computer:
// Dial card, History, Pipeline, Tasks, Vault, the lead profile, search, the desk's live column and Floor TV.
// Nothing may run (window.__xss stays unset) and no injected element may appear in the page.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/security_xss.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const P = [
  '"><img src=x onerror="window.__xss=(window.__xss||[]).concat(\'img\')" data-xss>',
  "'><svg onload=\"window.__xss=(window.__xss||[]).concat('svg')\" data-xss></svg>",
  '<script data-xss>window.__xss=(window.__xss||[]).concat("script")</script>',
  'javascript:window.__xss=(window.__xss||[]).concat("href")',
  '</textarea><iframe data-xss srcdoc="<script>parent.__xss=1</script>"></iframe>',
  '{{constructor.constructor("window.__xss=1")()}}',
];

(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: 'phone', w: 390, m: true }, { n: 'desk', w: 1280, m: false }]) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: 860 }, isMobile: c.m, hasTouch: c.m, timezoneId: 'America/New_York' });
    await ctx.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('vpex_consent', JSON.stringify({ v: '2026-11-10', t: Date.now(), id: 'testtesttesttesttest', c: { fonts: false, stats: false, attribution: false }, m: 'reject_all', r: 'optout' })); } catch (e) {} });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
    await page.goto(BASE + '#demo-investments'); await page.waitForTimeout(2500);
    const ids = await page.evaluate(() => window.__mockLeads().slice(0, 6).map(l => l.id));
    check(c.n + ' demo has leads to fill', ids.length === 6, ids);
    // every text field a lead can carry, plus other numbers with labels and the stage
    await page.evaluate(([ids, P]) => {
      ids.forEach((id, i) => {
        const p = P[i % P.length];
        ['name', 'notes', 'company', 'email', 'city', 'address', 'source', 'title', 'website', 'state'].forEach(k => window.__mockEditLead(id, k, k === 'name' ? 'Ann ' + p : p));
        window.__mockEditLead(id, 'alts', [{ n: '(212) 555-0150', l: p }]);
        window.__mockEditLead(id, 'tags', [p]);
      });
    }, [ids, P]);
    const views = ['dial', 'history', 'pipeline', 'tasks', 'vault'];
    for (const v of views) {
      await page.evaluate(v => { const b = document.querySelector('[data-view="' + v + '"]'); if (b) b.click(); }, v);
      await page.waitForTimeout(350);
    }
    for (const id of ids) {
      await page.evaluate(id => { const b = document.createElement('button'); b.setAttribute('data-open-lead', id); document.body.appendChild(b); b.click(); b.remove(); }, id);
      await page.waitForTimeout(300);
      await page.evaluate(() => { const x = document.querySelector('#leadModal.show .close-x, #leadModal.show [data-lp-close], #leadModal.show .lp-close'); if (x) x.click(); else document.getElementById('leadModal') && document.getElementById('leadModal').classList.remove('show'); });
    }
    await page.evaluate(() => { const s = document.getElementById('searchBtn'); if (s) s.click(); });
    await page.waitForTimeout(250);
    await page.keyboard.type('Ann'); await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    if (c.n === 'desk') { await page.evaluate(() => { const b = document.getElementById('openTvBtn'); if (b) b.click(); }); await page.waitForTimeout(600); }
    await page.evaluate(() => { const b = document.querySelector('[data-view="history"]'); if (b) b.click(); }); await page.waitForTimeout(300);
    await page.evaluate(id => { const b = document.createElement('button'); b.setAttribute('data-open-lead', id); document.body.appendChild(b); b.click(); b.remove(); }, ids[0]);
    await page.waitForTimeout(400);
    check(c.n + ': the payloads really were on screen, shown as text', await page.evaluate(() => /onerror=/.test(document.body.innerText)));
    const r = await page.evaluate(() => ({ ran: window.__xss || null, injected: document.querySelectorAll('[data-xss]').length,
      jsHref: [...document.querySelectorAll('a[href]')].filter(a => /^\s*javascript:/i.test(a.getAttribute('href'))).length }));
    check(c.n + ': no payload ran', r.ran === null, r.ran);
    check(c.n + ': no injected element in the page', r.injected === 0, r.injected);
    check(c.n + ': no javascript: links made from lead data', r.jsHref === 0, r.jsHref);
    check(c.n + ': no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log('security_xss: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
