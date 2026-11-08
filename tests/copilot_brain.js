// VPEX regression check (copilot_brain). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<playwright> node tests/copilot_brain.js
// Copilot Brain (owner only, on a computer): an AI on the computer (Chrome's built-in Gemini Nano, or an open model run by
// the browser with WebLLM) follows the whole call. Stand-ins for both engines answer like the real ones would (JSON held
// to the schema), so this checks the wiring: turning it on (download progress, remembered), the self-test, cards for what
// the keywords missed, taking back cards the rep's own words set off, the Next line, agreement and stage, the safety
// filter, one question at a time, nothing sent over the network, and that nobody else ever loads it.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

const STUB = (o) => {
  window.__sr = { list: [] };
  class F { constructor() { window.__sr.list.push(this); } start() { this.live = true; } abort() { this.live = false; } stop() { this.abort(); } }
  window.SpeechRecognition = window.webkitSpeechRecognition = F;
  window.__say = t => { const r = window.__sr.list[window.__sr.list.length - 1]; if (!r) return false; const res = [{ transcript: t }]; res.isFinal = true; r.onresult({ resultIndex: 0, results: [res] }); return true; };
  // what the stand-in AI answers for the newest line
  const TABLE = [
    [/whole thing feels kind of off/, { speaker: 'lead', move: 'trust', stage: 'objection', next: 'Earn trust: offer the documents and your direct line, then trial close.', check: '' }],
    [/i know it seems expensive/i, { speaker: 'rep', move: 'none', stage: 'objection', next: 'Ask the trial close now.', check: 'Good: you named it. Now ask if the idea makes sense.' }],
    [/^yeah okay$/, { speaker: 'lead', move: 'agree', stage: 'trial', next: 'Trial close: does the idea make sense?', check: '' }],
    [/promise me/, { speaker: 'lead', move: 'guarantee', stage: 'objection', next: 'Tell them it is guaranteed to double.', check: '' }],
    [/retired and live off our savings/, { speaker: 'lead', move: 'none', stage: 'discover', next: 'Ask what they want their savings to do.', check: '', facts: ['Retired, living off savings'] }],
    [/how would i even get in/, { speaker: 'lead', move: 'buy', stage: 'close', next: 'Give the minimum, then ask how they title accounts.', check: '' }],
    [/this is mike with/i, { speaker: 'rep', move: 'none', stage: 'open', next: '', check: '' }],
    [/too much money/, { speaker: 'lead', move: 'price', stage: 'objection', next: '', check: '' }],
    [/talk it over with my wife/, { speaker: 'lead', move: 'spouse', stage: 'objection', next: '', check: '' }],
    [/burned pretty bad/, { speaker: 'lead', move: 'bad', stage: 'objection', next: '', check: '' }],
    [/slammed/, { speaker: 'lead', move: 'busy', stage: 'open', next: '', check: '' }],
    [/minimum to get in/, { speaker: 'lead', move: 'buy', stage: 'close', next: '', check: '' }],
    [/putting the price aside/i, { speaker: 'rep', move: 'none', stage: 'trial', next: '', check: '' }],
    [/i guess that makes sense/i, { speaker: 'lead', move: 'agree', stage: 'trial', next: '', check: '' }],
  ];
  const answer = (text) => { const m = /NEWEST: (.*)$/m.exec(text) || [], nl = (m[1] || '').trim(); const hit = TABLE.find(r => r[0].test(nl)); return hit ? hit[1] : { speaker: 'lead', move: 'none', stage: 'discover', next: 'Ask what they own now.', check: '' }; };
  window.__brainLog = { prompts: [], creates: [], inflight: 0, maxInflight: 0, web: [] };
  const L = window.__brainLog, delay = o.delay || 0;
  const session = () => ({
    prompt: (text, opt) => { L.prompts.push({ text, opt }); L.inflight++; L.maxInflight = Math.max(L.maxInflight, L.inflight);
      return new Promise(r => setTimeout(() => { L.inflight--; r(JSON.stringify(answer(text))); }, delay)); },
    clone: () => Promise.resolve(session()), destroy() {} });
  if (!o.builtin) { try { Object.defineProperty(window, 'LanguageModel', { value: undefined, configurable: true, writable: true }); } catch (e) { window.LanguageModel = undefined; } }   // this test browser has its own
  if (o.builtin) window.LanguageModel = {
    availability: () => Promise.resolve(localStorage.getItem('__lmAvail') || o.builtin),
    create: (opt) => { L.creates.push({ sys: opt && opt.initialPrompts && opt.initialPrompts[0] && opt.initialPrompts[0].content, monitor: !!(opt && opt.monitor), act: navigator.userActivation ? navigator.userActivation.isActive : null });
      if (opt && opt.monitor && o.builtin === 'downloadable' && !localStorage.getItem('__lmAvail')) { const t = new EventTarget(); opt.monitor(t); [0.25, 0.6, 1].forEach((p, i) => setTimeout(() => { const e = new Event('downloadprogress'); e.loaded = p; t.dispatchEvent(e); }, 20 * (i + 1))); return new Promise(r => setTimeout(() => { localStorage.setItem('__lmAvail', 'available'); r(session()); }, 120)); }
      return Promise.resolve(session()); } };
  if (!o.gpu) { try { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true }); } catch (e) {} }
  if (o.gpu) Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: () => Promise.resolve({}) }, configurable: true });
  if (o.web) window.__vpexWebLLM = { prebuiltAppConfig: { model_list: [{ model_id: 'Qwen3-0.6B-q4f16_1-MLC' }, { model_id: 'Qwen3-1.7B-q4f16_1-MLC' }] },
    CreateMLCEngine: (id, cfg) => { L.web.push({ id }); [0.5, 1].forEach((p, i) => setTimeout(() => cfg.initProgressCallback({ progress: p, text: 'Loading' }), 10 * (i + 1)));
      return new Promise(r => setTimeout(() => r({ chat: { completions: { create: (req) => { L.web.push({ req }); const u = req.messages[1].content; return Promise.resolve({ choices: [{ message: { content: JSON.stringify(answer(u.replace(/ \/no_think$/, ''))) } }] }); } } }, unload() {} }), 50)); } };
};
async function boot(br, o) {
  const ctx = await br.newContext({ timezoneId: 'America/New_York', viewport: { width: o.w || 1280, height: o.h || 900 }, colorScheme: o.s || 'dark', isMobile: (o.w || 1280) < 500, hasTouch: (o.w || 1280) < 500 });
  await ctx.addInitScript(STUB, o);
  const page = await ctx.newPage(); const errs = [], reqs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('request', r => reqs.push(r.url()));
  await page.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.clock.install({ time: new Date('2026-11-09T14:10:00-05:00') });
  if (o.demo) { await page.goto(BASE + '#demo-' + o.demo); await page.waitForTimeout(2600); }
  else {
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
    await page.evaluate(o => {
      const db = demoSeed(), now = Date.now();
      db['members/vOwn'] = { username: 'vincent', name: 'Vincent', role: 'admin', active: true, lastSeen: now };
      localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      const email = (o.user || 'vincent') + '@dovetail-f863c.firebaseapp.com', uid = o.user === 'sam' ? 'dR2' : 'vOwn';
      localStorage.setItem('__mockauth', JSON.stringify({ [email]: { uid, pw: 'test' } })); localStorage.setItem('vpex_oc_seen', String(now));
      if (o.pref) localStorage.setItem('vpex_brain', o.pref);
      sessionStorage.setItem('__mocksess', JSON.stringify({ uid, email }));
    }, o);
    await page.goto(BASE); await page.waitForTimeout(2600);
  }
  await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  return { ctx, page, errs, reqs };
}
const brainBtn = async page => { if (await page.evaluate(() => { const m = document.querySelector('#copilot .el-menu'); return !!(m && m.hidden); })) await page.click('#elMenuBtn'); await page.click('#elBrain'); };   // the Brain button lives in the Copilot menu
const say = async (page, t, ms) => { await page.evaluate(t => window.__say(t), t); await page.waitForTimeout(ms || 250); };
const panel = page => page.evaluate(() => { const el = document.getElementById('copilot'); if (!el || el.hidden) return null;
  return { head: el.querySelector('.cp-head').innerText, cards: [...el.querySelectorAll('.cp-card')].map(c => ({ text: c.innerText, tag: (c.querySelector('.cp-tag') || {}).innerText || '' })),
    next: (el.querySelector('.mn-brain') || {}).innerText || '', brainTag: !!el.querySelector('.mn-brain .el-brain-tag'), checkLine: (el.querySelector('.el-check:not(.mn-brain)') || {}).innerText || '',
    stage: (el.querySelector('.el-steps-bar .now') || {}).textContent, brainBtn: !!el.querySelector('#elBrain') }; });
