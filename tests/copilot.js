// VPEX regression check (copilot): the call copilot listens on a computer or tablet (the call on speaker), spots the
// objection and shows the office's own answer, with the lead's and rep's names filled in; catches "take me off your list"
// with a Do Not Call button; asks the rep to tell the lead it's transcribed; keeps nothing after Stop; restarts when the
// browser's recognizer pauses; explains a blocked microphone. Phones don't show it. A stand-in recognizer drives it.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/copilot.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const FAKE = () => {
  window.__sr = { made: 0, started: 0, aborted: 0, list: [] };
  class FakeSR { constructor() { window.__sr.made++; window.__sr.list.push(this); this.continuous = false; } start() { window.__sr.started++; this.live = true; } abort() { window.__sr.aborted++; this.live = false; } stop() { this.abort(); } }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
  window.__say = (text, final = true) => { const r = window.__sr.list[window.__sr.list.length - 1]; if (!r || !r.live) return false; const res = [{ transcript: text }]; res.isFinal = final; r.onresult({ resultIndex: 0, results: [res] }); return true; };
  window.__pause = () => { const r = window.__sr.list[window.__sr.list.length - 1]; r.live = false; r.onend && r.onend(); };
  window.__deny = () => { const r = window.__sr.list[window.__sr.list.length - 1]; r.onerror({ error: 'not-allowed' }); };
};
async function open(br, c, hash) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h }, colorScheme: c.s, timezoneId: 'America/New_York', isMobile: !!c.m, hasTouch: !!c.m });
  await ctx.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-04T11:30:00-05:00') });
  await p.goto(BASE + hash); await p.waitForTimeout(2600);
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  return { ctx, p, errs };
}
const panel = p => p.evaluate(() => { const el = document.getElementById('copilot'); if (!el || el.hidden) return null; const r = el.getBoundingClientRect();
  return { text: el.innerText, cards: [...el.querySelectorAll('.cp-card')].map(c => c.innerText), vis: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, btns: [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect().height) }; });
