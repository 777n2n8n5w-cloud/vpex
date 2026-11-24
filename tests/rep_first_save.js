// VPEX regression check (rep_first_save): a rep's FIRST save of each kind reaches the database.
// From Nov 15 to Nov 24 no rep's call was saved: to add a call to the hour's record the app tried "update", and made the
// record only if the database said "not found". For a rep the database says "permission denied" instead (the rep's rule
// reads the old record, and there isn't one), so the record was never made and every call was refused. Admins'
// calls saved, so it went unseen. The same hit the rep's own record (leads they add, their settings) and the day's
// "on a call" record when a rep was first on a call that day. The in-page test database now answers like the real one.
// For a team at the top level (Vincent's) and an office, with no records yet for the day or the rep:
//  - the rep's first call (outcome logged) is in the database, under the rep, and the admin's Live rep tracker counts it
//  - the rep shows "on a call" for the admin while dialing (the day's first "on a call" record is the rep's)
//  - a number the rep dials by hand and saves as a lead is in the database (the rep's own record is made)
//  - the rep's settings (Manual dial) are saved with their login
//  - a second call in the same hour is added to the same record (not refused, not replacing the first)
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/rep_first_save.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (process.env.VERBOSE) console.log(ok ? 'ok  ' : 'FAIL', n); if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 600)); } };
const T0 = new Date('2026-11-24T11:30:00-05:00').getTime();
const LEADS = {}; for (let i = 1; i <= 12; i++) LEADS['L' + i] = { name: 'Lead Number' + i, phone: '732555' + String(1000 + i), status: 'pending', seq: i };
const SETUPS = [
  { tag: 'top-level team', pre: '', rep: { uid: 'w1', email: 'will@dovetail-f863c.firebaseapp.com' }, admin: { uid: 'v1', email: 'vince@dovetail-f863c.firebaseapp.com' } },
  { tag: 'office', pre: 'offices/acme/', rep: { uid: 'w1', email: 'will@acme.vpex.app' }, admin: { uid: 'v1', email: 'boss@acme.vpex.app' } },
];
const ev = (p, f, a) => p.evaluate(f, a);

