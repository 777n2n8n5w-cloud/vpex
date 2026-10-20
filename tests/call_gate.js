// VPEX regression check (call_gate). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/call_gate.js
// Tapping Call on a lead outside their calling hours asks first (Wait / Call anyway); inside hours it dials straight away.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
async function open(br, office, iso, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(iso) });
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(BASE + '#demo-' + office); await page.waitForTimeout(2500);
  // stop tel: links from leaving the page; count the dials instead
  await page.evaluate(() => document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a && !e.defaultPrevented) { e.preventDefault(); window.__dialed = (window.__dialed || 0) + 1; } }));   // bubbling, after the app: the app let it dial
  return { ctx, page, errs };
}
const sheet = page => page.evaluate(() => {
  const m = document.getElementById('infoModal'), b = document.getElementById('infoModalBody');
  const no = document.getElementById('gateNo'), go = b.querySelector('.gate-call');
  const lum = c => { const k = /^color\(/.test(c) ? 1 : 255; const v = c.replace(/^color\(srgb/, '').match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= k; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const con = el => { if (!el) return null; const cs = getComputedStyle(el); const L1 = lum(cs.color); let bg = cs.backgroundColor, p = el; while (p && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { p = p.parentElement; bg = p ? getComputedStyle(p).backgroundColor : 'rgb(255,255,255)'; } const L2 = lum(bg); return (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); };
  const r = el => el ? Math.round(el.getBoundingClientRect().height) : 0;
  return { open: m.classList.contains('show'), title: (b.querySelector('h3') || {}).textContent, msg: (b.querySelector('.modal-sub') || {}).textContent,
    no: no && no.textContent, noPrimary: !!no && no.classList.contains('btn-primary'), go: go && go.textContent, noH: r(no), goH: r(go), conNo: con(no), conGo: con(go),
    dialed: window.__dialed || 0, hint: (document.querySelector('.hint') || {}).textContent || '', sw: document.documentElement.scrollWidth, vw: innerWidth };
});
(async () => {
  const br = await chromium.launch();
  const NIGHT = '2026-10-20T07:30:00Z', MORN = '2026-10-20T15:30:00Z';   // 3:30 AM / 11:30 AM in New York
  for (const o of ['insurance', 'realestate', 'mca', 'auto', 'solar']) for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const tag = o + '/' + c.n;
    let { ctx, page, errs } = await open(br, o, NIGHT, c);
    await page.evaluate(() => document.getElementById('callBtn').click()); await page.waitForTimeout(400);
    let s = await sheet(page);
    check(tag + ' night: Call asks first', s.open && s.title === 'Outside calling hours', s);
    check(tag + ' night: says their time, state and why', /^It’s \d+:\d\d AM [A-Z]{2,4}T? for .+ in [A-Z]{2}: outside .+\. Calls open today at \d+:00 AM your time\. Sales calls outside these hours can break telemarketing rules\. Call now only if they asked you to\.$/.test(s.msg || ''), s.msg);
    check(tag + ' night: Wait is the main button, Call anyway second', s.no === 'Wait' && s.noPrimary && s.go === 'Call anyway', s);
    check(tag + ' night: buttons 44 px, contrast >= 4.5', s.noH >= 40 && s.goH >= 40 && s.conNo >= 4.5 && s.conGo >= 4.5, s);
    check(tag + ' night: nothing dialed yet', s.dialed === 0, s);
    check(tag + ' night: no overflow', s.sw <= s.vw, s);
    if (o === 'solar' && c.n !== 'desk') await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/gate-' + c.n + '.png' });
    await page.click('#gateNo'); await page.waitForTimeout(300);
    s = await sheet(page);
    check(tag + ' Wait: sheet closes, no call, not waiting for an outcome', !s.open && s.dialed === 0 && !/How did it go/.test(s.hint), s);
    await page.evaluate(() => document.getElementById('callBtn').click()); await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('#infoModalBody .gate-call').click()); await page.waitForTimeout(500);
    s = await sheet(page);
    check(tag + ' Call anyway: dials, sheet closes, asks how it went', s.dialed === 1 && !s.open && /How did it go/.test(s.hint), s);
    check(tag + ' night no page errors', !errs.length, errs); await ctx.close();
    if (c.n !== 'p-dark') continue;
    // inside hours: Callable now, then Call dials with no sheet
    ({ ctx, page, errs } = await open(br, o, MORN, c));
    await page.evaluate(() => { const b = document.querySelector('[data-qfilter="now"]'); if (b) b.click(); }); await page.waitForTimeout(500);
    const late = await page.evaluate(() => { const w = document.querySelector('.lead-where'); return w ? w.classList.contains('late') : null; });
    await page.evaluate(() => document.getElementById('callBtn').click()); await page.waitForTimeout(400);
    s = await sheet(page);
    check(tag + ' morning, callable lead: no sheet, dials', late === false && !s.open && s.dialed === 1 && /How did it go/.test(s.hint), { late, s });
    check(tag + ' morning no page errors', !errs.length, errs); await ctx.close();
  }
  await br.close(); console.log(`call_gate: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
