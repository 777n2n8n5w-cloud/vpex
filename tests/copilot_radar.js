// VPEX regression check (copilot_radar): round 3 of the Copilot Mind (owner only). The redesigned panel (the move to make
// on top and short, the reasoning one tap away, earlier answers folded, settings in a menu), Opportunity Radar (every
// deal with activity, bucketed on evidence with the one next action, fast), deal diagnosis on the lead profile (phase,
// next action, what's in the way, what Copilot remembers, the follow-up with a ready text), team coaching, patterns,
// phone fit, and nobody else seeing any of it.
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
// seed memory and qualifying answers on three leads, so the Radar has a deal at risk, one not qualified and one remembered
async function boot(br, o) {
  const ctx = await br.newContext({ timezoneId: 'America/New_York', viewport: { width: o.w || 1440, height: o.h || 900 }, colorScheme: o.s || 'light', isMobile: (o.w || 1440) < 500, hasTouch: (o.w || 1440) < 500 });
  await ctx.addInitScript(FAKE);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:8765' });
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
      const db = demoSeed(), now = Date.now(), seeded = {};
      db['members/vOwn'] = { username: 'vincent', name: 'Vincent', role: 'admin', active: true, lastSeen: now };
      const all = []; Object.keys(db).forEach(k => { if (/^leadChunks\/c/.test(k) && db[k].leads) Object.entries(db[k].leads).forEach(([id, l]) => all.push([k, id, l])); });
      const pick = (f) => all.find(x => f(x[2]) && !seeded[x[1]]);
      const a = pick(l => l.outcome === 'interested'); if (a) { seeded[a[1]] = 'mem'; Object.assign(a[2], { qf: Object.assign({}, a[2].qf, { accredited: 'Yes', check: '$100K' }), cpm: { v: 1, calls: 2, last: now - 86400000, o: { spouse: [2, now - 86400000], price: [1, now - 2 * 86400000] }, s: { buy: 1 }, t: ['price-a', 'spouse-a', 'bk-acct'], lastObj: 'spouse', f: [{ t: 'Retired teacher, wants to diversify', src: 'ai' }], st: 'trial', out: 'callback' } }); }
      const b = pick(l => !!l.calledAt); if (b) { seeded[b[1]] = 'notq'; b[2].qf = Object.assign({}, b[2].qf, { accredited: 'No' }); }
      const c = pick(l => !!l.calledAt); if (c) { seeded[c[1]] = 'risk'; c[2].cpm = { v: 1, calls: 3, o: { notint: [2, now], trust: [2, now] }, lastObj: 'notint' }; c[2].qf = Object.assign({}, c[2].qf, { accredited: 'Yes', check: '$25K' }); }
      window.__seeded = seeded; localStorage.setItem('__seeded', JSON.stringify(Object.fromEntries(Object.entries(seeded).map(([id, k]) => [k, id]))));
      Object.keys(db).forEach(k => { if (/^leadChunks\/c/.test(k)) { /* written back below */ } });
      localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      const email = (o.user || 'vincent') + '@dovetail-f863c.firebaseapp.com', uid = o.user === 'sam' ? 'dR2' : 'vOwn';
      localStorage.setItem('__mockauth', JSON.stringify({ [email]: { uid, pw: 'test' } })); localStorage.setItem('vpex_oc_seen', String(now));
      sessionStorage.setItem('__mocksess', JSON.stringify({ uid, email }));
    }, o);
    await page.goto(BASE); await page.waitForTimeout(2600);
  }
  await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.classList.remove('show')));
  return { ctx, page, errs, reqs };
}
const seeded = page => page.evaluate(() => JSON.parse(localStorage.getItem('__seeded') || '{}'));
const openCopilot = async page => { await page.evaluate(() => document.querySelector('[data-cp-toggle]').click()); await page.waitForTimeout(900); };
const openRadar = async page => { await page.evaluate(() => { const m = document.querySelector('#copilot .el-menu'); if (m && m.hidden) document.getElementById('elMenuBtn').click(); }); await page.waitForTimeout(150); await page.evaluate(() => document.getElementById('elRadar').click()); await page.waitForTimeout(700); };
const sheet = page => page.evaluate(() => { const m = document.querySelector('#featModal.show, .modal-overlay.show'); return m ? m.innerText : ''; });

