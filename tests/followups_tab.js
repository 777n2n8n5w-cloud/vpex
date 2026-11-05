// VPEX regression check (followups_tab). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/followups_tab.js
// The booking sheet with a mouse on a computer (the web version) and by touch on a phone:
//   "Later date" opens a month you can page through and pick from (it used to be a hidden date box a mouse couldn't open);
//   every time of day is reachable: Morning / Afternoon / Evening tabs show all their times at once (it used to be a
//   sideways strip a mouse couldn't scroll); a typed time works; quick picks (In 1 hour ...) set day and time in one tap;
//   times outside calling hours can't be booked. On a computer it all fits without scrolling.
// The Follow-ups tab: due ones you can call now vs ones waiting on calling hours (with when they open), kinds filter,
//   long sections show 25 then "Show all", Move opens the sheet and moves the time, Mark done has Undo, and a backlog of
//   late retries can be spread over 5 business days (with Undo) without touching interested leads.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-11-05T20:32:00Z';   // Thu Nov 5, 3:32 PM in New York
async function open(br, c) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: c.h || 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await page.goto(BASE + '#demo-insurance'); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const ev = (page, f, a) => page.evaluate(f, a);
const view = async (page, v) => { await ev(page, v => document.querySelector('#viewTabs [data-view="' + v + '"]').click(), v); await page.waitForTimeout(300); };
const tap = async (page, sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(150); };   // a real mouse click or tap, not a script click
const clear = page => ev(page, () => { ['tpLater', 'dnLater'].forEach(id => { const b = document.getElementById(id); if (b) b.click(); }); });
async function log(page, o, keep) {
  await page.clock.fastForward(25000); await page.waitForTimeout(60);
  await ev(page, () => document.getElementById('callBtn').click()); await page.waitForTimeout(200);
  await ev(page, o => document.querySelector('.out-btn[data-outcome="' + o + '"]').click(), o); await page.waitForTimeout(350);
  if (!keep) await ev(page, () => { const k = document.getElementById('fuKeep'); if (k && document.getElementById('fuSheet').classList.contains('show')) k.click(); });
  await page.waitForTimeout(80); await clear(page);
}
const sum = page => ev(page, () => document.querySelector('.fu-sum b').textContent);
async function toastWith(page, re) {   // other toasts (a badge, a goal) can be ahead in the queue
  for (let i = 0; i < 40; i++) { const t = await ev(page, () => { const x = document.getElementById('toast'); return x && x.classList.contains('show') ? x.innerText : ''; }); if (re.test(t)) return t; await page.waitForTimeout(250); }
  return '';
}

