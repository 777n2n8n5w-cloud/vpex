// VPEX regression check (signature_themes). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then node tests/signature_themes.js
// The five Signature themes (sig/*.css -> sig.css, sig.js) are the VPEX owner's own: only his login can see, try or use them.
// Checks: sig.css is built and scoped; contrast; owner-only gating (UI, saved choice, other logins); try-on never saves until Keep;
// switching keeps data; no sideways scroll on every main screen at 320/390/1280; motion off stops every decorative animation;
// the per-theme pieces (seams, letterbox timecode, seconds hand) work; nothing loads for anyone else.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
const IDS = ['sig-horologe', 'sig-urushi', 'sig-premiere', 'sig-blueprint', 'sig-prism'];
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

// split a selector list on its top-level commas (not the ones inside :is() / :not())
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
// ---------- static: build, scoping, contrast ----------
(function staticChecks() {
  let built = true;
  try { cp.execFileSync('python3', [path.join(ROOT, 'sig/build.py'), '--check'], { stdio: 'pipe' }); } catch (e) { built = false; }
  check('sig.css is up to date with sig/*.css (python3 sig/build.py)', built);
  const css = fs.readFileSync(path.join(ROOT, 'sig.css'), 'utf8');
  check('sig.css stays small', css.length < 90000, css.length);
  check('no unexpanded placeholders', !/@[VTM][\s\[.:#,{]/.test(css));
  // every rule in a theme file is scoped to that theme (or its preview tiles), so the 86 public themes can't be touched
  for (const id of IDS) {
    const src = fs.readFileSync(path.join(ROOT, 'sig', id.slice(4) + '.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const bad = [];
    (function walk(s, inKf) {
      let i = 0;
      while (i < s.length) {
        const open = s.indexOf('{', i); if (open < 0) break;
        const pre = s.slice(i, open).trim();
        let depth = 1, j = open + 1; while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
        const body = s.slice(open + 1, j - 1);
        if (/^@(media|supports)/.test(pre)) walk(body, false);
        else if (/^@keyframes/.test(pre) || /^@property/.test(pre) || inKf) { /* not selectors */ }
        else if (pre) splitTop(pre).forEach(sel => { sel = sel.trim(); if (!/^@[VTM]([\s\[.:#]|$)/.test(sel) && !sel.includes('.sig-scope[data-sig="' + id + '"]')) bad.push(sel); });
        i = j;
      }
    })(src, false);
    check(id + ': every rule scoped to the theme', bad.length === 0, bad.slice(0, 4));
    check(id + ': file id header', src.length > 0 && fs.readFileSync(path.join(ROOT, 'sig', id.slice(4) + '.css'), 'utf8').startsWith('/*! id: ' + id + ' */'));
    // contrast from the theme's own tokens
    const v = src.slice(src.indexOf('@V {'), src.indexOf('}', src.indexOf('@V {')));
    const tok = {}; v.replace(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g, (m, k, c) => { tok[k] = c; });
    const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const bg of ['bg', 'surface', 'surface-raised']) {
      check(id + ': text on ' + bg + ' >= 7:1', cr(tok.text, tok[bg]) >= 7, cr(tok.text, tok[bg]).toFixed(2));
      check(id + ': dim text on ' + bg + ' >= 4.5:1', cr(tok['text-dim'], tok[bg]) >= 4.5, cr(tok['text-dim'], tok[bg]).toFixed(2));
      check(id + ': faint text on ' + bg + ' >= 4.5:1', cr(tok['text-faint'], tok[bg]) >= 4.5, cr(tok['text-faint'], tok[bg]).toFixed(2));
      check(id + ': accent on ' + bg + ' >= 4.5:1', cr(tok.accent, tok[bg]) >= 4.5, cr(tok.accent, tok[bg]).toFixed(2));
    }
    check(id + ': text on accent buttons >= 4.5:1', cr(tok['accent-text'], tok['accent-fill']) >= 4.5);
    ['interested', 'notinterested', 'voicemail', 'noanswer', 'badnum', 'callback'].forEach(o => check(id + ': ' + o + ' color visible on cards >= 3:1', cr(tok[o], tok.surface) >= 3, cr(tok[o], tok.surface).toFixed(2)));
    const cb = (v.match(/--call-bg:([^;]+);/) || [])[1] || '', stops = cb.match(/#[0-9A-Fa-f]{6}/g) || [];
    if (tok['call-text']) stops.forEach(c => check(id + ': Call label on ' + c + ' >= 4.5:1', cr(tok['call-text'], c) >= 4.5, cr(tok['call-text'], c).toFixed(2)));
  }
})();

// ---------- runtime ----------
const GF = process.env.SIG_FONTS || '';   // optional: a folder with fonts.css + files (screenshots only)
async function boot(br, o) {
  const ctx = await br.newContext({ timezoneId: 'America/New_York', viewport: { width: o.w || 390, height: 844 }, colorScheme: o.scheme || 'dark', isMobile: (o.w || 390) < 500, hasTouch: (o.w || 390) < 500, reducedMotion: o.reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = [], reqs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('request', r => reqs.push(r.url()));
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/^tel:|sms:/, r => r.abort());
  await page.clock.install({ time: new Date('2026-10-21T14:10:00-04:00') });   // inside calling hours, so Call isn't held back
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
  await page.evaluate(o => {
    const db = demoSeed(), now = Date.now();
    db['members/vOwn'] = { username: 'vincent', name: 'Vincent', role: 'admin', active: true, lastSeen: now };
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    const email = (o.user || 'vincent') + '@dovetail-f863c.firebaseapp.com', uid = o.user === 'sam' ? 'dR2' : 'vOwn';
    localStorage.setItem('__mockauth', JSON.stringify({ [email]: { uid, pw: 'test' } }));
    localStorage.setItem('vpex_oc_seen', String(now));
    if (o.theme) localStorage.setItem('dovetail_dialer_theme_v1', o.theme);
    if (o.flag) localStorage.setItem('vpex_sig_ok', '1');
    if (o.prev) localStorage.setItem('vpex_sig_prev', o.prev);
    if (o.motionOff) localStorage.setItem('dovetail_motion', 'off');
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid, email }));
  }, o);
  reqs.length = 0;
  await page.goto(BASE); await page.waitForTimeout(o.wait || 2400);
  return { ctx, page, errs, reqs };
}
const ev = (page, fn, a) => page.evaluate(fn, a);
const click = async (page, sel, ms) => { await page.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await page.waitForTimeout(ms || 350); };
const overflow = page => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);

(async () => {
  const br = await chromium.launch();

  // 1. Owner on each theme: paints from the head, no errors, every main screen fits, the theme's own pieces work
  for (const id of IDS) {
    for (const w of [320, 390, 1280]) {
      const { ctx, page, errs } = await boot(br, { theme: id, flag: true, w });
      const st = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), sig: document.documentElement.classList.contains('sig'),
        css: !!(document.getElementById('sigCss') && document.getElementById('sigCss').sheet), js: !!window.VPEXSig, mounted: window.VPEXSig && VPEXSig.current(),
        bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), call: !!document.querySelector('.call-btn') }));
      check(id + ' ' + w + ': applied for the owner', st.t === id && st.sig && st.css && st.js && st.mounted === id, st);
      check(id + ' ' + w + ': its tokens are live', /^#/.test(st.bg), st.bg);
      check(id + ' ' + w + ': lead card and Call button render', st.call);
      for (const v of ['Dial', 'History', 'Pipeline', 'Tasks', 'Vault']) {
        await click(page, '#viewTab' + v, 450);
        const ov = await overflow(page); check(id + ' ' + w + ' ' + v + ': no sideways scroll', ov <= 1, ov);
      }
      await click(page, '#viewTabDial', 400);
      await click(page, '#menuBtn', 350); await click(page, '[data-set-cat="app"]', 350);
      const ovm = await overflow(page); check(id + ' ' + w + ' settings: no sideways scroll', ovm <= 1, ovm);
      await click(page, '#openSigBtn', 900);
      const sm = await ev(page, () => { const m = document.getElementById('sigModal'), b = m.querySelector('.modal'); return { show: m.classList.contains('show'), tiles: m.querySelectorAll('.sig-tile').length, wide: b.scrollWidth - b.clientWidth, active: (m.querySelector('.sig-tile.active') || {}).dataset }; });
      check(id + ' ' + w + ': Signature screen opens with five tiles', sm.show && sm.tiles === 5, sm);
      check(id + ' ' + w + ': Signature screen fits', sm.wide <= 1, sm.wide);
      check(id + ' ' + w + ': current theme marked in use', sm.active && sm.active.sig === id, sm.active);
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
      check(id + ' ' + w + ': no page errors', errs.length === 0, errs.slice(0, 2));
      await ctx.close();
    }
  }

  // 2. Per-theme pieces
  {
    const { ctx, page } = await boot(br, { theme: 'sig-urushi', flag: true });
    const n = await ev(page, () => document.querySelectorAll('#sigArt svg path').length);
    check('urushi: six seams drawn (crack, glow, gold)', n === 18, n);
    await ev(page, () => document.documentElement.style.setProperty('--goal-p', '0.5')); await page.waitForTimeout(2900);
    const off = await ev(page, () => { const g = document.querySelectorAll('#sigArt .sg-gold'); return [0, 2, 3, 5].map(i => parseFloat((getComputedStyle(g[i]).strokeDashoffset.match(/-?[\d.]+/) || ['NaN'])[0])); });
    check('urushi: half the goal fills the first three seams', off[0] === 0 && off[1] === 0 && Math.abs(off[2] - 1) < 0.01 && Math.abs(off[3] - 1) < 0.01, off);
    await ev(page, () => { document.documentElement.style.removeProperty('--goal-p'); });
    await ctx.close();
  }
  {
    const { ctx, page } = await boot(br, { theme: 'sig-premiere', flag: true });
    const o = await ev(page, () => !!document.querySelector('#sigOver .pm-bar.pm-bot .pm-tc') && document.querySelectorAll('#sigArt .pm-curtain').length);
    check('premiere: letterbox, timecode and curtains in place', o === 2, o);
    await ev(page, () => document.querySelector('.call-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); await page.waitForTimeout(2300);
    const tc = await ev(page, () => ({ live: document.body.classList.contains('st-live'), t: document.querySelector('#sigOver .pm-tc').textContent,
      bar: getComputedStyle(document.querySelector('#sigOver .pm-bot')).transform, op: getComputedStyle(document.querySelector('#sigOver .pm-tc')).opacity }));
    check('premiere: on a call the letterbox shows and the timecode runs', tc.live && /^0:0[1-3]$|^00:0[1-3]$/.test(tc.t) && tc.bar !== 'matrix(1, 0, 0, 0, 0, 0)', tc);
    const z = await ev(page, () => +getComputedStyle(document.getElementById('sigOver')).zIndex < +getComputedStyle(document.querySelector('.modal-overlay')).zIndex);
    check('premiere: overlay stays under sheets and dialogs', z);
    const pe = await ev(page, () => getComputedStyle(document.getElementById('sigOver')).pointerEvents);
    check('premiere: overlay never takes taps', pe === 'none', pe);
    await ctx.close();
  }
  {
    const { ctx, page } = await boot(br, { theme: 'sig-horologe', flag: true, scheme: 'light' });
    const h = await ev(page, () => { const b = document.querySelector('.call-btn'); const s0 = parseFloat(b.style.getPropertyValue('--sig-s0')); const a = document.getAnimations().filter(x => x.animationName === 'sigSecond'); return { s0, n: a.length, now: (Date.now() / 1000) % 60 }; });
    const since = (((h.now - h.s0) % 60) + 60) % 60;   // seconds since the button was drawn
    check('horologe: seconds hand set to the real clock', h.n >= 1 && since < 4, Object.assign(h, { since }));
    await ctx.close();
  }
  {
    const { ctx, page } = await boot(br, { theme: 'sig-prism', flag: true, scheme: 'light' });
    const p = await ev(page, () => ({ beam: !!document.querySelector('#sigArt .pr-beam'), frame: getComputedStyle(document.querySelector('#mainArea .card')).getPropertyValue('--card-frame') }));
    check('prism: foil frame and spectrum beam', p.beam && /conic-gradient/.test(p.frame), p);
    await ctx.close();
  }

  // 3. Motion: on = the signature animations run; off (Themes switch or the phone's setting) = none of them
  for (const mode of ['on', 'off', 'reduce']) {
    for (const id of IDS) {
      const { ctx, page } = await boot(br, { theme: id, flag: true, motionOff: mode === 'off', reduce: mode === 'reduce' });
      const names = await ev(page, () => document.getAnimations().map(a => a.animationName).filter(n => /^sig/.test(n || '')));
      if (mode === 'on') check(id + ': motion on runs its signature animation', names.length > 0 || id === 'sig-blueprint', names);
      else check(id + ': motion ' + mode + ' stops all decorative animation', names.length === 0, names);
      await ctx.close();
    }
  }

  // 4. Try-on: nothing saved until Keep; Back restores; Keep and Use save; data untouched
  {
    const { ctx, page, errs } = await boot(br, { theme: 'midnight' });
    const before = await ev(page, () => ({ k: Object.keys(localStorage).filter(k => /^dovetail_team_|^vpex_team_/.test(k)).map(k => k + ':' + Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).sort().join(',')).join('|'),
      name: (document.querySelector('.lead-name') || {}).textContent, worked: (document.getElementById('progNum') || {}).textContent }));
    check('owner: Signature row shown in Look & app', await ev(page, () => !document.getElementById('openSigBtn').hidden));
    await click(page, '#openThemesBtn', 400);
    check('owner: entry at the top of the standard picker', await ev(page, () => !document.getElementById('sigEntry').hidden));
    check('standard picker never lists Signature themes', await ev(page, () => document.querySelectorAll('[data-theme-choice^="sig-"]').length === 0));
    await click(page, '#sigEntry', 900);
    await click(page, '[data-sig-try="sig-urushi"]', 700);
    let s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1'), bar: !document.getElementById('sigTry').hidden, name: document.getElementById('sigTryName').textContent }));
    check('try: applies live without saving', s.t === 'sig-urushi' && s.saved === 'midnight' && s.bar && s.name === 'Urushi', s);
    await click(page, '#sigNext', 500); await click(page, '#sigNext', 500); await click(page, '#sigPrev', 500);
    s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1') }));
    check('try: cycles through the five', s.t === 'sig-premiere' && s.saved === 'midnight', s);
    for (const v of ['History', 'Tasks', 'Dial']) await click(page, '#viewTab' + v, 350);
    check('try: the bar stays while using the app', await ev(page, () => !document.getElementById('sigTry').hidden && document.documentElement.getAttribute('data-theme') === 'sig-premiere'));
    await click(page, '#sigBack', 900);
    s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1'), sig: document.documentElement.classList.contains('sig'), art: document.getElementById('sigArt').children.length, over: !!document.getElementById('sigOver'), modal: document.getElementById('sigModal').classList.contains('show') }));
    check('back: restores the old theme and cleans up', s.t === 'midnight' && s.saved === 'midnight' && !s.sig && s.art === 0 && !s.over, s);
    check('back: returns to the Signature screen', s.modal);
    await click(page, '[data-sig-try="sig-blueprint"]', 600); await click(page, '#sigKeep', 600);
    s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1'), ok: localStorage.getItem('vpex_sig_ok'), prev: localStorage.getItem('vpex_sig_prev'), bar: document.getElementById('sigTry').hidden }));
    check('keep: saves it, remembers the old theme', s.t === 'sig-blueprint' && s.saved === 'sig-blueprint' && s.ok === '1' && s.prev === 'midnight' && s.bar, s);
    await click(page, '#menuBtn', 300); await click(page, '[data-set-cat="app"]', 300); await click(page, '#openSigBtn', 800);
    await click(page, '[data-sig-use="sig-horologe"]', 700);
    s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1'), prev: localStorage.getItem('vpex_sig_prev'), modal: document.getElementById('sigModal').classList.contains('show') }));
    check('use: switches straight away', s.t === 'sig-horologe' && s.saved === 'sig-horologe' && s.prev === 'midnight' && !s.modal, s);
    const after = await ev(page, () => ({ k: Object.keys(localStorage).filter(k => /^dovetail_team_|^vpex_team_/.test(k)).map(k => k + ':' + Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).sort().join(',')).join('|'),
      name: (document.querySelector('.lead-name') || {}).textContent, worked: (document.getElementById('progNum') || {}).textContent }));
    check('switching keeps the same lead, progress and saved data', after.name === before.name && after.worked === before.worked && after.k === before.k, { before, after });
    // reload: paints straight from the head
    await page.reload(); await page.waitForTimeout(200);
    const early = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), sig: document.documentElement.classList.contains('sig') }));
    check('reload: applied before the app starts (no flash of another theme)', early.t === 'sig-horologe' && early.sig, early);
    await page.waitForTimeout(2200);
    await click(page, '#menuBtn', 300); await click(page, '[data-set-cat="app"]', 300); await click(page, '#openThemesBtn', 400);
    await click(page, '[data-theme-choice="ivory"]', 500);
    s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), sig: document.documentElement.classList.contains('sig'), art: document.getElementById('sigArt').children.length }));
    check('picking a standard theme leaves Signature cleanly', s.t === 'ivory' && !s.sig && s.art === 0, s);
    check('try-on flow: no page errors', errs.length === 0, errs.slice(0, 2));
    await ctx.close();
  }

  // 4b. Stress: 60 fast switches, switching mid-call, resizing; nothing leaks or breaks
  {
    const { ctx, page, errs } = await boot(br, { theme: 'sig-urushi', flag: true });
    await click(page, '#menuBtn', 300); await click(page, '[data-set-cat="app"]', 300); await click(page, '#openSigBtn', 800);
    await click(page, '[data-sig-try="sig-horologe"]', 400);
    for (let i = 0; i < 60; i++) await ev(page, () => document.getElementById('sigNext').click());
    await page.waitForTimeout(1200);
    let s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), over: document.querySelectorAll('#sigOver').length, art: document.getElementById('sigArt').children.length, mounted: VPEXSig.current() }));
    check('60 fast switches end on the right theme with one clean layer', s.t === 'sig-horologe' && s.mounted === 'sig-horologe' && s.over === 0 && s.art === 0, s);
    // mid-call: switch into Premiere while a call is live; the timecode picks up from when Call was tapped
    await ev(page, () => document.querySelector('.call-btn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); await page.waitForTimeout(2200);
    await ev(page, () => document.getElementById('sigNext').click()); await ev(page, () => document.getElementById('sigNext').click());   // horologe -> urushi -> premiere
    await page.waitForTimeout(1300);
    s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), live: document.body.classList.contains('st-live'), tc: (document.querySelector('#sigOver .pm-tc') || {}).textContent, outs: document.querySelectorAll('#outcomesRow [data-outcome]').length }));
    check('switching mid-call keeps the call live and the timer counts from Call', s.t === 'sig-premiere' && s.live && /^00:0[2-5]$/.test(s.tc) && s.outs >= 4, s);
    await ev(page, () => document.querySelector('#outcomesRow [data-outcome="voicemail"]').click()); await page.waitForTimeout(800);
    check('logging the call still works after switching', await ev(page, () => !document.body.classList.contains('st-live')));
    await click(page, '#sigBack', 900);
    for (const [w, h] of [[1280, 900], [320, 640], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
      const r = await ev(page, () => { const svg = document.querySelector('#sigArt svg'); return { vb: svg && svg.getAttribute('viewBox'), w: innerWidth, h: innerHeight, ov: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth }; });
      check('urushi seams redraw to ' + w + 'x' + h + ' and nothing scrolls sideways', r.vb === '0 0 ' + r.w + ' ' + r.h && r.ov <= 1, r);
    }
    check('stress: no page errors', errs.length === 0, errs.slice(0, 2));
    await ctx.close();
  }

  // 5. Anyone else: never sees them, a saved one is undone at sign-in, and nothing extra loads
  {
    const { ctx, page, errs, reqs } = await boot(br, { user: 'sam', theme: 'sig-urushi', flag: true, prev: 'midnight', wait: 2600 });
    const s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), sig: document.documentElement.classList.contains('sig'), ok: localStorage.getItem('vpex_sig_ok'), saved: localStorage.getItem('dovetail_dialer_theme_v1'), row: document.getElementById('openSigBtn').hidden }));
    check('other login: phone goes back to its own theme, flag cleared', s.t === 'midnight' && !s.sig && !s.ok && s.saved === 'midnight', s);
    check('other login: no Signature row', s.row);
    await click(page, '#menuBtn', 300); await click(page, '[data-set-cat="app"]', 300); await click(page, '#openThemesBtn', 400);
    check('other login: no entry in the picker', await ev(page, () => document.getElementById('sigEntry').hidden && document.querySelectorAll('[data-theme-choice^="sig-"]').length === 0));
    await ev(page, () => { const b = document.getElementById('sigEntry'); b.hidden = false; b.click(); }); await page.waitForTimeout(700);
    check('other login: forcing the hidden button open does nothing', await ev(page, () => !document.getElementById('sigModal').classList.contains('show')));
    check('other login: no page errors', errs.length === 0, errs.slice(0, 2));
    await ctx.close();
  }
  {
    const { ctx, page, reqs } = await boot(br, { user: 'sam', theme: 'midnight' });
    await click(page, '#menuBtn', 300); await click(page, '[data-set-cat="app"]', 300); await click(page, '#openThemesBtn', 600);
    const extra = reqs.filter(u => /sig\.(css|js)|Bodoni|Shippori|Big\+Shoulders|Barlow\+Semi|Syne/.test(u));
    check('other login: no Signature styles, script or fonts downloaded', extra.length === 0, extra);
    await ctx.close();
  }
  {
    // a phone that never had the owner on it ignores a hand-set theme value
    const { ctx, page } = await boot(br, { user: 'sam', theme: 'sig-prism' });
    const s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1') }));
    check('no flag: a typed-in Signature theme is ignored', s.t !== 'sig-prism' && s.saved !== 'sig-prism', s);
    await ctx.close();
  }
  {
    // the owner's demo office looks standard (it's for showing people)
    const { ctx, page } = await boot(br, { theme: 'sig-urushi', flag: true, prev: 'ivory' });
    await page.goto(BASE + '#demo'); await page.reload(); await page.waitForTimeout(2200);
    const s = await ev(page, () => ({ t: document.documentElement.getAttribute('data-theme'), ok: localStorage.getItem('vpex_sig_ok'), saved: localStorage.getItem('dovetail_dialer_theme_v1') }));
    check('demo office: shows a standard theme but keeps his choice', s.t !== 'sig-urushi' && s.ok === '1' && s.saved === 'sig-urushi', s);
    await ctx.close();
  }

  await br.close();
  console.log((fail ? 'FAILED ' : 'ok ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
