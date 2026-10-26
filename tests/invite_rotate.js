// VPEX regression check (invite_rotate). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/invite_rotate.js
// Security: turning a rep off or removing them changes the office's invite link, so the link they joined with can't
// bring them back (a new login, or recreating a removed login's member record). Runs on the in-page mock backend,
// which enforces the same invite rule as firestore-rules.txt. Turning someone back on leaves the link alone.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const now = Date.now(), OLD = 'oldcode234';
function seed() {
  const db = {};
  db['config/billing'] = { price: 49 };
  db['offices/acme'] = { name: 'Acme Insurance', industry: 'insurance', ownerUid: 'a1', plan: 'trial', trialEnds: now + 5 * 864e5, createdAt: now - 864e5, invite: OLD, locked: false, seats: 3 };
  db['offices/acme/members/a1'] = { username: 'boss', name: 'Pat Admin', role: 'admin', active: true, lastSeen: now };
  db['offices/acme/members/r1'] = { username: 'sam', name: 'Sam Rep', role: 'rep', active: true, lastSeen: now, invite: OLD };
  db['offices/acme/members/r2'] = { username: 'lee', name: 'Lee Rep', role: 'rep', active: true, lastSeen: now, invite: OLD };
  db['offices/acme/leadChunks/c001'] = { leads: { l1: { name: 'Avery Stone', phone: '+12125550111', phoneRaw: '(212) 555-0111', state: 'NY', status: 'pending' } } };
  return db;
}
const AUTH = { 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'sam@acme.vpex.app': { uid: 'r1', pw: 'testpass1' }, 'lee@acme.vpex.app': { uid: 'r2', pw: 'testpass1' } };
async function ctxWith(br, c, db, sess, url) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500 });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
  await page.evaluate(([db, auth, sess]) => {
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth));
    localStorage.setItem('vpex_office', 'acme');
    if (sess) sessionStorage.setItem('__mocksess', JSON.stringify(sess)); else sessionStorage.removeItem('__mocksess');
  }, [db, AUTH, sess]);
  await page.goto(url || (BASE + '?o=acme')); await page.waitForTimeout(2600);
  return { ctx, page, errs };
}
const fs = page => page.evaluate(() => JSON.parse(localStorage.getItem('__mockfs') || '{}'));
async function openTeam(page) {
  await page.evaluate(() => document.getElementById('menuBtn').click()); await page.waitForTimeout(400);
  await page.evaluate(() => { const c = document.querySelector('[data-set-cat="admin"]'); if (c) c.click(); }); await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById('hubTeam').click()); await page.waitForTimeout(700);
}
const toast = page => page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: '390-dark', w: 390, s: 'dark' }, { n: '1280-light', w: 1280, s: 'light' }]) {
    const tag = c.n;
    const A = await ctxWith(br, c, seed(), { uid: 'a1', email: 'boss@acme.vpex.app' });
    await openTeam(A.page);
    const ui = await A.page.evaluate(() => ({ rm: !!document.querySelector('[data-tm-remove="r1"]'), off: !!document.querySelector('[data-tm-toggle="r2"]'), sub: (document.querySelector('.modal.show .modal-sub, .modal-overlay.show .modal-sub') || {}).textContent || '' }));
    check(tag + ': Team & access lists the reps', ui.rm && ui.off, ui);
    check(tag + ': Team & access says turning off changes the link', /changes the invite link/.test(ui.sub), ui.sub);
    // Remove Sam
    await A.page.evaluate(() => document.querySelector('[data-tm-remove="r1"]').click()); await A.page.waitForTimeout(250);
    await A.page.evaluate(() => document.getElementById('confirmOkBtn').click()); await A.page.waitForTimeout(900);
    let db = await fs(A.page); const inv1 = db['offices/acme'].invite;
    check(tag + ': removing Sam deletes his member record', !db['offices/acme/members/r1'], db['offices/acme/members/r1']);
    check(tag + ': removing Sam changes the invite code', typeof inv1 === 'string' && inv1.length >= 6 && inv1 !== OLD, inv1);
    const t1 = await toast(A.page);
    check(tag + ': admin is told the link changed', /removed/.test(t1) && /invite link changed/.test(t1), t1);
    const link1 = await A.page.evaluate(() => { const b = document.getElementById('tmInvite'); return b ? true : false; });
    check(tag + ': invite button still there', link1);
    // Turn Lee off, then back on
    await openTeam(A.page);
    await A.page.evaluate(() => document.querySelector('[data-tm-toggle="r2"]').click()); await A.page.waitForTimeout(900);
    db = await fs(A.page); const inv2 = db['offices/acme'].invite;
    check(tag + ': turning Lee off locks him out', db['offices/acme/members/r2'] && db['offices/acme/members/r2'].active === false, db['offices/acme/members/r2']);
    check(tag + ': turning Lee off changes the invite code again', inv2 && inv2 !== inv1 && inv2 !== OLD, { inv1, inv2 });
    const t2 = await toast(A.page);
    check(tag + ': admin is told (turn off)', /locked out/.test(t2) && /invite link changed/.test(t2), t2);
    await openTeam(A.page);
    await A.page.evaluate(() => document.querySelector('[data-tm-toggle="r2"]').click()); await A.page.waitForTimeout(900);
    db = await fs(A.page);
    check(tag + ': turning Lee back on leaves the link alone', db['offices/acme'].invite === inv2 && db['offices/acme/members/r2'].active === true, db['offices/acme']);
    check(tag + ': no page errors (admin)', !A.errs.length, A.errs);
    await A.ctx.close();
    // Attack 1: someone with the OLD link makes a new login
    const J = await ctxWith(br, c, db, null, BASE + '?o=acme&code=' + OLD);
    const hasForm = await J.page.evaluate(() => !!document.getElementById('jnGo') && !!document.getElementById('jnGo').offsetParent);
    check(tag + ': old link opens the join form', hasForm);
    await J.page.fill('#jnName', 'Sam Again'); await J.page.fill('#jnUser', 'sam2'); await J.page.fill('#jnPw', 'testpass1'); await J.page.fill('#jnPw2', 'testpass1');
    await J.page.click('#jnGo'); await J.page.waitForTimeout(1500);
    const j1 = await J.page.evaluate(() => ({ msg: (document.getElementById('authMsg') || {}).innerText || '', db: JSON.parse(localStorage.getItem('__mockfs') || '{}') }));
    check(tag + ': old link can no longer join', /no longer valid/.test(j1.msg) && !Object.keys(j1.db).some(k => /^offices\/acme\/members\//.test(k) && j1.db[k].username === 'sam2'), j1.msg);
    await J.ctx.close();
    // Attack 2: Sam's own (removed) login recreates his member record with the old code
    const R = await ctxWith(br, c, j1.db, { uid: 'r1', email: 'sam@acme.vpex.app' });
    const r = await R.page.evaluate(async old => {
      try { await firebase.app().auth().signInWithEmailAndPassword('sam@acme.vpex.app', 'testpass1'); if (!firebase.app().auth().currentUser) return 'not signed in'; await firebase.app().firestore().collection('offices').doc('acme').collection('members').doc('r1').set({ username: 'sam', name: 'Sam Rep', role: 'rep', active: true, invite: old }); return 'written'; }
      catch (e) { return (e && e.code) || String(e); }
    }, OLD);
    check(tag + ': removed login cannot recreate itself with the old code', r === 'permission-denied', r);
    await R.ctx.close();
    // Sanity: the NEW link still lets a new rep in
    const N = await ctxWith(br, c, j1.db, null, BASE + '?o=acme&code=' + inv2);
    await N.page.fill('#jnName', 'Robin New'); await N.page.fill('#jnUser', 'robin'); await N.page.fill('#jnPw', 'testpass1'); await N.page.fill('#jnPw2', 'testpass1');
    await N.page.click('#jnGo'); await N.page.waitForTimeout(2200);
    const n1 = await N.page.evaluate(() => { const db = JSON.parse(localStorage.getItem('__mockfs') || '{}'); return Object.keys(db).filter(k => /^offices\/acme\/members\//.test(k)).map(k => db[k].username); });
    check(tag + ': the new link still lets a new rep join', n1.includes('robin'), n1);
    check(tag + ': no page errors (join)', !N.errs.length, N.errs);
    await N.ctx.close();
  }
  await br.close();
  console.log('invite_rotate: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
