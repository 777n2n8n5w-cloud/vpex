// VPEX regression check (rep_tracker): the Live rep tracker (Admin controls > Team > Live rep tracker).
//  - Who sees it: the admin and managers; a rep doesn't.
//  - Every state reads right: on a call (with whom, a running clock), dialing, online with no calls yet, offline, out of office;
//    a rep marked out who is dialing shows as dialing. "Needs you" flags and its count.
//  - Names are shown as text (a name can't run code).
//  - Live: a rep's dial shows within 1.5 s, and a keyboard user's focus stays on the same button through the redraw.
//  - Tap a rep: their day opens (aria-expanded); tap a lead in their latest calls: the lead opens, the tracker closes.
//  - Escape closes it and puts focus back on a visible control.
//  - Phone at 320 px: nothing runs off the side. Dark and light: text contrast at least 4.5.
//  - An office with no reps yet says how to add them.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/rep_tracker.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (process.env.VERBOSE) console.log(ok ? 'ok  ' : 'FAIL', n); if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 700)); } };
const T0 = new Date('2026-11-04T11:30:00-05:00').getTime();   // Wednesday 11:30 AM
const XSS = 'Rob <img src=x onerror="window.__x=1">';
const LEADS = {}; for (let i = 1; i <= 12; i++) LEADS['L' + i] = { name: 'Lead Number' + i, phone: '732555' + String(1000 + i), status: 'pending', seq: i };
const iso = ms => new Date(ms).toISOString(), day = '2026-11-04';
const calls = (uid, name, list) => { const out = {}; list.forEach(([min, k, lead], i) => { out[uid + 'c' + i] = { timestamp: iso(T0 - min * 60000), leadId: lead, name: LEADS[lead].name, outcomeKey: k, outcome: k, talk: 40, by: { uid, name } }; }); return out; };
const db0 = (reps) => {
  const db = {
    'offices/acme': { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: T0 + 5 * 864e5, ownerUid: 'a1', createdAt: T0 - 864e5, invite: 'abc123xyz', locked: false },
    'offices/acme/members/a1': { username: 'boss', name: 'Dana Cruz', role: 'admin', active: true, lastSeen: T0 },
    'offices/acme/leadChunks/c001': { leads: JSON.parse(JSON.stringify(LEADS)) },
  };
  const roster = [{ uid: 'a1', name: 'Dana Cruz', role: 'admin', active: true }];
  if (reps) {
    const M = [['r1', 'sam', 'Sam Rep', 'rep', T0, ''], ['r2', 'mia', 'Mia Chen', 'rep', T0, ''], ['m1', 'lee', 'Lee Park', 'manager', T0, ''],
      ['r4', 'rob', XSS, 'rep', T0, ''], ['r5', 'olu', 'Olu Bates', 'rep', T0 - 3600e3, 'out'], ['r6', 'kai', 'Kai West', 'rep', T0 - 2 * 3600e3, ''], ['r7', 'ivy', 'Ivy Lane', 'rep', T0, 'out']];
    M.forEach(([uid, u, name, role, seen, loc]) => { db['offices/acme/members/' + uid] = { username: u, name, role, active: true, lastSeen: seen, workLoc: loc }; roster.push({ uid, name, role, active: true }); });
    // Sam: 3 calls this morning, the last 3 minutes ago. Kai: calls at 9, offline since. Ivy: marked out, but dialing.
    db['offices/acme/callDays/2026-11-04_r1_16'] = { calls: calls('r1', 'Sam Rep', [[40, 'noanswer', 'L1'], [20, 'interested', 'L3'], [3, 'voicemail', 'L5']]) };
    db['offices/acme/callDays/2026-11-04_r6_14'] = { calls: calls('r6', 'Kai West', [[150, 'noanswer', 'L7'], [140, 'notinterested', 'L9']]) };
    db['offices/acme/callDays/2026-11-04_r7_16'] = { calls: calls('r7', 'Ivy Lane', [[2, 'noanswer', 'L11']]) };
    db['offices/acme/callDays/2026-11-04_r4_16'] = { calls: calls('r4', XSS, [[5, 'noanswer', 'L2']]) };
  }
  // the called leads are worked (so Call doesn't ask "call them again?")
  Object.keys(db).filter(k => /callDays\//.test(k)).forEach(k => Object.values(db[k].calls).forEach(c => { const L = db['offices/acme/leadChunks/c001'].leads[c.leadId]; L.status = 'done'; L.calledAt = c.timestamp; L.outcome = c.outcomeKey; L.owner = c.by; }));
  db['offices/acme/leadChunks/_team'] = { roster };
  return db;
};
const AUTH = { 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'sam@acme.vpex.app': { uid: 'r1', pw: 'testpass1' }, 'lee@acme.vpex.app': { uid: 'm1', pw: 'testpass1' } };
const ev = (p, f, a) => p.evaluate(f, a);
function contrast(a, b) {
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

(async () => {
  const br = await chromium.launch();
  const errs = [];
  async function office(db, scheme) {
    const ctx = await br.newContext({ timezoneId: 'America/New_York', colorScheme: scheme || 'light' });
    await ctx.clock.install({ time: T0 });
    const boot = await ctx.newPage(); await boot.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await boot.goto(BASE + '#mockbench'); await boot.waitForTimeout(300);
    await ev(boot, ([db, auth]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth)); localStorage.setItem('vpex_office', 'acme'); }, [db, AUTH]);
    await boot.close(); return ctx;
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
  const openRT = async p => { await ev(p, () => document.getElementById('adminBtn').click()); await p.waitForTimeout(300);
    const has = await ev(p, () => !!document.getElementById('hubTrack'));
    if (has) { await ev(p, () => document.getElementById('hubTrack').click()); await p.waitForTimeout(400); }
    return has; };
  const rows = p => ev(p, () => [...document.querySelectorAll('#rtBody .rt-rep')].map(r => ({ uid: r.getAttribute('data-rt-uid'), cls: r.className, name: r.querySelector('.rt-name').textContent,
    st: r.querySelector('.rt-st').textContent, n: +r.querySelector('[data-rt-calls]').textContent, flags: [...r.querySelectorAll('.rt-flag')].map(f => f.textContent) })));

  const A = await office(db0(true));
  // ---- who sees it ----
  const sam = await signIn(A, 'r1', 'sam@acme.vpex.app', 390, 'sam');
  check('a rep has no Admin controls, so no tracker', await ev(sam, () => { const b = document.getElementById('adminBtn'); return !b || !b.offsetParent; }) && !(await ev(sam, () => !!document.getElementById('rtModal'))));
  const lee = await signIn(A, 'm1', 'lee@acme.vpex.app', 1366, 'lee');
  check('a manager has the Live rep tracker', await openRT(lee));
  check('the manager\'s tracker lists the reps', (await rows(lee)).some(r => r.uid === 'r1'), await rows(lee));
  await lee.close();

  // ---- the admin ----
  const boss = await signIn(A, 'a1', 'boss@acme.vpex.app', 1366, 'boss');
  check('admin: the tracker opens', await openRT(boss));
  let R = await rows(boss); const by = uid => R.find(r => r.uid === uid) || {};
  check('Sam: dialing, 3 calls, last call 3 min ago', /^Dialing/.test(by('r1').st) && by('r1').n === 3 && /3 min ago/.test(by('r1').st), by('r1'));
  check('Mia: online, no calls yet, flagged after 10 AM on a weekday', /Online, no calls yet/.test(by('r2').st) && by('r2').flags.includes('No calls yet'), by('r2'));
  check('Kai: offline, last seen 2 h ago, his 2 calls count', /^Offline/.test(by('r6').st) && /2 h ago/.test(by('r6').st) && by('r6').n === 2, by('r6'));
  check('Olu: out of office, not flagged for no calls', /Out of office/.test(by('r5').st) && !by('r5').flags.includes('No calls yet'), by('r5'));
  check('Ivy: marked out but dialing shows as dialing', /^Dialing/.test(by('r7').st), by('r7'));
  check('the admin (no calls) stays out of the list; the manager is in it', !R.some(r => r.uid === 'a1') && R.some(r => r.uid === 'm1'), R.map(r => r.uid));
  check('a name with code in it shows as text and runs nothing', by('r4').name === XSS && !(await ev(boss, () => window.__x)), by('r4'));
  const tot = await ev(boss, () => +document.querySelector('#rtBody .rt-s.big b').textContent);
  check('floor total = sum of the reps', tot === R.reduce((n, r) => n + r.n, 0) && tot === 7, { tot });
  // Live sort: on a call first, then dialing, then idle...
  const rank = { 'st-call': 0, 'st-dial': 1, 'st-idle': 2, 'st-off': 3, 'st-out': 4, 'st-away': 5 }, ranks = R.map(r => rank[(r.cls.match(/st-\w+/) || [])[0]]);
  check('Live order: on a call, dialing, idle, offline, out, not on', ranks.every((v, i) => !i || v >= ranks[i - 1]), R.map(r => r.cls));
  // Needs you
  const needN = await ev(boss, () => { const c = document.querySelector('#rtBody [data-rt-sort="needs"] .chip-n'); return c ? +c.textContent : 0; });
  check('Needs you count = reps with a flag', needN === R.filter(r => r.flags.length).length && needN >= 1, { needN, flagged: R.filter(r => r.flags.length).map(r => r.uid) });
  await ev(boss, () => document.querySelector('#rtBody [data-rt-sort="needs"]').click()); await boss.waitForTimeout(200);
  const RN = await rows(boss);
  check('Needs you puts flagged reps first; the chip is pressed', RN[0].flags.length > 0 && await ev(boss, () => document.querySelector('#rtBody [data-rt-sort="needs"]').getAttribute('aria-pressed') === 'true'), RN.map(r => r.uid + ':' + r.flags.length));
  await ev(boss, () => document.querySelector('#rtBody [data-rt-sort="calls"]').click()); await boss.waitForTimeout(200);
  const RC = await rows(boss);
  check('Most calls: highest first', RC.every((r, i) => !i || r.n <= RC[i - 1].n), RC.map(r => r.n));
  await ev(boss, () => document.querySelector('#rtBody [data-rt-sort="live"]').click()); await boss.waitForTimeout(200);

  // ---- live + keyboard focus through the redraw ----
  await ev(boss, () => document.querySelector('#rtBody [data-rt-toggle="r2"]').focus());
  const samCur = await ev(sam, () => document.querySelector('.lead-name').textContent);
  await ev(sam, () => document.getElementById('callBtn').click());
  const t0 = Date.now(); let live = null;
  while (Date.now() - t0 < 3000) { live = (await rows(boss)).find(r => r.uid === 'r1'); if (live && /st-call/.test(live.cls)) break; await boss.waitForTimeout(100); }
  const ms = Date.now() - t0;
  check('Sam\'s dial shows within 1.5 s: on a call with the lead, 4 calls', live && /st-call/.test(live.cls) && live.n === 4 && live.st.indexOf('On a call with ' + samCur) === 0 && ms < 1500, { live, ms, samCur });
  check('the keyboard focus stayed on Mia\'s row through the redraw', await ev(boss, () => document.activeElement && document.activeElement.getAttribute('data-rt-toggle') === 'r2'));
  const c1 = await ev(boss, () => document.querySelector('#rtBody [data-rt-uid="r1"] time').textContent);
  await boss.clock.fastForward(3000); await boss.waitForTimeout(200);
  const c2 = await ev(boss, () => document.querySelector('#rtBody [data-rt-uid="r1"] time').textContent);
  check('the call clock runs', c1 !== c2, { c1, c2 });
  await ev(sam, () => document.querySelector('.out-btn[data-outcome="noanswer"]').click()); await sam.waitForTimeout(1500);
  live = (await rows(boss)).find(r => r.uid === 'r1');
  check('after the outcome: still 4 (not 5), back to dialing', live.n === 4 && /st-dial/.test(live.cls), live);

  // ---- a rep's day, and opening a lead ----
  await ev(boss, () => document.querySelector('#rtBody [data-rt-toggle="r1"]').click()); await boss.waitForTimeout(200);
  const det = await ev(boss, () => { const r = document.querySelector('#rtBody [data-rt-uid="r1"]'); return { exp: r.querySelector('[data-rt-toggle]').getAttribute('aria-expanded'), txt: r.querySelector('.rt-detail') ? r.querySelector('.rt-detail').innerText : '', n: r.querySelectorAll('.rt-recent li').length }; });
  check('tap Sam: his day opens (expanded, latest calls newest first, 4 of them)', det.exp === 'true' && det.n === 4 && /First call/.test(det.txt) && det.txt.indexOf('No answer') < det.txt.indexOf('Interested'), det);
  await ev(boss, () => document.querySelector('#rtBody [data-rt-uid="r1"] .rt-lead').click()); await boss.waitForTimeout(500);
  const lp = await ev(boss, () => ({ lead: document.getElementById('leadModal').classList.contains('show'), rt: document.getElementById('rtModal').classList.contains('show') }));
  check('tap a lead in his calls: the lead opens, the tracker closes', lp.lead && !lp.rt, lp);
  await ev(boss, () => document.getElementById('lpClose').click()); await boss.waitForTimeout(300);

  // ---- Escape and focus ----
  await openRT(boss);
  await boss.keyboard.press('Escape'); await boss.waitForTimeout(200);
  const af = await ev(boss, () => ({ open: document.getElementById('rtModal').classList.contains('show'), id: document.activeElement && document.activeElement.id, vis: !!(document.activeElement && document.activeElement.offsetParent) }));
  check('Escape closes it, focus lands on a visible control', !af.open && af.vis && af.id === 'adminBtn', af);

  // ---- phone 320 px, both themes ----
  for (const scheme of ['light', 'dark']) {
    const C = await office(db0(true), scheme);
    const ph = await signIn(C, 'a1', 'boss@acme.vpex.app', 320, 'ph-' + scheme);
    await openRT(ph);
    await ev(ph, () => document.querySelector('#rtBody [data-rt-toggle="r1"]').click()); await ph.waitForTimeout(200);
    const fit = await ev(ph, () => { const m = document.querySelector('#rtModal .rt-modal'); const over = [...m.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className).slice(0, 5);
      return { sw: document.documentElement.scrollWidth, vw: innerWidth, mw: m.scrollWidth, cw: m.clientWidth, over }; });
    check(scheme + ' 320 px: nothing runs off the side', fit.sw <= fit.vw && fit.mw <= fit.cw && !fit.over.length, fit);
    const cols = await ev(ph, () => { const bgOf = el => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/, 0\.\d+\)$/.test(c)) return c; el = el.parentElement; } return 'rgb(255,255,255)'; };
      return ['.rt-name', '.rt-st', '.rt-s span', '.rt-m', '.rt-recent time', '.rt-kv span'].map(sel => { const el = document.querySelector('#rtBody ' + sel); return el ? [sel, getComputedStyle(el).color, bgOf(el)] : [sel, null, null]; }); });
    const low = cols.filter(([s, c, b]) => c && contrast(c, b) < 4.5).map(([s, c, b]) => s + ' ' + contrast(c, b).toFixed(2));
    check(scheme + ': text contrast at least 4.5 (names, status, labels)', !low.length, low);
    await C.close();
  }

  // ---- an office with no reps yet ----
  const E = await office(db0(false));
  const solo = await signIn(E, 'a1', 'boss@acme.vpex.app', 390, 'solo');
  await openRT(solo);
  check('no reps yet: it says how to add them', /No reps yet\. Add them in Team & logins\./.test(await ev(solo, () => (document.getElementById('rtBody') || {}).innerText || '')), await ev(solo, () => (document.getElementById('rtBody') || {}).innerText));

  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('rep_tracker: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
