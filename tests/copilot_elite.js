// VPEX regression check (copilot_elite). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<playwright> node tests/copilot_elite.js
// Copilot Elite is the VPEX owner's alone (his own login, the original team) until he gives it to everyone: the four-step
// answers in cp-elite.js, per floor; tap mode on his phone (the microphone is on the call); listening on a computer;
// each answer's win rate on his own calls (call.cpv, Interested = a win), least-tried first until 20 calls, then the leader.
// Nobody else (reps, other logins, demos) sees it or downloads cp-elite.js, and their Copilot is unchanged.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };

// ---------- 1. the playbook file ----------
const SRC = fs.readFileSync(path.join(ROOT, 'cp-elite.js'), 'utf8');
const win = {}; vm.runInNewContext(SRC, { window: win });
const E = win.VPEXElite;
check('cp-elite.js defines VPEXElite', E && E.PLAYS && E.CLOSE && E.IDEAS && E.LABEL);
const INDS = ['insurance', 'realestate', 'mca', 'auto', 'solar', 'investments'];
const ids = {}, all = [];
Object.keys(E.PLAYS).forEach(k => Object.keys(E.PLAYS[k]).filter(ind => ind !== 'noAll').forEach(ind => {
  check('floor key ' + k + '/' + ind, ind === 'all' || INDS.includes(ind), ind);
  E.PLAYS[k][ind].forEach(v => { if (ids[v.id] === v) return; all.push(v); check('unique id ' + v.id, !ids[v.id], v.id); ids[v.id] = v; });   // the same answer may serve two objections
}));
INDS.forEach(ind => {
  const c = E.CLOSE[ind] || [];
  check(ind + ': two or more closes', c.length >= 2, c.length);
  c.forEach(x => { check('close ' + x.id + ' offers two choices', / or /.test(x.t) && /\?$/.test(x.t), x.t); check('unique id ' + x.id, !ids[x.id]); ids[x.id] = 1; });
});
const BANNED = /risk[- ]free|can'?t lose|double your money|guaranteed (approval|returns?|savings)|act now|today only|last chance|only \d+ (spots|left)|dovetail/i;
all.forEach(v => {
  check(v.id + ': method and either a rap or steps with a tip', v.m && (v.rap ? typeof v.rap === 'string' && v.rap.length > 10 : Array.isArray(v.steps) && v.steps.length >= 1 && v.steps.every(s => s.length === 2 && s[0] && s[1]) && v.tip), v.id);
  const text = [v.m, v.tip, v.close || '', v.rap || '', v.note || ''].concat(v.steps.map(s => s[1])).join(' ');
  check(v.id + ': no banned promise or fake urgency', !BANNED.test(text), (text.match(BANNED) || [])[0]);
  check(v.id + ': fill-ins are {first}/{me}/{company} only', (text.match(/\{[^}]*\}/g) || []).every(f => /^\{(first|me|company|name)\}$/.test(f)), text.match(/\{[^}]*\}/g));
  if (v.close) check(v.id + ': its own close gives two choices', / or /.test(v.close), v.close);
});
// the owner's Closer's Playbook: every section is in, the firm's name never is
const BOOK = ['bk-close-2', 'bk-close-3', 'bk-close-4', 'bk-close-5', 'bk-close-6', 'bk-close-7', 'bk-close-8', 'bk-close-9', 'bk-close-10', 'bk-trial-a', 'bk-trial-b', 'bk-trial-c',
  'bk-think', 'bk-acct', 'bk-burnt', 'bk-re', 'bk-broker-1', 'bk-broker-2', 'bk-local', 'bk-self-1', 'bk-self-2', 'bk-self-3', 'bk-self-4', 'bk-self-5', 'bk-self-6', 'bk-spectacular',
  'bk-conservative', 'bk-send', 'bk-look', 'bk-watch', 'bk-phone', 'bk-self-7', 'bk-no', 'bk-raps-1', 'bk-raps-2', 'bk-key', 'bk-raps-3', 'bk-indecision', 'bk-raps-4',
  'bk-liquid-1', 'bk-liquid-2', 'bk-liquid-3', 'bk-cb-1', 'bk-cb-2', 'bk-cb-3', 'bk-cb-4', 'bk-notwork', 'bk-market', 'bk-private', 'bk-dynamics'];