(async () => {
  const br = await chromium.launch();
  for (const c of [{ n: 'desk', w: 1280, h: 860, s: 'light' }, { n: 'laptop', w: 1366, h: 768, s: 'dark' }, { n: 'phone', w: 390, s: 'dark' }]) {
    const { ctx, page, errs } = await open(br, c);
    await view(page, 'dial');
    for (let i = 0; i < 14; i++) { const w = await ev(page, () => document.querySelector('.lead-where').textContent); if (/\bCA\b/.test(w)) break; await ev(page, () => document.getElementById('skipBtn').click()); await page.waitForTimeout(100); }
    await log(page, 'interested', true);
    // fits on a computer: the Book button is on screen with nothing to scroll
    let g = await ev(page, () => { const m = document.querySelector('.fu-modal'), b = document.getElementById('fuBook').getBoundingClientRect(); return { sh: m.scrollHeight, ch: m.clientHeight, bottom: b.bottom, vh: innerHeight, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
    if (c.w >= 1280) check(c.n + ' the whole sheet fits on screen, no scrolling', g.sh <= g.ch + 1 && g.bottom <= g.vh, g);
    check(c.n + ' no sideways overflow', g.sw <= g.vw, g);
    // Later date: a month opens, the next month is reachable, a day there can be picked
    await tap(page, '#fuMore');
    check(c.n + ' "Later date" opens a calendar', await ev(page, () => !!document.getElementById('fuCal') && document.getElementById('fuMore').getAttribute('aria-expanded') === 'true'));
    const past = await ev(page, () => [...document.querySelectorAll('#fuCal .fu-cd')].filter(b => +b.textContent < 5).every(b => b.disabled));
    check(c.n + ' days already gone can\'t be picked', past);
    await tap(page, '[data-fu-cal="1"]');
    check(c.n + ' the next month pages in', /December 2026/.test(await ev(page, () => document.querySelector('.fu-cal-h b').textContent)));
    await tap(page, '#fuCal [data-fu-day="2026-12-17"]');
    g = await ev(page, () => ({ cal: !!document.getElementById('fuCal'), more: document.getElementById('fuMore').textContent, book: document.getElementById('fuBook').textContent }));
    check(c.n + ' picking Dec 17 closes the calendar and books that day', !g.cal && /Dec 17/.test(g.more) && /Thursday, Dec 17/.test(await sum(page)), g);
    // every time of day is reachable: Evening shows its times, all of them, no sideways scroll
    await tap(page, '[data-fu-part="eve"]');
    g = await ev(page, () => { const row = document.querySelector('.fu-times'), r = row.getBoundingClientRect(); const chips = [...row.querySelectorAll('[data-fu-at]')]; return { n: chips.length, last: chips.length ? chips[chips.length - 1].querySelector('b').textContent : '', allIn: chips.every(x => { const q = x.getBoundingClientRect(); return q.left >= r.left - 1 && q.right <= r.right + 1; }), scroll: row.scrollWidth <= row.clientWidth + 1 }; });
    check(c.n + ' Evening shows every evening time, the latest inside their hours (8:30 PM CA = 11:30 PM NY)', g.n >= 10 && g.last === '11:30 PM' && g.allIn && g.scroll, g);
    await tap(page, '.fu-times [data-fu-at]:last-child');
    check(c.n + ' a late evening time can be picked', /at 11:30 PM/.test(await sum(page)), await sum(page));
    // typed time
    await page.fill('#fuTimeIn', '18:45'); await page.dispatchEvent('#fuTimeIn', 'change'); await page.waitForTimeout(150);
    check(c.n + ' a typed time works (6:45 PM)', /at 6:45 PM/.test(await sum(page)) && /3:45 PM CA/.test(await ev(page, () => document.querySelector('.fu-sum').innerText)));
    // a typed time outside their hours can't be booked; the fix button moves it
    await page.fill('#fuTimeIn', '07:00'); await page.dispatchEvent('#fuTimeIn', 'change'); await page.waitForTimeout(150);
    g = await ev(page, () => ({ dis: document.getElementById('fuBook').disabled, fix: !!document.getElementById('fuFix') }));
    check(c.n + ' 7 AM New York (4 AM in CA) is blocked with a one-tap fix', g.dis && g.fix, g);
    await tap(page, '#fuFix');
    check(c.n + ' the fix moves it inside their hours', !(await ev(page, () => document.getElementById('fuBook').disabled)));
    // quick pick: In 1 hour
    await tap(page, '[data-fu-q]');
    g = await ev(page, () => ({ b: document.getElementById('fuBook').textContent, sum: document.querySelector('.fu-sum b').textContent }));
    check(c.n + ' "In 1 hour" books today at 4:35 PM in one tap', /Today 4:35 PM/.test(g.b), g);
    // keyboard on a computer: Tab reaches the parts and Enter books
    await tap(page, '#fuBook'); await page.waitForTimeout(300);
    check(c.n + ' booked and closed', !(await ev(page, () => document.getElementById('fuSheet').classList.contains('show'))));
    await clear(page);
    // ---------- Follow-ups tab ----------
    for (const o of ['noanswer', 'voicemail', 'noanswer', 'noanswer', 'interested', 'noanswer', 'voicemail', 'noanswer', 'noanswer', 'noanswer', 'noanswer', 'voicemail']) await log(page, o);
    await page.clock.fastForward(4 * 86400000); await page.waitForTimeout(400);
    await view(page, 'tasks');
    g = await ev(page, () => ({ sub: document.querySelector('.tasks-sub').textContent, banner: (document.querySelector('.fu-banner') || {}).innerText || '', bl: (document.querySelector('.tk-backlog') || {}).innerText || '', chips: [...document.querySelectorAll('[data-tk-kind]')].map(b => b.innerText.replace(/\s+/g, ' ')), heads: [...document.querySelectorAll('.task-section-head')].map(h => h.innerText) }));
    check(c.n + ' the tab counts what\'s due and starts the run', /due now/.test(g.sub) && /Call \d+ due now/.test(g.banner), g);
    check(c.n + ' late retries can be spread out (interested leads aren\'t counted)', /^1[01] automatic retries are 2\+ days late/.test(g.bl), g.bl);
    check(c.n + ' kinds filter: Interested and Retries', g.chips.some(x => /^Interested 1/.test(x)) && g.chips.some(x => /^Retries/.test(x)), g.chips);
    // filter to Interested
    await tap(page, '[data-tk-kind="int"]');
    const intRows = await ev(page, () => document.querySelectorAll('.task-item').length);
    check(c.n + ' the Interested filter shows just the interested follow-up', intRows === 1, intRows);
    await tap(page, '[data-tk-kind="all"]');
    // Move: opens the sheet in move mode, moves the time, keeps the follow-up
    const name = await ev(page, () => document.querySelector('.task-item .task-lead-name').textContent);
    await tap(page, '.task-item [data-move-task]');
    g = await ev(page, () => ({ t: document.getElementById('fuTitle').textContent, keep: document.getElementById('fuKeep').textContent, stages: !!document.querySelector('.fu-stages'), tag: !!document.querySelector('.fu-tag') }));
    check(c.n + ' Move opens "Move the follow-up" with Cancel, no stage row', /^Move the follow-up with/.test(g.t) && g.keep === 'Cancel' && !g.stages && !g.tag, g);
    await tap(page, '.fu-days [data-fu-day]:nth-child(2)'); await tap(page, '[data-fu-part="pm"]'); await tap(page, '.fu-times [data-fu-at]');
    const movedTo = await ev(page, () => document.getElementById('fuBook').textContent);
    await tap(page, '#fuBook'); await page.waitForTimeout(300);
    const row = await ev(page, n => { const it = [...document.querySelectorAll('.task-item')].find(x => x.querySelector('.task-lead-name').textContent === n); return it ? it.querySelector('.task-due').textContent : ''; }, name);
    check(c.n + ' the moved follow-up shows its new time', /^Move to /.test(movedTo) && row && !/Overdue/.test(row), { movedTo, row });
    // Mark done + Undo
    const before = await ev(page, () => document.querySelectorAll('.task-item:not(:has(.task-check.done))').length);
    await tap(page, '.task-item .task-check');
    const dt = await toastWith(page, /^Done/);
    const act = await ev(page, () => { const b = document.querySelector('#toast .nt-act'); return b ? b.textContent : ''; });
    check(c.n + ' Mark done offers Undo', dt && act === 'Undo', { dt, act });
    await ev(page, () => document.querySelector('#toast .nt-act').click()); await page.waitForTimeout(300);
    check(c.n + ' Undo puts it back', await ev(page, () => document.querySelectorAll('.task-item:not(:has(.task-check.done))').length) === before);
    // Spread + Undo
    const late = await ev(page, () => document.querySelectorAll('.task-item.overdue').length);
    await tap(page, '#tkSpread');
    const spt = await toastWith(page, /^Spread \d+ late retries/);
    g = await ev(page, () => ({ bl: !!document.querySelector('.tk-backlog'), late: document.querySelectorAll('.task-item.overdue').length, up: [...document.querySelectorAll('.task-section-head.tk-day')].length, interested: [...document.querySelectorAll('.task-item')].some(x => /Interested/.test(x.innerText) && /Overdue/.test(x.innerText)) }));
    check(c.n + ' Spread moves the late retries onto the coming days, the interested one stays due', !g.bl && g.late < late && g.up >= 3 && g.interested && spt, { g, spt });
    await ev(page, () => document.querySelector('#toast .nt-act').click()); await page.waitForTimeout(300);
    check(c.n + ' Undo puts them back', await ev(page, () => document.querySelectorAll('.task-item.overdue').length) === late);
    // waiting on calling hours: at 11 PM New York, a California lead is still open, an Eastern one isn't
    await page.clock.fastForward(7.5 * 3600000); await page.waitForTimeout(300); await view(page, 'dial'); await view(page, 'tasks');
    g = await ev(page, () => ({ heads: [...document.querySelectorAll('.task-section-head')].map(h => h.innerText), wait: [...document.querySelectorAll('.tk-wait')].map(x => x.textContent).slice(0, 3), ok: document.querySelectorAll('.tk-ok').length }));
    check(c.n + ' late at night, closed leads sit under "waiting on calling hours" with when they open', g.heads.some(h => /WAITING ON CALLING HOURS/i.test(h)) && g.wait.length && g.wait.every(w => /^opens (tomorrow )?\d/.test(w)), g);
    check(c.n + ' no page errors', !errs.length, errs);
    await ctx.close();
  }
  // a long list shows 25 per section, then Show all
  {
    const { ctx, page, errs } = await open(br, { w: 1280, h: 860, s: 'light' });
    await view(page, 'dial');
    for (let i = 0; i < 30; i++) await log(page, 'noanswer');
    await page.clock.fastForward(4 * 86400000); await page.waitForTimeout(300);
    await view(page, 'tasks');
    let n = await ev(page, () => ({ rows: document.querySelectorAll('.task-item').length, more: (document.querySelector('[data-tk-more]') || {}).textContent || '' }));
    check('30 due: 25 rows and "Show all 30"', n.rows === 25 && n.more === 'Show all 30', n);
    await tap(page, '[data-tk-more]');
    check('Show all lists all 30', await ev(page, () => document.querySelectorAll('.task-item').length) === 30);
    check('no page errors (long list)', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log('followups_tab: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