const outside = reqs => reqs.filter(u => !/^(http:\/\/127\.0\.0\.1|data:|blob:)/.test(u) && !/gstatic|fonts\.|cloudfunctions/.test(u));

(async () => {
  const br = await chromium.launch();
  // 1. Chrome's built-in AI, first time: download, then the call
  {
    const tag = 'builtin';
    const { ctx, page, errs, reqs } = await boot(br, { builtin: 'downloadable' });
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800);
    let p = await panel(page);
    check(tag + ': Brain button on the computer', p && p.brainBtn);
    check(tag + ': cp-brain.js not loaded until asked', !reqs.some(u => /cp-brain\.js/.test(u)));
    await brainBtn(page); await page.waitForTimeout(500);
    const st = await page.evaluate(() => document.getElementById('brStat').innerText);
    check(tag + ': sheet says Gemini Nano can download once', /Gemini Nano\): can download it/.test(st) && /Qwen3/.test(st), st);
    await page.click('#brOn'); await page.waitForTimeout(60);
    const mid = await page.evaluate(() => ({ prog: !document.getElementById('brProg').hidden, msg: document.getElementById('brMsg').textContent }));
    check(tag + ': download progress shown', mid.prog && /Downloading the brain… \d+%|Starting/.test(mid.msg), mid);
    await page.waitForTimeout(400);
    const done = await page.evaluate(() => ({ msg: document.getElementById('brMsg').textContent, pref: localStorage.getItem('vpex_brain'), log: window.__brainLog.creates }));
    check(tag + ': on, remembered', /Brain is on: Gemini Nano/.test(done.msg) && done.pref === 'builtin', done);
    check(tag + ': the download was started by the tap (user activation)', done.log[0] && done.log[0].monitor && done.log[0].act === true, done.log);
    // self-test
    await page.click('#brTest'); await page.waitForTimeout(800);
    const res = await page.evaluate(() => document.getElementById('brRes').innerText);
    check(tag + ': Test it: 8 of 8 right, with timing', /^8 of 8 right · about [\d.]+ s a line/.test(res), res.slice(0, 200));
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); }); await page.waitForTimeout(200);
    p = await panel(page);
    check(tag + ': header says Brain on', /Brain on/.test(p.head), p.head);
    const n0 = await page.evaluate(() => window.__brainLog.prompts.length);
    // a line no keyword catches
    await say(page, 'the whole thing feels kind of off to me', 300); p = await panel(page);
    check(tag + ': the brain hears what keywords miss → trust card, marked', /Is this legit|trust/i.test(p.cards[0].text) && /^Heard by the brain · /.test(p.cards[0].tag), p.cards.map(c => c.tag));
    check(tag + ': Next line from the brain, tagged', p.brainTag && /Earn trust: offer the documents/.test(p.next), p.next);
    const pr = await page.evaluate(() => window.__brainLog.prompts[window.__brainLog.prompts.length - 1]);
    const en = pr.opt && pr.opt.responseConstraint && pr.opt.responseConstraint.properties.move.enum;
    check(tag + ': asked with the call so far and the newest line marked', /NEWEST: the whole thing feels kind of off to me/.test(pr.text), pr.text.slice(-200));
    check(tag + ': answer held to a schema: who, move (this floor\'s objections), stage, next, check', en && ['trust', 'price', 'guarantee', 'liquid', 'who', 'buy', 'agree', 'none'].every(x => en.includes(x)) && pr.opt.responseConstraint.properties.speaker.enum.join() === 'rep,lead,unclear', en);
    const sys = await page.evaluate(() => window.__brainLog.creates.map(c => c.sys).filter(Boolean).pop());
    check(tag + ': the brain knows the floor and both voices', /selling investments/.test(sys) && /REP/.test(sys) && /LEAD/.test(sys) && /Never promise returns/.test(sys), (sys || '').slice(0, 200));
    await say(page, 'my wife and i are retired and live off our savings', 300); p = await panel(page);
    const facts = await page.evaluate(() => [...document.querySelectorAll('#copilot .mn-ev-i')].map(e => e.innerText));
    check(tag + ': facts the lead states → shown as "AI heard"', facts.some(f => /^AI heard/.test(f) && /Retired, living off savings/.test(f)), facts);
    // the rep's own words
    await say(page, 'I know it seems expensive, but here is the thing', 350); p = await panel(page);
    check(tag + ': the rep said "expensive": no price card left', !p.cards.some(c => /It's too expensive/.test(c.text)), p.cards.map(c => c.text.slice(0, 40)));
    check(tag + ': coaching on your own line', /Your last line: Good: you named it/.test(p.checkLine), p.checkLine);
    // agreement → trial
    await say(page, 'yeah okay', 300); p = await panel(page);
    check(tag + ': agreement read by the brain → Trial', p.stage === 'Trial' && /does the idea make sense/.test(p.next), p);
    // safety filter
    await say(page, 'can you promise me it works', 300); p = await panel(page);
    check(tag + ': a Next that promises returns is dropped (playbook line instead)', !/guaranteed to double/.test(p.next) && !p.brainTag, p.next);
    check(tag + ': ...and the honest guarantee answer shows', /lose some or all/.test(p.cards[0].text), p.cards[0].text.slice(0, 120));
    // buying signal in other words
    await say(page, 'so how would i even get in on something like this', 300); p = await panel(page);
    check(tag + ': buying signal → close, stage Close', /Buying signal/.test(p.cards[0].text) && p.stage === 'Close', [p.stage, p.cards[0].text.slice(0, 40)]);
    check(tag + ': one question per new line', await page.evaluate(() => window.__brainLog.prompts.length) - n0 === 6);
    check(tag + ': nothing said on the call went over the network', outside(reqs).length === 0, outside(reqs));
    check(tag + ': no page errors', !errs.length, errs);
    await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/brain-1280.png' });
    await ctx.close();
  }
  // 2. one at a time when lines come fast; the newest waiting line goes next
  {
    const { ctx, page, errs } = await boot(br, { builtin: 'available', pref: 'builtin', delay: 300 });
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(900);
    let p = await panel(page);
    check('resume: turned on before → on again without a tap', /Brain on/.test(p.head), p.head);
    await say(page, 'first line here', 20); await say(page, 'second line here', 20); await say(page, 'third line here', 20);
    await page.waitForTimeout(1200);
    const L = await page.evaluate(() => ({ max: window.__brainLog.maxInflight, n: window.__brainLog.prompts.length, last: window.__brainLog.prompts[window.__brainLog.prompts.length - 1].text }));
    check('busy: never two questions at once', L.max === 1, L);
    check('busy: the newest line is judged, the one in between skipped', L.n === 2 && /NEWEST: third line here/.test(L.last), L);
    // turn off
    await brainBtn(page); await page.waitForTimeout(400); await page.click('#brOff'); await page.waitForTimeout(200);
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); });
    p = await panel(page);
    check('off: header without Brain, remembered off', !/Brain on/.test(p.head) && await page.evaluate(() => localStorage.getItem('vpex_brain')) === 'off', p.head);
    const before = await page.evaluate(() => window.__brainLog.prompts.length);
    await say(page, 'honestly it is too expensive', 300); p = await panel(page);
    check('off: keywords still answer, no brain question', /too expensive/.test(p.cards[0].text) && await page.evaluate(() => window.__brainLog.prompts.length) === before);
    check('no page errors (busy/off)', !errs.length, errs);
    await ctx.close();
  }
  // 3. the open model in the browser (WebLLM), when Chrome's built-in AI isn't there
  {
    const { ctx, page, errs } = await boot(br, { gpu: true, web: true });
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800);
    await brainBtn(page); await page.waitForTimeout(500);
    const st = await page.evaluate(() => document.getElementById('brStat').innerText);
    check('webllm: sheet: built-in not in this browser, open model can run', /not in this browser/.test(st) && /can run here/.test(st), st);
    await page.click('#brOn'); await page.waitForTimeout(400);
    const done = await page.evaluate(() => ({ msg: document.getElementById('brMsg').textContent, pref: localStorage.getItem('vpex_brain'), web: window.__brainLog.web }));
    check('webllm: on with Qwen3 1.7B, remembered', /Brain is on: Qwen3-1\.7B/.test(done.msg) && done.pref === 'webllm' && done.web[0].id === 'Qwen3-1.7B-q4f16_1-MLC', done);
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); });
    await say(page, 'the whole thing feels kind of off to me', 300);
    const p = await panel(page);
    const req = await page.evaluate(() => window.__brainLog.web.filter(x => x.req).pop().req);
    check('webllm: asked with a JSON schema, thinking off', req.response_format && req.response_format.type === 'json_object' && /"speaker"/.test(req.response_format.schema) && / \/no_think$/.test(req.messages[1].content) && req.temperature === 0, req.response_format);
    check('webllm: the card from the brain', /^Heard by the brain/.test(p.cards[0].tag), p.cards.map(c => c.tag));
    check('webllm: no page errors', !errs.length, errs);
    await ctx.close();
  }
  // 4. a computer that can't run it
  {
    const { ctx, page, errs } = await boot(br, {});
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800);
    await brainBtn(page); await page.waitForTimeout(500); await page.click('#brOn'); await page.waitForTimeout(200);
    const t = await page.evaluate(() => document.getElementById('brMsg').textContent + ' | ' + document.getElementById('brStat').innerText);
    check('no AI here: says so plainly, keywords keep working', /can’t run the brain/.test(t) && /needs Chrome or Edge/.test(t), t);
    check('no AI here: no page errors', !errs.length, errs);
    await ctx.close();
  }
  // 5. nobody else: reps, demos, and the owner's phone
  for (const o of [{ n: 'rep 1280', user: 'sam', builtin: 'available' }, { n: 'demo 1280', demo: 'insurance', builtin: 'available' }, { n: 'owner phone', w: 390, h: 844, builtin: 'available' }]) {
    const { ctx, page, errs, reqs } = await boot(br, o);
    const has = await page.evaluate(() => !!document.querySelector('[data-cp-toggle]'));
    if (has) { await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800); await say(page, 'the whole thing feels kind of off to me', 300); }
    const p = await panel(page);
    check(o.n + ': no Brain button', !p || !p.brainBtn);
    check(o.n + ': cp-brain.js never loaded, the AI never asked', !reqs.some(u => /cp-brain\.js/.test(u)) && await page.evaluate(() => window.__brainLog.prompts.length + window.__brainLog.creates.length) === 0);
    check(o.n + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`copilot_brain: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
