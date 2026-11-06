// VPEX regression check (command_center). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/command_center.js
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
  async function open(c, sess, db, hash) {
    const ctx = await br.newContext({ viewport: { width: c.w, height: c.h || 844 }, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York', deviceScaleFactor: c.dpr || 1 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.clock.install({ time: new Date(NOW) });
    await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis/, r => r.abort());
    await page.route(/api\.github\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GH) }));
    await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
    await page.evaluate(([db, sess]) => { localStorage.clear(); localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      localStorage.setItem('__mockauth', JSON.stringify({ 'vincent@dovetail-f863c.firebaseapp.com': { uid: 'vOwn', pw: 'testpass1' }, 'boss@acme.vpex.app': { uid: 'acme0', pw: 'testpass1' } }));
      if (sess.office) localStorage.setItem('vpex_office', sess.office);
      sessionStorage.setItem('__mocksess', JSON.stringify({ uid: sess.uid, email: sess.email })); }, [db, sess]);
    await page.goto(BASE + (sess.office ? '?o=' + sess.office : '?go=1') + (hash || '')); await page.waitForTimeout(3200);
    return { ctx, page, errs };
  }
  const OWNER = { uid: 'vOwn', email: 'vincent@dovetail-f863c.firebaseapp.com' };
  const ev = (page, f, a) => page.evaluate(f, a);
  const txt = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
  const fs = (page) => ev(page, () => JSON.parse(localStorage.getItem('__mockfs') || '{}'));

  for (const c of [{ w: 390, n: 'phone' }, { w: 1280, h: 860, n: 'desktop' }]) {
    const tag = ' (' + c.n + ')';
    let { ctx, page, errs } = await open(c, OWNER, seed());
    check('owner: Command button in the header' + tag, await ev(page, () => { const b = document.getElementById('cmdBtn'); return !!b && getComputedStyle(b).display !== 'none'; }));
    await ev(page, () => document.getElementById('cmdBtn').click()); await page.waitForTimeout(1800);
    check('opens full screen' + tag, await ev(page, () => { const r = document.getElementById('cmd'); return !!r && !r.hidden && r.getBoundingClientRect().width === innerWidth; }));
    check('#command in the address' + tag, await ev(page, () => location.hash === '#command'));
    // ---- brief ----
    const brief = await txt(page, '#cx-brief');
    check('brief: monthly revenue $343 (Harbor 5 + Quiet 2 reps at $49)' + tag, /\$343/.test(brief), brief.slice(0, 400));
    check('brief: $245 at risk (the declined card)' + tag, /\$245 at risk/.test(brief));
    check('brief: 2 paying, 2 on trial, trial upside $196' + tag, /Paying offices\s*2/.test(brief) && /On trial\s*2/.test(brief) && /\$196 a month if they convert/.test(brief), brief);
    check('brief: 38 calls today on the floor, Mia leads with 30, 1 dialing now' + tag, /38 calls today/.test(brief) && /Mia leads with 30/.test(brief) && /1 dialing right now/.test(brief));
    check('brief: first urgent thing named' + tag, /starting with Harbor Insurance: card declined/.test(brief), brief);
    check('brief: greeting' + tag, /Good afternoon, Vincent/.test(brief));
    // ---- needs you ----
    const items = await ev(page, () => [...document.querySelectorAll('#cx-needs .cx-in')].map(li => ({ sev: li.className.replace(/.*sev-/, ''), t: li.querySelector('b').innerText })));
    const has = (re, sev) => items.some(i => re.test(i.t) && (!sev || i.sev === sev));
    check('needs: urgent first (declined card, failed check)' + tag, items[0] && items[0].sev === 'alert' && has(/Harbor Insurance: card declined/, 'alert') && has(/Notifications daily check failed/, 'alert'), items);
    check('needs: Acme trial ending' + tag, has(/Acme Auto Sales: trial ends in 2 days/, 'warn'), items.map(i => i.t));
    check('needs: new signup Newco is an opportunity' + tag, has(/New signup: Newco Solar/, 'opp'));
    check('needs: Quiet Co went quiet' + tag, has(/Quiet Co Realty went quiet/, 'warn'));
    check('needs: Sam idle 50 min, Jordan not started (and never you)' + tag, has(/^Sam hasn't dialed in 50 min/, 'warn') && has(/^Jordan hasn't made a call today/, 'warn') && !items.some(i => /Vincent/.test(i.t)), items.map(i => i.t));
    check('needs: Mia leading, shout out' + tag, has(/Mia is leading: 30 calls, 4 interested/, 'opp'));
    check('needs: late interested follow-up' + tag, has(/1 interested follow-up is over a day late/, 'warn'));
    check('needs: a planned post missed' + tag, has(/1 planned post didn't go out this week/, 'warn'));
    check('needs: Instagram brings signups' + tag, has(/Instagram brings your signups/, 'opp'));
    check('needs: ranked alert, warn, opportunity, info' + tag, items.map(i => ({ alert: 0, warn: 1, opp: 2, info: 3 })[i.sev]).every((v, i, a) => !i || a[i - 1] <= v));
    check('needs: the declined card has a ready text to the office owner' + tag, await ev(page, () => { const li = [...document.querySelectorAll('#cx-needs .cx-in')].find(x => /card declined/.test(x.innerText)); const a = li && li.querySelector('a.cx-b'); return !!a && /^sms:\(?/.test(a.getAttribute('href')) && /didn't%20go%20through|didn%27t%20go%20through/.test(a.getAttribute('href')); }));
    await ev(page, () => document.querySelector('[data-cx-f="money"]').click()); await page.waitForTimeout(200);
    check('needs: Money filter shows only offices' + tag, await ev(page, () => [...document.querySelectorAll('#cx-needs .cx-in b')].every(b => /Harbor|Acme|Newco|Quiet/.test(b.innerText))));
    await ev(page, () => document.querySelector('[data-cx-f="all"]').click()); await page.waitForTimeout(200);
    const before = items.length;
    await ev(page, () => { const li = [...document.querySelectorAll('#cx-needs .cx-in')].find(x => /Quiet Co/.test(x.innerText)); li.querySelector('[data-cx-snooze]').click(); }); await page.waitForTimeout(300);
    check('needs: Later hides it until tomorrow' + tag, await ev(page, () => ![...document.querySelectorAll('#cx-needs .cx-in')].some(x => /Quiet Co/.test(x.innerText))) && await ev(page, () => document.querySelectorAll('#cx-needs .cx-in').length) === before - 1);
    check('status line: urgent, needs you, ideas' + tag, /^2 urgent · 7 need you · 3 ideas$/.test(await txt(page, '#cxStatus')), await txt(page, '#cxStatus'));
    // a one-tap fix: +7 trial days for Acme, from the trial-ending card
    await ev(page, () => { const li = [...document.querySelectorAll('#cx-needs .cx-in')].find(x => /Acme Auto Sales: trial ends/.test(x.innerText)); [...li.querySelectorAll('button')].find(b => /\+7 trial days/.test(b.innerText)).click(); }); await page.waitForTimeout(700);
    let d = await fs(page);
    check('fix: +7 trial days saved on the office' + tag, d['offices/acme'].trialEnds > NOW + 8 * DAY, d['offices/acme'].trialEnds - NOW);
    check('fix: Acme no longer ending soon' + tag, await ev(page, () => ![...document.querySelectorAll('#cx-needs .cx-in')].some(x => /Acme Auto Sales: trial ends/.test(x.innerText))));
    // ---- your floor ----
    const reps = await ev(page, () => [...document.querySelectorAll('#cx-floor .cx-reps .cx-tr:not(.cx-th)')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    check('floor: Mia dialing (30 calls, 8 talked, 4 interested), Sam idle, Jordan not started' + tag, /^Mia Chen Dialing 30 8 4/.test(reps[0] || '') && /^Sam Ortiz Idle 8 1 0/.test(reps[1] || '') && /^Jordan Lee Not started 0 0 0/.test(reps[2] || ''), reps);
    check('floor: pipeline $50,000 committed' + tag, /\$50,000\s*committed/.test(await txt(page, '#cx-floor .cx-pipe')), await txt(page, '#cx-floor .cx-pipe'));
    await ev(page, () => { const r = [...document.querySelectorAll('#cx-floor .cx-reps .cx-tr')].find(x => /Sam Ortiz/.test(x.innerText)); r.querySelector('button').click(); }); await page.waitForTimeout(500);
    check('floor: Nudge opens Message your floor for Sam, on top of Command' + tag, await ev(page, () => { const m = document.getElementById('featModal'); const lab = document.getElementById('flSendL'); const r = document.getElementById('flText').getBoundingClientRect(); const top = document.elementFromPoint(r.left + 10, r.top + 10); return m.classList.contains('show') && lab && lab.textContent === 'Send to Sam' && !!top && !!top.closest('#featModal'); }));
    await ev(page, () => document.getElementById('featClose').click()); await page.waitForTimeout(200);
    // ---- offices ----
    await ev(page, () => { const i = document.getElementById('cxOffQ'); i.focus(); i.value = 'harb'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(200);
    check('offices: search narrows to Harbor and keeps typing focus' + tag, await ev(page, () => { const n = [...document.querySelectorAll('#cx-offices .cx-off')].map(x => x.querySelector('b').innerText); return n.length === 1 && n[0] === 'Harbor Insurance' && document.activeElement && document.activeElement.id === 'cxOffQ'; }));
    await ev(page, () => { const i = document.getElementById('cxOffQ'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); }); await page.waitForTimeout(200);
    check('offices: 4 offices with money row' + tag, await ev(page, () => document.querySelectorAll('#cx-offices .cx-off').length === 4) && /At risk\s*\$245/.test(await txt(page, '#cx-offices .cx-money')));
    // ---- growth ----
    const g = await txt(page, '#cx-growth');
    check('growth: funnel 200 visits, 35 demos, 12 trial forms, 4 signups' + tag, /Visits\s*200/.test(g) && /Opened the demo\s*35/.test(g) && /Opened the trial form\s*12/.test(g) && /Signed up\s*4/.test(g), g.slice(0, 300));
    check('growth: signups up 100% on the week before' + tag, /Signed up\s*4\s*\+100%/.test(g), g);
    check('growth: sources and recent signup with its post' + tag, /Instagram\s*120\s*30\s*3/.test(g) && /Newco Solar\s*Instagram · post w7-aq/.test(g), g);
    // ---- content ----
    const ct = await txt(page, '#cx-content');
    check('content: 412 followers, 1 missed, next posts from the plan, what to make more of' + tag, /Instagram followers\s*412/.test(ct) && /Missed or failed\s*1/.test(ct) && /Up next/.test(ct) && /Make more\s*before\/after/.test(ct), ct.slice(0, 400));
    // ---- systems ----
    const sy = await txt(page, '#cx-systems');
    check('systems: failed check, running bot, website OK, app build' + tag, /Notifications daily check\s*Failed/.test(sy) && /Instagram bot\s*Running now/.test(sy) && /Website\s*OK/.test(sy) && /Build \d{4}-\d\d-\d\d/.test(sy), sy);
    // ---- controls ----
    check('controls: every setting listed (25)' + tag, await ev(page, () => document.querySelectorAll('#cx-controls .cx-ctl').length) === 25);
    await ev(page, () => { const b = [...document.querySelectorAll('#cx-controls .cx-ctl')].find(x => /Lead lists/.test(x.innerText)); b.querySelector('[data-cx-pin]').click(); }); await page.waitForTimeout(200);
    check('controls: pinning puts it in the brief' + tag, /Pinned[\s\S]*Lead lists/.test(await txt(page, '#cx-brief .cx-quick')));
    await ev(page, () => { const b = [...document.querySelectorAll('#cx-controls .cx-ctl-b')].find(x => /Follow-up rules/.test(x.innerText)); b.click(); }); await page.waitForTimeout(400);
    check('controls: an editor opens on top of Command' + tag, await ev(page, () => { const m = [...document.querySelectorAll('.modal-overlay.show')]; if (!m.length) return false; const r = m[m.length - 1].querySelector('.modal').getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 30); return !!top && !document.getElementById('cmd').contains(top); }));
    await ev(page, () => { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); }); await page.waitForTimeout(150);
    // ---- search ----
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k'); await page.waitForTimeout(200);
    check('search: Ctrl/Cmd+K opens it' + tag, await ev(page, () => !document.getElementById('cxPal').hidden && document.activeElement.id === 'cxPalQ'));
    check('search: the lead search does not open on top of Command' + tag, await ev(page, () => document.getElementById('searchOverlay').hidden));
    await page.keyboard.type('pacing'); await page.waitForTimeout(150);
    check('search: finds Call pacing first' + tag, /Call pacing/.test(await txt(page, '#cxPalList li.on')), await txt(page, '#cxPalList'));
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    check('search: Enter opens the pacing editor' + tag, await ev(page, () => { const m = [...document.querySelectorAll('.modal-overlay.show')]; return m.length === 1 && /Call pacing/.test(m[0].innerText); }), await ev(page, () => [...document.querySelectorAll('.modal-overlay.show')].map(m => m.id + ':' + m.innerText.slice(0, 80))));
    await ev(page, () => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'))); await page.waitForTimeout(150);
    await ev(page, () => document.getElementById('cxSearch').click()); await page.waitForTimeout(150);
    await page.keyboard.type('grace'); await page.waitForTimeout(150);
    check('search: finds a lead by name' + tag, /Lead\s*Grace Hayes/.test(await txt(page, '#cxPalList')), await txt(page, '#cxPalList'));
    await ev(page, () => [...document.querySelectorAll('#cxPalList li')].find(x => /Grace Hayes/.test(x.innerText)).click()); await page.waitForTimeout(500);
    check('search: picking a lead opens their file' + tag, await ev(page, () => { const m = document.getElementById('leadModal'); return !!m && m.classList.contains('show') && /Grace Hayes/.test(m.innerText); }));
    await ev(page, () => document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'))); await page.waitForTimeout(150);
    await ev(page, () => document.getElementById('cxSearch').click()); await page.waitForTimeout(100);
    await page.keyboard.type('harbor'); await page.waitForTimeout(100);
    check('search: finds an office' + tag, /Office\s*Harbor Insurance · harbor-ins/.test(await txt(page, '#cxPalList')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    check('search: Esc closes search, not Command' + tag, await ev(page, () => document.getElementById('cxPal').hidden && !document.getElementById('cmd').hidden));
    // ---- rules: the bot's key stays hidden even from the owner ----
    const sec = await ev(page, async () => {
      const db = firebase.app().firestore(), out = {};
      const t = async (k, f) => { try { await f(); out[k] = 'ok'; } catch (e) { out[k] = e.code || 'err'; } };
      await t('token', () => db.collection('igBot').doc('meta').collection('items').doc('token').get());
      await t('learn', () => db.collection('igBot').doc('meta').collection('items').doc('learnings').get());
      await t('writeGrowth', () => db.collection('growth').doc('days').collection('items').doc('2026-11-06').set({ t: 1 }));
      return out;
    });
    check('rules: owner can read learnings, not the Instagram key, and can\'t write the funnel' + tag, sec.token === 'permission-denied' && sec.learn === 'ok' && sec.writeGrowth === 'permission-denied', sec);
    check('nothing in the page shows the key' + tag, !(await ev(page, () => document.body.innerText.includes('NEVER-SHOW-THIS'))));
    // ---- layout ----
    const lay = await ev(page, () => { const r = document.getElementById('cmd'); return { over: r.scrollWidth - r.clientWidth, wide: [...r.querySelectorAll('.cx-p')].filter(p => !p.hidden).every(p => p.getBoundingClientRect().right <= innerWidth + 1) }; });
    check('layout: no sideways scroll, every panel on screen' + tag, lay.over <= 0 && lay.wide, lay);
    await ev(page, () => { document.getElementById('cmd').scrollTop = 0; }); await page.waitForTimeout(150);
    if (c.n === 'desktop') check('layout: Needs you sits beside the panels on a computer' + tag, await ev(page, () => { const n = document.getElementById('cx-needs').getBoundingClientRect(), m = document.querySelector('.cx-main').getBoundingClientRect(); return n.left > m.right - 1 && Math.abs(n.top - m.top) < 4; }));
    if (process.env.SHOTS) {
      await ev(page, () => { document.getElementById('cmd').scrollTop = 0; }); await page.waitForTimeout(200);
      await page.screenshot({ path: process.env.SHOTS + '/cmd_' + c.n + '_top.png' });
      for (const k of ['floor', 'offices', 'growth', 'content', 'controls']) {
        await ev(page, (k) => { const r = document.getElementById('cmd'), el = document.getElementById('cx-' + k); r.scrollTop = el.offsetTop - (innerWidth < 1100 ? 112 : 76); }, k); await page.waitForTimeout(150);
        await page.screenshot({ path: process.env.SHOTS + '/cmd_' + c.n + '_' + k + '.png' });
      }
    }
    // ---- customize ----
    await ev(page, () => document.getElementById('cxCustom').click()); await page.waitForTimeout(200);
    await ev(page, () => { document.querySelector('[data-cx-show="growth"]').click(); document.getElementById('cxCustSave').click(); }); await page.waitForTimeout(300);
    check('customize: hiding Growth hides it and its jump link' + tag, await ev(page, () => document.getElementById('cx-growth').hidden && document.querySelector('[data-cx-go="growth"]').hidden));
    // ---- close ----
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check('Esc closes Command' + tag, await ev(page, () => document.getElementById('cmd').hidden && location.hash !== '#command'));
    check('no page errors' + tag, !errs.length, errs);
    await ctx.close();

    // opens straight from a #command link
    ({ ctx, page, errs } = await open(c, OWNER, seed(), '#command'));
    check('#command link opens it on start' + tag, await ev(page, () => { const r = document.getElementById('cmd'); return !!r && !r.hidden; }));
    check('no page errors on #command start' + tag, !errs.length, errs);
    await ctx.close();

    // an office admin never gets it, not even from the link
    ({ ctx, page, errs } = await open(c, { uid: 'acme0', email: 'boss@acme.vpex.app', office: 'acme' }, seed(), '#command'));
    check('office admin: no Command button, link does nothing' + tag, await ev(page, () => getComputedStyle(document.getElementById('cmdBtn')).display === 'none' && !(document.getElementById('cmd') && !document.getElementById('cmd').hidden)));
    const adm = await ev(page, async () => { try { await firebase.app().firestore().collection('growth').doc('days').collection('items').doc('2026-11-05').get(); return 'ok'; } catch (e) { return e.code; } });
    check('office admin: can\'t read the funnel' + tag, adm === 'permission-denied', adm);
    await ev(page, () => document.getElementById('adminBtn').click()); await page.waitForTimeout(300);
    check('office admin: no Command Center in Admin controls' + tag, await ev(page, () => !document.getElementById('hubCmd')));
    check('office admin: no page errors' + tag, !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`command_center: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