check('playbook: all 50 sections are in', BOOK.every(id => ids[id] && ids[id].rap && ids[id].src === 'Your playbook'), BOOK.filter(id => !ids[id]));
check('playbook: the firm is never named (cp-elite.js)', !/dovetail/i.test(SRC));
check('playbook: no blank lines left (______)', !/_{3,}/.test(SRC));
check('playbook: the 6 rules on every call, for investments only', E.RULES && E.RULES.investments.length === 6 && /lose the full amount/.test(E.RULES.investments[2]) && Object.keys(E.RULES).join() === 'investments');
check('playbook: "allocation is filling" only with its [Only if true:] guard', (SRC.match(/allocation is filling/g) || []).length === 1 && /\[Only if true:\] This allocation is filling/.test(SRC));
check('playbook: the closes end on their own question (no second close stacked on)', E.PLAYS.buy.investments.every(v => v.close === '' || /\?$/.test(v.close)));
check('investments: guarantee answer says no and names the risk of loss', /lose some or all/.test(JSON.stringify(E.PLAYS.guarantee.investments)) && /^No/.test(E.PLAYS.guarantee.investments[0].steps[0][1]));
check('every objection the base Copilot hears has an elite answer on every floor', ['notint', 'price', 'money', 'send', 'spouse', 'advisor', 'already', 'later', 'number', 'trust', 'think', 'credit', 'self', 'rent', 'roof', 'buy'].every(k => E.PLAYS[k] && (E.PLAYS[k].all || []).length));
const said = { busy: "sorry i'm slammed right now", what: 'what is this about', decide: "i'm not the decision maker", wait: 'i want to wait until after the holidays', bad: 'we had a bad experience last time',
  info: 'i need to do my own research', old: "i'm too old for this", browse: "i'm just shopping around", payment: 'the payment is too high', guarantee: 'is it guaranteed', liquid: 'when can i get my money back', stall: "i'll get back to you",
  who: 'so tell me about yourself', realestate: 'i invest in real estate', conservative: "i'm pretty conservative", watch: "i'll watch it for a while", phone: "i don't do business over the phone", notwork: "i don't think it's going to work", market: "the market's down right now" };
E.IDEAS.forEach(x => check('idea ' + x[0] + ' hears "' + said[x[0]] + '"', said[x[0]] && x[1].test(' ' + said[x[0]] + ' '), x[0]));
check('every new idea has a label and an answer', E.IDEAS.every(x => E.LABEL[x[0]] && E.PLAYS[x[0]]));

// ---------- 2. choosing: least-tried until 20 calls, then the leader most of the time ----------
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /function elChoose\(list\) \{[\s\S]*?\n  \}/.exec(src);
  check('index.html has elChoose', !!m);
  const ctx = { Math, ST: {}, EL_MIN: 20 }; vm.createContext(ctx);
  vm.runInContext('function elStats() { return ST; }\n' + m[0], ctx);
  const L = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  ctx.ST = { a: { n: 5, w: 1 }, b: { n: 2, w: 0 }, c: { n: 9, w: 5 } };
  check('choose: under 20 calls, the least-tried', [...Array(30)].every(() => ctx.elChoose(L).id === 'b'));
  ctx.ST = { a: { n: 40, w: 4 }, b: { n: 40, w: 16 }, c: { n: 40, w: 8 } };
  const cnt = { a: 0, b: 0, c: 0 }; for (let i = 0; i < 2000; i++) cnt[ctx.elChoose(L).id]++;
  check('choose: all tested, the leader most of the time', cnt.b > 1600, cnt);
  check('choose: the others still get tried now and then', cnt.a > 20 && cnt.c > 20, cnt);
}

