// VPEX Experience layer (vx/): light, material and motion on every theme.
//   python3 -m http.server 8765   (in the repo root)
//   NODE_PATH=<dir with playwright> node tests/vx_experience.js
// Mock backend (#mockbench), so nothing touches the live database.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }

async function boot(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.w || 390, height: opts.h || 844 }, isMobile: !opts.w, hasTouch: !opts.w, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  if (opts.force) await page.addInitScript(() => { window.__vxForce = 1; });
  await page.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (opts.clock) await page.clock.install({ time: new Date('2026-11-05T14:10:00-05:00') });
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(300);
  await page.evaluate(o => { const db = demoSeed(), now = Date.now();
    db['members/vOwn'] = { username: 'vincent', name: 'Vincent', role: 'admin', active: true, lastSeen: now };
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'vincent@dovetail-f863c.firebaseapp.com': { uid: 'vOwn', pw: 'test' } }));
    localStorage.setItem('vpex_oc_seen', String(now));
    if (o.theme) localStorage.setItem('dovetail_dialer_theme_v1', o.theme);
    if (o.motionOff) localStorage.setItem('dovetail_motion', 'off');
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'vOwn', email: 'vincent@dovetail-f863c.firebaseapp.com' })); }, opts);
  await page.goto(BASE + '?go=1');
  await page.waitForSelector('#viewTabs:not([style*="none"])', { timeout: 20000 });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}
const css = (page, sel, prop, pseudo) => page.evaluate(([s, p, ps]) => { const e = document.querySelector(s); return e ? getComputedStyle(e, ps || null).getPropertyValue(p).trim() : null; }, [sel, prop, pseudo]);
const rootVar = (page, n) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), n);

