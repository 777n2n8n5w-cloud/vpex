// VPEX regression check (instant_sync): a tap saves right away and shows up on the rep's other screens.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/instant_sync.js
// Runs the real app on the in-page backend (#mockbench), a phone (390) and a computer (1280) signed in to one office:
// 1. A qualifying answer, a checklist tick or a stage pick is in the database within ~100 ms of the tap (no 400 ms wait)
//    and on the computer moments later; typing still goes out in one write, not one per letter.
// 2. Someone else saving a different lead in the same record while the Qualify sheet is open doesn't swallow the next tap
//    (the sheet used to keep writing to a copy of the lead the app had already replaced).
// 3. On a slow connection a second tap doesn't wait for the first one's answer from the server, and nothing is lost.
// 4. Leaving the app (Home button, lock, switch apps) sends what's pending at once, even mid-word.
// 5. A save the server turns down for a moment (no signal) is retried until it lands.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (process.env.VERBOSE) console.log(ok ? 'ok  ' : 'FAIL', n, info === undefined ? '' : JSON.stringify(info)); if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const now = Date.now();
const LEADS = {}; for (let i = 1; i <= 12; i++) LEADS['L' + i] = { name: 'Lead Number' + i, phone: '732555' + String(1000 + i), status: 'pending', seq: i };
const db0 = () => ({
  'offices/acme': { name: 'Acme Insurance', industry: 'insurance', plan: 'trial', trialEnds: now + 5 * 864e5, ownerUid: 'a1', createdAt: now, invite: 'abc123xyz', locked: false },
  'offices/acme/members/a1': { username: 'boss', name: 'Dana Cruz', role: 'admin', active: true },
  'offices/acme/members/r1': { username: 'sam', name: 'Sam Rep', role: 'rep', active: true },
  'offices/acme/members/r2': { username: 'mia', name: 'Mia Chen', role: 'rep', active: true },
  'offices/acme/leadChunks/_team': { roster: [{ uid: 'a1', name: 'Dana Cruz', role: 'admin', active: true }, { uid: 'r1', name: 'Sam Rep', role: 'rep', active: true }, { uid: 'r2', name: 'Mia Chen', role: 'rep', active: true }] },
  'offices/acme/leadChunks/c001': { leads: JSON.parse(JSON.stringify(LEADS)) },
});
const AUTH = { 'boss@acme.vpex.app': { uid: 'a1', pw: 'testpass1' }, 'sam@acme.vpex.app': { uid: 'r1', pw: 'testpass1' }, 'mia@acme.vpex.app': { uid: 'r2', pw: 'testpass1' } };
const ev = (page, f, a) => page.evaluate(f, a);
const fs = page => ev(page, () => JSON.parse(localStorage.getItem('__mockfs') || '{}'));
const lead = async (page, id) => ((await fs(page))['offices/acme/leadChunks/c001'] || { leads: {} }).leads[id] || {};
// watch the database from inside the page: how long after "now" does test(lead) come true
const waitDb = (page, id, src, ms) => ev(page, ([id, src, ms]) => new Promise(res => {
  const t0 = performance.now(), test = new Function('l', 'return ' + src);
  (function tick() {
    let l = {}; try { l = JSON.parse(localStorage.getItem('__mockfs') || '{}')['offices/acme/leadChunks/c001'].leads[id] || {}; } catch (e) {}
    if (test(l)) return res(Math.round(performance.now() - t0));
    if (performance.now() - t0 > ms) return res(-1);
    setTimeout(tick, 5);
  })();
}), [id, src, ms || 3000]);
const waitApp = (page, id, src, ms) => ev(page, ([id, src, ms]) => new Promise(res => {
  const t0 = performance.now(), test = new Function('l', 'return ' + src);
  (function tick() {
    const l = (window.__mockLeadFull(id) || [])[0] || {};
    if (test(l)) return res(Math.round(performance.now() - t0));
    if (performance.now() - t0 > ms) return res(-1);
    setTimeout(tick, 5);
  })();
}), [id, src, ms || 3000]);

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', timezoneId: 'America/New_York' });
  async function signIn(uid, email, w, fresh) {
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setViewportSize({ width: w, height: w < 500 ? 844 : 860 });
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis|cloudfunctions/, r => r.abort());
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(300);
    await page.evaluate(([db, auth, sess, fresh]) => { localStorage.setItem('vpex_mockbench', '1'); if (fresh) localStorage.setItem('__mockfs', JSON.stringify(db)); localStorage.setItem('__mockauth', JSON.stringify(auth));
      localStorage.setItem('vpex_office', 'acme'); sessionStorage.setItem('__mocksess', JSON.stringify(sess)); }, [db0(), AUTH, { uid, email }, fresh]);
    await page.goto(BASE + '?o=acme'); await page.waitForTimeout(2600);
    return { page, errs };
  }
  const phone = await signIn('r1', 'sam@acme.vpex.app', 390, true);
  const desk = await signIn('r1', 'sam@acme.vpex.app', 1280, false);
  const mia = await signIn('r2', 'mia@acme.vpex.app', 1280, false);
  const P = phone.page, D = desk.page, M = mia.page;
  check('both screens have the list', (await ev(P, () => (window.__mockLeadFull('L3') || []).length)) === 1 && (await ev(D, () => (window.__mockLeadFull('L3') || []).length)) === 1);

  // ---- 1. a tap is saved at once and reaches the computer ----
  // open the Qualify sheet for L3 the way the dial card's Qualify row does (on the phone, and on the computer too)
  const openQf = pg => ev(pg, () => { const b = document.createElement('button'); b.setAttribute('data-qf-open', 'L3'); document.body.appendChild(b); b.click(); b.remove(); });
  await openQf(P); await openQf(D); await P.waitForTimeout(300);
  check('Qualify sheet says it is saved', await ev(P, () => (document.querySelector('#featModalBody [data-live-save]') || {}).textContent === 'Saved · your team sees it'));
  check('Qualify sheet is open', await ev(P, () => !!document.querySelector('#featModalBody [data-qf-k="product"]')));
  let w = waitDb(P, 'L3', 'l.qf && l.qf.product === "IUL"'), wd = waitApp(D, 'L3', 'l.qf && l.qf.product === "IUL"');
  await ev(P, () => document.querySelector('#featModalBody [data-qf-v="IUL"]').click());
  let ms = await w;
  check('tap: in the database within 120 ms', ms >= 0 && ms < 120, ms);
  ms = await wd;
  check('tap: on the computer within 300 ms of the tap', ms >= 0 && ms < 300, ms);
  ms = await ev(D, () => new Promise(res => { const t0 = performance.now(); (function tick() { const x = document.querySelector('#featModalBody [data-qf-v="IUL"]'); if (x && x.classList.contains('on')) return res(Math.round(performance.now() - t0)); if (performance.now() - t0 > 2000) return res(-1); setTimeout(tick, 5); })(); }));
  check('tap: the sheet open on the computer lights up the answer too', ms >= 0, ms);
  check('tap: the pill says Synced', await ev(P, () => { const p = document.getElementById('savePill'); return !p || p.textContent === 'Synced'; }));

  // typing: one write when they pause, not one per letter
  const writes0 = await ev(P, () => window.__mockWrites || 0);
  await P.locator('#featModalBody [data-qf-in="age"]').pressSequentially('64', { delay: 40 });
  await P.waitForTimeout(700);
  const writes1 = await ev(P, () => window.__mockWrites || 0);
  check('typing: saved once the rep pauses', (await lead(P, 'L3')).qf && (await lead(P, 'L3')).qf.age === '64', (await lead(P, 'L3')).qf);
  check('typing: not a write per letter', writes1 - writes0 <= 2, writes1 - writes0);

  // ---- 2. someone else saves another lead in the same record while the sheet is open ----
  // Mia writes a note on L9 (same record c001): change it and save
  await ev(M, () => window.__mockEditLead('L9', 'notes', 'Mia called, try after 5'));
  check('Mia\'s edit reached the phone', (await waitApp(P, 'L9', 'l.notes === "Mia called, try after 5"')) >= 0);
  w = waitDb(P, 'L3', 'l.qf && l.qf.tobacco === "No"');
  await ev(P, () => document.querySelector('#featModalBody [data-qf-v="No"][data-qf-k="tobacco"]').click());
  ms = await w;
  check('open sheet still saves after a teammate saved the same record', ms >= 0, ms);
  check('...and keeps the earlier answers', JSON.stringify((await lead(P, 'L3')).qf) === JSON.stringify({ product: 'IUL', age: '64', tobacco: 'No' }), (await lead(P, 'L3')).qf);
  check('...and Mia\'s note is still there', (await lead(P, 'L9')).notes === 'Mia called, try after 5');

  // ---- 3. slow connection: taps don't queue behind each other ----
  await ev(P, () => { window.__mockLatency = 700; });
  const t0 = Date.now();
  await ev(P, () => document.querySelector('#featModalBody [data-qf-v="Whole life"]').click());
  await P.waitForTimeout(60);
  await ev(P, () => document.querySelector('#featModalBody [data-qf-v="Yes"][data-qf-k="tobacco"]').click());
  ms = await waitDb(P, 'L3', 'l.qf && l.qf.product === "Whole life" && l.qf.tobacco === "Yes"', 4000);
  check('slow signal: both taps land in about one round trip', ms >= 0 && Date.now() - t0 < 1250, [ms, Date.now() - t0]);
  await ev(P, () => { window.__mockLatency = 0; });
  await P.waitForTimeout(300);
  check('slow signal: pill back to Synced', await ev(P, () => document.getElementById('savePill').textContent === 'Synced'), await ev(P, () => document.getElementById('savePill').textContent));

  // ---- 4. leaving the app mid-word sends it at once ----
  await ev(P, () => { const i = document.querySelector('#featModalBody [data-qf-in="carrier"]'); i.focus(); i.value = 'Mutual of Om'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  w = waitDb(P, 'L3', 'l.qf && l.qf.carrier === "Mutual of Om"', 2000);
  await ev(P, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  ms = await w;
  check('leaving the app: pending typing goes out right away', ms >= 0 && ms < 120, ms);
  await ev(P, () => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });

  // ---- 5. a save refused for a moment (no signal) is retried ----
  await ev(P, () => { window.__offline = true; });
  await ev(P, () => document.querySelector('#featModalBody [data-qf-v="Annuity"]').click());
  await P.waitForTimeout(400);
  check('no signal: the sheet says it\'s on the phone and will send', /Saved on this phone/.test(await ev(P, () => document.querySelector('#featModalBody [data-live-save]').textContent)));
  check('no signal: pill says it will sync', /Offline/.test(await ev(P, () => document.getElementById('savePill').textContent)), await ev(P, () => document.getElementById('savePill').textContent));
  await ev(P, () => { window.__offline = false; window.dispatchEvent(new Event('online')); });
  ms = await waitDb(P, 'L3', 'l.qf && l.qf.product === "Annuity"', 8000);
  check('no signal: lands once the signal is back', ms >= 0, ms);
  check('no signal: lands within 2 s of the signal coming back', ms >= 0 && ms < 2000, ms);

  // ---- the follow-up checklist and stage go out at once too ----
  w = waitDb(P, 'L5', 'l.stage === "Pitched"');
  await ev(P, () => { const b = document.createElement('button'); b.onclick = () => window.__mockEditLead('L5', 'stage', 'Pitched'); document.body.appendChild(b); b.click(); b.remove(); });
  ms = await w;
  check('a pick (stage) saved within 120 ms', ms >= 0 && ms < 120, ms);

  const errs = phone.errs.concat(desk.errs, mia.errs).filter(e => !/firebase|gstatic|Failed to fetch/i.test(e));
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('instant_sync: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