(async () => {
  const br = await chromium.launch();
  const errs = [];
  for (const S of SETUPS) {
    const db = {};
    if (S.pre) db['offices/acme'] = { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: T0 + 5 * 864e5, ownerUid: 'v1', createdAt: T0 - 864e5, invite: 'abc123xyz', locked: false };
    db[S.pre + 'members/v1'] = { username: 'vince', name: 'Vince Admin', role: 'admin', active: true, lastSeen: T0 };
    db[S.pre + 'members/w1'] = { username: 'will', name: 'Will Rep', role: 'rep', active: true, lastSeen: T0 };
    db[S.pre + 'leadChunks/_team'] = { roster: [{ uid: 'v1', name: 'Vince Admin', role: 'admin', active: true }, { uid: 'w1', name: 'Will Rep', role: 'rep', active: true }] };
    db[S.pre + 'leadChunks/c001'] = { leads: JSON.parse(JSON.stringify(LEADS)) };
    const ctx = await br.newContext({ timezoneId: 'America/New_York' });
    await ctx.clock.install({ time: T0 });
    const boot = await ctx.newPage(); await boot.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await boot.goto(BASE + '#mockbench'); await boot.waitForTimeout(300);
    await ev(boot, ([db, S]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      const a = {}; a[S.rep.email] = { uid: 'w1', pw: 'testpass1' }; a[S.admin.email] = { uid: 'v1', pw: 'testpass1' }; localStorage.setItem('__mockauth', JSON.stringify(a));
      if (S.pre) localStorage.setItem('vpex_office', 'acme'); }, [db, S]);
    await boot.close();
    const open = async (who, w, tag) => { const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: w < 500 ? 844 : 900 });
      p.on('pageerror', e => errs.push(tag + ': ' + e.message));
      await p.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
      await p.addInitScript(([who]) => { sessionStorage.setItem('__mocksess', JSON.stringify(who));
        window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) e.preventDefault(); }, true); }, [who]);
      await p.goto(BASE + (S.pre ? '?o=acme' : '')); await p.waitForTimeout(2800); return p; };
    const server = p => ev(p, pre => { const fs = JSON.parse(localStorage.getItem('__mockfs')); const k = Object.keys(fs);
      const callDocs = k.filter(x => x.indexOf(pre + 'callDays/') === 0 && /_w1_\d\d$/.test(x));
      const calls = callDocs.reduce((a, x) => a.concat(Object.values(fs[x].calls || {})), []);
      const act = k.filter(x => x.indexOf(pre + 'callDays/act_') === 0).map(x => fs[x]);
      const own = fs[pre + 'leadChunks/r_w1'] || null;
      return { calls: calls.map(c => c.outcomeKey + '@' + (c.by && c.by.uid)), docs: callDocs.length, live: act.some(a => a.live && a.live.w1),
        ownLeads: own ? Object.values(own.leads || {}).map(l => l.name) : null, prefs: own && own.prefs ? own.prefs.manualDial : undefined }; }, S.pre);

    const rep = await open(S.rep, 390, S.tag + ' rep'), boss = await open(S.admin, 1366, S.tag + ' admin');
    await ev(boss, () => document.getElementById('adminBtn').click()); await boss.waitForTimeout(300);
    await ev(boss, () => document.getElementById('hubTrack').click()); await boss.waitForTimeout(400);
    // the first call of the day
    await ev(rep, () => document.getElementById('callBtn').click()); await rep.waitForTimeout(1500);
    const onCall = await ev(boss, () => { const r = document.querySelector('#rtBody [data-rt-uid="w1"]'); return r ? r.className : ''; });
    check(S.tag + ': the admin sees the rep on a call (the day\'s first "on a call" record is the rep\'s)', /st-call/.test(onCall), { onCall, srv: await server(rep) });
    await ev(rep, () => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await rep.waitForTimeout(1500);
    let s = await server(rep);
    check(S.tag + ': the rep\'s first call is in the database, under the rep', JSON.stringify(s.calls) === '["noanswer@w1"]', s);
    const n = await ev(boss, () => { const b = document.querySelector('#rtBody [data-rt-uid="w1"] [data-rt-calls]'); return b ? +b.textContent : -1; });
    check(S.tag + ': the admin\'s Live rep tracker counts it', n === 1, n);
    const left = await ev(rep, () => { const k = Object.keys(localStorage).find(k => /^(vpex|dovetail)_team_w1/.test(k)); const st = k ? JSON.parse(localStorage.getItem(k)) : {}; return (st.pendingCalls || []).length; });
    check(S.tag + ': nothing left waiting on the rep\'s phone', left === 0, left);
    // a second call in the same hour joins the same record
    await rep.clock.fastForward(30000); await rep.waitForTimeout(200);
    await ev(rep, () => document.getElementById('callBtn').click()); await rep.waitForTimeout(400);
    await ev(rep, () => document.querySelector('.out-btn[data-outcome="voicemail"]').click()); await rep.waitForTimeout(1500);
    s = await server(rep);
    check(S.tag + ': a second call that hour is added to the same record', s.calls.length === 2 && s.calls.includes('voicemail@w1') && s.docs === 1, s);
    // Manual dial: a new number, saved as a lead (the rep's own record is made), and the setting is saved with the login
    await rep.clock.fastForward(30000); await rep.waitForTimeout(200);
    await ev(rep, () => document.getElementById('mdToggle').click()); await rep.waitForTimeout(300);
    for (const k of '7325550199') await ev(rep, k => document.querySelector('[data-k="' + k + '"]').click(), k);
    await ev(rep, () => document.querySelector('#kpGo a').click()); await rep.waitForTimeout(700);
    await rep.fill('#kpName', 'Pat Newlead'); await ev(rep, () => document.getElementById('kpSave').click()); await rep.waitForTimeout(500);
    await ev(rep, () => document.querySelector('.out-btn[data-outcome="interested"]') && document.querySelector('.out-btn[data-outcome="interested"]').click()); await rep.waitForTimeout(400);
    await ev(rep, () => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); }); await rep.waitForTimeout(3000);
    s = await server(rep);
    check(S.tag + ': a lead the rep adds is in the database (the rep\'s own record was made)', !!s.ownLeads && s.ownLeads.includes('Pat Newlead'), s);
    check(S.tag + ': and its call too', s.calls.length === 3, s);
    check(S.tag + ': the rep\'s settings are saved with their login (Manual dial on)', s.prefs === true, s);
    // what the admin sees about the rep's phone
    await boss.waitForTimeout(3500);
    const row = () => ev(boss, () => { let r = document.querySelector('#rtBody [data-rt-uid="w1"]'); if (!r) return null; const t = r.querySelector('[data-rt-toggle]'); if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
      r = document.querySelector('#rtBody [data-rt-uid="w1"]');   // the row is drawn again when it opens
      return { flags: [...r.querySelectorAll('.rt-flag')].map(f => f.textContent), detail: (r.querySelector('.rt-detail') || {}).innerText || '' }; });
    await boss.waitForTimeout(200);
    let rw = await row();
    check(S.tag + ': the admin sees the rep\'s phone is saving and on the current app', rw && /All saved/.test(rw.detail) && /app 20\d\d-\d\d-\d\d/.test(rw.detail) && !rw.flags.some(f => /not saved|app/i.test(f)), rw);
    // the server refuses the rep's calls (what happened Nov 15-24): the admin is told
    await ev(rep, () => { window.__mockDeny = 'callDays/\\d{4}-\\d\\d-\\d\\d_w1_'; });
    await rep.clock.fastForward(30000); await rep.waitForTimeout(200);
    await ev(rep, () => { const b = document.querySelector('#viewTabs [data-view="dial"]'); b && b.click(); }); await rep.waitForTimeout(300);
    await ev(rep, () => { const t = document.getElementById('mdToggle'); if (t && t.getAttribute('aria-checked') === 'true') t.click(); }); await rep.waitForTimeout(300);
    await ev(rep, () => document.getElementById('callBtn').click()); await rep.waitForTimeout(400);
    await ev(rep, () => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await rep.waitForTimeout(5000);
    await boss.waitForTimeout(1500); rw = await row();
    check(S.tag + ': a rep whose calls the server refuses: the admin sees "1 call not saved yet on their phone"', rw && rw.flags.some(f => /^1 call not saved yet on their phone$/.test(f)), rw);
    await ev(rep, () => { window.__mockDeny = ''; }); await rep.clock.fastForward(70000); await rep.waitForTimeout(5000); await boss.waitForTimeout(1500);   // the next try, a minute later
    rw = await row();
    check(S.tag + ': once it\'s saved, the warning goes away by itself', rw && !rw.flags.some(f => /not saved/.test(f)) && /All saved/.test(rw.detail), rw);
    // a rep on an old version of the app: online, but their phone sends no report
    await rep.close();
    await ev(boss, ([pre]) => { const fs = JSON.parse(localStorage.getItem('__mockfs')); const k = Object.keys(fs).find(x => x.indexOf(pre + 'callDays/act_') === 0);
      if (k && fs[k].live && fs[k].live.w1) delete fs[k].live.w1.h; fs[pre + 'members/w1'].lastSeen = Date.now(); localStorage.setItem('__mockfs', JSON.stringify(fs)); }, [S.pre]);
    await boss.reload(); await boss.waitForTimeout(2800);
    await ev(boss, () => document.getElementById('adminBtn').click()); await boss.waitForTimeout(300);
    await ev(boss, () => document.getElementById('hubTrack').click()); await boss.waitForTimeout(500);
    rw = await row();
    check(S.tag + ': an online rep whose phone runs an old app is flagged "Needs the app update"', rw && rw.flags.some(f => /Needs the app update/.test(f)), rw);
    await ctx.close();
  }
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('rep_first_save: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
