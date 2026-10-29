// VPEX regression check (design_themes). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/design_themes.js
// The 21 "Design styles" themes (Ethereal … Conceptual Sketch): listed under their own group and chip in the picker, each one
// picked from the picker applies and is saved, paints its own look, keeps text readable, fits the screen (Call on one line,
// no sideways scroll) at 390 and 1280, and logs a call with no page errors.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const IDS = { ethereal: 'Ethereal', bohemian: 'Bohemian', victorian: 'Victorian', cyberpunk: 'Cyberpunk', wabisabi: 'Wabi-Sabi', claymorphism: 'Claymorphism',
  cybercore: 'Cybercore', neobrutalism: 'Neo-Brutalism', scrapbook: 'Scrapbook', surrealism: 'Surrealism', y2k: 'Y2K Aesthetic', pixelart: 'Pixel Art',
  glassmorphism: 'Glassmorphism', neumorphism: 'Neumorphism', bentogrid: 'Bento Grid', editorial: 'Editorial Design', swiss: 'Swiss Design',
  minimalism: 'Minimalism', maximalism: 'Maximalism', luxurytype: 'Luxury Typography', sketch: 'Conceptual Sketch' };
let P = 0, F = 0;
const check = (label, ok, info) => { if (ok) P++; else { F++; console.log('FAIL', label, info === undefined ? '' : JSON.stringify(info)); } };

async function boot(br, o) {
  const ctx = await br.newContext({ viewport: { width: o.w, height: o.w > 900 ? 860 : 844 }, colorScheme: o.scheme || 'dark' });
  if (o.theme) await ctx.addInitScript(t => { try { localStorage.setItem('dovetail_dialer_theme_v1', t); } catch (e) {} }, o.theme);
  await ctx.route(/gstatic|googleapis/, r => r.abort());
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '#demo-' + (o.ind || 'insurance')); await page.waitForTimeout(2400);
  return { ctx, page, errs };
}

(async () => {
  const br = await chromium.launch();
  // 1. Picker: the Design chip and group, 21 cards with the requested names, picking one applies and saves it
  {
    const { ctx, page, errs } = await boot(br, { w: 390, theme: 'midnight' });
    await page.evaluate(() => document.getElementById('openThemesBtn').click()); await page.waitForTimeout(400);
    const chip = await page.evaluate(() => { const b = document.querySelector('[data-themecat="design"]'); return b && b.textContent.replace(/\s+/g, ' ').trim(); });
    check('picker: a "Design 21" chip', chip === 'Design 21', chip);
    await page.click('[data-themecat="design"]'); await page.waitForTimeout(200);
    const g = await page.evaluate(() => ({ label: [...document.querySelectorAll('#themeSwatchRow .theme-group-label')].map(x => x.textContent),
      cards: [...document.querySelectorAll('#themeSwatchRow .theme-card')].map(c => [c.getAttribute('data-theme-choice'), c.querySelector('.tc-name').textContent.replace('✓', '').trim()]) }));
    check('picker: one "Design styles" group', g.label.length === 1 && g.label[0] === 'Design styles', g.label);
    check('picker: the 21 cards carry the requested names, in order', JSON.stringify(g.cards) === JSON.stringify(Object.entries(IDS)), g.cards);
    const all = await page.evaluate(() => document.querySelector('[data-themecat="all"]').textContent.replace(/\D+/g, ''));
    check('picker: All counts 108 (86 + 21 + Auto)', all === '108', all);
    await page.click('[data-theme-choice="neobrutalism"]'); await page.waitForTimeout(300);
    const s = await page.evaluate(() => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1'), label: document.getElementById('themeCurrent').textContent }));
    check('picker: picking Neo-Brutalism applies and saves it', s.t === 'neobrutalism' && s.saved === 'neobrutalism' && /Neo-Brutalism/.test(s.label), s);
    await page.fill('#themeSearch', 'kintsugi'); await page.waitForTimeout(200);
    const found = await page.evaluate(() => [...document.querySelectorAll('#themeSwatchRow .theme-card')].map(c => c.getAttribute('data-theme-choice')));
    check('picker: search finds Wabi-Sabi by its description', found.length === 1 && found[0] === 'wabisabi', found);
    check('picker: no Signature theme listed', await page.evaluate(() => document.querySelectorAll('[data-theme-choice^="sig-"]').length === 0));
    check('picker: no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  // 2. Each theme at 390 dark and 1280 light (the theme decides light or dark, not the phone)
  for (const [w, scheme] of [[390, 'dark'], [1280, 'light']]) {
    for (const id of Object.keys(IDS)) {
      const { ctx, page, errs } = await boot(br, { w, scheme, theme: id, ind: ['insurance', 'realestate', 'mca', 'auto', 'solar'][Object.keys(IDS).indexOf(id) % 5] });
      const r = await page.evaluate(() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
        const px = c => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data]; };
        const lum = a => { const m = a.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
        const cr = (a, b) => { const A = lum(px(a)), B = lum(px(b)); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05); };
        const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
        const call = document.querySelector('#mainArea .call-btn'), cr1 = call && call.getBoundingClientRect();
        const lh = call ? parseFloat(getComputedStyle(call.querySelector('span') || call).lineHeight) || 22 : 0;
        const span = call && (call.querySelector('span') || call), sr = span && span.getBoundingClientRect();
        return { t: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor, font: v('--font-display'),
          text: cr(v('--text'), v('--surface')), dim: cr(v('--text-dim'), v('--surface')), acc: cr(v('--accent'), v('--surface')),
          over: document.documentElement.scrollWidth > innerWidth + 1, callH: cr1 && Math.round(cr1.height), callLines: sr ? Math.round(sr.height / lh) : 0,
          callIn: cr1 && cr1.left >= 0 && cr1.right <= innerWidth + 1, desk: document.body.classList.contains('desk') || innerWidth >= 1100 };
      });
      const tag = id + ' ' + w + ' ' + scheme;
      check(tag + ': applied', r.t === id, r.t);
      check(tag + ': its own display face', r.font.length > 0 && !/IBM Plex/.test(r.font.split(',')[0]), r.font);
      check(tag + ': text 7:1, dim 4.5:1, accent 4.5:1 on cards', r.text >= 7 && r.dim >= 4.5 && r.acc >= 4.5, [r.text, r.dim, r.acc].map(x => +x.toFixed(2)));
      check(tag + ': Call on one line, on screen, 44 px+', r.callLines === 1 && r.callIn && r.callH >= 44, r);
      check(tag + ': no sideways scroll', !r.over);
      // log a call: Call then No answer
      await page.evaluate(() => document.querySelector('#mainArea .call-btn').click()); await page.waitForTimeout(500);
      const sheet = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Try the call/.test(x.textContent) && x.offsetParent); if (b) b.click(); return !!b; });
      if (sheet) await page.waitForTimeout(400);
      const before = await page.evaluate(() => (document.querySelector('.rh-count strong') || {}).textContent);
      await page.evaluate(() => { const b = document.querySelector('#outcomesRow [data-outcome="noanswer"]') || document.querySelector('#outcomesRow [data-outcome]'); b.click(); }); await page.waitForTimeout(600);
      const after = await page.evaluate(() => (document.querySelector('.rh-count strong') || {}).textContent);
      check(tag + ': a call logs (+1 today)', +after === +before + 1, [before, after]);
      check(tag + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }
  console.log('design_themes: ' + P + ' passed, ' + F + ' failed');
  process.exitCode = F ? 1 : 0;
  await br.close();
})();
