// VPEX regression check (rep_persist): a rep's work is saved for them, everywhere.
// Sam (a rep) works his list on his phone: two calls with outcomes, moves a lead to Pitched with notes, adds a follow-up.
// Then nothing of it may be lost:
//  1. Reload the phone: everything is there.
//  2. A brand-new device (nothing saved in the browser, only what's in the office database): Sam signs in, everything is there.
//  3. The next morning on that device: yesterday's calls are in the lead's history, the follow-up is due, the stage holds.
//  4. The admin sees Sam's calls in the Live rep tracker, his lead at Pitched with the notes, the follow-up is Sam's.
//  5. Mia (another rep) working at the same time doesn't overwrite any of it.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/rep_persist.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (process.env.VERBOSE) console.log(ok ? 'ok  ' : 'FAIL', n); if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 600)); } };
const T0 = new Date('2026-11-04T11:30:00-05:00').getTime();   // a Wednesday, inside calling hours
const LEADS = {}; for (let i = 1; i <= 12; i++) LEADS['L' + i] = { name: 'Lead Number' + i, phone: '732555' + String(1000 + i), status: 'pending', seq: i, owner: i % 2 ? { uid: 'r1', name: 'Sam Rep' } : { uid: 'r2', name: 'Mia Chen' } };
const db0 = () => ({
  'offices/acme': { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: T0 + 5 * 864e5, ownerUid: 'a1', createdAt: T0 - 864e5, invite: 'abc123xyz', locked: false },
  'offices/acme/members/a1': { username: 'boss', name: 'Dana Cruz', role: 'admin', active: true, lastSeen: T0 },
  'offices/acme/members/r1': { username: 'sam', name: 'Sam Rep', role: 'rep', active: true, lastSeen: T0 },
  'offices/acme/members/r2': { username: 'mia', name: 'Mia Chen', role: 'rep', active: true, lastSeen: T0 },
  'offices/acme/leadChunks/_team': { roster: [{ uid: 'a1', name: 'Dana Cruz', role: 'admin', active: true }, { uid: 'r1', name: 'Sam Rep', role: 'rep', active: true }, { uid: 'r2', name: 'Mia Chen', role: 'rep', active: true }] },
  'offices/acme/leadChunks/c001': { leads: JSON.parse(JSON.stringify(LEADS)) },
});
const AUTH = { 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'sam@acme.vpex.app': { uid: 'r1', pw: 'testpass1' }, 'mia@acme.vpex.app': { uid: 'r2', pw: 'testpass1' } };
const ev = (p, f, a) => p.evaluate(f, a);