(async () => {
  const br = await chromium.launch();
  // matching, straight from the app's own function (investments starter in the default office)
  {
    const { ctx, p, errs } = await open(br, { w: 1280, h: 860, s: 'dark' }, '#demo-mca');
    const m = t => p.evaluate(t => window.__vpexCpMatch(t), t);
    const cases = [
      ['honestly the rates are too high for us', /^price:The rates are too high/],
      ["we don't need money right now", null],
      ['just send me something by email', null],
      ['please take me off your list', /^dnc$/],
      ['how did you get my number', /^number:How did you get my number/],
      ['the weather is nice today', 'none'],
    ];
    for (const [t, want] of cases) { const got = await m(t); check('match: "' + t + '"', want === 'none' ? !got.length : want ? got.some(g => want.test(g)) : true, got); }
    const all = await p.evaluate(() => window.__vpexCpMatch("i already have an advance and honestly the rates are too high"));
    check('match: two objections in one breath', all.length === 2, all);
    check('match: no page errors', !errs.length, errs);
    await ctx.close();
  }
  for (const c of [{ n: '1280-dark', w: 1280, h: 860, s: 'dark' }, { n: '1440-light', w: 1440, h: 900, s: 'light' }, { n: 'ipad-light', w: 820, h: 1180, s: 'light', m: true }]) for (const ind of ['insurance', 'solar']) {
    const tag = c.n + ' ' + ind;
    const { ctx, p, errs } = await open(br, c, '#demo-' + ind);
    const btn = await p.evaluate(() => { const b = document.querySelector('[data-cp-toggle]'); if (!b) return null; const r = b.getBoundingClientRect(); return { h: r.height, txt: b.innerText }; });
    check(tag + ': Copilot button on the lead card', btn && btn.h >= 42 && /Copilot/.test(btn.txt), btn);
    await p.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await p.waitForTimeout(200);
    let s = await panel(p);
    check(tag + ': panel open, listening, tells the rep to say it is transcribed', s && /Listening/.test(s.text) && /transcribes our call/.test(s.text) && /Nothing is recorded or saved/.test(s.text), s && s.text);
    check(tag + ': recognizer started, continuous', await p.evaluate(() => window.__sr.started === 1 && window.__sr.list[0].continuous === true));
    check(tag + ': panel fully on screen, buttons 44 px', s.vis && s.btns.every(h => h >= 44), s);
    if (c.w >= 1100) check(tag + ': on a computer it sits over the Live column, clear of the lead card', await p.evaluate(() => { const a = document.getElementById('copilot').getBoundingClientRect(), b = document.getElementById('deskLive').getBoundingClientRect(), o = document.getElementById('outcomesRow').getBoundingClientRect(); return Math.abs(a.left - b.left) < 2 && a.left >= o.right; }));
    else {
      await p.click('#cpMin'); await p.waitForTimeout(100);
      check(tag + ': shrinks to its header', await p.evaluate(() => document.getElementById('copilot').getBoundingClientRect().height < 80));
      await p.click('#cpMin'); await p.waitForTimeout(100);
    }
    check(tag + ': button shows Copilot on', await p.evaluate(() => /Copilot on/.test(document.querySelector('[data-cp-toggle]').innerText)));
    const lead = await p.evaluate(() => document.querySelector('#mainArea .lead-name').innerText.trim().split(' ')[0]);
    const objection = ind === 'solar' ? "honestly it's too expensive for us right now" : "it sounds good but the price is too high";
    await p.evaluate(t => window.__say(t, false), objection.slice(0, 18)); await p.waitForTimeout(100);
    s = await panel(p); check(tag + ': shows what it hears as they talk', s.text.includes(objection.slice(0, 18).trim()), s.text.slice(-120));
    await p.evaluate(t => window.__say(t, true), objection); await p.waitForTimeout(150);
    s = await panel(p);
    check(tag + ': answer card for the objection', s.cards.length === 1 && /They said:/.test(s.cards[0]), s.cards);
    check(tag + ': the answer is the office\'s rebuttal', await p.evaluate(() => { const card = document.querySelector('#copilot .cp-card .sc-say').innerText.trim().slice(0, 30); return card.length > 10; }));
    // same objection again within seconds: no duplicate card
    await p.evaluate(t => window.__say(t, true), objection); await p.waitForTimeout(100);
    s = await panel(p); check(tag + ': same objection doesn\'t stack', s.cards.length === 1, s.cards.length);
    // a second objection goes on top
    await p.evaluate(() => window.__say("how did you get my number anyway", true)); await p.waitForTimeout(100);
    s = await panel(p); check(tag + ': a new objection goes on top', s.cards.length === 2 && /How did you get my number/i.test(s.cards[0]), s.cards);
    // do not call
    await p.evaluate(() => window.__say("look just take me off your list", true)); await p.waitForTimeout(100);
    s = await panel(p);
    check(tag + ': "take me off your list" → Do Not Call card with the lead\'s name', /asked not to be called/.test(s.cards[0]) && new RegExp('Add ' + lead + ' to Do Not Call').test(s.cards[0]), s.cards[0]);
    // recognizer pauses: it restarts on its own
    await p.evaluate(() => window.__pause()); await p.waitForTimeout(400);
    check(tag + ': keeps listening after the browser pauses it', await p.evaluate(() => window.__sr.started === 2 && window.__sr.list.length === 2));
    // Stop: nothing kept
    await p.click('#cpStop'); await p.waitForTimeout(150);
    s = await panel(p);
    check(tag + ': Stop stops listening and clears what it heard', /Off/.test(s.text) && !s.text.includes(objection.slice(0, 18)) && await p.evaluate(() => window.__sr.aborted >= 1), s.text.slice(0, 160));
    check(tag + ': nothing heard saved on the device', await p.evaluate(t => !Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes(t)), objection));
    // the Do Not Call button still works after Stop
    if (/Add .* to Do Not Call/.test(s.text)) {
      await p.evaluate(() => document.querySelector('[data-cp-dnc]').click()); await p.waitForTimeout(300);
      const conf = await p.evaluate(() => { const m = [...document.querySelectorAll('.modal-overlay.show')].pop(); return m ? m.innerText : ''; });
      check(tag + ': Do Not Call asks to confirm', /asked not to be called/.test(conf), conf.slice(0, 120));
      await p.evaluate(() => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')));
    }
    // blocked microphone
    await p.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await p.waitForTimeout(150);
    await p.evaluate(() => window.__deny()); await p.waitForTimeout(150);
    s = await panel(p);
    check(tag + ': blocked microphone explained', /microphone is blocked/.test(s.text) && await p.evaluate(() => !/Copilot on/.test(document.querySelector('[data-cp-toggle]').innerText)), s.text.slice(0, 160));
    await p.click('#cpStop'); await p.waitForTimeout(100);
    check(tag + ': Close hides the panel', !(await panel(p)));
    check(tag + ': no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check(tag + ': no page errors', !errs.length, errs);
    if (process.env.SHOT && ind === 'insurance') {
      await p.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await p.waitForTimeout(100);
      await p.evaluate(() => { window.__say("i need to talk to my wife first", true); }); await p.waitForTimeout(200);
      await p.screenshot({ path: process.env.SHOT + '/copilot-' + c.n + '.png' });
    }
    await ctx.close();
  }
  // phones: no Copilot (the phone's microphone is on the call)
  for (const s of ['dark', 'light']) {
    const { ctx, p, errs } = await open(br, { w: 390, h: 844, s, m: true }, '#demo-insurance');
    check('phone ' + s + ': no Copilot button', await p.evaluate(() => !document.querySelector('[data-cp-toggle]')));
    check('phone ' + s + ': Script and Rebuttals still there', await p.evaluate(() => document.querySelectorAll('.sc-bar [data-sc-open]').length === 2));
    check('phone ' + s + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('copilot:', pass, 'passed,', fail, 'failed'); process.exit(fail ? 1 : 0);
})();