// ---------- 3. in the app ----------
const FAKE = () => {
  window.__sr = { list: [] };
  class F { constructor() { window.__sr.list.push(this); } start() { this.live = true; } abort() { this.live = false; } stop() { this.abort(); } }
  window.SpeechRecognition = window.webkitSpeechRecognition = F;
  window.__say = t => { const r = window.__sr.list[window.__sr.list.length - 1]; if (!r) return false; const res = [{ transcript: t }]; res.isFinal = true; r.onresult({ resultIndex: 0, results: [res] }); return true; };
};
async function boot(br, o) {
  const ctx = await br.newContext({ timezoneId: 'America/New_York', viewport: { width: o.w, height: o.h || 844 }, colorScheme: o.s || 'dark', isMobile: o.w < 500, hasTouch: o.w < 500 });
  if (!o.noSR) await ctx.addInitScript(FAKE);
  const page = await ctx.newPage(); const errs = [], reqs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('request', r => reqs.push(r.url()));
  await page.route(/gstatic\.com\/firebasejs|cloudfunctions/, r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/^tel:|sms:/, r => r.abort());
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
      sessionStorage.setItem('__mocksess', JSON.stringify({ uid, email }));
    }, o);
    await page.goto(BASE); await page.waitForTimeout(2600);
  }
  await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  return { ctx, page, errs, reqs };
}
const panel = page => page.evaluate(() => {
  const el = document.getElementById('copilot'); if (!el || el.hidden) return null; const r = el.getBoundingClientRect();
  const cards = [...el.querySelectorAll('.cp-card')].map(c => ({ el: c.classList.contains('el'), text: c.innerText, tag: (c.querySelector('.cp-tag') || {}).innerText || '', steps: c.querySelectorAll('.el-steps li').length }));
  const chips = [...el.querySelectorAll('[data-el-say]')].map(b => ({ k: b.getAttribute('data-el-say'), h: b.getBoundingClientRect().height }));
  const btns = [...el.querySelectorAll('button, select')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height);
  return { text: el.innerText, cards, chips, btns, elite: !!el.querySelector('.el-badge'), tap: el.classList.contains('cp-tap'), inView: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
    sw: document.documentElement.scrollWidth, vw: innerWidth, ind: (el.querySelector('#elInd') || {}).value };
});
const tap = async (page, k) => { await page.evaluate(k => document.querySelector('[data-el-say="' + k + '"]').click(), k); await page.waitForTimeout(250); };
const logOutcome = async (page, o) => { await page.evaluate(() => document.getElementById('copyBtn').click()); await page.waitForTimeout(300);
  await page.evaluate(o => document.querySelector('#outcomesRow [data-outcome="' + o + '"]').click(), o); await page.waitForTimeout(700);
  await page.evaluate(() => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await page.waitForTimeout(200); };
const eliteReq = reqs => reqs.filter(u => /cp-elite\.js/.test(u)).length;

(async () => {
  const br = await chromium.launch();
  // 3a. the owner's iPhone (390, dark and light): tap mode
  for (const s of ['dark', 'light']) {
    const tag = 'owner 390 ' + s;
    const { ctx, page, errs, reqs } = await boot(br, { w: 390, s });
    const btn = await page.evaluate(() => { const b = document.querySelector('[data-cp-toggle]'); return b && b.getBoundingClientRect().height; });
    check(tag + ': Copilot button on the phone for the owner', btn >= 42, btn);
    check(tag + ': cp-elite.js not loaded before Copilot opens', eliteReq(reqs) === 0);
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800);
    let p = await panel(page);
    check(tag + ': Elite, tap mode, nothing heard', p && p.elite && p.tap && /Tap mode/.test(p.text) && !/transcribes our call/.test(p.text), p && p.text.slice(0, 200));
    check(tag + ': no microphone used on the phone', await page.evaluate(() => window.__sr.list.length) === 0);
    check(tag + ': cp-elite.js loaded once', eliteReq(reqs) === 1, eliteReq(reqs));
    check(tag + ': playbook is his floor (investments)', p.ind === 'investments', p.ind);
    check(tag + ': tap chips incl. Ready to buy and the investor ones', ['buy', 'price', 'think', 'guarantee', 'liquid', 'trial', 'who', 'conservative', 'market', 'watch', 'phone', 'notwork', 'realestate'].every(k => p.chips.some(c => c.k === k)), p.chips.map(c => c.k));
    check(tag + ': every chip and button >= 44 px', p.chips.every(c => c.h >= 44) && p.btns.every(h => h >= 44), [p.chips.map(c => c.h), p.btns]);
    check(tag + ': panel on screen, no sideways scroll', p.inView && p.sw <= p.vw, p);
    await tap(page, 'price'); p = await panel(page);
    const c0 = p.cards[0];
    check(tag + ': tap → a four-step elite answer', c0 && c0.el && c0.steps >= 3 && /They said: “It's too expensive\.”/.test(c0.text) && /THEN CLOSE|Then close/i.test(c0.text) && /How to say it:/.test(c0.text), c0);
    check(tag + ': still testing line', /Still testing · 0 of 20 calls/.test(c0.tag), c0.tag);
    const firstTag = c0.tag;
    await tap(page, 'think'); await tap(page, 'price'); p = await panel(page);
    check(tag + ': the same answer for the whole call', p.cards[0].tag === firstTag && p.cards.length === 2, p.cards.map(c => c.tag));
    await tap(page, 'guarantee'); p = await panel(page);
    check(tag + ': guarantee (investments): honest about loss', /lose some or all/.test(p.cards[0].text), p.cards[0].text);
    await tap(page, 'buy'); p = await panel(page);
    check(tag + ': Ready to buy → one of your 10 closes, from your playbook', /Buying signal/.test(p.cards[0].text) && p.cards[0].el && /^Your playbook · /.test(p.cards[0].tag) && /\d+(st|nd|rd|th) CLOSE/i.test(p.cards[0].text), p.cards[0].text.slice(0, 160));
    const rules = await page.evaluate(() => { const d = document.querySelector('#copilot .el-rules'); if (!d) return null; d.open = true; return { n: d.querySelectorAll('li').length, t: d.innerText, h: d.querySelector('summary').getBoundingClientRect().height }; });
    check(tag + ': Rules on every call (6), 44 px', rules && rules.n === 6 && /never tell them to stretch/.test(rules.t) && rules.h >= 44, rules);
    await page.evaluate(() => { const d = document.querySelector('#copilot .el-rules'); if (d) d.open = false; });
    await tap(page, 'who'); p = await panel(page);
    check(tag + ': Tell me about yourself → a Self / Raps rap, said as written', /Tell me about yourself/.test(p.cards[0].text) && /^Your playbook · /.test(p.cards[0].tag) && /(SELF|RAPS|KEY|SPECTACULAR)/i.test(p.cards[0].text) && !/Dovetail/i.test(p.cards[0].text), p.cards[0].text.slice(0, 160));
    await tap(page, 'trial'); p = await panel(page);
    check(tag + ': Trial close card', /Trial close\./.test(p.cards[0].text) && /title your accounts|does the idea make sense|holding you back/.test(p.cards[0].text), p.cards[0].text);
    await tap(page, 'market'); p = await panel(page);
    check(tag + ': market down → Market Down / Private Markets / Buying Dynamics', /(Market Down|Private Markets Bullet|Buying Dynamics)/i.test(p.cards[0].text), p.cards[0].text.slice(0, 120));
    check(tag + ': at most 3 cards', p.cards.length === 3, p.cards.length);
    // log Interested: a win for what was shown
    await logOutcome(page, 'interested');
    await page.evaluate(() => document.getElementById('elRes').click()); await page.waitForTimeout(300);
    const res = await page.evaluate(() => { const m = [...document.querySelectorAll('.modal-overlay.show, .feat-sheet, [role=dialog]')].map(x => x.innerText).join('\n'); return m; });
    check(tag + ': What wins counts the call as a win for the answers shown', (res.match(/1 of 1 · 100%/g) || []).length >= 4, res.slice(0, 600));
    check(tag + ': What wins lists not-used answers', /Not used yet/.test(res));
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); });
    // next lead: a fresh pick, and a loss counts as shown with no win
    await tap(page, 'price'); p = await panel(page);
    const t2 = p.cards[0].tag;
    check(tag + ': next lead gets a fresh pick (least-tried)', t2 !== firstTag && /0 of 20/.test(t2), [firstTag, t2]);
    await logOutcome(page, 'notinterested');
    await page.evaluate(() => document.getElementById('elRes').click()); await page.waitForTimeout(300);
    const res2 = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay.show')].map(x => x.innerText).join('\n'));
    check(tag + ': a Not interested call counts as shown, not won', /0 of 1 · 0%/.test(res2), res2.slice(0, 400));
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); });
    // another floor's playbook
    await page.evaluate(() => { const s = document.getElementById('elInd'); s.value = 'solar'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(250);
    p = await panel(page);
    check(tag + ': switch to Solar: its chips (I rent, roof)', p.ind === 'solar' && p.chips.some(c => c.k === 'rent') && p.chips.some(c => c.k === 'roof') && !p.chips.some(c => c.k === 'liquid'), p.chips.map(c => c.k));
    await tap(page, 'rent'); p = await panel(page);
    check(tag + ': solar renter: respect the rule, no close', /Only the homeowner can sign/.test(p.cards[0].text) && !/Then close/i.test(p.cards[0].text), p.cards[0].text);
    check(tag + ': the choice is remembered', await page.evaluate(() => localStorage.getItem('vpex_el_ind')) === 'solar');
    if (s === 'dark') await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/elite-390.png' });
    check(tag + ': Stop closes listening; no page errors', !errs.length, errs);
    await ctx.close();
  }
  // 3b. the owner on a computer: listening, sharper hearing, answers above the tap row
  {
    const tag = 'owner 1440';
    const { ctx, page, errs } = await boot(br, { w: 1440, h: 900, s: 'light' });
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800);
    let p = await panel(page);
    check(tag + ': Elite, listening, consent line', p.elite && !p.tap && /Listening on this device/.test(p.text) && /transcribes our call/.test(p.text), p.text.slice(0, 200));
    await page.evaluate(() => window.__say("sorry i'm slammed right now")); await page.waitForTimeout(250); p = await panel(page);
    check(tag + ': "slammed" → I\'m busy (not Call me later)', /I'm busy right now/.test(p.cards[0].text) && !p.cards.some(c => /Call me later/.test(c.text)), p.cards.map(c => c.text.slice(0, 60)));
    await page.evaluate(() => window.__say('ok but is it guaranteed')); await page.waitForTimeout(250); p = await panel(page);
    check(tag + ': "is it guaranteed" → honest answer', /Is it guaranteed/.test(p.cards[0].text) && /lose some or all/.test(p.cards[0].text), p.cards[0].text.slice(0, 200));
    await page.evaluate(() => window.__say('that makes sense so how does it work and when can we start')); await page.waitForTimeout(250); p = await panel(page);
    check(tag + ': buying signal → elite close', /Buying signal/.test(p.cards[0].text) && p.cards[0].el, p.cards[0].text.slice(0, 120));
    const order = await page.evaluate(() => { const el = document.getElementById('copilot'); const a = el.querySelector('.cp-card'), b = el.querySelector('.el-tap'); return a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? 1 : 0; });
    check(tag + ': answers above the tap row while listening', order === 1);
    await tap(page, 'spouse'); p = await panel(page);
    check(tag + ': tapping works while listening too', /talk to my spouse/.test(p.cards[0].text) && p.cards[0].el);
    check(tag + ': panel on screen, no sideways scroll', p.inView && p.sw <= p.vw, p);
    await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/elite-1440.png' });
    check(tag + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  // 3c. everyone else: unchanged, and never downloads the playbook
  for (const o of [{ n: 'rep 390', w: 390, user: 'sam' }, { n: 'rep 1280', w: 1280, user: 'sam' }, { n: 'demo insurance 1280', w: 1280, demo: 'insurance' }, { n: 'demo mca 390', w: 390, demo: 'mca' }]) {
    const { ctx, page, errs, reqs } = await boot(br, o);
    const btn = await page.evaluate(() => !!document.querySelector('[data-cp-toggle]'));
    if (o.w < 500) check(o.n + ': no Copilot on a phone', !btn);
    else {
      check(o.n + ': Copilot on a computer', btn);
      await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800);
      await page.evaluate(() => window.__say("i'm busy and honestly it's too expensive")); await page.waitForTimeout(300);
      const p = await panel(page);
      check(o.n + ': no Elite, no tap row, no playbook picker', !p.elite && !p.chips.length && !p.ind, p.text.slice(0, 200));
      check(o.n + ': the regular answer cards', p.cards.length >= 1 && p.cards.every(c => !c.el) && /too expensive/i.test(p.text), p.cards.map(c => c.text.slice(0, 60)));
    }
    check(o.n + ': cp-elite.js never requested', eliteReq(reqs) === 0, reqs.filter(u => /elite/.test(u)));
    check(o.n + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`copilot_elite: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