(async () => {
  // 0. The build is current: vx/ sources and index.html agree.
  try { execFileSync('python3', [path.join(__dirname, '..', 'vx', 'build.py'), '--check'], { stdio: 'pipe' }); check('vx build is current', true); }
  catch (e) { check('vx build is current', false, String(e.stdout || e.message).slice(0, 200)); }

  const browser = await chromium.launch();

  // 1. Every public theme: the layer is there, has its own recipe, and switching is instant.
  {
    const { ctx, page, errs } = await boot(browser, {});
    const themes = await page.evaluate(() => [...document.querySelectorAll('style')].map(s => s.textContent).join('').match(/:root\[data-theme="([a-z0-9_]+)"\] \{ --vx-l1/g).map(m => m.match(/"(.+)"/)[1]));
    check('recipes for every public theme', themes.length >= 107, themes.length);
    check('ambient layer, vignette, grain and touch light mounted', await page.evaluate(() => ['vxAtmo', 'vxVig', 'vxGrain', 'vxTouch'].every(i => document.getElementById(i))));
    const seen = new Set(); let bad = [];
    for (const id of themes) {
      const r = await page.evaluate(id => {
        document.documentElement.setAttribute('data-theme', id);
        const cs = getComputedStyle(document.documentElement), a = document.getElementById('vxAtmo');
        return { l1: cs.getPropertyValue('--vx-l1').trim(), dur: cs.getPropertyValue('--vx-dur').trim(), 
          grainZ: getComputedStyle(document.getElementById('vxGrain')).zIndex, shell: getComputedStyle(document.querySelector('.shell')).zIndex };
      }, id);
      seen.add(r.l1 + '|' + r.dur);
      if (!r.dur || +r.grainZ >= 100 || r.shell !== '1') bad.push(id);
    }
    check('every theme resolves its motion personality, grain below sheets', !bad.length, bad);
    check('themes have distinct identities (light + motion)', seen.size >= 90, seen.size);
    const bl = await page.evaluate(() => ['midnight', 'ivory'].map(t => { document.documentElement.setAttribute('data-theme', t); return getComputedStyle(document.getElementById('vxAtmo')).mixBlendMode; }));
    check('ambient light composites without blend modes (cheap on phones)', bl.every(v => v === 'normal'), bl);
    const flat = await page.evaluate(() => ['swiss', 'minimalism', 'contrast', 'neobrutalism'].map(t => { document.documentElement.setAttribute('data-theme', t); return getComputedStyle(document.documentElement).getPropertyValue('--vx-amb').trim(); }));
    check('restrained themes (Swiss, Minimalism, High contrast, Neo-Brutalism) stay unlit', flat.every(v => v === '0'), flat);
    // card details
    const det = await page.evaluate(() => { const o = {}; for (const t of ['midnight', 'oxblood', 'flow']) { document.documentElement.setAttribute('data-theme', t); const c = document.querySelector('#mainArea .card'); o[t] = c ? getComputedStyle(c).outlineStyle : null; } return o; });
    check('card details: hairline (Midnight), stitched seam (Oxblood), none (Flow)', det.midnight === 'solid' && det.oxblood === 'dashed' && det.flow === 'none', det);
    const corners = await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'terminal'); const c = document.querySelector('#mainArea .card'); return getComputedStyle(c).backgroundImage.split('linear-gradient').length; });
    check('corner brackets on tech themes', corners > 8, corners);
    const sig = await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'sig-horologe'); return getComputedStyle(document.getElementById('vxAtmo')).display; });
    check('signature themes keep their own world (no shared lights)', sig === 'none', sig);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'flow'));
    check('picker previews carry each theme’s light', await page.evaluate(() => [...document.querySelectorAll('style')].some(s => /theme-card\[data-theme-choice="aurora"\] \.tc-prev \{ --tcl/.test(s.textContent))));
    // Under automation the number count-ups stay off: the Pipeline numbers read true at once.
    await page.tap('#viewTabPipeline');
    const sum = await page.evaluate(() => { const b = document.querySelector('.pipe-summary b'); return b ? b.textContent : null; });
    check('numbers are exact immediately under automation', sum !== null && /^\d+$/.test(sum) && sum !== '0', sum);
    check('automation runs without vx motion (functional tests see settled layout)', await page.evaluate(() => document.documentElement.classList.contains('vx-auto') && getComputedStyle(document.getElementById('vxAtmo'), '::before').animationName === 'none'));
    check('no page errors across all themes', !errs.length, errs.slice(0, 3));
    await ctx.close();
  }

  // 2. Motion on (forced as a real user would see it): tab ink glides, rows rise, numbers count to their true value.
  {
    const { ctx, page, errs } = await boot(browser, { force: true, theme: 'aurora' });
    const before = await page.evaluate(() => { const o = {}; document.querySelectorAll('#viewTabs .view-tab').forEach(b => o[b.id] = b.className); return o; });
    // layout-shift watch
    await page.evaluate(() => { window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: false }); } catch (e) {} });
    await page.tap('#viewTabPipeline');
    await page.waitForTimeout(60);
    const mid = await page.evaluate(() => ({ ink: !!document.querySelector('#viewTabs .vx-ink'), gliding: document.getElementById('viewTabs').classList.contains('vx-gliding'),
      rising: document.querySelectorAll('#mainArea .vx-rise').length, grow: document.querySelectorAll('#mainArea .vx-grow').length,
      counting: (document.querySelector('.pipe-summary b') || {}).__vxBusy === true }));
    check('tab ink glides to the new tab', mid.ink && mid.gliding, mid);
    check('rows rise in sequence', mid.rising >= 3, mid.rising);
    check('the target bar grows in', mid.grow >= 1, mid.grow);
    check('numbers count up', mid.counting, mid);
    await page.waitForTimeout(1600);
    const end = await page.evaluate(() => ({ gliding: document.getElementById('viewTabs').classList.contains('vx-gliding'), rising: document.querySelectorAll('#mainArea .vx-rise').length,
      txt: [...document.querySelectorAll('.pipe-summary b, .pipe-forecast b, .deal-bar-amounts')].map(b => b.textContent) }));
    await page.evaluate(() => { localStorage.setItem('dovetail_motion', 'off'); document.getElementById('viewTabDial').click(); document.getElementById('viewTabPipeline').click(); localStorage.removeItem('dovetail_motion'); });
    const truth = await page.evaluate(() => [...document.querySelectorAll('.pipe-summary b, .pipe-forecast b, .deal-bar-amounts')].map(b => b.textContent));
    check('glide and rise clean up after themselves', !end.gliding && end.rising === 0, end);
    check('counted numbers land on the exact values', JSON.stringify(end.txt) === JSON.stringify(truth), [end.txt, truth]);
    check('active tab is still correct after the glide', await page.evaluate(() => document.getElementById('viewTabPipeline').classList.contains('active') && !document.getElementById('viewTabDial').classList.contains('active')));
    for (const v of ['History', 'Tasks', 'Vault', 'Dial']) { await page.tap('#viewTab' + v); await page.waitForTimeout(250); }
    await page.waitForTimeout(900);
    const cls = await page.evaluate(() => window.__cls);
    check('no layout shift from view transitions', cls < 0.02, cls);
    check('view state survived the tour', await page.evaluate(() => document.body.getAttribute('data-view') === 'dial' && !!document.querySelector('#mainArea .card')));
    // sheets: open, then close, and the overlay never blocks taps after it closes
    await page.evaluate(() => document.getElementById('menuBtn').click()); await page.waitForTimeout(80);
    const sheet = await page.evaluate(() => { const m = document.querySelector('#menuModal > .modal'); return getComputedStyle(m).animationName; });
    check('settings sheet rises in', /vxSheet/.test(sheet), sheet);
    await page.evaluate(() => document.getElementById('closeMenuModal').click()); await page.waitForTimeout(50);
    check('closed sheet does not catch taps', await page.evaluate(() => { const m = document.getElementById('menuModal'); return !m.classList.contains('show') && getComputedStyle(m).pointerEvents === 'none'; }));
    // feature sheets open fresh: charts inside draw in, then the class clears
    await page.evaluate(() => { const b = document.getElementById('qcSortBtn'); b && b.click(); }); await page.waitForTimeout(60);
    const fresh = await page.evaluate(() => document.getElementById('featModal').classList.contains('vx-fresh'));
    await page.waitForTimeout(2000);
    const cleared = await page.evaluate(() => !document.getElementById('featModal').classList.contains('vx-fresh'));
    check('feature sheets open fresh (charts draw in), then settle', fresh && cleared, [fresh, cleared]);
    await page.evaluate(() => { const c = document.getElementById('featClose'); c && c.click(); }); await page.waitForTimeout(100);
    // the touch light blooms on tap
    const bloom = await page.evaluate(() => new Promise(res => { const t = document.getElementById('vxTouch'); const b = document.getElementById('viewTabHistory').getBoundingClientRect();
      document.getElementById('viewTabHistory').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: b.left + 5, clientY: b.top + 5 }));
      requestAnimationFrame(() => res(t.getAnimations().length)); }));
    check('touch light blooms where you tap', bloom >= 1, bloom);
    // today's count rolls up
    await page.evaluate(() => { const n = document.getElementById('todayNum'); n.textContent = String((parseInt(n.textContent, 10) || 0) + 1); });
    await page.waitForTimeout(30);
    check('today’s count rolls when it climbs', await page.evaluate(() => document.getElementById('todayNum').classList.contains('vx-roll')));
    // theme switch from the picker: reveal, then the choice is saved
    await page.evaluate(() => { document.getElementById('menuBtn').click(); });
    await page.evaluate(() => { const b = [...document.querySelectorAll('.modal-overlay.show button')].find(x => /Look & app/.test(x.textContent)); b && b.click(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.modal-overlay.show button')].find(x => /^\s*Theme/.test(x.textContent)); b && b.click(); });
    await page.waitForTimeout(400);
    const card = page.locator('.theme-card[data-theme-choice="royal"]'); await card.scrollIntoViewIfNeeded(); await card.click();
    await page.waitForTimeout(1100);
    const th = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1'), rx: document.documentElement.style.getPropertyValue('--vx-rx') }));
    check('picker switch applies and saves the theme', th.attr === 'royal' && th.saved === 'royal', th);
    check('the reveal opens from where you tapped', /px$/.test(th.rx), th);
    check('no page errors with motion on', !errs.length, errs.slice(0, 3));
    await ctx.close();
  }

  // 3. Reduce Motion (system setting) and the in-app Motion switch: everything still, nothing waiting on an animation.
  for (const mode of ['reduced', 'motionOff']) {
    const { ctx, page, errs } = await boot(browser, mode === 'reduced' ? { reduced: true, force: true, theme: 'aurora' } : { motionOff: true, force: true, theme: 'aurora' });
    const a = await css(page, '#vxAtmo', 'animation-name', '::before');
    check(mode + ': ambient light holds still', a === 'none', a);
    await page.tap('#viewTabPipeline'); await page.waitForTimeout(40);
    const r = await page.evaluate(() => ({ rise: [...document.querySelectorAll('#mainArea .vx-rise')].filter(e => getComputedStyle(e).animationName !== 'none').length,
      ink: !!document.querySelector('#viewTabs.vx-gliding'), busy: [...document.querySelectorAll('.pipe-summary b')].some(b => b.__vxBusy) }));
    check(mode + ': views switch without motion and numbers show at once', !r.rise && !r.ink && !r.busy, r);
    await page.evaluate(() => document.getElementById('menuBtn').click()); await page.waitForTimeout(30);
    const m = await page.evaluate(() => getComputedStyle(document.querySelector('#menuModal > .modal')).animationName);
    check(mode + ': sheets open without motion', m === 'none', m);
    check(mode + ': no page errors', !errs.length, errs.slice(0, 3));
    await ctx.close();
  }

  // 4. Battery: after 90 seconds without a touch the ambient light pauses; a tap wakes it.
  {
    const { ctx, page } = await boot(browser, { clock: true, force: true, theme: 'aurora' });
    await page.clock.runFor(91000);
    const idle = await page.evaluate(() => ({ c: document.documentElement.classList.contains('vx-idle'), s: getComputedStyle(document.getElementById('vxAtmo'), '::before').animationPlayState }));
    check('ambient light pauses when idle', idle.c && idle.s === 'paused', idle);
    await page.tap('#viewTabHistory');
    check('a tap wakes it', await page.evaluate(() => !document.documentElement.classList.contains('vx-idle')));
    await ctx.close();
  }

  // 5. Desktop: the card light follows the cursor; the layout is untouched.
  {
    const { ctx, page, errs } = await boot(browser, { w: 1280, h: 860, theme: 'midnight', force: true });
    const box = await page.locator('#mainArea .card').first().boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + 40); await page.waitForTimeout(120);
    const lx = await page.evaluate(() => document.querySelector('#mainArea .card').style.getPropertyValue('--vx-lx'));
    check('card light follows the cursor', /^(7\d|8\d|9\d)%$/.test(lx), lx);
    const cb = await page.locator('#callBtn').boundingBox();
    await page.mouse.move(cb.x + 20, cb.y + 10); await page.waitForTimeout(80);
    const px = await page.evaluate(() => document.getElementById('callBtn').style.getPropertyValue('--vx-px'));
    check('Call button light follows the cursor', /px$/.test(px), px);
    check('desktop: no page errors', !errs.length, errs.slice(0, 3));
    await ctx.close();
  }

  await browser.close();
  console.log(`vx_experience: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
