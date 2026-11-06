// VPEX regression check (lead_progress): where a lead is at, for investment floors (Email sent, Docs sent, Docs returned,
// Account funded). The checklist pops up in the follow-up sheet after Interested (and is in the lead profile); the lead
// card face shows only the current status ("✓ Docs sent · 2 of 4"), the Tasks card the furthest step. Saved on the lead
// (lead.prog, synced with it). Other industries don't show it.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/lead_progress.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const STEPS = ['Email sent', 'Docs sent', 'Docs returned', 'Account funded'];
async function open(br, c, hash, theme) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 900 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  if (theme) await page.addInitScript(t => { try { localStorage.setItem('dovetail_dialer_theme_v1', t); } catch (e) {} }, theme);
  await page.clock.install({ time: new Date('2026-11-06T16:00:00Z') });   // Fri 11 AM in New York
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(BASE + hash); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const ev = (page, f, a) => page.evaluate(f, a);
const curId = page => ev(page, () => document.querySelector('#mainArea .lead-name').getAttribute('data-open-lead'));
const prog = (page, id) => ev(page, id => (window.__mockLeadFull(id)[0] || {}).prog || null, id);
const sheetBox = page => ev(page, () => { const b = document.querySelector('#fuBody .lead-prog'); return b ? [...b.querySelectorAll('input')].map(i => i.checked) : null; });
(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: '390-dark', w: 390, s: 'dark' }, { n: '390-light', w: 390, s: 'light' }, { n: '1280-dark', w: 1280, s: 'dark' }, { n: '1440-starfighter', w: 1440, s: 'dark', th: 'starfighter' }]) {
    const { ctx, page, errs } = await open(br, c, '#demo-investments', c.th);
    const t = c.n + ' ';
    check(t + 'no checklist on the card face', await ev(page, () => !document.querySelector('#mainArea .lead-prog')));
    check(t + 'no status on the card before anything is ticked', await ev(page, () => !document.querySelector('#mainArea .lead-prog-face')));
    const id = await curId(page);
    // Call, then Interested: the follow-up sheet pops up with the checklist
    await page.locator('#callBtn').click(); await page.waitForTimeout(600);
    await page.locator('#outcomesRow [data-outcome="interested"], #outcomesRow button').first().click(); await page.waitForTimeout(900);
    const sh = await ev(page, () => { const b = document.querySelector('#fuBody .lead-prog'); if (!b) return null; const ls = [...b.querySelectorAll('.lead-prog-step')];
      return { labels: ls.map(l => l.innerText.trim()), h: ls.map(l => Math.round(l.getBoundingClientRect().height)), n: b.querySelector('.lead-prog-n').innerText, open: document.getElementById('fuSheet').classList.contains('show'),
        clip: ls.some(l => { const s = l.querySelector('span'); return s.scrollWidth > s.clientWidth + 1; }), rows: new Set(ls.map(l => Math.round(l.getBoundingClientRect().top))).size,
        afterStages: !!(document.querySelector('#fuBody .fu-stages').compareDocumentPosition(b) & 4) }; });
    check(t + 'Interested: follow-up sheet shows the 4 steps', sh && sh.open && JSON.stringify(sh.labels) === JSON.stringify(STEPS), sh);
    if (!sh) { await ctx.close(); continue; }
    check(t + 'under "Where are they?", 0 of 4, 2 rows', sh.afterStages && sh.n === '0 of 4' && sh.rows === 2, sh);
    check(t + '44 px tap targets, labels not cut off', sh.h.every(h => h >= 44) && !sh.clip, sh);
    await page.locator('#fuBody .lead-prog-step').nth(0).click(); await page.waitForTimeout(200);
    await page.locator('#fuBody .lead-prog-step').nth(1).click(); await page.waitForTimeout(200);
    let p = await prog(page, id);
    check(t + 'ticks save on the lead with the time', p && typeof p.email === 'number' && typeof p.docs === 'number' && Object.keys(p).length === 2, p);
    check(t + 'sheet stays open, count 2 of 4, toast', await ev(page, () => document.getElementById('fuSheet').classList.contains('show') && document.querySelector('#fuBody .lead-prog-n').innerText === '2 of 4' && document.body.innerText.includes('Docs sent ✓')));
    await page.locator('#fuBody [data-fu-stage]').nth(1).click(); await page.waitForTimeout(250);
    check(t + 'picking a stage keeps the ticks', JSON.stringify(await sheetBox(page)) === '[true,true,false,false]', await sheetBox(page));
    const pl = await ev(page, id => (window.__mockPayload(id) || {}).prog, id);
    check(t + 'goes out with the lead to the floor', pl && pl.email && pl.docs, pl);
    await page.locator('#fuBook').click(); await page.waitForTimeout(800);
    check(t + 'booking still works', await ev(page, () => !document.getElementById('fuSheet').classList.contains('show')));
    // the lead card face shows the status: open that lead from Up next / search via the profile
    // Callback later: no checklist in that sheet
    await ev(page, () => { const b = document.getElementById('tpLater'); if (b) b.click(); });
    await page.clock.runFor(12000); await page.waitForTimeout(300);   // call pacing: the next call waits a few seconds
    const id2 = await curId(page);
    await page.locator('#callBtn').click(); await page.waitForTimeout(600);
    await page.locator('#outcomesRow [data-outcome="callback"]').first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(900);
    const cbOpen = await ev(page, () => document.getElementById('fuSheet').classList.contains('show'));
    check(t + 'Callback later opens its sheet', cbOpen);
    if (cbOpen) { check(t + 'Callback later sheet: no checklist', await ev(page, () => !document.querySelector('#fuBody .lead-prog'))); await page.locator('#fuKeep').click(); await page.waitForTimeout(600); }
    // tick from the profile of the lead now on the card: the face shows the furthest step and count
    await ev(page, () => document.querySelector('#mainArea .lead-name').click()); await page.waitForTimeout(600);
    const pid = await ev(page, () => document.querySelector('#leadModalBody .lead-prog').getAttribute('data-prog-lead'));
    await page.locator('#leadModalBody .lead-prog-step').nth(0).click(); await page.waitForTimeout(200);
    await page.locator('#leadModalBody .lead-prog-step').nth(2).click(); await page.waitForTimeout(200);
    await ev(page, () => document.getElementById('lpClose').click()); await page.waitForTimeout(500);
    const face = await ev(page, () => { const f = document.querySelector('#mainArea .lead-prog-face'); if (!f) return null; const r = f.getBoundingClientRect(); const cs = getComputedStyle(f);
      return { t: f.innerText.replace(/\s+/g, ' ').trim(), h: Math.round(r.height), lead: f.getAttribute('data-open-lead'), sw: document.documentElement.scrollWidth > innerWidth, cur: document.querySelector('#mainArea .lead-name').getAttribute('data-open-lead') }; });
    check(t + 'card face shows the current status', face && face.t === '✓ Docs returned · 2 of 4' && face.lead === face.cur && face.cur === pid, face);
    check(t + 'status is small (≤ 34 px) and fits', face && face.h <= 34 && !face.sw, face);
    await page.locator('#mainArea .lead-prog-face').click(); await page.waitForTimeout(600);
    const pr = await ev(page, () => document.getElementById('leadModal').classList.contains('show') ? [...document.querySelectorAll('#leadModalBody .lead-prog input')].map(i => i.checked) : null);
    check(t + 'tapping the status opens the lead with its checklist', JSON.stringify(pr) === '[true,false,true,false]', pr);
    await page.locator('#leadModalBody .lead-prog-step').nth(2).click(); await page.waitForTimeout(200);   // untick Docs returned
    await ev(page, () => document.getElementById('lpClose').click()); await page.waitForTimeout(500);
    const f2 = await ev(page, () => { const f = document.querySelector('#mainArea .lead-prog-face'); return f ? f.innerText.replace(/\s+/g, ' ').trim() : null; });
    check(t + 'untick: status follows', f2 === '✓ Email sent · 1 of 4', f2);
    // stays after reopening the app
    await page.waitForTimeout(3000);
    await page.goto(BASE); await page.waitForTimeout(2500);
    check(t + 'kept after reopening the app', JSON.stringify(await prog(page, id)).includes('docs') && !!(await prog(page, pid) || {}).email, [await prog(page, id), await prog(page, pid)]);
    // Tasks card: the furthest step for a lead with a follow-up
    const tl = await ev(page, () => { const id = window.__mockOpenTaskLead(); if (!id) return null; window.__mockEditLead(id, 'prog', { email: Date.now() - 86400000, docs: Date.now() }); return window.__mockLeadFull(id)[0].name; });
    await ev(page, () => document.querySelector('#viewTabs [data-view="tasks"]').click()); await page.waitForTimeout(400);
    await ev(page, () => { const b = document.querySelector('[data-tscope="all"]'); if (b) b.click(); }); await page.waitForTimeout(400);
    const chip = await ev(page, n => { const card = [...document.querySelectorAll('.task-item')].find(x => x.innerText.includes(n)); const ch = card && card.querySelector('.lead-prog-chip'); return ch ? { t: ch.innerText, sw: document.documentElement.scrollWidth > innerWidth } : null; }, tl);
    check(t + 'Tasks card shows the furthest step', chip && chip.t === '✓ Docs sent' && !chip.sw, chip);
    check(t + 'no page errors', !errs.length, errs);
    await ctx.close();
  }
  // other industries: nothing
  for (const ind of ['insurance', 'realestate', 'mca', 'auto', 'solar']) {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' }, '#demo-' + ind);
    await page.locator('#callBtn').click(); await page.waitForTimeout(600);
    await page.locator('#outcomesRow [data-outcome="interested"], #outcomesRow button').first().click(); await page.waitForTimeout(900);
    const n = await ev(page, () => document.querySelectorAll('.lead-prog, .lead-prog-face').length);
    check(ind + ': no progress checklist or status', n === 0, n);
    check(ind + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`lead_progress: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