(async () => {
  const br = await chromium.launch();
  const errs = [];
  async function device(time, db) {   // a browser of its own: its own storage, its own clock; db = the office database it starts from
    const ctx = await br.newContext({ timezoneId: 'America/New_York' });
    await ctx.clock.install({ time });
    const boot = await ctx.newPage(); await boot.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await boot.goto(BASE + '#mockbench'); await boot.waitForTimeout(300);
    await ev(boot, ([db, auth]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth)); localStorage.setItem('vpex_office', 'acme'); }, [db, AUTH]);
    await boot.close();
    return ctx;
  }
  async function signIn(ctx, uid, email, w, tag) {
    const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
    p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await p.addInitScript(([uid, email]) => { sessionStorage.setItem('__mocksess', JSON.stringify({ uid, email }));
      window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }, true); }, [uid, email]);
    await p.goto(BASE + '?o=acme'); await p.waitForTimeout(2800);
    return p;
  }
  const snap = p => ev(p, () => {   // what this screen has for Sam
    const calls = window.__mockCallLog().filter(c => c[3] === 'r1');
    const full = id => (window.__mockLeadFull(id) || [])[0] || null;
    return { calls: calls.length, callIds: calls.map(c => c[0]).sort(), leads: window.__mockLeads().length };
  });

  // ---- Sam works his list on his phone ----
  const A = await device(T0, db0());
  const sam = await signIn(A, 'r1', 'sam@acme.vpex.app', 390, 'sam');
  const curId = () => ev(sam, () => { const n = document.querySelector('.lead-name'); const l = n && window.__mockLeadFull(n.textContent.trim())[0]; return l ? l.id : null; });
  const called = [];
  for (const oc of ['noanswer', 'voicemail']) {
    const id = await curId(); called.push(id);
    await ev(sam, () => document.getElementById('callBtn').click()); await sam.waitForTimeout(400);
    await ev(sam, k => document.querySelector('.out-btn[data-outcome="' + k + '"]').click(), oc); await sam.waitForTimeout(500);
    await sam.clock.fastForward(30000); await sam.waitForTimeout(300);
  }
  check('Sam: two calls logged on his phone', (await snap(sam)).calls === 2, await snap(sam));
  // the lead on the card now: move it to Pitched and write notes
  const pid = await curId();
  await ev(sam, () => { const s = document.getElementById('leadStageSelect'); s.value = 'Pitched'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sam.waitForTimeout(300);
  await sam.click('#leadNotesInput'); await sam.keyboard.type('Wants IUL quote, spouse on the call next time');
  await sam.waitForTimeout(400);
  await ev(sam, () => { const b = document.querySelector('#viewTabs [data-view="tasks"]'); b && b.click(); }); await sam.waitForTimeout(400);
  // a follow-up for tomorrow on the Pitched lead
  await ev(sam, () => document.getElementById('addTaskBtn').click()); await sam.waitForTimeout(300);
  await ev(sam, id => { const s = document.getElementById('taskLeadSelect'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true }));
    const d = document.getElementById('taskDueInput'); d.value = '2026-11-05'; d.dispatchEvent(new Event('input', { bubbles: true })); d.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('taskNoteInput').value = 'Send IUL quote';
    document.getElementById('submitTask').click(); }, pid);
  await sam.waitForTimeout(2500);   // saves go out

  const lead = (p, id) => ev(p, id => (window.__mockLeadFull(id) || [])[0] || null, id);
  const task = p => ev(p, () => { const t = (window.__mockTasks ? window.__mockTasks() : []).filter(x => x.note === 'Send IUL quote'); return t[0] || null; });
  const s0 = await snap(sam), l0 = await lead(sam, pid);
  check('Sam: lead moved to Pitched with notes', l0 && l0.stage === 'Pitched' && /Wants IUL quote/.test(l0.notes || ''), l0 && { stage: l0.stage, notes: l0.notes });
  const t0 = await task(sam);
  check('Sam: follow-up saved, his, due tomorrow', t0 && t0.leadId === pid && t0.due === '2026-11-05' && (!t0.assignee || t0.assignee.uid === 'r1'), t0);
  const leadCalls = id => ev(sam, id => window.__mockCallsFor(id).map(c => c.outcomeKey), id);
  check('Sam: each called lead shows its call and outcome', JSON.stringify(await leadCalls(called[0])) === '["noanswer"]' && JSON.stringify(await leadCalls(called[1])) === '["voicemail"]', [await leadCalls(called[0]), await leadCalls(called[1])]);

  // ---- 5. Mia works at the same time (other leads, same records) ----
  const mia = await signIn(A, 'r2', 'mia@acme.vpex.app', 1280, 'mia');
  const miaCur = await ev(mia, () => { const n = document.querySelector('.lead-name'); return n ? window.__mockLeadFull(n.textContent.trim())[0].id : null; });
  await ev(mia, () => document.getElementById('callBtn').click()); await mia.waitForTimeout(400);
  await ev(mia, () => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await mia.waitForTimeout(400);
  await ev(mia, () => { const s = document.getElementById('leadStageSelect'); if (s) { s.value = 'Qualified'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
  await mia.waitForTimeout(2500);
  const lm = await lead(sam, pid);
  check('Mia\'s work doesn\'t touch Sam\'s lead (stage and notes hold on Sam\'s phone)', lm && lm.stage === 'Pitched' && /Wants IUL quote/.test(lm.notes || ''), lm && { stage: lm.stage, notes: lm.notes, miaCur });

  // ---- 1. reload the phone ----
  await sam.reload(); await sam.waitForTimeout(2800);
  const s1 = await snap(sam), l1 = await lead(sam, pid), t1 = await task(sam);
  check('reload: Sam\'s calls are all there', s1.calls === 2 && JSON.stringify(s1.callIds) === JSON.stringify(s0.callIds), { s0, s1 });
  check('reload: stage, stage history and notes are there', l1 && l1.stage === 'Pitched' && (l1.stageLog || []).some(x => x.s === 'Pitched') && /Wants IUL quote/.test(l1.notes || ''), l1 && { stage: l1.stage, notes: l1.notes });
  check('reload: the follow-up is there', !!t1 && t1.leadId === pid, t1);

  // ---- 2 + 3. a brand-new device the next morning: only the office database ----
  const server = await ev(sam, () => JSON.parse(localStorage.getItem('__mockfs')));
  const B = await device(T0 + 864e5 - 2.5 * 3600e3, server);   // Thursday 9:00 AM
  const sam2 = await signIn(B, 'r1', 'sam@acme.vpex.app', 1366, 'sam2');
  const local = await ev(sam2, () => Object.keys(localStorage).filter(k => !/^(__mock|vpex_mockbench|vpex_office)/.test(k)).length);
  const l2 = await lead(sam2, pid);
  check('new device: Sam\'s lead is at Pitched with his notes', l2 && l2.stage === 'Pitched' && /Wants IUL quote/.test(l2.notes || ''), l2 && { stage: l2.stage, notes: l2.notes, local });
  const t2 = await ev(sam2, () => { const t = (window.__mockTasks ? window.__mockTasks() : []).filter(x => x.note === 'Send IUL quote'); return t[0] || null; });
  check('new device: the follow-up is there and due today', !!t2 && t2.leadId === pid && t2.due === '2026-11-05' && !t2.done, t2);
  const hist = await ev(sam2, ids => ids.map(id => window.__mockCallsFor(id).map(c => c.outcomeKey + '@' + (c.by && c.by.uid))), called);
  check('new device, next day: yesterday\'s calls are in each lead\'s history, with the outcome and that Sam made them', JSON.stringify(hist) === '[["noanswer@r1"],["voicemail@r1"]]', hist);
  const tasksTab = await ev(sam2, () => { const b = document.querySelector('#viewTabs [data-view="tasks"]'); b && b.click(); return new Promise(r => setTimeout(() => r(document.getElementById('mainArea').innerText), 400)); });
  check('new device: the Tasks tab lists the follow-up', /Send IUL quote/.test(tasksTab), tasksTab.slice(0, 300));

  // ---- 6. a shared office computer: Sam signs out, Mia signs in on the same browser, then Sam comes back ----
  await sam2.waitForTimeout(1500);
  const signOut = async p => { await ev(p, () => { document.getElementById('signOutBtn').click(); }); await p.waitForTimeout(200);
    await ev(p, () => document.getElementById('confirmOkBtn').click()); await p.waitForTimeout(1200); };
  const signInForm = async (p, user) => { await p.fill('#authUser', user); await p.fill('#authPw', 'testpass1'); await ev(p, () => document.getElementById('authGo').click()); await p.waitForTimeout(3200); };
  await signOut(sam2);
  const afterOut = await ev(sam2, () => ({ form: getComputedStyle(document.getElementById('authForm')).display !== 'none' && !!document.getElementById('authForm').offsetParent,
    leads: window.__mockLeads().length, tasks: window.__mockTasks().length, calls: window.__mockCallLog().length,
    left: Object.keys(localStorage).filter(k => { try { return /Send IUL quote|Wants IUL quote/.test(localStorage.getItem(k)) && !/^__mock/.test(k); } catch (e) { return false; } }) }));
  check('shared computer: after Sam signs out, the sign-in form shows and none of his data is left in the app or the browser', afterOut.form && !afterOut.leads && !afterOut.tasks && !afterOut.calls && !afterOut.left.length, afterOut);
  await signInForm(sam2, 'mia');
  const miaV = await ev(sam2, () => { const b = document.querySelector('#viewTabs [data-view="tasks"]'); b && b.click(); return new Promise(r => setTimeout(() => r({ uid: (JSON.parse(sessionStorage.getItem('__mocksess') || '{}') || {}).uid, tab: document.getElementById('mainArea').innerText }), 500)); });
  check('shared computer: Mia signs in and gets her own screen (Sam\'s follow-up isn\'t in her Tasks)', miaV.uid === 'r2' && !/Send IUL quote/.test(miaV.tab) && miaV.tab.length > 0, { uid: miaV.uid, tab: miaV.tab.slice(0, 300) });
  await signOut(sam2);
  await signInForm(sam2, 'sam');
  const back = await ev(sam2, ([pid, called]) => { const l = (window.__mockLeadFull(pid) || [])[0] || {};
    return { stage: l.stage, notes: l.notes, task: window.__mockTasks().filter(t => t.note === 'Send IUL quote').length, hist: called.map(id => window.__mockCallsFor(id).map(c => c.outcomeKey + '@' + (c.by && c.by.uid))) }; }, [pid, called]);
  check('shared computer: Sam signs back in and everything is there (stage, notes, follow-up, call history)', back.stage === 'Pitched' && /Wants IUL quote/.test(back.notes || '') && back.task === 1 && JSON.stringify(back.hist) === '[["noanswer@r1"],["voicemail@r1"]]', back);

  // ---- 4. the admin sees it ----
  const boss = await signIn(A, 'a1', 'boss@acme.vpex.app', 1366, 'boss');
  const lb = await lead(boss, pid);
  check('admin: Sam\'s lead at Pitched with his notes', lb && lb.stage === 'Pitched' && /Wants IUL quote/.test(lb.notes || ''), lb && { stage: lb.stage, notes: lb.notes });
  await ev(boss, () => document.getElementById('adminBtn').click()); await boss.waitForTimeout(300);
  await ev(boss, () => document.getElementById('hubTrack').click()); await boss.waitForTimeout(500);
  const rt = await ev(boss, () => { const r = document.querySelector('#rtBody [data-rt-uid="r1"] [data-rt-calls]'); const m = document.querySelector('#rtBody [data-rt-uid="r2"] [data-rt-calls]'); return { sam: r ? +r.textContent : -1, mia: m ? +m.textContent : -1 }; });
  check('admin: Live rep tracker counts Sam\'s 2 calls and Mia\'s 1', rt.sam === 2 && rt.mia === 1, rt);
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('rep_persist: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
