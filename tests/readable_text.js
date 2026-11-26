// VPEX regression check (readable_text): every word on Calendar, Pipeline and Tasks is readable in every theme
// (contrast 4.5:1 for small text, 3:1 for large; WCAG AA). Small grey labels used to drop to 3.4:1 in 40 light themes.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/readable_text.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const probe = (pg) => pg.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const scope = [...document.querySelectorAll('.modal-overlay.show')].pop() || document.getElementById('mainArea') || document.body;
  const vw = document.documentElement.clientWidth;
  const over = [...scope.querySelectorAll('*')].filter(e => vis(e) && e.getBoundingClientRect().right > vw + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('.filter-row,.hscroll,[style*="overflow"]')).map(e => (e.className && e.className.baseVal === undefined ? e.className : e.tagName) + '').slice(0, 3);
  const txt = scope.innerText || '';
  const bad = (txt.match(/[^\n]{0,30}\b(undefined|NaN|null|Invalid Date|\[object Object\])\b[^\n]{0,30}/g) || []).slice(0, 3);
  const small = [...scope.querySelectorAll('button, a[href], select, input:not([type=hidden])')].filter(e => vis(e) && !e.closest('.cal-legend')).filter(e => { const r = e.getBoundingClientRect(); return (r.width < 28 || r.height < 28) && !/^(A)$/.test(e.tagName); })
    .map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 4);
  // contrast of text in the main area
  const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return 1; let v = m.slice(0, 3).map(Number); if (/^color\(srgb/.test(c)) v = v.map(x => x * 255); const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
  const alpha = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(s => s.trim()); return p.length > 3 ? +p[3] : 1; } const n = c.match(/\/\s*([\d.]+)\)/); return n ? +n[1] : 1; };
  const bgOf = el => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && alpha(b) > 0.85) return b; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)'; };
  const low = [];
  [...scope.querySelectorAll('b, span, p, h2, h3, h4, time, button, a, div')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)).slice(0, 400).forEach(e => {
    const cs = getComputedStyle(e); if (+cs.opacity < 0.9 || e.closest('[disabled], .done, .past, .other')) return;
    const a = lum(cs.color), b = lum(bgOf(e)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), big = parseFloat(cs.fontSize) >= 18.6 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700);
    if (r < (big ? 3 : 4.5) - 0.05) low.push((e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 18) + '" ' + r.toFixed(2));
  });
  return { over, bad, small, low: low.slice(0, 4) };
});
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  await ctx.route(/gstatic\.com\/firebasejs|cloudfunctions|fonts\.g/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-25T16:20:00Z') });
  await p.goto(BASE + '#demo-insurance'); await p.waitForTimeout(2600);
  const names = await p.evaluate(() => { document.getElementById('menuBtn').click(); const n = [...document.querySelectorAll('[data-theme-choice]')].map(b => b.getAttribute('data-theme-choice')).filter(x => x !== 'auto'); document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); return n; });
  check('themes found', names.length >= 100, names.length);
  const bad = [];
  for (const th of names) {
    await p.evaluate(th => document.documentElement.setAttribute('data-theme', th), th);
    for (const t of ['calendar', 'pipeline', 'tasks']) {
      await p.evaluate(t => document.querySelector('#viewTabs [data-view="' + t + '"]').click(), t); await p.waitForTimeout(80);
      const r = await probe(p); if (r.low.length) bad.push(th + ' ' + t + ': ' + r.low.join(' | '));
    }
  }
  check('every theme: Calendar, Pipeline and Tasks text is readable', !bad.length, bad.slice(0, 12));
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('readable_text:', pass, 'passed,', fail, 'failed'); process.exit(fail ? 1 : 0);
})();
