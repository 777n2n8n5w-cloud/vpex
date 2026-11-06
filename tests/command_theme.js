// VPEX regression check (command_theme): Command Center is drawn in the owner's own theme (colors, fonts, background),
// public or Signature, light or dark, with readable text. Seeds the same fictional operation as command_center.js.
// (setup below copied from command_center.js) Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/command_center.js
// The owner's Command Center, on the in-page backend with a fictional operation: the owner's floor (Mia dialing, Sam idle,
// Jordan not started), four customer offices (a declined card, a trial ending, a brand-new signup, a paying office gone quiet),
// a week of site funnel counts, the posting bot's results, and one failed automation run (GitHub answered from a fixture).
// Checks: only the owner gets it; the numbers add up; Needs you ranks the right things with working one-tap fixes;
// the floor board, offices, growth, content, systems and controls panels; search; pins; customize; keyboard; #command;
// the rules (the bot's key stays hidden even from the owner; an admin can't read the funnel); phone and desktop layouts.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = Date.parse('2026-11-05T19:20:00Z');   // Thu Nov 5, 2:20 PM in New York
const MIN = 60000, DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString();
const ny = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

function seed() {
  const db = {};
  db['members/vOwn'] = { username: 'vincent', name: 'Vincent Nickel', role: 'admin', active: true, lastSeen: NOW };
  db['members/r1'] = { username: 'mia', name: 'Mia Chen', role: 'rep', active: true };
  db['members/r2'] = { username: 'sam', name: 'Sam Ortiz', role: 'rep', active: true };
  db['members/r3'] = { username: 'jordan', name: 'Jordan Lee', role: 'rep', active: true };
  db['config/billing'] = { price: 49, foundingPrice: 29 };
  // the owner's floor today: Mia 30 calls up to a minute ago (8 conversations, 4 interested), Sam 8 calls, last one 50 minutes ago
  const calls = {};
  const call = (uid, name, i, ts, o) => { calls[uid + i] = { leadId: 'L' + (i % 5), name: 'Lead ' + i, outcomeKey: o, outcome: o, attempt: 1, timestamp: iso(ts), by: { uid, name } }; };
  for (let i = 0; i < 30; i++) call('r1', 'Mia Chen', i, NOW - MIN - i * 4 * MIN, i < 4 ? 'interested' : i < 8 ? 'notinterested' : 'noanswer');
  for (let i = 0; i < 8; i++) call('r2', 'Sam Ortiz', i, NOW - 50 * MIN - i * 6 * MIN, i === 0 ? 'callback' : 'noanswer');
  const byDoc = {};
  Object.keys(calls).forEach(k => { const c = calls[k], d = new Date(c.timestamp); const key = d.toISOString().slice(0, 10) + '_' + c.by.uid + '_' + String(d.getUTCHours()).padStart(2, '0'); (byDoc[key] = byDoc[key] || {})[k] = c; });
  Object.keys(byDoc).forEach(k => { db['callDays/' + k] = { calls: byDoc[k] }; });
  db['leadChunks/c001'] = { leads: {
    L1: { name: 'Grace Hayes', phone: '(201) 555-0142', stage: 'Committed', amount: 50000, owner: { uid: 'r1', name: 'Mia Chen' }, outcome: 'interested', tasks: [] },
    L2: { name: 'Thomas Ross', phone: '(305) 555-0177', stage: 'Pitched', amount: 40000, owner: { uid: 'r1', name: 'Mia Chen' }, outcome: 'interested',
      tasks: [{ id: 't2', type: 'Follow-up', note: 'Interested', due: '2026-11-03', dueAt: NOW - 2 * DAY, assignee: { uid: 'r2', name: 'Sam Ortiz' } }] },
    L3: { name: 'Amelia Patel', phone: '(415) 555-0190', stage: 'Qualified', amount: 20000, owner: { uid: 'r2', name: 'Sam Ortiz' }, outcome: 'callback', tasks: [] } } };
  // four customer offices
  const off = (id, d, reps, calls7, extra) => {
    db['offices/' + id] = Object.assign({ name: d.name, industry: 'insurance', ownerUid: id + '0', createdAt: NOW - 20 * DAY, invite: 'abc123xyz', locked: false }, d);
    for (let k = 0; k < reps; k++) db['offices/' + id + '/members/' + id + k] = k === 0 ? { username: 'boss', name: d.boss, role: 'admin', active: true, lastSeen: NOW - 3600000, phone: '(305) 555-01' + (10 + reps) } : { name: 'Rep ' + k, role: 'rep', active: true };
    if (calls7) db['offices/' + id + '/callDays/n_' + ny(NOW - DAY).replace(/(\d+)-(\d+)-(\d+)/, '$1-$2-$3')] = { c: calls7 };
    db['offices/' + id + '/leadChunks/c001'] = { leads: extra && extra.noLeads ? {} : { a: { name: 'x' }, b: { name: 'y' } } };
  };
  off('harbor-ins', { name: 'Harbor Insurance', plan: 'paid', paidThrough: NOW + 20 * DAY, stripeSub: 'sub_1', payFailed: true, boss: 'Dana Cruz' }, 5, 180);
  off('quietco', { name: 'Quiet Co Realty', plan: 'paid', paidThrough: NOW + 12 * DAY, boss: 'Pat Moss' }, 2, 0);
  off('acme', { name: 'Acme Auto Sales', plan: 'trial', trialEnds: NOW + 1.5 * DAY, boss: 'Ray Diaz' }, 3, 95);
  off('newco', { name: 'Newco Solar', plan: 'trial', trialEnds: NOW + 7 * DAY, createdAt: NOW - 2 * 3600000, boss: 'Kim Lo' }, 1, 0, { noLeads: true });
  // site funnel: this week and last week
  const day = (ms, c) => { db['growth/days/items/' + ny(ms)] = { day: ny(ms), t: 1, c }; };
  day(NOW, { 'visit~ig~-~-~-~-~-': 120, 'visit~google~-~-~-~-~-': 60, 'demo~ig~-~-~-~-~-': 30, 'trial_view~ig~-~-~-~-~-': 12, 'signup~ig~-~-~-~-~-': 3, 'bio_tap~ig~-~-~w7-aq~-~-': 40 });
  day(NOW - 2 * DAY, { 'visit~google~-~-~-~-~-': 20, 'demo~google~-~-~-~-~-': 5, 'signup~google~-~-~-~-~-': 1 });
  day(NOW - 9 * DAY, { 'visit~ig~-~-~-~-~-': 100, 'signup~ig~-~-~-~-~-': 2 });
  db['growth/offices/items/newco'] = { at: NOW - 2 * 3600000, s: 'ig', m: 'bio', n: 'w7-aq', i: 'solar' };
  // the posting bot
  db['igBot/posted/items/w6-hook'] = { status: 'posted', at: (NOW - 2 * DAY) / 1000, title: 'Monday hook' };
  db['igBot/posted/items/w6-miss'] = { status: 'missed', at: (NOW - DAY) / 1000, title: 'Calling hours carousel' };
  db['igBot/meta/items/learnings'] = { at: NOW / 1000, followers: 412, recs: { more: ['before/after'], less: ['quote'], best_slot: 'Tue 11:00', widest_reach_format: 'reel', untested_hooks: ['myth'] } };
  db['igBot/meta/items/token'] = { token: 'NEVER-SHOW-THIS' };
  return db;
}
const GH = { workflow_runs: [
  { id: 11, name: 'Check VPEX notifications', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/x/y/actions/runs/11', head_branch: 'main', event: 'schedule', created_at: iso(NOW - 6 * 3600000), updated_at: iso(NOW - 6 * 3600000) },
  { id: 12, name: 'pages build and deployment', status: 'completed', conclusion: 'success', html_url: 'https://github.com/x/y/actions/runs/12', head_branch: 'main', event: 'push', created_at: iso(NOW - DAY), updated_at: iso(NOW - DAY) },
  { id: 13, name: 'VPEX Instagram bot', status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/y/actions/runs/13', head_branch: 'main', event: 'schedule', created_at: iso(NOW - MIN), updated_at: iso(NOW - MIN) },
  { id: 14, name: 'Deploy VPEX notifications', status: 'completed', conclusion: 'success', html_url: 'https://github.com/x/y/actions/runs/14', head_branch: 'main', event: 'push', created_at: iso(NOW - DAY), updated_at: iso(NOW - DAY) } ] };


(async () => {
  const br = await chromium.launch();
  const OWNER = { uid: 'vOwn', email: 'vincent@dovetail-f863c.firebaseapp.com' };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  for (const [th, w] of [['starfighter', 1280], ['flowlight', 1280], ['neobrutalism', 390], ['wabisabi', 1280], ['sig-urushi', 1280], ['sig-amalfi', 390], ['', 1280]]) {
    const tag = (th || 'auto') + ' ' + w + ': ';
    const ctx = await br.newContext({ viewport: { width: w, height: 860 }, isMobile: w < 500, hasTouch: w < 500, timezoneId: 'America/New_York' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date(NOW) });
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis/, r => r.abort());
    await page.route(/api\.github\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GH) }));
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
    await page.evaluate(([db, sess, th]) => { localStorage.clear(); localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      localStorage.setItem('__mockauth', JSON.stringify({ 'vincent@dovetail-f863c.firebaseapp.com': { uid: 'vOwn', pw: 'testpass1' } }));
      sessionStorage.setItem('__mocksess', JSON.stringify({ uid: sess.uid, email: sess.email }));
      if (th) { localStorage.setItem('dovetail_dialer_theme_v1', th); localStorage.setItem('vpex_sig_ok', '1'); } }, [seed(), OWNER, th]);
    await page.goto(BASE + '?go=1'); await page.waitForTimeout(3200);
    check(tag + 'theme applied', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === (th || null));
    await page.evaluate(() => document.getElementById('cmdBtn').click()); await page.waitForTimeout(1800);
    const r = await page.evaluate(() => {
      const cmd = document.getElementById('cmd'), root = getComputedStyle(document.documentElement), cs = getComputedStyle(cmd), body = getComputedStyle(document.body);
      const prim = cmd.querySelector('.cx-b.pri, .cx-cta'), pc = prim && getComputedStyle(prim);
      const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      return { bg: cs.backgroundColor, bodyBg: body.backgroundColor, font: cs.fontFamily, themeFont: root.getPropertyValue('--font-body').trim(),
        text: rgb(cs.color), textVar: root.getPropertyValue('--text').trim(), bgRgb: rgb(cs.backgroundColor),
        prim: pc && { bg: rgb(pc.backgroundColor), fg: rgb(pc.color) }, sw: document.documentElement.scrollWidth > innerWidth };
    });
    const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
    check(tag + 'background is the theme background', r.bg === r.bodyBg, r);
    check(tag + 'font is the theme font', !r.themeFont || r.font.replace(/[\s'"]/g, '') === r.themeFont.replace(/[\s'"]/g, ''), [r.font, r.themeFont]);
    check(tag + 'text readable on the background (7:1+)', ratio(r.text, r.bgRgb) >= 7, ratio(r.text, r.bgRgb));
    check(tag + 'main button text readable (4.5:1+)', !r.prim || ratio(r.prim.fg, r.prim.bg) >= 4.5, r.prim && ratio(r.prim.fg, r.prim.bg));
    check(tag + 'no sideways scroll', !r.sw);
    check(tag + 'no page errors', !errs.length, errs);
    await ctx.close();
  }
  // the old fixed look is gone: light themes no longer get the dark panel
  await br.close();
  console.log(`command_theme: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
