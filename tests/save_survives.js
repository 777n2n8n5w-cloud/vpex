// VPEX regression check (save_survives): a rep's work is never lost when the app closes before the server answers.
// Reps reported call history not saving. For team logins the phone kept no copy of its own unsaved work: a call, a
// pipeline move, notes or a follow-up handed to the database was counted as saved at once, and only the database's
// offline copy held it until the server answered. When that copy isn't working on a phone (it can fail without a word),
// closing the app, the phone freezing it, or a dead signal lost the work, and the next open showed the server's older
// copy. Now the app keeps its own list of unconfirmed work on the phone, crosses each item off only when the server
// confirms it, and sends what's left on every start.
// This test's in-page database keeps nothing it hasn't answered, like a phone whose offline copy failed. For each case
// Sam calls a lead (outcome logged), moves another lead to Pitched with notes, and books a follow-up, then:
//  A. slow server: the app is closed before the server answers
//  B. no signal: the work is done offline and the app is closed, then opened again with signal
//  C. no signal, closed and reopened still offline: the work is on screen; signal comes back: it lands
// After it reopens, all of it must be on screen right away, reach the server, and still be there on a brand-new device.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/save_survives.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (process.env.VERBOSE) console.log(ok ? 'ok  ' : 'FAIL', n); if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 700)); } };
const T0 = new Date('2026-11-04T11:30:00-05:00').getTime();
const LEADS = {}; for (let i = 1; i <= 12; i++) LEADS['L' + i] = { name: 'Lead Number' + i, phone: '732555' + String(1000 + i), status: 'pending', seq: i };
const db0 = () => ({
  'offices/acme': { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: T0 + 5 * 864e5, ownerUid: 'a1', createdAt: T0 - 864e5, invite: 'abc123xyz', locked: false },
  'offices/acme/members/a1': { username: 'boss', name: 'Dana Cruz', role: 'admin', active: true, lastSeen: T0 },
  'offices/acme/members/r1': { username: 'sam', name: 'Sam Rep', role: 'rep', active: true, lastSeen: T0 },
  'offices/acme/leadChunks/_team': { roster: [{ uid: 'a1', name: 'Dana Cruz', role: 'admin', active: true }, { uid: 'r1', name: 'Sam Rep', role: 'rep', active: true }] },
  'offices/acme/leadChunks/c001': { leads: JSON.parse(JSON.stringify(LEADS)) },
});
const AUTH = { 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'sam@acme.vpex.app': { uid: 'r1', pw: 'testpass1' } };
const ev = (p, f, a) => p.evaluate(f, a);

