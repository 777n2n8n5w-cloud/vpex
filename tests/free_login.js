// VPEX regression check (free_login): a removed person's username can be used again, with nothing linking the two logins.
//  - functions/ freeLogin deletes the sign-in account of someone already off the team (and their phones' alert tokens),
//    for that office's signed-in admin only; never a teammate, never the admin themselves, never another office's login,
//    never VPEX's owner. No sign-in gets 401.
//  - The app: Remove calls it; Add a rep frees a username an old login still holds, then creates the new login
//    (a new account: new id, new password).
//   NODE_PATH=<playwright> node tests/free_login.js   (server part needs no web server; app part uses the test bench)
const Module = require('module');
const fs = require('fs');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

(async () => {
  // ---------- server, with stand-ins ----------
  const PROJECT = 'dovetail-f863c'; process.env.GCLOUD_PROJECT = PROJECT;
  let store = {}, users = {}, deleted = [];
  const snap = p => ({ id: p.split('/').pop(), exists: !!store[p], get: f => store[p] ? store[p][f] : undefined, ref: docRef(p) });
  function docRef(p) { return { path: p, get: async () => snap(p), set: async v => { store[p] = v; }, delete: async () => { delete store[p]; } }; }
  const col = p => ({ where: (f, op, v) => ({ limit: () => ({ get: async () => ({ docs: Object.keys(store).filter(k => k.startsWith(p + '/') && store[k][f] === v).map(snap) }) }) }) });
  const fakeDb = { doc: docRef, collection: col };
  const tokens = { 'tok-admin': 'adminUid01', 'tok-rep': 'repUid0001', 'tok-other': 'otherAdm01', 'tok-owner': 'ownerUid01' };
  const fakeAuth = {
    verifyIdToken: async t => { const uid = tokens[t]; if (!uid) throw Object.assign(new Error('bad'), { code: 'auth/argument-error' }); return { uid, email: users[uid].email }; },
    getUser: async uid => { if (!users[uid]) throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' }); return users[uid]; },
    getUserByEmail: async e => { const u = Object.values(users).find(x => x.email === e); if (!u) throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' }); return u; },
    deleteUser: async uid => { deleted.push(uid); delete users[uid]; } };
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => fakeDb, { FieldValue: {}, FieldPath: class {} }), auth: () => fakeAuth, messaging: () => ({}) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: () => () => {} }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => Object.assign(fn, { opts: o }) }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load; Module._load = function (r) { if (stubs[r]) return stubs[r]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  const reset = () => {
    store = { 'offices/acme-ins/members/adminUid01': { role: 'admin', active: true }, 'offices/acme-ins/members/repUid0001': { role: 'rep', active: true },
      'offices/other-co/members/otherAdm01': { role: 'admin', active: true }, 'members/ownerUid01': { role: 'admin', active: true },
      'pushTokens/t1': { uid: 'goneUid001', tz: 'x' }, 'pushTokens/t2': { uid: 'repUid0001' } };
    users = { adminUid01: { uid: 'adminUid01', email: 'boss@acme-ins.vpex.app' }, repUid0001: { uid: 'repUid0001', email: 'mia@acme-ins.vpex.app' },
      goneUid001: { uid: 'goneUid001', email: 'lancenopants1@acme-ins.vpex.app' }, otherGone1: { uid: 'otherGone1', email: 'lancenopants1@other-co.vpex.app' },
      otherAdm01: { uid: 'otherAdm01', email: 'ann@other-co.vpex.app' }, ownerUid01: { uid: 'ownerUid01', email: 'vincent@' + PROJECT + '.firebaseapp.com' } };
    deleted = [];
  };
  // tokens are short in this stand-in: pad them past the 20-character floor the function expects
  const call = async (tok, body, method) => { let st = 0, js = null; const req = { method: method || 'POST', body, get: h => h === 'Authorization' && tok ? 'Bearer ' + tok.padEnd(24, '#') : '' };
    const res = { status(s) { st = s; return this; }, json(j) { js = j; } };
    await F.freeLogin(req, res); return { st, js }; };
  const realVerify = fakeAuth.verifyIdToken; fakeAuth.verifyIdToken = async t => realVerify(t.replace(/#+$/, ''));

  check('server: allowed only from vpexdialer.com, a couple of instances', JSON.stringify(F.freeLogin.opts.cors) === JSON.stringify(['https://vpexdialer.com', 'https://www.vpexdialer.com']) && F.freeLogin.opts.maxInstances === 2);
  reset(); let r = await call(null, { office: 'acme-ins', username: 'lancenopants1' });
  check('no sign-in: 401, nothing deleted', r.st === 401 && !deleted.length, r);
  reset(); r = await call('tok-rep', { office: 'acme-ins', username: 'lancenopants1' });
  check('a rep (not an admin): 403', r.st === 403 && r.js.error === 'admin' && !deleted.length, r);
  reset(); r = await call('tok-other', { office: 'acme-ins', username: 'lancenopants1' });
  check('another office\'s admin: 403', r.st === 403 && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', username: 'mia' });
  check('someone still on the team: 409, kept', r.st === 409 && r.js.error === 'in-use' && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', username: 'boss' });
  check('the admin themselves: refused', r.st === 403 && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', uid: 'otherGone1' });
  check('another office\'s login, even by id: refused', r.st === 403 && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', username: 'lancenopants1' });
  check('a removed person\'s username: their old login is deleted', r.st === 200 && r.js.ok && deleted.join() === 'goneUid001', r);
  check('with their phones\' alert tokens (others\' stay)', !store['pushTokens/t1'] && !!store['pushTokens/t2']);
  check('the same username in another office is untouched', !!users.otherGone1);
  reset(); r = await call('tok-admin', { office: 'acme-ins', uid: 'goneUid001' });
  check('after Remove (by id): deleted', r.st === 200 && deleted.join() === 'goneUid001', r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', username: 'neverused' });
  check('a username nobody has: fine, nothing to do', r.st === 200 && r.js.gone && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', username: 'Bad Name!' });
  check('a malformed username: 400', r.st === 400 && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: '../x', username: 'lancenopants1' });
  check('a malformed office: 400', r.st === 400 && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', username: 'x'.repeat(500) });
  check('an oversized request: 413', r.st === 413 && !deleted.length, r);
  reset(); r = await call('tok-admin', { office: 'acme-ins', username: 'lancenopants1' }, 'GET');
  check('GET: 405', r.st === 405 && !deleted.length, r);
  reset(); delete store['members/ownerUid01']; store['members/adm2Uid0001'] = { role: 'admin', active: true }; users.adm2Uid0001 = { uid: 'adm2Uid0001', email: 'sam@' + PROJECT + '.firebaseapp.com' };
  tokens['tok-adm2'] = 'adm2Uid0001'; r = await call('tok-adm2', { office: '', username: 'vincent' });
  check('VPEX\'s owner login can never be freed', r.st === 403 && !deleted.length, r);

  // ---------- the app ----------
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  check('app: Remove deletes their login too', /tcol\("members"\)\.doc\(id\)\.delete\(\)\.then\(function \(\) \{\s*freeLogin\(\{ uid: id \}\)/.test(html));
  check('app: Remove says the username can be used again', /their login is deleted, so the username can be used again/.test(html));
  check('app: Add a rep frees an old login\'s username, then creates the new login', /if \(!\/email-already-in-use\/\.test\(\(e1 && e1\.code\) \|\| ""\)\) throw e1;[\s\S]{0,400}freeLogin\(\{ username: user \}\)[\s\S]{0,300}cred = await sa\.createUserWithEmailAndPassword\(emailFor\(user\), pw\);/.test(html));
  check('app: a teammate\'s username gets its own message', /Someone on your team already uses that username/.test(html));
  check('daily check: freeLogin is live and refuses no sign-in', /consent book freeLogin; do/.test(fs.readFileSync(__dirname + '/../.github/workflows/vpex-notifications-check.yml', 'utf8')));

  console.log('free_login: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
