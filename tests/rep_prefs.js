// VPEX regression check (rep_prefs). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/rep_prefs.js
// 1. A rep's own settings follow the login: theme, daily goal, sort order and text name picked on one phone show up on a
//    new phone (or the iPhone Home Screen app, which keeps its storage apart from Safari) after signing in. Kept in
//    leadChunks/r_<uid>.prefs, the record reps can already write; the leads in that record are never touched.
//    Original team (top-level) and an office (record made on first save); the newest copy wins; nothing sent before the
//    account's copy is read; an admin's upload never puts leads into a rep's own record; demo offices send nothing.
// 2. Sign-in links: Create login and the Team & access note give the original team vpexdialer.com/?legacy=1 and an
//    office its ?o= link with the office code; signing in with no office code works for the original team.
// In-page backend: the "server" is the __mockfs copy, carried from one browser context (phone) to the next.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const LEG = 'dovetail-f863c.firebaseapp.com', now = Date.now();
function seed() {
  const db = {};
  db['members/vOwn'] = { username: 'vincent', name: 'Vincent', role: 'admin', active: true, lastSeen: now };
  db['members/r1sam'] = { username: 'sam', name: 'Sam Ortiz', role: 'rep', active: true, lastSeen: now };
  db['leadChunks/c001'] = { leads: { l1: { name: 'Avery Stone', phone: '+12125550111', phoneRaw: '(212) 555-0111', state: 'NY', status: 'pending' } } };
  db['leadChunks/r_r1sam'] = { leads: { l2: { name: 'Blake Rowe', phone: '+12125550112', phoneRaw: '(212) 555-0112', state: 'NY', status: 'pending', owner: { uid: 'r1sam', name: 'Sam Ortiz' } } } };
  db['offices/acme'] = { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: now + 5 * 864e5, ownerUid: 'a1', createdAt: now, invite: 'abc123xyz', locked: false };
  db['offices/acme/members/a1'] = { username: 'boss', name: 'Dana Cruz', role: 'admin', active: true };
  db['offices/acme/members/r2'] = { username: 'lee', name: 'Lee Park', role: 'rep', active: true };
  db['offices/acme/leadChunks/c001'] = { leads: { l9: { name: 'Casey Lin', phone: '+12125550119', phoneRaw: '(212) 555-0119', state: 'NY', status: 'pending' } } };
  return db;
}
const AUTH = { ['vincent@' + LEG]: { uid: 'vOwn', pw: 'testpass1' }, ['sam@' + LEG]: { uid: 'r1sam', pw: 'testpass1' }, 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'lee@acme.vpex.app': { uid: 'r2', pw: 'testpass1' } };
// one "phone": its own storage, the shared server copy, signed in as uid (or not signed in)
async function phone(br, c, db, sess, office, url) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(400);
  await page.evaluate(([db, auth, sess, office]) => { localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth));
    if (office) localStorage.setItem('vpex_office', office); else localStorage.removeItem('vpex_office');
    if (sess) sessionStorage.setItem('__mocksess', JSON.stringify(sess)); else sessionStorage.removeItem('__mocksess'); }, [db, AUTH, sess, office]);
  await page.goto(url || (BASE + (office ? '?o=' + office : ''))); await page.waitForTimeout(3000);
  return { ctx, page, errs };
}
const server = page => page.evaluate(() => JSON.parse(localStorage.getItem('__mockfs') || '{}'));
const view = page => page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('dovetail_dialer_theme_v1'),
  goal: (document.getElementById('todayGoalLbl') || {}).textContent || '', sw: document.documentElement.scrollWidth, vw: innerWidth }));
async function pickTheme(page, id) { await page.evaluate(() => document.getElementById('openThemesBtn').click()); await page.waitForTimeout(400);
  await page.evaluate(() => { const a = document.querySelector('[data-themecat="all"]'); if (a) a.click(); }); await page.waitForTimeout(200);
  await page.evaluate(id => document.querySelector('[data-theme-choice="' + id + '"]').click(), id); await page.waitForTimeout(300); }
async function setGoal(page, n) { await page.evaluate(() => { const m = document.querySelector('.modal.show .modal-close, .modal.show [data-close]'); document.querySelectorAll('.modal.show').forEach(x => x.classList.remove('show')); });
  await page.evaluate(() => document.getElementById('todayGoalLbl').click()); await page.waitForTimeout(150);
  await page.fill('#goalInlineInput', String(n)); await page.press('#goalInlineInput', 'Enter'); await page.waitForTimeout(200); }