(async () => {
  const br = await chromium.launch();
  const errs = [];
  async function device(db) {
    const ctx = await br.newContext({ timezoneId: 'America/New_York' });
    await ctx.clock.install({ time: T0 });
    const boot = await ctx.newPage(); await boot.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await boot.goto(BASE + '#mockbench'); await boot.waitForTimeout(300);
    await ev(boot, ([db, auth]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth)); localStorage.setItem('vpex_office', 'acme'); }, [db, AUTH]);
    await boot.close(); return ctx;
  }
  async function open(ctx, tag, offline) {
    const p = await ctx.newPage(); await p.setViewportSize({ width: 390, height: 844 });
    p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await p.addInitScript(([off]) => { sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'r1', email: 'sam@acme.vpex.app' }));
      if (off) window.__offline = true;
      window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }, true); }, [offline]);
    await p.goto(BASE + '?o=acme'); await p.waitForTimeout(2800);
    return p;
  }
  const curId = p => ev(p, () => { const n = document.querySelector('.lead-name'); const l = n && window.__mockLeadFull(n.textContent.trim())[0]; return l ? l.id : null; });
  async function work(p, tag) {   // a call, a pipeline move with notes, a follow-up
    const called = await curId(p);
    await ev(p, () => document.getElementById('callBtn').click()); await p.waitForTimeout(400);
    await ev(p, () => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await p.waitForTimeout(500);
    await p.clock.fastForward(30000); await p.waitForTimeout(200);
    const pid = await curId(p);
    await ev(p, () => { const s = document.getElementById('leadStageSelect'); s.value = 'Pitched'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(200);
    await p.click('#leadNotesInput'); await p.keyboard.type('Notes ' + tag); await ev(p, () => document.getElementById('leadNotesInput').blur());
    await p.waitForTimeout(300);
    await ev(p, () => document.querySelector('#viewTabs [data-view="tasks"]').click()); await p.waitForTimeout(300);
    await ev(p, () => document.getElementById('addTaskBtn').click()); await p.waitForTimeout(300);
    await ev(p, ([id, tag]) => { const s = document.getElementById('taskLeadSelect'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true }));
      const d = document.getElementById('taskDueInput'); d.value = '2026-11-05'; d.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('taskNoteInput').value = 'Follow up ' + tag; document.getElementById('submitTask').click(); }, [pid, tag]);
    await p.waitForTimeout(700);
    await ev(p, () => document.querySelector('#viewTabs [data-view="dial"]').click()); await p.waitForTimeout(200);
    return { called, pid };
  }
  const onScreen = (p, w, tag) => ev(p, ([w, tag]) => {
    const l = (window.__mockLeadFull(w.pid) || [])[0] || {};
    return { call: window.__mockCallsFor(w.called).map(c => c.outcomeKey).join(','), stage: l.stage, notes: l.notes || '',
      task: window.__mockTasks().some(t => t.note === 'Follow up ' + tag && t.leadId === w.pid) };
  }, [w, tag]);
  const onServer = (p, w, tag) => ev(p, ([w, tag]) => {
    const fs = JSON.parse(localStorage.getItem('__mockfs'));
    const calls = Object.keys(fs).filter(k => /\/callDays\/\d{4}-\d\d-\d\d_r1_\d\d$/.test(k)).reduce((a, k) => a.concat(Object.values(fs[k].calls || {})), []);
    let lead = null; Object.keys(fs).filter(k => /leadChunks\/(c\d+|r_r1)$/.test(k)).forEach(k => { const L = (fs[k].leads || {})[w.pid]; if (L) lead = L; });
    return { call: calls.filter(c => c.leadId === w.called).map(c => c.outcomeKey).join(','), stage: lead && lead.stage, notes: lead && lead.notes || '',
      task: !!(lead && (lead.tasks || []).some(t => t.note === 'Follow up ' + tag)) };
  }, [w, tag]);
  const good = (s, tag) => s.call === 'noanswer' && s.stage === 'Pitched' && s.notes.indexOf('Notes ' + tag) >= 0 && s.task;

  for (const [tag, mode] of [['A', 'slow'], ['B', 'offline'], ['C', 'offline-twice']]) {
    const ctx = await device(db0());
    let p = await open(ctx, tag + '1', mode !== 'slow');
    if (mode === 'slow') await ev(p, () => { window.__mockLatency = 600000; });   // the server never answers before the app closes
    const w = await work(p, tag);
    check(tag + ' (' + mode + '): before closing, the work is on screen', good(await onScreen(p, w, tag), tag), await onScreen(p, w, tag));
    const before = await onServer(p, w, tag);
    check(tag + ' (' + mode + '): and the server doesn\'t have it yet (the case being tested)', !before.call && before.stage !== 'Pitched', before);
    await p.close();   // the app is closed / killed
    if (mode === 'offline-twice') {
      p = await open(ctx, tag + '2', true);
      check(tag + ': reopened still offline: the work is on screen', good(await onScreen(p, w, tag), tag), await onScreen(p, w, tag));
      await ev(p, () => { window.__offline = false; window.dispatchEvent(new Event('online')); }); await p.waitForTimeout(3000);
    } else {
      p = await open(ctx, tag + '2', false);
      check(tag + ' (' + mode + '): reopened: the work is on screen at once', good(await onScreen(p, w, tag), tag), await onScreen(p, w, tag));
      await p.waitForTimeout(2500);
    }
    const srv = await onServer(p, w, tag);
    check(tag + ' (' + mode + '): it reached the server (call, Pitched, notes, follow-up)', good(srv, tag), srv);
    check(tag + ' (' + mode + '): the call is saved once, not twice', srv.call === 'noanswer', srv);
    const left = await ev(p, () => { const k = Object.keys(localStorage).find(k => /^(vpex|dovetail)_team_/.test(k) && !/signedout/.test(k)); const s = k ? JSON.parse(localStorage.getItem(k)) : {}; return { calls: (s.pendingCalls || []).length, leads: Object.keys(s.unsaved || {}).length }; });
    check(tag + ' (' + mode + '): once the server has it, nothing is left waiting on the phone', !left.calls && !left.leads, left);
    // a brand-new device sees all of it
    const fsNow = await ev(p, () => JSON.parse(localStorage.getItem('__mockfs')));
    await ctx.close();
    const ctx2 = await device(fsNow); const p2 = await open(ctx2, tag + '-new', false);
    check(tag + ' (' + mode + '): a brand-new device shows all of it', good(await onScreen(p2, w, tag), tag), await onScreen(p2, w, tag));
    await ctx2.close();
  }
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('save_survives: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
