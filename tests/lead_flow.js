// VPEX regression check (lead_flow): from the call list to the next step.
//  - Sort your leads: who to call, in what order, from which list; every option labeled, counted, applied at once.
//  - Next steps: every follow-up says what it's for (each industry has its own steps); the pipeline flags
//    overdue / due today / missing next steps and filters by them; the lead profile leads with the next step;
//    finishing a step on a live deal asks for the next one.
//  - Key dates by industry in the Vault, with one-time dates (X-date, lease end) warning ahead of time.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/lead_flow.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
async function open(br, hash, w) {
  const ctx = await br.newContext({ viewport: { width: w || 390, height: 900 }, isMobile: (w || 390) < 500, hasTouch: (w || 390) < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-11-06T16:00:00Z') });   // Fri 11 AM in New York
  await page.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await page.goto(BASE + hash); await page.waitForTimeout(2500);
  await page.evaluate(() => { try { sessionStorage.setItem('vpex_demo_hi', '1'); } catch (e) {} });
  return { ctx, page, errs };
}
const ev = (page, f, a) => page.evaluate(f, a);
const click = (page, sel) => ev(page, s => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel);
const sum = page => ev(page, () => { const s = document.querySelector('#featModalBody .qs-sum'); return s ? s.innerText.replace(/\s+/g, ' ').trim() : null; });
const closeSheets = page => ev(page, () => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); const t = document.getElementById('textPrompt'); if (t) t.style.display = 'none'; });

