// VPEX regression check (copilot_mind_live): the Copilot's reasoning on a live call in the app (owner, computer, stand-in
// speech): the Now card (title, do, say, what's happening, why, aim, evidence labeled heard/on record/guess/unknown,
// where the deal stands, a read of the person), a promise on the rep's own words stopped, a missed buying signal caught,
// memory saved on the lead when the call is logged (and synced), the next call picking up where the last one ended,
// never repeating an answer the person already heard, and nobody else getting any of it.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 500)); } };
const FAKE = () => {
  window.__sr = { list: [] };
  class F { constructor() { window.__sr.list.push(this); } start() { this.live = true; } abort() { this.live = false; } stop() { this.abort(); } }
  window.SpeechRecognition = window.webkitSpeechRecognition = F;
  window.__say = t => { const r = window.__sr.list[window.__sr.list.length - 1]; if (!r) return false; const res = [{ transcript: t }]; res.isFinal = true; r.onresult({ resultIndex: 0, results: [res] }); return true; };
  try { Object.defineProperty(window, 'LanguageModel', { value: undefined, configurable: true, writable: true }); } catch (e) {}
};
async function boot(br, o) {
  const ctx = await br.newContext({ timezoneId: 'America/New_York', viewport: { width: o.w || 1440, height: o.h || 900 }, colorScheme: o.s || 'light', isMobile: (o.w || 1440) < 500, hasTouch: (o.w || 1440) < 500 });
  await ctx.addInitScript(FAKE);
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
const say = async (page, t) => { await page.evaluate(t => window.__say(t), t); await page.waitForTimeout(220); };
const now = page => page.evaluate(() => { const n = document.querySelector('#copilot .el-next'); if (!n) return null;
  return { title: (n.querySelector('.mn-title b') || {}).textContent || '', conf: (n.querySelector('.mn-conf') || {}).textContent || '', text: n.innerText,
    ev: [...n.querySelectorAll('.mn-ev-i')].map(e => e.innerText), alerts: [...n.querySelectorAll('.mn-al')].map(a => [a.className.replace(/.*lv-/, ''), a.innerText]),
    band: (n.querySelector('.mn-band') || {}).textContent || '', stage: (n.querySelector('.el-steps-bar .now') || {}).textContent || '' }; });
const cards = page => page.evaluate(() => [...document.querySelectorAll('#copilot .cp-card')].map(c => ({ text: c.innerText, tag: (c.querySelector('.cp-tag') || {}).innerText || '' })));
const leadName = page => page.evaluate(() => (document.querySelector('.lead-name, #leadName, .ln-name, h2.lead-name') || document.querySelector('.lead-card h2') || {}).textContent || '');
const mem = (page, name) => page.evaluate(name => { const db = JSON.parse(localStorage.getItem('__mockfs') || '{}'); let out = null, call = null;
  Object.keys(db).forEach(k => { if (/leadChunks\//.test(k) && db[k].leads) Object.values(db[k].leads).forEach(l => { if (l.name === name && l.cpm) out = l.cpm; }); });
  Object.keys(db).forEach(k => { if (/callDays\//.test(k) && db[k].calls) Object.values(db[k].calls).forEach(c => { if (c.name === name && c.cpk) call = c; }); });
  return { cpm: out, call }; }, name);

(async () => {
  const br = await chromium.launch();
  for (const s of ['light', 'dark']) {
    const tag = '1440 ' + s;
    const { ctx, page, errs, reqs } = await boot(br, { s });
    const name = (await page.evaluate(() => { const h = [...document.querySelectorAll('h1,h2,h3,.lead-name')].find(x => /\w+ \w+/.test(x.textContent) && x.getBoundingClientRect().height > 20); return h ? h.textContent.trim() : ''; }));
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(900);
    check(tag + ': cp-mind.js loaded with the playbook', reqs.filter(u => /cp-mind\.js/.test(u)).length === 1);
    let n = await now(page);
    check(tag + ': Now card: a title and every part (do, say, what, why, aim)', n && n.title && /Do:/.test(n.text) && /SAY/i.test(n.text) && /What’s happening:/.test(n.text) && /Why:/.test(n.text) && /Aim:/.test(n.text), n);
    check(tag + ': where the deal stands, without a made-up number', n.band && !/\d+%/.test(n.band), n.band);
    await say(page, 'honestly it is way too expensive for me');
    n = await now(page);
    check(tag + ': an objection → the value approach, with the heard line as evidence', /Value/.test(n.title) && n.ev.some(e => /^Heard/.test(e) && /too expensive/.test(e)) && /Separate price from value/.test(n.text), n);
    await say(page, 'trust me this is guaranteed to double');
    n = await now(page);
    check(tag + ': a promise on your own words → a stop, with what to say instead', n.alerts.some(a => a[0] === 'stop' && /Nobody can promise/.test(a[1])), n.alerts);
    await say(page, "okay so what's the minimum to get in");
    n = await now(page);
    check(tag + ': buying signal (qualified lead) → ask for the commitment', /Ask for the commitment/.test(n.title) && n.stage === 'Close', n);
    await say(page, 'let me tell you a little bit more about the company'); await say(page, 'they were founded a few years ago in california');
    n = await now(page);
    check(tag + ': the pitch went on after the signal → go back and ask', n.alerts.some(a => /buying signal/.test(a[1]) && /Go back to it/.test(a[1])), n.alerts);
    check(tag + ': investments close without risk talk → say the risks', n.alerts.length >= 1 && (n.alerts.some(a => /risks out loud/.test(a[1])) || n.alerts.length === 2), n.alerts);
    const firstPrice = (await cards(page)).find(c => /too expensive/.test(c.text));
    const firstMethod = firstPrice ? firstPrice.tag.split(' · ')[0] : '';
    // log the call: Interested
    await page.evaluate(() => document.getElementById('copyBtn').click()); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="interested"]').click()); await page.waitForTimeout(600);
    await page.evaluate(() => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); document.querySelectorAll('.toast').forEach(t => t.remove()); });
    await page.waitForTimeout(3500);
    const m = await mem(page, name);
    check(tag + ': memory saved on the lead and synced: the concern, the signal, the answers tried', m.cpm && m.cpm.calls === 1 && m.cpm.o && m.cpm.o.price && m.cpm.o.price[0] === 1 && m.cpm.s && m.cpm.s.buy === 1 && m.cpm.lastObj === 'price' && m.cpm.t.length >= 1 && m.cpm.out === 'interested', [name, m.cpm]);
    check(tag + ': the call carries what kinds of concerns came up (learning)', m.call && m.call.cpk.includes('value') && m.call.cpk.includes('signal'), m.call && m.call.cpk);
    check(tag + ': memory stays small', JSON.stringify(m.cpm || {}).length < 1500, JSON.stringify(m.cpm || {}).length);
    // call the same person again (from their profile, the way a rep would): pick up where you left off
    const lid = await page.evaluate(name => { const db = JSON.parse(localStorage.getItem('__mockfs') || '{}'); let id = '';
      Object.keys(db).forEach(k => { if (/leadChunks\//.test(k) && db[k].leads) Object.entries(db[k].leads).forEach(([i, l]) => { if (l.name === name) id = i; }); }); return id; }, name);
    await page.evaluate(() => document.querySelector('[data-view="history"]').click()); await page.waitForTimeout(500);
    await page.evaluate(id => { const b = document.querySelector('[data-open-lead="' + id + '"]'); if (b) b.click(); }, lid); await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector('#leadModalBody .call-btn'); if (b) b.click(); }); await page.waitForTimeout(700);
    await page.evaluate(() => { const m = document.querySelector('#leadModal'); if (m) m.classList.remove('show'); const t = document.querySelector('[data-view="dial"]'); if (t) t.click(); return 1; });
    await page.waitForTimeout(600);
    n = await now(page);
    check(tag + ': next call with the same person → pick up where you left off, from memory', /Pick up where you left off/.test(n.title) && n.ev.some(e => /^On record/.test(e) && /Last time/.test(e) && /too expensive/i.test(e)), n);
    await page.evaluate(() => document.querySelector('[data-el-say="price"]').click()); await page.waitForTimeout(250);
    const again = (await cards(page))[0];
    check(tag + ': never the same answer this person already heard', again && firstMethod && again.tag.split(' · ')[0] !== firstMethod, [firstMethod, again && again.tag]);
    check(tag + ': no page errors', !errs.length, errs);
    if (s === 'light') await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/mind-1440.png' });
    await ctx.close();
  }
  // early "not interested" on a fresh call → earn 60 seconds; twice → step back
  {
    const { ctx, page, errs } = await boot(br, { w: 1280, s: 'dark' });
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(900);
    await say(page, 'not interested');
    let n = await now(page);
    check('brush-off: an early "not interested" → earn the next 60 seconds (a guess, labeled)', /Earn the next 60 seconds/.test(n.title) && n.ev.some(e => /^Guess/.test(e)), n);
    await say(page, "look i said i'm not interested");
    n = await now(page);
    check('brush-off: a second "not interested" → check, then step back', /Check, then step back/.test(n.title) && /timing, or is this something you'd never/.test(n.text), n);
    check('brush-off: no page errors', !errs.length, errs);
    await ctx.close();
  }
  // the phone (tap mode) gets the same reasoning
  {
    const { ctx, page, errs } = await boot(br, { w: 390, h: 844, s: 'dark' });
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelector('[data-el-say="spouse"]').click()); await page.waitForTimeout(250);
    const n = await now(page);
    check('phone: tap "spouse" → decision-maker approach', /Decision-maker/.test(n.title) && /set a call with both/.test(n.text), n);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check('phone: no sideways scroll', ov <= 1, ov);
    check('phone: no page errors', !errs.length, errs);
    await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/mind-390.png' });
    await ctx.close();
  }
  // nobody else
  for (const o of [{ n: 'rep', user: 'sam', w: 1280 }, { n: 'demo', demo: 'insurance', w: 1280 }]) {
    const { ctx, page, errs, reqs } = await boot(br, o);
    await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(800);
    await say(page, 'honestly it is way too expensive for me');
    check(o.n + ': no Now card, cp-mind.js never loaded', !(await now(page)) && !reqs.some(u => /cp-mind\.js/.test(u)));
    check(o.n + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`copilot_mind_live: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
