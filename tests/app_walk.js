// VPEX regression check (app_walk): walk the whole app and press everything, the way a new owner would on day one.
// Two demo offices (phone light, computer dark) and a team (admin and rep) on the in-page backend. On each:
//  - every tab (Dial, Tasks, Pipeline, History, Vault), the lead profile, the menu and Load leads
//  - Admin controls: every section, and every row in it is pressed: it must open something (a sheet, a screen, a tab,
//    a message), never nothing, and never an error
// And on every screen: no script errors, no browser pop-ups, nothing off the side, no "undefined"/"NaN" text, and every
// button and field has a name a screen reader can say.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/app_walk.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 700)); } };
const DOWNLOADS = /^(hubBackup|hubExport)$/;   // these save a file

(async () => {
  const br = await chromium.launch();
  const probe = pg => pg.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
    const scope = document.getElementById('floorTv') || [...document.querySelectorAll('.modal-overlay.show')].pop() || document.body;
    const over = [...scope.querySelectorAll('*')].filter(e => vis(e) && e.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed')
      .filter(e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return false; return true; })
      .slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '#' + e.id);
    const junk = ((scope.innerText || '').match(/.{0,50}(\bundefined\b|\bNaN\b|\[object Object\]|Infinity).{0,30}/g) || []).slice(0, 3);
    const unnamed = [...scope.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter(e => vis(e) && !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label'))).slice(0, 3).map(e => e.outerHTML.slice(0, 90));
    return { over, junk, unnamed, sw: document.documentElement.scrollWidth, vw: innerWidth };
  });
  const state = pg => pg.evaluate(() => ({ modals: [...document.querySelectorAll('.modal-overlay.show')].map(m => m.id).join(','), tv: !!document.getElementById('floorTv'), view: document.body.getAttribute('data-view') || (document.querySelector('#viewTabs .active') || {}).id || '', toast: !!document.querySelector('#toast.show, .toast.show') }));
  const closeAll = async pg => { await pg.keyboard.press('Escape').catch(() => {}); await pg.evaluate(() => { const tv = document.getElementById('tvClose'); if (tv) tv.click(); document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); }); await pg.waitForTimeout(120); };

  async function walk(tag, url, w, scheme, init) {
    const ctx = await br.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, colorScheme: scheme, isMobile: w < 500, hasTouch: w < 500, timezoneId: 'America/New_York', acceptDownloads: true });
    await ctx.clock.install({ time: new Date('2026-11-04T14:20:00-05:00') });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    pg.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource|firebase|fonts|ERR_/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
    pg.on('dialog', d => { errs.push('browser pop-up: ' + d.message().slice(0, 80)); d.dismiss().catch(() => {}); });
    await pg.route(/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)|cloudfunctions|googletagmanager/, r => r.abort());
    if (init) await init(pg);
    await pg.goto(url); await pg.waitForTimeout(2800);
    const screen = async name => { const p = await probe(pg); const e = errs.splice(0);
      check(tag + ' ' + name + ': no errors', !e.length, e);
      check(tag + ' ' + name + ': fits the screen, no "undefined", everything named', p.sw <= p.vw && !p.over.length && !p.junk.length && !p.unnamed.length, p); };
    await screen('start');
    for (const v of ['dial', 'tasks', 'pipeline', 'history', 'vault']) {
      if (await pg.evaluate(v => { const b = document.querySelector('#viewTabs [data-view="' + v + '"]'); if (b && b.offsetParent) { b.click(); return true; } return false; }, v)) { await pg.waitForTimeout(350); await screen('tab ' + v); }
    }
    await pg.evaluate(() => { const b = document.querySelector('#viewTabs [data-view="dial"]'); b && b.click(); }); await pg.waitForTimeout(300);
    if (await pg.evaluate(() => { const n = document.querySelector('.lead-name'); if (n) { n.click(); return true; } return false; })) { await pg.waitForTimeout(400); await screen('lead profile'); await closeAll(pg); }
    if (await pg.evaluate(() => { const b = document.getElementById('menuBtn'); if (b && b.offsetParent) { b.click(); return true; } return false; })) {
      await pg.waitForTimeout(300); await screen('menu');
      await pg.evaluate(() => { const b = document.getElementById('menuLoadBtn'); b && b.click(); }); await pg.waitForTimeout(300); await screen('menu > Load leads'); await closeAll(pg);
    }
    let rowsPressed = 0;
    if (await pg.evaluate(() => { const b = document.getElementById('adminBtn'); return !!(b && b.offsetParent); })) {
      await pg.evaluate(() => document.getElementById('adminBtn').click()); await pg.waitForTimeout(300); await screen('Admin controls');
      const cats = await pg.evaluate(() => [...document.querySelectorAll('[data-hub-cat]')].map(c => c.getAttribute('data-hub-cat')));
      for (const c of cats) {
        const open = async () => { await closeAll(pg); await pg.evaluate(() => document.getElementById('adminBtn').click()); await pg.waitForTimeout(200);
          await pg.evaluate(c => { const x = document.querySelector('[data-hub-cat="' + c + '"]'); x && x.click(); }, c); await pg.waitForTimeout(220); };
        await open(); await screen('Admin controls > ' + c);
        const rows = await pg.evaluate(() => [...document.querySelectorAll('.hub-row[id]')].filter(r => r.offsetParent).map(r => r.id));
        for (const r of rows) {
          if (DOWNLOADS.test(r)) continue;
          await open();
          const before = await state(pg);
          const ok = await pg.evaluate(r => { const x = document.getElementById(r); if (x && x.offsetParent) { x.click(); return true; } return false; }, r);
          check(tag + ' ' + c + ' > ' + r + ': the row can be pressed', ok);
          if (!ok) continue;
          await pg.waitForTimeout(450); rowsPressed++;
          const after = await state(pg);
          check(tag + ' ' + c + ' > ' + r + ': pressing it opens something', after.modals !== before.modals && !!after.modals || after.tv || after.view !== before.view || after.toast, { before, after });
          await screen(c + ' > ' + r);
        }
      }
      await closeAll(pg);
    }
    await ctx.close();
    return rowsPressed;
  }
  const seed = (uid, email) => async pg => { await pg.goto(BASE + '#mockbench'); await pg.waitForTimeout(300);
    await pg.evaluate(([uid, email]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(demoSeed())); sessionStorage.setItem('__mocksess', JSON.stringify({ uid, email })); }, [uid, email]); };
  const n1 = await walk('insurance demo, phone', BASE + '#demo-insurance', 390, 'light');
  const n2 = await walk('solar demo, computer dark', BASE + '#demo-solar', 1366, 'dark');
  const n3 = await walk('team admin, phone dark', BASE, 390, 'dark', seed('dAdm', 'demo@dovetail-f863c.firebaseapp.com'));
  await walk('team rep, computer', BASE, 1366, 'light', seed('dR2', 'sam@dovetail-f863c.firebaseapp.com'));
  check('Admin controls rows were pressed (the walk reached them)', n1 >= 15 && n2 >= 15 && n3 >= 15, { n1, n2, n3 });
  await br.close();
  console.log('app_walk: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