(async () => {
  const br = await chromium.launch();
  for (const w of [390, 1280]) {
    const t = w + ' ';
    const { ctx, page, errs } = await open(br, '#demo-investments', w);
    // ---------- Sort your leads ----------
    check(t + 'Sort chip says what it does', /Sort & filter/.test(await ev(page, () => document.getElementById('qcSortBtn').innerText)));
    await click(page, '#qcSortBtn'); await page.waitForTimeout(300);
    const s0 = await ev(page, () => ({ title: document.querySelector('#featModalBody h3').innerText, secs: [...document.querySelectorAll('#featModalBody .qs-sec h4')].map(h => h.innerText.replace(/^\d\s*/, '')),
      opts: [...document.querySelectorAll('#featModalBody .qs-opt')].map(o => ({ t: o.querySelector('b').innerText, d: o.querySelector('small').innerText, h: o.getBoundingClientRect().height })),
      zones: document.querySelectorAll('#featModalBody .qs-zones [data-qs-who]').length }));
    check(t + 'sheet asks who, in what order', s0.title === 'Sort your leads' && s0.secs[0] === 'Who to call' && s0.secs[1] === 'In what order', s0);
    check(t + 'every option is labeled and explained, 44 px+', s0.opts.length >= 7 && s0.opts.every(o => o.t && o.d && o.h >= 44), s0.opts);
    check(t + 'time zones are compact chips', s0.zones >= 1, s0.zones);
    check(t + 'summary reads back what you are calling', /^\d+ leads? to call Everyone to call · as imported/.test(await sum(page)), await sum(page));
    await click(page, '[data-qs-order="smart"]'); await page.waitForTimeout(200);
    check(t + 'order applies at once and reads back', /best time to answer/.test(await sum(page)) && /Best time/.test(await ev(page, () => document.getElementById('qcSortBtn').innerText)), await sum(page));
    await click(page, '[data-qs-who="now"]'); await page.waitForTimeout(200);
    const nowS = await sum(page), nowChip = await ev(page, () => { const c = document.querySelector('#queueControls [data-qfilter="now"]'); return c ? c.classList.contains('active') : null; });
    check(t + 'Callable now applies to the Dial chips too', /Callable now/.test(nowS) && nowChip === true, [nowS, nowChip]);
    const z = await ev(page, () => { const c = document.querySelector('#featModalBody .qs-zones [data-qs-who]'); if (!c) return null; const n = +c.querySelector('.chip-n').innerText; c.click(); return { n, k: c.getAttribute('data-qs-who') }; });
    await page.waitForTimeout(200);
    if (z) check(t + 'a time zone gives exactly its count', new RegExp('^' + z.n + ' leads? to call').test(await sum(page)), [z, await sum(page)]);
    await click(page, '#qsReset'); await page.waitForTimeout(200);
    check(t + 'Reset puts everything back', /Everyone to call · as imported/.test(await sum(page)) && /Sort & filter/.test(await ev(page, () => document.getElementById('qcSortBtn').innerText)), await sum(page));
    await click(page, '#sortDone'); await page.waitForTimeout(200);
    await click(page, '#qcSortBtn'); await page.waitForTimeout(200);   // reopened: one tap, one change (no stacked listeners)
    await click(page, '[data-qs-order="east"]'); await page.waitForTimeout(150);
    check(t + 'reopening works the same', /east → west/i.test(await sum(page)), await sum(page));
    await click(page, '[data-qs-order="imported"]'); await click(page, '#sortDone'); await page.waitForTimeout(200);

    // ---------- Pipeline: next steps ----------
    await click(page, '#viewTabPipeline'); await page.waitForTimeout(400);
    const pf = await ev(page, () => ({ chips: [...document.querySelectorAll('.pipe-filters [data-pipe-f]')].map(b => [b.getAttribute('data-pipe-f'), +b.querySelector('.chip-n').innerText]),
      lines: [...document.querySelectorAll('.pipe-item .nx-line')].map(l => l.className.replace('nx-line ', '')), items: document.querySelectorAll('.pipe-item').length,
      help: !!document.querySelector('.stage-help') }));
    check(t + 'pipeline filters by next step', pf.chips.length >= 2 && pf.chips[0][0] === 'all', pf.chips);
    check(t + 'every live deal shows its next step line', pf.lines.length >= 1, pf);
    check(t + 'each stage says what it means', pf.help);
    for (const [k, n] of pf.chips.filter(c => c[0] !== 'all')) {
      await click(page, '[data-pipe-f="' + k + '"]'); await page.waitForTimeout(250);
      const got = await ev(page, k => [...document.querySelectorAll('.pipe-item')].map(it => (it.querySelector('.nx-line') || {}).className || ''), k);
      check(t + 'filter "' + k + '" shows exactly its ' + n, got.length === n && got.every(c => c.indexOf('nx-' + k) !== -1), got);
    }
    await click(page, '[data-pipe-f="all"]'); await page.waitForTimeout(200);
    // set a missing next step (make one missing first: finish the open steps of the first live deal)
    let target = await ev(page, () => { const it = document.querySelector('.pipe-item .nx-none'); return it ? it.getAttribute('data-set-next') : null; });
    if (!target) {
      target = await ev(page, () => document.querySelector('.pipe-item').getAttribute('data-pipe-id'));
      await click(page, '#viewTabTasks'); await page.waitForTimeout(300);
      for (let i = 0; i < 6; i++) { const ok = await ev(page, id => { const b = [...document.querySelectorAll('.task-item')].find(r => r.querySelector('[data-open-lead="' + id + '"]') && r.querySelector('.task-check:not(.done)')); if (!b) return false; b.querySelector('.task-check').click(); return true; }, target); if (!ok) break; await page.waitForTimeout(150); }
      const prompt = await ev(page, () => { const t = document.getElementById('toast'); return t ? t.innerText : ''; });
      check(t + 'finishing the last step on a live deal asks for the next', /what’s next/i.test(prompt) && /Set next step/.test(prompt), prompt);
      await click(page, '#viewTabPipeline'); await page.waitForTimeout(300);
    }
    check(t + 'a deal without a next step says so', !!target && await ev(page, id => !!document.querySelector('[data-set-next="' + id + '"]'), target));
    await click(page, '[data-set-next="' + target + '"]'); await page.waitForTimeout(400);
    const fs = await ev(page, () => ({ open: document.getElementById('fuSheet').classList.contains('show'), title: document.getElementById('fuTitle').innerText,
      whats: [...document.querySelectorAll('#fuBody [data-fu-what]')].map(b => b.innerText), on: (document.querySelector('#fuBody [data-fu-what].on') || {}).innerText, keep: document.getElementById('fuKeep').innerText }));
    check(t + 'Set opens the sheet: what, then when', fs.open && /^What’s next with/.test(fs.title) && fs.keep === 'Cancel', fs);
    check(t + 'investment floors get their own steps', ['Send overview', 'Advisor meeting', 'Funding call'].every(x => fs.whats.indexOf(x) !== -1) && fs.on === 'Follow-up call', fs.whats);
    await click(page, '#fuBody [data-fu-what="Advisor meeting"]'); await page.waitForTimeout(150);
    check(t + 'picking a step marks it', await ev(page, () => document.querySelector('#fuBody [data-fu-what].on').innerText) === 'Advisor meeting');
    await click(page, '#fuBook'); await page.waitForTimeout(400);
    const after = await ev(page, id => { const it = document.querySelector('[data-pipe-id="' + id + '"] .nx-line'); return it ? it.innerText.replace(/\s+/g, ' ') : null; }, target);
    check(t + 'the deal now shows its next step', /Advisor meeting/.test(after || ''), after);
    const task = await ev(page, id => (window.__mockLeadFull ? (window.__mockLeadFull(id)[1] || []) : []).filter(x => !x.done).map(x => ({ what: x.what, auto: x.auto, pinned: !!x.pinned })), target);
    // move it: change the step and the time
    await click(page, '[data-pipe-id="' + target + '"] [data-move-next]'); await page.waitForTimeout(350);
    const mv = await ev(page, () => ({ title: document.getElementById('fuTitle').innerText, on: (document.querySelector('#fuBody [data-fu-what].on') || {}).innerText }));
    check(t + 'Move keeps the step it was', /^Move the follow-up/.test(mv.title) && mv.on === 'Advisor meeting', mv);
    await click(page, '#fuBody [data-fu-what="Funding call"]'); await page.waitForTimeout(150);
    await click(page, '#fuBook'); await page.waitForTimeout(400);
    check(t + 'moving can change the step', /Funding call/.test(await ev(page, id => (document.querySelector('[data-pipe-id="' + id + '"] .nx-line') || {}).innerText || '', target)));

    // ---------- Lead profile ----------
    await click(page, '[data-pipe-id="' + target + '"] [data-open-lead]'); await page.waitForTimeout(400);
    const lp = await ev(page, () => { const n = document.querySelector('#leadModalBody .lp-next'); return n ? { k: n.querySelector('.lp-next-k').innerText, b: n.querySelector('b').innerText, move: !!n.querySelector('[data-move-next]'), done: !!document.getElementById('lpNextDone'),
      above: !!(n.compareDocumentPosition(document.getElementById('lpStage')) & 4), add: document.getElementById('lpAddTask').innerText } : null; });
    check(t + 'profile leads with the next step, Move and Mark done', lp && /Next step/i.test(lp.k) && lp.b === 'Funding call' && lp.move && lp.done && lp.above, lp);
    check(t + 'profile button says + Next step', lp && lp.add === '+ Next step', lp);
    const cal = await ev(page, () => { const b = document.querySelector('#leadModalBody .handoff-info .copy-btn'); return b ? Math.round(b.getBoundingClientRect().height) : 0; });
    if (cal) check(t + 'Add to calendar is one line', cal <= 44, cal);
    await click(page, '#lpNextDone'); await page.waitForTimeout(300);
    const pr = await ev(page, () => document.getElementById('toast').innerText);
    check(t + 'Mark done on the last step asks what’s next', /what’s next/i.test(pr) && /Set next step/.test(pr), pr);
    const lp2 = await ev(page, () => { const n = document.querySelector('#leadModalBody .lp-next'); return n ? n.className + '|' + n.innerText.replace(/\s+/g, ' ') : null; });
    check(t + 'profile now shows no next step, with Set', /nx-none/.test(lp2 || '') && /Set next step/.test(lp2 || ''), lp2);
    await click(page, '#lpAddTask'); await page.waitForTimeout(350);
    check(t + '+ Next step opens the same sheet', await ev(page, () => document.getElementById('fuSheet').classList.contains('show') && /^What’s next with/.test(document.getElementById('fuTitle').innerText)));
    await click(page, '#fuKeep'); await page.waitForTimeout(250);
    check(t + 'Cancel books nothing', await ev(page, id => !document.querySelector('[data-pipe-id="' + id + '"] .nx-line:not(.nx-none)'), target));

    // ---------- Tasks rows name the step ----------
    await click(page, '#viewTabTasks'); await page.waitForTimeout(300);
    const rows = await ev(page, () => [...document.querySelectorAll('.task-item:not(.done) .task-what')].map(x => x.innerText));
    check(t + 'every follow-up says what it is', rows.length >= 1 && rows.every(Boolean), rows);

    // ---------- Interested: the step is part of booking ----------
    await click(page, '#viewTabDial'); await page.waitForTimeout(400); await closeSheets(page);
    await page.locator('#callBtn').click(); await page.waitForTimeout(600);
    await page.locator('#outcomesRow [data-outcome="interested"]').first().click(); await page.waitForTimeout(900);
    const ins = await ev(page, () => ({ title: document.getElementById('fuTitle').innerText, n: document.querySelectorAll('#fuBody [data-fu-what]').length }));
    check(t + 'Interested asks what’s next, and when', /What’s next with .+, and when\?/.test(ins.title) && ins.n >= 5, ins);
    await click(page, '#fuBody [data-fu-what="Send overview"]'); await page.waitForTimeout(150);
    await click(page, '#fuBook'); await page.waitForTimeout(400);
    const bk = await ev(page, () => document.getElementById('toast').innerText);
    check(t + 'booked toast names the step', /Send overview booked/.test(bk), bk);
    await closeSheets(page);
    // Callback later: no step to pick, it's a call back
    await page.clock.runFor(15000); await page.waitForTimeout(300);
    await page.locator('#callBtn').click(); await page.waitForTimeout(600);
    await page.locator('#outcomesRow [data-outcome="callback"]').first().click(); await page.waitForTimeout(900);
    check(t + 'Callback later has no step chips', await ev(page, () => document.getElementById('fuSheet').classList.contains('show') && !document.querySelector('#fuBody [data-fu-what]')));
    await click(page, '#fuBook'); await page.waitForTimeout(300);
    check(t + 'no page errors', !errs.length, errs.slice(0, 3));
    await ctx.close();
  }

  // ---------- Industries: their own next steps and key dates ----------
  const IND = { insurance: ['Send quote', 'Medical exam', 'X-date', 'Policy renewal'], realestate: ['Showing', 'Listing appointment', 'Closing anniversary', 'Lease ends'],
    mca: ['Get bank statements', 'Contract signing', 'Renewal eligible', 'Payoff date'], auto: ['Test drive', 'Credit application', 'Lease ends', 'Service due'], solar: ['Site survey', 'Proposal review', 'Install anniversary', 'Warranty check'] };
  for (const [ind, want] of Object.entries(IND)) {
    const { ctx, page, errs } = await open(br, '#demo-' + ind);
    await click(page, '#viewTabPipeline'); await page.waitForTimeout(300);
    const any = await ev(page, () => { const b = document.querySelector('[data-set-next], [data-move-next]'); if (!b) return false; b.click(); return true; });
    await page.waitForTimeout(350);
    const whats = await ev(page, () => [...document.querySelectorAll('#fuBody [data-fu-what]')].map(b => b.innerText));
    check(ind + ': its own next steps', any && want.slice(0, 2).every(x => whats.indexOf(x) !== -1), whats);
    await closeSheets(page);
    await click(page, '#viewTabVault'); await page.waitForTimeout(300);
    const opened = await ev(page, () => { const r = document.querySelector('#mainArea [data-vault-open], #mainArea .vault-row, #mainArea .vt-row'); if (!r) return false; r.click(); return true; });
    await page.waitForTimeout(300);
    if (opened) {
      await click(page, '#vAddDate'); await page.waitForTimeout(200);
      const kinds = await ev(page, () => [...document.querySelectorAll('#kdLabel option')].map(o => o.textContent));
      check(ind + ': its own key dates', want.slice(2).every(x => kinds.indexOf(x) !== -1) && kinds[kinds.length - 1] === 'Other', kinds);
      if (ind === 'insurance') {   // a one-time X-date 30 days out warns now (inside its 60-day window); it isn't treated as yearly
        await ev(page, () => { document.getElementById('kdLabel').value = 'X-date'; const d = new Date(Date.now() + 30 * 86400000); document.getElementById('kdDate').value = d.toISOString().slice(0, 10); document.getElementById('kdSave').click(); });
        await page.waitForTimeout(300);
        const al = await ev(page, () => [...document.querySelectorAll('#vaultModalBody .va-row')].map(r => r.innerText));
        check('insurance: X-date 30 days out warns now', al.some(a => /^X-date in 3[01] days$/.test(a)), al);
      }
    } else check(ind + ': demo has a Vault record to open', false);
    check(ind + ': no page errors', !errs.length, errs.slice(0, 3));
    await ctx.close();
  }
  await br.close();
  console.log(`lead_flow: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
