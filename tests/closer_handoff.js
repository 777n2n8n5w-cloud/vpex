// VPEX regression check (closer_handoff): once a lead is fully qualified, the rep sends it to a closer in two taps,
// and the closer is alerted at once on whatever screen they're on.
//  - The "Send to a closer" button shows on the dial card, the profile and the Qualify sheet only when every qualifying
//    answer is in; the sheet lists the closers (never the rep), defaults to "Call now", and refuses a time the closer
//    already has booked, offering the next open one.
//  - Sending from the call logs that call as Interested once (no follow-up sheet, no double count) and moves the lead
//    to the closer with an appointment task; the rep's list moves on.
//  - The closer's screen shows the alert within 2 s (chime, name, when, answers, note) even on another tab; "Call now"
//    puts the lead on their dial card and marks it opened, and the rep sees "Sam opened ...". An appointment handoff
//    says when. A dismissed alert doesn't come back on reload, but the "New handoff" pill stays until it's opened.
//  - The phone alert (server) says "Call now" for a call-now handoff and the appointment time otherwise.
//  - Regression: answering qualifying questions for one lead never changes the lead whose sheet was open before.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/closer_handoff.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // ---------- the phone alert's words (server) ----------
  const L = require('../functions/lib.js'), t0 = Date.now();
  const mNow = L.handoffMessage('acme', { leadId: 'x1', lead: { name: 'Jane Doe' }, h: { from: { name: 'Mia Chen' }, to: { uid: 'dR2abc' }, at: t0, apptAt: t0, now: true, note: 'Wants term' } }, 'America/New_York', t0);
  check('push: call-now handoff says call now, with the note', mNow.title === 'New handoff from Mia: Jane Doe' && /^Call now\. They're expecting you\. · Wants term$/.test(mNow.body), mNow);
  const mAppt = L.handoffMessage('acme', { leadId: 'x1', lead: { name: 'Jane Doe' }, h: { from: { name: 'Mia Chen' }, to: { uid: 'dR2abc' }, at: t0, apptAt: t0 + 86400000 } }, 'America/New_York', t0);
  check('push: appointment handoff says when', /^Appointment tomorrow /.test(mAppt.body), mAppt);
  const evs = L.handoffEvents('acme', { leads: {} }, { leads: { x1: { name: 'Jane', handoff: { from: { uid: 'dR3xyz', name: 'Mia' }, to: { uid: 'dR2abc', name: 'Sam' }, at: t0, apptAt: t0, now: true, seen: false } } } }, t0);
  check('push: a new call-now handoff is sent once', evs.length === 1 && evs[0].leadId === 'x1', evs);

  // ---------- the app ----------
  const br = await chromium.launch();
  const ctx = await br.newContext({ timezoneId: 'America/New_York' });
  await ctx.clock.install({ time: new Date('2026-11-04T11:30:00-05:00') });   // a weekday 11:30 AM in New York: the leads are inside calling hours (at night Call asks first)
  const errs = [];
  const boot = await ctx.newPage();
  await boot.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await boot.goto(BASE + '#mockbench'); await boot.waitForTimeout(500);
  await boot.evaluate(() => {
    const db = demoSeed();
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'demo@dovetail-f863c.firebaseapp.com': { uid: 'dAdm', pw: 'test' }, 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' }, 'mia@dovetail-f863c.firebaseapp.com': { uid: 'dR3', pw: 'test' } }));
  });
  await boot.close();
  const open = async (uid, email) => {
    const p = await ctx.newPage(); await p.setViewportSize({ width: 390, height: 844 }); p.on('pageerror', e => errs.push(uid + ': ' + e.message));
    await p.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await p.addInitScript(([u, e]) => { try { sessionStorage.setItem('__mocksess', JSON.stringify({ uid: u, email: e })); } catch (x) {}
      window.__chimes = 0; window.__toasts = []; new MutationObserver(() => { const t = document.querySelector('.toast'); if (t && t.textContent && window.__toasts[window.__toasts.length - 1] !== t.textContent) window.__toasts.push(t.textContent); }).observe(document, { subtree: true, childList: true, characterData: true }); const A = window.AudioContext; if (A) window.AudioContext = function () { window.__chimes++; return new A(); };
      window.addEventListener('click', ev => { const a = ev.target.closest && ev.target.closest('a[href^="tel:"]'); if (a) ev.preventDefault(); }); }, [uid, email]);
    await p.goto(BASE); await p.waitForTimeout(2800);
    return p;
  };
  const sam = await open('dR2', 'sam@dovetail-f863c.firebaseapp.com');
  const mia = await open('dR3', 'mia@dovetail-f863c.firebaseapp.com');
  await sam.evaluate(() => { const t = document.querySelector('.view-tab[data-view="tasks"], #tabTasks, [data-tab="tasks"]'); if (t) t.click(); }); await sam.waitForTimeout(300);
  const samView = await sam.evaluate(() => { const a = document.querySelector('.view-tab.active'); return a ? a.textContent.trim() : ''; });

  // 1. Mia's lead: not qualified yet, so no big button
  const lead = await mia.evaluate(() => { const n = document.querySelector('.lead-name'); return { name: n.textContent, id: n.getAttribute('data-open-lead') }; });
  check('dial card: no "Send to a closer" before the lead is qualified', !(await mia.$('#mainArea .ho-ready')));
  const r0 = await mia.evaluate(() => +document.getElementById('todayNum').textContent);
  await mia.evaluate(() => document.getElementById('callBtn').click()); await mia.waitForTimeout(400);

  // 2. qualify on the call: the sheet offers the handoff once every answer is in
  await mia.evaluate(id => document.querySelector('[data-qf-open="' + id + '"]').click(), lead.id); await mia.waitForTimeout(300);
  const groups = await mia.evaluate(() => [...document.querySelectorAll('#featModalBody .qf-opts')].map(g => g.querySelector('.qf-opt').getAttribute('data-qf-k')));
  const inputs = await mia.evaluate(() => [...document.querySelectorAll('#featModalBody [data-qf-in]')].map(i => i.getAttribute('data-qf-in')));
  check('Qualify sheet: no send button with answers missing', !(await mia.$('#qfSend')));
  for (const k of groups) await mia.evaluate(k => { const g = document.querySelector('#featModalBody [data-qf-k="' + k + '"]:not(.on)'); if (g && !document.querySelector('#featModalBody [data-qf-k="' + k + '"].on')) g.click(); }, k);
  for (let i = 0; i < inputs.length; i++) {
    if (i === inputs.length - 1) check('Qualify sheet: still no send button with one answer left', !(await mia.$('#qfSend')));
    await mia.fill('#featModalBody [data-qf-in="' + inputs[i] + '"]', i === 0 ? '61' : 'x' + i);
  }
  await mia.waitForTimeout(150);
  check('Qualify sheet: "Send to a closer" appears the moment the last answer is in', !!(await mia.$('#qfSend')), { groups, inputs });
  await mia.click('#qfSend'); await mia.waitForTimeout(300);

  // 3. the handoff sheet
  const sheet = await mia.evaluate(() => ({ closers: [...document.querySelectorAll('[data-ho-uid]')].map(b => b.getAttribute('data-ho-uid')), when: (document.querySelector('[data-ho-when][aria-checked="true"]') || {}).textContent, go: document.getElementById('hoGo').textContent, chips: document.querySelectorAll('#hoSheet .ho-qf .qf-chip').length }));
  check('sheet: lists the closer (Sam), not the rep', sheet.closers.join() === 'dR2', sheet);
  check('sheet: defaults to Call now, button says who', sheet.when === 'Call now' && sheet.go === 'Send to Sam now', sheet);
  check('sheet: shows the answers going with the lead', sheet.chips === groups.length + inputs.length, sheet);
  await mia.fill('#hoNote', 'Wants the 20-year term, call before 5');
  const sentAt = Date.now();
  const sentPage = await mia.evaluate(() => Date.now());
  await mia.click('#hoGo'); await mia.waitForTimeout(300);

  // 4. Mia's side
  const ms = await mia.evaluate(id => { const H = window.__ho, l = H.lead(id), c = H.lastCall();
    return { owner: l.owner && l.owner.uid, status: l.status, h: l.handoff, last: c && c.leadId === id ? c.outcomeKey : null, n: H.calls(id).filter(x => Date.parse(x.timestamp) > Date.now() - 60000).length,
      task: H.tasks(id).map(t => ({ a: t.assignee && t.assignee.uid, note: t.note })), awaiting: H.awaiting(),
      fu: !!document.querySelector('.fu-overlay.show, #fuSheet.show, .fu-sheet.show'), card: (document.querySelector('.lead-name') || {}).textContent, modal: document.getElementById('featModal').classList.contains('show') }; }, lead.id);
  check('rep: the call is logged as Interested, once', ms.last === 'interested' && ms.n === 1 && !ms.awaiting, ms);
  check('rep: no follow-up sheet (the closer has it)', !ms.fu && !ms.modal, ms);
  check('rep: calls today counted once', await mia.evaluate(() => +document.getElementById('todayNum').textContent) === r0 + 1);
  check('rep: lead now belongs to Sam, call-now handoff recorded', ms.owner === 'dR2' && ms.status === 'done' && ms.h && ms.h.now === true && ms.h.to.uid === 'dR2' && ms.h.seen === false, ms);
  check('rep: Sam has the one open call on it', ms.task.length === 1 && ms.task[0].a === 'dR2' && /^Appointment — call now, handoff from Mia/.test(ms.task[0].note), ms.task);
  check('rep: the dial card moved on to the next lead', ms.card && ms.card !== lead.name, ms.card);

  // 5. Sam's screen: the alert drops in, on the Tasks tab
  const t1 = Date.now(); let alertMs = -1;
  while (Date.now() - t1 < 4000) { if (await sam.evaluate(() => { const a = document.getElementById('hoAlert'); return !!(a && a.classList.contains('show')); })) { alertMs = Date.now() - sentAt; break; } await sleep(100); }
  check('closer: alert shows within 2 s of the send, on another tab (' + samView + ')', alertMs >= 0 && alertMs < 2000, alertMs);
  const al = await sam.evaluate(() => { const a = document.getElementById('hoAlert'); return { text: a.innerText, go: document.getElementById('hoAlertGo').textContent, chimes: window.__chimes, role: a.getAttribute('role'), r: a.getBoundingClientRect().toJSON() }; });
  check('closer: alert says who, which lead, call now, the note and the answers', al.text.includes('New handoff from Mia') && al.text.includes(lead.name) && al.text.includes('Call now') && al.text.includes('20-year term') && /61/.test(al.text), al.text);
  check('closer: it chimes, and is an alert dialog fully on screen', al.chimes >= 1 && al.role === 'alertdialog' && al.r.top >= 0 && al.r.right <= 390 && al.r.left >= 0, al);
  await sam.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/ho_alert.png' : '/dev/null' }).catch(() => {});
  check('closer: the alert button says Call ' + lead.name.split(' ')[0] + ' now', al.go === 'Call ' + lead.name.split(' ')[0] + ' now', al.go);
  await sam.click('#hoAlertGo'); await sam.waitForTimeout(400);
  const sc = await sam.evaluate(id => ({ card: (document.querySelector('.lead-name') || {}).textContent, view: (document.querySelector('.view-tab.active') || {}).textContent, h: window.__ho.lead(id).handoff, shown: document.getElementById('hoAlert').classList.contains('show') }), lead.id);
  check('closer: Call now puts the lead on the dial card', sc.card === lead.name && !sc.shown, sc);
  check('closer: and marks the handoff opened', sc.h.seen === true && sc.h.seenAt >= sentPage, sc.h);

  // 6. Mia hears it was opened
  let seenToast = '';
  const t2 = Date.now();
  while (Date.now() - t2 < 3000) { seenToast = await mia.evaluate(() => window.__toasts.filter(t => /Sam opened/.test(t))[0] || ''); if (/Sam opened/.test(seenToast)) break; await sleep(100); }
  check('rep: "Sam opened <lead>\'s handoff" within 3 s', /Sam opened .+handoff/.test(seenToast), seenToast);
  await mia.evaluate(id => window.__ho.profile(id), lead.id); await mia.waitForTimeout(300);
  const info = await mia.evaluate(() => (document.querySelector('#leadModalBody .handoff-info') || {}).innerText || '');
  check('rep: the profile says sent to Sam, call now, opened by Sam', /to Sam Ortiz/.test(info) && /call now/.test(info) && /Opened by Sam/.test(info), info);
  check('rep: no second "Send to a closer" on a lead she already handed off', !(await mia.$('#leadModalBody .ho-ready, #leadModalBody [data-handoff]')));
  await mia.evaluate(() => window.__ho.closeProfile()); await mia.waitForTimeout(200);

  // 7. an appointment, at a time Sam already has: refused, next open time offered
  const lead2 = await mia.evaluate(() => { const n = document.querySelector('.lead-name'); return { name: n.textContent, id: n.getAttribute('data-open-lead') }; });
  await mia.evaluate(id => window.__ho.profile(id), lead2.id); await mia.waitForTimeout(300);
  check('profile: a lead that isn\'t fully qualified gets the small "Send to a closer" button', !!(await mia.$('#leadModalBody .lp-star[data-handoff]')) && !(await mia.$('#leadModalBody .ho-ready')));
  await mia.click('#leadModalBody .lp-star[data-handoff]'); await mia.waitForTimeout(300);
  await mia.click('[data-ho-when="pick"]');
  const soon = await mia.evaluate(() => { const d = new Date(Date.now() + 10 * 60000); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); });
  await mia.fill('#hoAt', soon); await mia.waitForTimeout(150);
  const busy = await mia.evaluate(() => ({ slot: document.getElementById('hoSlot').innerText, bad: document.getElementById('hoSlot').classList.contains('bad'), dis: document.getElementById('hoGo').disabled, free: !!document.querySelector('[data-ho-free]') }));
  check('sheet: a time Sam already has is refused, with the next open time offered', busy.bad && busy.dis && busy.free && new RegExp('Sam already has ' + lead.name).test(busy.slot), busy);
  await mia.click('[data-ho-free]'); await mia.waitForTimeout(150);
  const ok = await mia.evaluate(id1 => ({ slot: document.getElementById('hoSlot').innerText, dis: document.getElementById('hoGo').disabled, go: document.getElementById('hoGo').textContent, at: new Date(document.getElementById('hoAt').value).getTime(), booked: id1 }), await mia.evaluate(id => window.__ho.tasks(id)[0].dueAt, lead.id));
  check('sheet: the offered time is free and the button says when', !ok.dis && /Sam is free then/.test(ok.slot) && /^Send to Sam for /.test(ok.go) && ok.at - ok.booked >= 30 * 60000 && ok.at - ok.booked <= 36 * 60000, ok);
  const sent2 = Date.now();
  await mia.click('#hoGo'); await mia.waitForTimeout(300);
  const t3 = Date.now(); let a2 = '';
  while (Date.now() - t3 < 4000) { a2 = await sam.evaluate(() => { const a = document.getElementById('hoAlert'); return a && a.classList.contains('show') ? a.innerText : ''; }); if (a2) break; await sleep(100); }
  check('closer: appointment handoff alert within 2 s, says the appointment time', a2.includes(lead2.name) && /Appointment /.test(a2) && Date.now() - sent2 < 2500, a2);
  check('closer: appointment alert offers Got it', await sam.evaluate(() => document.getElementById('hoAlertGo').textContent) === 'Got it');
  await sam.click('#hoAlertLater'); await sam.waitForTimeout(300);
  check('closer: Later closes it, still unopened', await sam.evaluate(id => !document.getElementById('hoAlert').classList.contains('show') && !window.__ho.lead(id).handoff.seen, lead2.id));
  // Sam is mid-call on the first lead; after logging it the pill is there
  await sam.reload(); await sam.waitForTimeout(2800);
  check('closer: a dismissed alert doesn\'t come back on reload', !(await sam.evaluate(() => { const a = document.getElementById('hoAlert'); return !!(a && a.classList.contains('show')); })));
  check('closer: the "New handoff" pill is still on the dial screen', await sam.evaluate(n => [...document.querySelectorAll('.need-pill')].some(p => /New handoff/.test(p.textContent) && p.textContent.includes(n)), lead2.name.split(' ')[0]));

  // 8. Escape closes an alert (keyboard)
  await sam.evaluate(id => window.__ho.alert(id), lead2.id); await sam.waitForTimeout(100);
  check('closer: the alert can be brought up again', await sam.evaluate(() => document.getElementById('hoAlert').classList.contains('show')));
  await sam.keyboard.press('Escape'); await sam.waitForTimeout(100);
  check('closer: Escape closes the alert', !(await sam.evaluate(() => document.getElementById('hoAlert').classList.contains('show'))));

  // 9. regression: a Qualify sheet never writes to the previous sheet's lead
  const ids = await mia.evaluate(() => window.__ho.pending().slice(3, 5));
  const before = await mia.evaluate(id => JSON.stringify(window.__ho.lead(id).qf || {}), ids[0]);
  await mia.evaluate(id => window.__ho.qualify(id), ids[0]); await mia.waitForTimeout(150); await mia.evaluate(() => window.__ho.closeSheet());
  await mia.evaluate(id => window.__ho.qualify(id), ids[1]); await mia.waitForTimeout(150);
  await mia.evaluate(() => document.querySelector('#featModalBody .qf-opt:not(.on)').click()); await mia.waitForTimeout(100);
  check('Qualify: an answer for one lead leaves the last lead\'s answers alone', await mia.evaluate(id => JSON.stringify(window.__ho.lead(id).qf || {}), ids[0]) === before);

  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('closer_handoff: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