(async () => {
  const br = await chromium.launch();
  for (const v of [{ n: '1440 light', w: 1440, s: 'light' }, { n: '390 dark', w: 390, h: 844, s: 'dark' }]) {
    const tag = v.n;
    const { ctx, page, errs } = await boot(br, v);
    const S = await seeded(page);
    await openCopilot(page);
    // the panel: menu, Now card on top
    const menu0 = await page.evaluate(() => { const m = document.querySelector('#copilot .el-menu'), b = document.getElementById('elMenuBtn'); return { hidden: !!(m && m.hidden), btn: b && b.getBoundingClientRect().height }; });
    check(tag + ': settings live in the menu (closed), ⋯ button 44 px', menu0.hidden && menu0.btn >= 44, menu0);
    await page.evaluate(() => document.getElementById('elMenuBtn').click()); await page.waitForTimeout(120);
    const menu1 = await page.evaluate(() => { const m = document.querySelector('#copilot .el-menu'); return m && !m.hidden ? [...m.querySelectorAll('button,select')].map(b => [b.id, Math.round(b.getBoundingClientRect().height)]) : null; });
    check(tag + ': the menu opens: playbook, Radar, What wins' + (v.w > 500 ? ', Brain' : ''), menu1 && ['elInd', 'elRadar', 'elRes'].concat(v.w > 500 ? ['elBrain'] : []).every(id => menu1.some(b => b[0] === id && b[1] >= 44)), menu1);
    await page.evaluate(() => document.getElementById('elMenuBtn').click()); await page.waitForTimeout(120);
    if (v.w > 500) { for (const t of ['honestly it is way too expensive', "i'd have to ask my accountant first", 'is this even legit']) { await page.evaluate(t => window.__say(t), t); await page.waitForTimeout(200); } }
    else { for (const k of ['price', 'advisor', 'trust']) { await page.evaluate(k => document.querySelector('[data-el-say="' + k + '"]').click(), k); await page.waitForTimeout(150); } }
    const lay = await page.evaluate(() => {
      const p = document.getElementById('copilot'), body = p.querySelector('.cp-body'), now = p.querySelector('.el-next'), t = now.querySelector('.mn-title'), r = t.getBoundingClientRect(), pr = p.getBoundingClientRect();
      const older = p.querySelector('details.el-older'), why = p.querySelector('details.mn-why');
      const vis = [...p.querySelectorAll('button, select, summary')].filter(b => b.offsetParent && b.getBoundingClientRect().height > 0).map(b => Math.round(b.getBoundingClientRect().height));
      return { titleVisible: r.top >= pr.top && r.bottom <= pr.bottom, scrollTop: body.scrollTop, nowFirst: !!now && (now.compareDocumentPosition(p.querySelector('.cp-card')) & Node.DOCUMENT_POSITION_FOLLOWING) > 0,
        older: older ? { open: older.open, sum: older.querySelector('summary').innerText, cards: older.querySelectorAll('.cp-card').length } : null, whyOpen: why ? why.open : null, minBtn: Math.min.apply(null, vis), ov: document.documentElement.scrollWidth - innerWidth };
    });
    check(tag + ': after three objections the move to make is on top and in view', lay.titleVisible && lay.nowFirst && lay.scrollTop === 0, lay);
    check(tag + ': earlier answers folded into one line naming them', lay.older && !lay.older.open && lay.older.cards === 2 && /Earlier on this call: .+ · .+/.test(lay.older.sum), lay.older);
    check(tag + ': "Why this move" open on a computer, folded on a phone', v.w > 500 ? lay.whyOpen === true : lay.whyOpen === false, lay.whyOpen);
    check(tag + ': every visible control at least 44 px, no sideways scroll', lay.minBtn >= 44 && lay.ov <= 1, lay);
    if (v.w > 500) await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/r3-panel-1440.png' });
    else await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/r3-panel-390.png' });
    // the Radar
    await openRadar(page);
    const rad = await page.evaluate(() => { const m = document.querySelector('#featModal'); const rows = [...m.querySelectorAll('.rd-row')];
      return { title: (m.querySelector('h3') || {}).textContent, sub: (m.querySelector('.modal-sub') || {}).textContent, secs: [...m.querySelectorAll('.rd-pane[data-rd="pipe"] .rd-h b')].map(b => b.textContent),
        rows: rows.map(r => ({ id: r.getAttribute('data-radar-lead'), b: r.className.replace(/.*b-/, ''), t: r.textContent.replace(/\s+/g, ' '), h: r.getBoundingClientRect().height })), tabs: [...m.querySelectorAll('[data-rd-tab]')].map(b => b.textContent),
        notq: (m.querySelector('.rd-note') || {}).textContent || '', ov: document.documentElement.scrollWidth - innerWidth }; });
    const ms = +((rad.sub.match(/in (\d+) ms/) || [])[1]);
    check(tag + ': Opportunity Radar opens with how many deals it checked and how fast', rad.title === 'Opportunity Radar' && /deals checked in \d+ ms/.test(rad.sub) && ms < 800, rad.sub);
    check(tag + ': sections on evidence: needs a push / at risk / moving', rad.secs.includes('Needs a push') && rad.secs.includes('At risk') && rad.secs.includes('Moving'), rad.secs);
        const riskRow = rad.rows.find(r => r.id === S.risk), memRow = rad.rows.find(r => r.id === S.mem);
    check(tag + ': the lead who said no twice (and doubted us twice) is at risk, with the evidence', riskRow && riskRow.b === 'atrisk' && /not interested ×2|legit ×2|trust/i.test(riskRow.t), riskRow);
    check(tag + ': the remembered deal: the last concern (spouse) comes before "move to commitment"', memRow && /Resolve: I need to talk to my spouse/.test(memRow.t) && /Last time this was in the way/.test(memRow.t), memRow);
    check(tag + ': not-qualified deals are counted, not pushed', !rad.rows.some(r => r.id === S.notq) && /not qualified/.test(rad.notq), rad.notq);
    check(tag + ': every row is a 44 px tap target', rad.rows.every(r => r.h >= 44), rad.rows.map(r => r.h));
    check(tag + ': tabs: Pipeline, Patterns, Team', rad.tabs.join() === 'Pipeline,Patterns,Team', rad.tabs);
    check(tag + ': no sideways scroll in the Radar', rad.ov <= 1, rad.ov);
    const onTop = await page.evaluate(() => { const r = document.querySelector('#featModal .modal').getBoundingClientRect(), pts = [[0.5, 0.5], [0.8, 0.7], [0.3, 0.85], [0.9, 0.3]];
      return pts.map(([x, y]) => { const e = document.elementFromPoint(r.left + r.width * x, r.top + Math.min(r.height, innerHeight - r.top - 4) * y); return !!(e && e.closest('#featModal')); }); });
    check(tag + ': the Radar sits on top: Copilot never covers it', onTop.every(Boolean), onTop);
    if (v.w > 500) await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/r3-radar-1440.png' });
    else await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/r3-radar-390.png' });
    await page.evaluate(() => document.querySelector('[data-rd-tab="patterns"]').click()); await page.waitForTimeout(150);
    const pat = await page.evaluate(() => document.querySelector('.rd-pane[data-rd="patterns"]').innerText);
    check(tag + ': Patterns: where deals sit, what follows each kind of concern, honest caveat', /Where deals sit/.test(pat) && /What happens after each kind of concern/.test(pat) && /not proof yet/.test(pat), pat.slice(0, 200));
    await page.evaluate(() => document.querySelector('[data-rd-tab="team"]').click()); await page.waitForTimeout(150);
    const team = await page.evaluate(() => [...document.querySelectorAll('.rd-pane[data-rd="team"] .rd-rep')].map(r => r.innerText));
    check(tag + ': Team: one targeted tip per active rep', team.length >= 2 && team.every(t => t.split('\n').length >= 2), team);
    await page.evaluate(() => document.querySelector('[data-rd-tab="pipe"]').click());
    // a row opens the deal: the profile has Copilot's read
    await page.evaluate(id => document.querySelector('[data-radar-lead="' + id + '"]').click(), S.mem); await page.waitForTimeout(700);
    const lp = await page.evaluate(() => { const b = document.getElementById('lpMind'); return b ? { t: b.innerText, btns: [...b.querySelectorAll('button')].map(x => [x.textContent, Math.round(x.getBoundingClientRect().height)]) } : null; });
    check(tag + ': a Radar row opens the deal; the profile shows Copilot\'s read (phase, next, why)', lp && /Copilot read/.test(lp.t) && /Next:/.test(lp.t), lp);
    check(tag + ': what\'s in the way, and what Copilot remembers (concerns ×n, signals, answers tried, AI-heard fact)', lp && /Remembered/.test(lp.t) && /2 calls with Copilot/.test(lp.t) && /×2/.test(lp.t) && /Buying signals: 1/.test(lp.t) && /3 answers tried/.test(lp.t) && /AI heard: Retired teacher/.test(lp.t), lp && lp.t);
    check(tag + ': the follow-up: what, when, why (spouse → evening, both)', lp && /Follow-up: Call with both/.test(lp.t) && /(7:00 PM|7 PM [A-Z]{2} their time)/.test(lp.t), lp && lp.t);
    await page.evaluate(() => document.querySelector('#lpMind [data-lpmind-text]').click()); await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    check(tag + ': copy a follow-up text from the profile (their name, both of you)', /both of you/.test(clip) && /^Hi \w+/.test(clip), clip);
    check(tag + ': profile buttons 44 px', lp && lp.btns.every(b => b[1] >= 44), lp && lp.btns);
    const cover = await page.evaluate(() => { const b = document.getElementById('lpMind'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(), c = document.getElementById('copilot').getBoundingClientRect();
      const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('#leadModal') ? 'profile' : e.closest('#copilot') ? 'copilot' : 'other') : 'none'; };
      return { read: [0.2, 0.5, 0.85].map(x => hit(r.left + r.width * x, r.top + Math.min(r.height, 60) / 2)), cp: c.width ? hit(c.left + c.width / 2, c.top + 20) : 'hidden', desk: document.body.classList.contains('desk'), shown: [...document.querySelectorAll('.modal-overlay.show')].map(m => m.id), cpr: getComputedStyle(document.getElementById('copilot')).right }; });
    check(tag + ': Copilot never covers the profile\'s read' + (v.w > 1100 ? ', and stays in view beside it' : ''), cover.read.every(x => x === 'profile') && (!cover.desk || cover.cp === 'copilot'), cover);
    if (v.w > 500) await page.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/r3-profile-1440.png' });
    check(tag + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  // nobody else: no Radar, no profile read, cp-mind.js never loaded
  for (const o of [{ n: 'rep', user: 'sam', w: 1280 }, { n: 'demo', demo: 'insurance', w: 1280 }]) {
    const { ctx, page, errs, reqs } = await boot(br, o);
    await openCopilot(page);
    const r = await page.evaluate(() => ({ menu: !!document.getElementById('elMenuBtn'), radar: !!document.getElementById('elRadar') }));
    await page.evaluate(() => { const b = document.querySelector('.up-item, [data-open-lead]'); if (b) b.click(); }); await page.waitForTimeout(600);
    const lp = await page.evaluate(() => !!document.getElementById('lpMind'));
    check(o.n + ': no menu, no Radar, no profile read, cp-mind.js never loaded', !r.menu && !r.radar && !lp && !reqs.some(u => /cp-mind\.js/.test(u)), [r, lp]);
    check(o.n + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`copilot_radar: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
