// VPEX regression check (calling_hours_cards): on phones the "stricter states" table on vpexdialer.com/calling-hours/ (and every state page)
//  is a list of small cards: no sideways swipe to reach Holidays and Calls per person, each card shows the hours plus only the rules that
//  differ from the federal default (Same / Allowed / No state limit stay in the page for screen readers but are visually hidden).
//  On wider screens it's the full table, unchanged.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/calling_hours_cards.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };
const read = p => p.evaluate(() => {
  const tw = document.querySelector('.tw.strict'), t = tw && tw.querySelector('table');
  if (!t) return null;
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const rows = [...t.tBodies[0].rows].map(tr => ({ name: tr.cells[0].textContent, cells: [...tr.cells].slice(1).map(td => ({ t: td.textContent, d: td.classList.contains('d'), shown: shown(td),
    label: getComputedStyle(td, '::before').content, right: td.getBoundingClientRect().right })), h: tr.getBoundingClientRect().height }));
  return { rows, ov: document.documentElement.scrollWidth > innerWidth, twScroll: tw.scrollWidth > tw.clientWidth + 1, thead: shown(t.tHead), vw: innerWidth };
});
const DEF = ['Same', 'Allowed', 'No state limit'];
(async () => {
  const br = await chromium.launch();
  for (const page of ['calling-hours/', 'calling-hours/pennsylvania/', 'calling-hours/texas/', 'calling-hours/new-york/']) {
    for (const [w, h, scheme, touch] of [[390, 844, 'dark', true], [390, 844, 'light', true], [320, 640, 'light', true], [1280, 900, 'light', false]]) {
      const tag = page + ' ' + w + ' ' + scheme;
      const ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, colorScheme: scheme });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.route(/gstatic|googleapis|cloudfunctions|google-analytics|googletagmanager/, r => r.abort());
      await p.goto(BASE + page); await p.waitForTimeout(500);
      const s = await read(p);
      check(tag + ': stricter-states table present', s && s.rows.length === 20, s && s.rows.length);
      if (!s) { await ctx.close(); continue; }
      check(tag + ': no sideways scroll on the page', !s.ov);
      check(tag + ': default cells are marked (Same / Allowed / No state limit) and only those', s.rows.every(r => r.cells.every((c, i) => i === 0 ? !c.d : c.d === DEF.includes(c.t))), s.rows.find(r => r.cells.some((c, i) => i === 0 ? c.d : c.d !== DEF.includes(c.t))));
      if (w < 560) {
        check(tag + ': table does not scroll sideways (no swipe to reach Holidays)', !s.twScroll);
        check(tag + ': column headers visually hidden', !s.thead);
        check(tag + ': hours always shown with a label', s.rows.every(r => r.cells[0].shown && /Hours/.test(r.cells[0].label)));
        check(tag + ': every stricter rule is shown with its label', s.rows.every(r => r.cells.slice(1).every(c => c.d || (c.shown && c.label !== 'none' && c.label.length > 2))),
          s.rows.map(r => r.name + ':' + r.cells.filter(c => !c.d && !c.shown).map(c => c.t)).filter(x => !/:$/.test(x)));
        check(tag + ': defaults hidden on the card', s.rows.every(r => r.cells.every(c => !c.d || !c.shown)));
        check(tag + ': nothing past the right edge', s.rows.every(r => r.cells.every(c => !c.shown || c.right <= s.vw + 0.5)));
        const pa = s.rows.find(r => r.name === 'Pennsylvania'), ri = s.rows.find(r => r.name === 'Rhode Island'), fl = s.rows.find(r => r.name === 'Florida');
        check(tag + ': Pennsylvania card shows hours, Sunday and holidays', pa && pa.cells[0].shown && pa.cells[2].shown && pa.cells[2].t === 'No calls' && pa.cells[3].shown, pa);
        check(tag + ': Rhode Island card shows Saturday 10 AM–5 PM', ri && ri.cells[1].shown && ri.cells[1].t === '10 AM–5 PM', ri);
        check(tag + ': Florida card shows 3 per 24 hours', fl && fl.cells[4].shown && fl.cells[4].t === '3 per 24 hours', fl);
        check(tag + ': cards are compact (≤ 160 px each, most ≤ 110)', s.rows.every(r => r.h <= 160) && s.rows.filter(r => r.h <= 110).length >= 16, s.rows.map(r => Math.round(r.h)));
      } else {
        check(tag + ': full table on wide screens (every cell and header shown)', s.thead && s.rows.every(r => r.cells.every(c => c.shown && c.label === 'none')));
      }
      check(tag + ': no page errors', !errs.length, errs);
      await ctx.close();
    }
  }
  await br.close();
  console.log('calling_hours_cards: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