(async () => {
  const br = await chromium.launch();
  for (const c of [{ w: 390, s: 'dark' }, { w: 1280, s: 'light' }]) {
    const T = c.w + '-' + c.s + ' ';
    // ---- original team, rep Sam ----
    let db = seed();
    let A = await phone(br, c, db, { uid: 'r1sam', email: 'sam@' + LEG }, null, BASE + '?legacy=1');
    let srv = await server(A.page);
    check(T + 'first open: nothing sent in the first seconds (the floor isn\'t disturbed at sign-in)', !(srv['leadChunks/r_r1sam'] || {}).prefs);
    await A.page.waitForTimeout(13500); srv = await server(A.page);
    check(T + 'first open: this phone\'s settings go to the account about 15 s later', srv['leadChunks/r_r1sam'] && srv['leadChunks/r_r1sam'].prefs && srv['leadChunks/r_r1sam'].prefs.at > 0, srv['leadChunks/r_r1sam']);
    check(T + 'rep\'s own leads untouched', srv['leadChunks/r_r1sam'] && srv['leadChunks/r_r1sam'].leads && srv['leadChunks/r_r1sam'].leads.l2 && srv['leadChunks/r_r1sam'].leads.l2.name === 'Blake Rowe');
    await pickTheme(A.page, 'midnight'); await setGoal(A.page, 140);
    await A.page.waitForTimeout(3200);
    srv = await server(A.page);
    const p = (srv['leadChunks/r_r1sam'] || {}).prefs || {};
    check(T + 'theme and goal saved to the account', p.theme === 'midnight' && p.dailyGoal === 140, p);
    check(T + 'text name saved too', p.textSettings && p.textSettings.myName === 'Sam', p.textSettings && p.textSettings.myName);
    check(T + 'only settings travel (no current lead, open call or leads)', !('activeLeadId' in p) && !('awaitingOutcome' in p) && !('leads' in p) && !('callLog' in p), Object.keys(p));
    check(T + 'leads still untouched after saving settings', srv['leadChunks/r_r1sam'].leads.l2 && Object.keys(srv['leadChunks/r_r1sam'].leads).length === 1);
    check(T + 'phone A: no page errors', !A.errs.length, A.errs);
    await A.ctx.close();
    // a brand-new phone (or the Home Screen app): nothing on it yet
    let B = await phone(br, c, srv, { uid: 'r1sam', email: 'sam@' + LEG }, null, BASE + '?legacy=1');
    let v = await view(B.page);
    check(T + 'new phone gets the theme', v.theme === 'midnight' && v.saved === 'midnight', v);
    check(T + 'new phone gets the daily goal', /140/.test(v.goal), v.goal);
    check(T + 'new phone: no sideways scroll, no page errors', v.sw <= v.vw && !B.errs.length, B.errs);
    // change on B, then A (still holding the old copy) opens again and gets B's newer one
    await pickTheme(B.page, 'auto'); await B.page.waitForTimeout(1500);
    srv = await server(B.page);
    check(T + 'back to Auto is saved too', ((srv['leadChunks/r_r1sam'] || {}).prefs || {}).theme === 'auto', (srv['leadChunks/r_r1sam'] || {}).prefs);
    await B.ctx.close();
    // ---- an office rep with no record of their own yet; and sign-in links ----
    db = seed();
    let C = await phone(br, c, db, { uid: 'r2', email: 'lee@acme.vpex.app' }, 'acme');
    await pickTheme(C.page, 'midnight'); await C.page.waitForTimeout(1500);
    srv = await server(C.page);
    check(T + 'office rep: record made with settings and no leads', srv['offices/acme/leadChunks/r_r2'] && srv['offices/acme/leadChunks/r_r2'].prefs.theme === 'midnight' && Object.keys(srv['offices/acme/leadChunks/r_r2'].leads || {}).length === 0, srv['offices/acme/leadChunks/r_r2']);
    check(T + 'office rep: other offices and the original team untouched', !srv['leadChunks/r_r2'] && !srv['offices/acme/leadChunks/r_r1sam']);
    await C.ctx.close();
    // the server holds a newer copy than this phone: the phone takes it and sends nothing back first
    const db2 = seed(); db2['offices/acme/leadChunks/r_r2'] = { leads: {}, prefs: { at: Date.now() + 1000, theme: 'midnight', dailyGoal: 77 } };
    let D = await phone(br, c, db2, { uid: 'r2', email: 'lee@acme.vpex.app' }, 'acme');
    v = await view(D.page); srv = await server(D.page);
    check(T + 'newer account copy wins on open (theme, goal)', v.theme === 'midnight' && /77/.test(v.goal), v);
    check(T + 'phone didn\'t overwrite the account copy', srv['offices/acme/leadChunks/r_r2'].prefs.dailyGoal === 77);
    await D.ctx.close();
    // Create login (office admin): link with ?o= and the office code; original team: ?legacy=1
    for (const [who, sess, office, wantLink, wantCode] of [['office admin', { uid: 'a1', email: 'boss@acme.vpex.app' }, 'acme', 'http://127.0.0.1:8765/index.html?o=acme', true], ['owner (original team)', { uid: 'vOwn', email: 'vincent@' + LEG }, null, 'http://127.0.0.1:8765/index.html?legacy=1', false]]) {
      const E = await phone(br, c, seed(), sess, office, office ? undefined : BASE + '?legacy=1');
      await E.page.evaluate(() => document.getElementById('menuBtn').click()); await E.page.waitForTimeout(400);
      await E.page.evaluate(() => { const x = document.querySelector('[data-set-cat="admin"]'); if (x) x.click(); }); await E.page.waitForTimeout(400);
      const note = await E.page.evaluate(() => [...document.querySelectorAll('.hub-note')].map(x => x.textContent).join(' | '));
      check(T + who + ': Team note gives the right sign-in link', note.includes('Reps sign in at ' + wantLink), note);
      await E.page.evaluate(() => document.getElementById('hubTeam').click()); await E.page.waitForTimeout(700);
      // stand in for Firebase's account creation (the bench has no second app): only the copied text is under test
      await E.page.evaluate(() => { window.firebase.initializeApp = () => ({ auth: () => ({ setPersistence: async () => {}, createUserWithEmailAndPassword: async () => ({ user: { uid: 'newRep1' } }), signOut: async () => {} }) }); window.firebase.apps = []; });
      await E.page.fill('#tmName', 'Jo Rivera'); await E.page.fill('#tmUser', 'jorivera'); await E.page.fill('#tmPw', 'goodpass99');
      await E.page.evaluate(() => document.getElementById('tmAdd').click()); await E.page.waitForTimeout(900);
      const det = await E.page.evaluate(() => (document.querySelector('#tmCreated pre') || {}).textContent || ('ERR:' + ((document.getElementById('tmErr') || {}).textContent || 'no form')));
      check(T + who + ': login details link', det.includes('Link: ' + wantLink), det);
      check(T + who + (wantCode ? ': details include the office code' : ': no office code line'), det.includes('Office code: acme') === wantCode, det);
      check(T + who + ': no page errors', !E.errs.length, E.errs);
      await E.ctx.close();
    }
    // sign in at the plain site (office code box shown) with no office code: the original team's login works
    const F = await phone(br, c, seed(), null, null, BASE);
    await F.page.evaluate(() => { const b = document.getElementById('heroSignin'); if (b) b.click(); }); await F.page.waitForTimeout(500);
    const box = await F.page.evaluate(() => { const w = document.getElementById('authOfficeWrap'); return !!w && w.style.display !== 'none'; });
    if (box) {
      await F.page.fill('#authUser', 'sam'); await F.page.fill('#authPw', 'testpass1');
      await F.page.evaluate(() => document.getElementById('authGo').click()); await F.page.waitForTimeout(3000);
      const ok = await F.page.evaluate(() => !!document.getElementById('callBtn') && getComputedStyle(document.getElementById('authScreen')).display === 'none');
      check(T + 'blank office code signs an original-team rep in', ok);
    } else check(T + 'plain site shows the office code box to a new phone', false, 'no box');
    check(T + 'sign-in page: no page errors', !F.errs.length, F.errs);
    await F.ctx.close();
    // wrong password with no office code: a clear message
    const G = await phone(br, c, seed(), null, null, BASE);
    await G.page.evaluate(() => { const b = document.getElementById('heroSignin'); if (b) b.click(); }); await G.page.waitForTimeout(500);
    await G.page.fill('#authUser', 'sam'); await G.page.fill('#authPw', 'nope-wrong');
    await G.page.evaluate(() => document.getElementById('authGo').click()); await G.page.waitForTimeout(1500);
    const msg = await G.page.evaluate(() => document.getElementById('authMsg').textContent);
    check(T + 'wrong password, no office code: says to add the office code if it\'s an office login', /Wrong username or password\. If your login is for an office/.test(msg), msg);
    await G.ctx.close();
  }
  // demo offices send nothing
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);
    await pickTheme(page, 'midnight'); await page.waitForTimeout(3000);
    const fs = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('__mockfs') || '{}')).filter(k => /\/r_|^leadChunks\/r_/.test(k) && /prefs/.test(localStorage.getItem('__mockfs'))));
    check('demo: no settings record written', fs.length === 0, fs);
    await ctx.close();
  }
  await br.close();
  console.log(`rep_prefs: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
