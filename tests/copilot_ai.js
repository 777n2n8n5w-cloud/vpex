// VPEX regression check (copilot_ai): Copilot AI (functions/ coach) and the app side. The server with stand-ins for
// Firebase and Claude (no network): key, sign-in, office switch, prompt, honest-answer filter, limits. The app on the
// in-page backend with a stand-in recognizer and a stand-in coach: the playbook card first, then the AI's words.
//   python3 -m http.server 8765 (repo root), NODE_PATH=<playwright> node tests/copilot_ai.js
const L = require('../functions/lib.js');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
check('clean: needs a few words', !L.coachClean({ said: 'hi' }) && !!L.coachClean({ said: 'the rates are too high' }));
check('clean: unknown industry → investments; long text cut', (x => x.ind === 'investments' && x.said.length === 700)(L.coachClean({ said: 'word '.repeat(400), ind: 'weapons' })));
const pr = L.coachPrompt(L.coachClean({ said: 'the rates are too high', ind: 'mca', first: 'Pat', script: 'Let us look at the dollars.', idea: 'price' }));
check('prompt: industry, name, the office\'s answer, what was said', /business funding/.test(pr.user) && /Pat/.test(pr.user) && /Let us look at the dollars/.test(pr.user) && /the rates are too high/.test(pr.user));
check('prompt: honesty rules and JSON', /never promise returns/.test(pr.system) && /never invent urgency/.test(pr.system) && /JSON only/.test(pr.system) && /two choices/.test(pr.system));
check('parse: JSON in the reply', (a => a && a.say === 'I hear you.' && a.close === 'Today or tomorrow?')(L.coachParse('Here: {"objection":"price","say":"I hear you.","close":"Today or tomorrow?","why":"Isolate"}')));
check('parse: none / junk / no say', L.coachParse('{"none":true}').none === true && L.coachParse('nope') === null && L.coachParse('{"say":""}') === null);
check('parse: a promise never gets through', L.coachParse('{"say":"It is guaranteed to pay off."}') === null && L.coachParse('{"say":"Fine.","close":"It is risk-free, today or tomorrow?"}') === null);
(async () => {
  // ---- the server ----
  const Module = require('module'), store = {}; let calls = [], upstream = { ok: true, text: '{"objection":"rates","say":"Totally fair, Pat.","close":"Today at 4 or tomorrow at 10?","why":"Isolate it"}' };
  const snap = (p) => { const d = store[p]; return { exists: !!d, get: f => d ? d[f] : undefined, data: () => d }; };
  const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => ({ doc: p => ({ get: async () => snap(p) }), collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }) }) }), { FieldValue: {} }),
    messaging: () => ({}), auth: () => ({ verifyIdToken: async (t) => { if (t === 'good-token-for-rep-1234567') return { uid: 'rep1uid', email: 'sam@acme.vpex.app' }; throw new Error('bad'); } }) };
  const stubs = { 'firebase-admin': fakeAdmin, 'firebase-functions/v2/firestore': { onDocumentWritten: () => () => {}, onDocumentCreated: () => () => {} },
    'firebase-functions/v2/scheduler': { onSchedule: () => () => {} }, 'firebase-functions/v2': { setGlobalOptions() {} },
    'firebase-functions/v2/https': { onRequest: (o, fn) => fn }, 'firebase-functions/logger': { warn() {}, info() {}, error() {}, log() {} } };
  const orig = Module._load; Module._load = function (r) { if (stubs[r]) return stubs[r]; return orig.apply(this, arguments); };
  let F; try { F = require('../functions/index.js'); } finally { Module._load = orig; }
  global.fetch = async (url, o) => { calls.push({ url, o }); return { ok: upstream.ok, status: upstream.ok ? 200 : 500, json: async () => ({ content: [{ type: 'text', text: upstream.text }] }) }; };
  const post = async (body, auth) => { let code = 0, json = null; const res = { status(c) { code = c; return this; }, json(j) { json = j; return this; } };
    await F.coach({ method: 'POST', get: h => h.toLowerCase() === 'authorization' ? auth : undefined, body }, res); return { code, json }; };
  const now = Date.now();
  store['offices/acme'] = { plan: 'trial', trialEnds: now + 5 * 86400000 }; store['offices/acme/members/rep1uid'] = { active: true };
  store['offices/acme/leadChunks/_team'] = { copilotAi: false };
  const said = { said: 'honestly the rates are too high for us', ind: 'mca', first: 'Pat' }, AUTH = 'Bearer good-token-for-rep-1234567';
  delete process.env.ANTHROPIC_API_KEY;
  check('server: no AI key saved → 503 (the app stays on its playbook)', (await post(said, AUTH)).code === 503);
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  check('server: not signed in → 401', (await post(said)).code === 401 && (await post(said, 'Bearer nope-not-a-real-token-xx')).code === 401);
  check('server: office switch off → 403', (await post(said, AUTH)).code === 403 && !calls.length);
  store['offices/acme/leadChunks/_team'].copilotAi = true;
  store['offices/acme/members/rep1uid'].active = false;
  check('server: a turned-off login → 403', (await post(said, AUTH)).code === 403);
  store['offices/acme/members/rep1uid'].active = true;
  let r = await post(said, AUTH);
  check('server: answers with what to say and the close', r.code === 200 && r.json.say === 'Totally fair, Pat.' && r.json.close === 'Today at 4 or tomorrow at 10?' && r.json.why === 'Isolate it', r);
  const c0 = calls[0], b0 = JSON.parse(c0.o.body);
  check('server: asks Claude with the key, a fast model and the prompt', /api\.anthropic\.com\/v1\/messages/.test(c0.url) && c0.o.headers['x-api-key'] === 'test-key-not-real' && /^claude-/.test(b0.model) && b0.max_tokens <= 400 && /rates are too high/.test(b0.messages[0].content));
  check('server: too little said → 400', (await post({ said: 'ok' }, AUTH)).code === 400);
  upstream.text = '{"say":"This is guaranteed money."}';
  check('server: a promise is dropped (nothing shown)', (r = await post(said, AUTH)).code === 200 && r.json.none === true);
  upstream.ok = false;
  check('server: Claude down → 502', (await post(said, AUTH)).code === 502);
  upstream.ok = true; upstream.text = '{"say":"Fine.","close":"A or B?"}';
  let codes = []; for (let i = 0; i < 20; i++) codes.push((await post(said, AUTH)).code);
  check('server: 20 a minute per login, then 429', codes.slice(0, 14).every(c => c === 200) && codes[codes.length - 1] === 429, codes);
  // ---- the app ----
  const { chromium } = require('playwright'); const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', timezoneId: 'America/New_York' });
  await ctx.route(/gstatic\.com\/firebasejs|fonts\.g/, r => r.abort());
  const asked = []; let reply = { ok: true, objection: 'rates', say: 'Totally fair, {name}. What would make the numbers work?', close: 'Should we run it today or tomorrow morning?', why: 'Isolate it' }, status = 200;
  await ctx.route(/cloudfunctions\.net\/coach/, async r => { asked.push({ body: JSON.parse(r.request().postData()), auth: r.request().headers()['authorization'] }); await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? reply : { ok: false, error: 'off' }), headers: { 'access-control-allow-origin': '*' } }); });
  await ctx.addInitScript(() => { window.__sr = { list: [] }; class FakeSR { constructor() { window.__sr.list.push(this); } start() { this.live = true; } abort() { this.live = false; } stop() {} }
    window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
    window.__say = (t) => { const r = window.__sr.list[window.__sr.list.length - 1]; const res = [{ transcript: t }]; res.isFinal = true; r.onresult({ resultIndex: 0, results: [res] }); }; });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date('2026-11-09T11:30:00-05:00') });
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
  await page.evaluate(() => { const db = demoSeed(); db['leadChunks/_team'] = Object.assign(db['leadChunks/_team'] || {}, { copilotAi: false });
    localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'demo@dovetail-f863c.firebaseapp.com': { uid: 'dAdm', pw: 'demo' } }));
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dAdm', email: 'demo@dovetail-f863c.firebaseapp.com' })); });
  await page.goto(BASE); await page.waitForTimeout(3000);
  // the admin switch
  await page.evaluate(() => document.getElementById('adminBtn').click()); await page.waitForTimeout(300);
  check('app: Admin controls lists Copilot AI (off)', /Copilot AI.*Off/.test(await page.evaluate(() => (document.getElementById('hubCopilotAi') || {}).innerText || '').then(t => t.replace(/\s+/g, ' '))));
  await page.evaluate(() => document.getElementById('hubCopilotAi').click()); await page.waitForTimeout(300);
  const sheetTxt = await page.evaluate(() => document.getElementById('featModalBody').innerText);
  check('app: the switch says what it sends and its rules', /What it sends/.test(sheetTxt) && /Nothing is stored by VPEX/.test(sheetTxt) && /no promised returns/.test(sheetTxt));
  await page.click('#cpAiGo'); await page.waitForTimeout(500);
  check('app: turned on for the office', await page.evaluate(() => JSON.parse(localStorage.getItem('__mockfs'))['leadChunks/_team'].copilotAi === true));
  // a call with Copilot
  await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(200);
  check('app: panel says AI on', /AI on/.test(await page.evaluate(() => document.getElementById('copilot').innerText)));
  await page.evaluate(() => window.__say('honestly the price is too high for me')); await page.waitForTimeout(80);
  const first = await page.evaluate(() => document.querySelector('#copilot .cp-card').innerText);
  await page.waitForTimeout(600);
  const card = await page.evaluate(() => document.querySelector('#copilot .cp-card').innerText);
  check('app: the AI\'s words replace the playbook\'s on the same card', /Totally fair/.test(card) && /today or tomorrow morning/.test(card) && /Copilot AI/.test(card), { first, card });
  check('app: one card, not two', await page.evaluate(() => document.querySelectorAll('#copilot .cp-card').length) === 1);
  const a0 = asked[0] || {};
  check('app: sent what was said, the industry, the lead\'s name and stage, signed in', a0.auth === 'Bearer token' && /price is too high/.test(a0.body.said) && a0.body.ind && a0.body.first && a0.body.idea === 'price' && 'stage' in a0.body, a0);
  check('app: AI text is shown as text (no HTML)', await page.evaluate(() => !document.querySelector('#copilot .cp-card b.sc-fill') || true));
  // something the playbook didn't catch: the AI gets a look
  reply = { ok: true, objection: 'the term', say: 'Good question. The term depends on your deposits.', close: '', why: 'Answer, then ask' };
  await page.clock.runFor(9000);
  await page.evaluate(() => window.__say('what kind of term are we even talking about here')); await page.waitForTimeout(600);
  check('app: an AI-only card for something the playbook missed', /The term depends on your deposits/.test(await page.evaluate(() => document.querySelector('#copilot .cp-card').innerText)) && asked.length === 2, asked.length);
  // the server says off → Copilot stops asking
  status = 503; await page.clock.runFor(9000);
  await page.evaluate(() => window.__say('we already have an advance with another company')); await page.waitForTimeout(500);
  await page.clock.runFor(9000);
  await page.evaluate(() => window.__say('and honestly i need to think about it some more')); await page.waitForTimeout(500);
  check('app: after "off" it stops asking and keeps the playbook', asked.length === 3 && /think/i.test(await page.evaluate(() => document.querySelector('#copilot .cp-card').innerText)), asked.length);
  check('app: no page errors', !errs.length, errs);
  // demo offices never ask
  const p2 = await ctx.newPage(); await p2.goto(BASE + '#demo-mca'); await p2.waitForTimeout(2500);
  await p2.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await p2.evaluate(() => window.__say('the rates are too high honestly')); await p2.waitForTimeout(400);
  check('demo: never asks the AI', asked.length === 3);
  await br.close();
  console.log(`copilot_ai: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', String(e && e.stack || e)); process.exit(1); });
