// VPEX regression check (demo_no_dial). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/demo_no_dial.js
// Demo offices: Call and Text never leave the page (no phone prompt for a fictional 555 number, no Messages, no FaceTime),
// a once-per-visit toast says so, and after the visitor's 3rd logged call one card offers the free trial.
// Real offices (#mockbench) keep real tel: links.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const MORN = '2026-10-20T15:30:00Z';   // 11:30 AM in New York: the first demo leads are callable
async function open(br, office, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(MORN) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
  // window listener: runs after every document listener, so it sees what the app decided
  await page.addInitScript(() => window.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (!a) return;
    window.__links = (window.__links || []).concat([{ href: a.getAttribute('href').slice(0, 4), prevented: e.defaultPrevented, demo: !!e.vpexDemoDial }]);
    if (!e.defaultPrevented) e.preventDefault();   // never leave the test page
  }));
  await page.goto(BASE + '#demo-' + office); await page.waitForTimeout(1600);
  return { ctx, page, errs };
}
const toast = page => page.evaluate(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.innerText.replace(/\n/g, ' / ') : ''; });
const nudge = page => page.evaluate(() => {
  const n = document.getElementById('demoNudge'); if (!n || n.style.display === 'none') return null;
  const lum = c => { const k = /^color\(/.test(c) ? 1 : 255; const v = c.replace(/^color\(srgb/, '').match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= k; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const con = el => { const cs = getComputedStyle(el); const L1 = lum(cs.color); let bg = cs.backgroundColor, p = el; while (p && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { p = p.parentElement; bg = p ? getComputedStyle(p).backgroundColor : 'rgb(255,255,255)'; } const L2 = lum(bg); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
  const b = n.getBoundingClientRect(), t = document.getElementById('dnTrial'), l = document.getElementById('dnLater');
  return { text: n.innerText.replace(/\n/g, ' / '), role: n.getAttribute('role'), inView: b.top >= 0 && b.bottom <= innerHeight + 1 && b.left >= 0 && b.right <= innerWidth + 1,
    tH: Math.round(t.getBoundingClientRect().height), lH: Math.round(l.getBoundingClientRect().height),
    conT: con(t), conL: con(l), conB: con(n.querySelector('.tp-titles b')), conS: con(n.querySelector('.tp-titles span')),
    textPrompt: document.getElementById('textPrompt').style.display !== 'none', sw: document.documentElement.scrollWidth, vw: innerWidth };
});
async function logCall(page, outcome, viaCall) {
  await page.clock.fastForward(20000);   // past the demo's cooling-off wait between calls
  await page.waitForTimeout(150);
  if (viaCall) await page.evaluate(() => document.getElementById('callBtn').click());
  else await page.evaluate(() => document.getElementById('copyBtn').click());
  await page.waitForTimeout(250);
  await page.evaluate(o => document.querySelector('#outcomesRow [data-outcome="' + o + '"]').click(), outcome);
  await page.waitForTimeout(500);
}
(async () => {
  const br = await chromium.launch();
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const tag = o + '/' + c.n;
    const { ctx, page, errs } = await open(br, o, c);
    check(tag + ' welcome toast says demo and that no real call goes out', /^Demo office with sample leads \/ Tap Call to try it\. No real call goes out\.$/.test(await toast(page)), await toast(page));
    check(tag + ' hint under the outcomes says it’s a demo', /^Try it: tap Call \(it.s a demo, so no real call goes out\)/.test(await page.evaluate(() => document.querySelector('.hint').textContent)));
    // 1st call through the Call button
    await page.evaluate(() => document.getElementById('callBtn').click()); await page.waitForTimeout(300);
    let links = await page.evaluate(() => window.__links || []);
    check(tag + ' Call stays on the page (demo call)', links.length === 1 && links[0].href === 'tel:' && links[0].prevented && links[0].demo, links);
    check(tag + ' Call toast says no real call', /^Dialing \(\d{3}\) 555-\d{4} … \/ Demo, so no real call goes out$/.test(await toast(page)), await toast(page));
    check(tag + ' outcomes are ready after Call', await page.evaluate(() => !document.getElementById('outcomesRow').classList.contains('disabled') && /How did it go/.test(document.querySelector('.hint').textContent)));
    await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="noanswer"]').click()); await page.waitForTimeout(500);
    check(tag + ' 1 call: no trial card', (await nudge(page)) === null);
    // the follow-up text prompt: Send text stays on the page too, logs the text, no "Messages didn't open?"
    const tp = await page.evaluate(() => { const a = document.getElementById('tpSend'); if (!a) return false; a.click(); return true; });
    if (tp) {
      await page.waitForTimeout(300);
      links = await page.evaluate(() => window.__links || []);
      const last = links[links.length - 1];
      check(tag + ' Send text stays on the page (demo)', last && last.href === 'sms:' && last.prevented && last.demo, links);
      check(tag + ' Send text toast says Messages doesn’t open', /^Text logged \/ Demo, so Messages doesn.t open/.test(await toast(page)), await toast(page));
      await page.clock.fastForward(2500); await page.waitForTimeout(200);
      check(tag + ' no "Messages didn’t open?" fallback', await page.evaluate(() => !/didn.t open/.test(document.getElementById('textPrompt').innerText) && document.getElementById('textPrompt').style.display === 'none'));
    } else check(tag + ' text prompt offered after a no answer', false);
    await logCall(page, 'voicemail', true);
    check(tag + ' 2 calls: no trial card', (await nudge(page)) === null);
    await logCall(page, 'noanswer', false);
    const n = await nudge(page);
    check(tag + ' 3rd call: trial card', !!n && /^Run your own floor like this \/ Load your list and invite your reps\. They call from their own phones\. 7 days free, no card needed\. \/ Keep exploring \/ Start free trial$/.test(n.text), n);
    if (n) {
      check(tag + ' card is a labelled dialog, fully on screen, no overflow', n.role === 'dialog' && n.inView && n.sw <= n.vw, n);
      check(tag + ' card replaces the text prompt (one card at a time)', !n.textPrompt, n);
      check(tag + ' card buttons >= 42 px', n.tH >= 42 && n.lH >= 42, n);
      check(tag + ' card contrast >= 4.5', n.conT >= 4.5 && n.conL >= 4.5 && n.conB >= 4.5 && n.conS >= 4.5, n);
    }
    links = await page.evaluate(() => window.__links || []);
    check(tag + ' no link ever left the page', links.every(l => l.prevented && l.demo), links);
    if (c.n === 'p-dark') {
      await page.evaluate(() => document.getElementById('dnLater').click()); await page.waitForTimeout(200);
      check(tag + ' Keep exploring closes it', (await nudge(page)) === null);
      await logCall(page, 'noanswer', true); await logCall(page, 'notinterested', true);
      check(tag + ' shown once per visit (not after calls 4 and 5)', (await nudge(page)) === null);
      // a reload in the same tab: no second welcome toast, no second card
      await page.reload(); await page.waitForTimeout(1600);
      check(tag + ' welcome toast once per visit', !/Demo office with sample leads/.test(await toast(page)), await toast(page));
    } else if (c.n === 'p-light') {
      const navs = []; page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
      await page.evaluate(() => document.getElementById('dnTrial').click()); await page.waitForTimeout(1200);
      check(tag + ' Start free trial leaves the demo for the trial form with this industry (?trial=' + o + ')', navs.some(u => new URL(u).search === '?trial=' + o && !/#demo/.test(u)), navs);
    }
    check(tag + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  // a real office (the test bench, no demo): tel: links are not touched
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE.replace(/index\.html$/, '') + 'index.html#mockbench'); await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const a = document.createElement('a'); a.href = 'tel:2125550115'; a.textContent = 'x'; document.body.appendChild(a);
      let prevented = null; window.addEventListener('click', e => { prevented = e.defaultPrevented; e.preventDefault(); }, { once: true });
      a.click(); a.remove(); return { prevented, nudge: !!document.getElementById('demoNudge'), hi: sessionStorage.getItem('vpex_demo_hi') };
    });
    check('real office: tel: links still dial', r.prevented === false, r);
    check('real office: no demo card or welcome', !r.nudge && !r.hi, r);
    await page.evaluate(() => { localStorage.removeItem('vpex_mockbench'); });
    await ctx.close();
  }
  await br.close();
  console.log('demo_no_dial: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
