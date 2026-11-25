// VPEX regression check (holiday_followups): Thanksgiving, Christmas and New Year's Day aren't suggested as follow-up or closer times.
//  - Follow-up sheet the day before Thanksgiving (Wed Nov 25): the suggested time is Fri 10 AM, not Thursday; the Tomorrow chip
//    says "Thanksgiving" and can still be picked; the Interested follow-up saved is Friday; the day before (Tue) nothing changes.
//  - Send to a closer: the next-day pick is "Fri 10 AM" on Wed Nov 25, "Mon 10 AM" on a Friday (it used to say "Tomorrow" for
//    Monday) and "Tomorrow 10 AM" on an ordinary weekday; a time outside the lead's calling hours says so and offers the first
//    allowed time.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/holiday_followups.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const ev = (p, f, a) => p.evaluate(f, a);

async function fuSheet(br, o, c, iso) {
  const cx = await br.newContext({ viewport: { width: c.w, height: c.w < 500 ? 844 : 800 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const p = await cx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/gstatic\.com\/firebasejs/, r => r.abort());
  await p.clock.install({ time: new Date(iso) });
  await p.goto(BASE + '#demo-' + o); await p.waitForTimeout(2500);
  await p.clock.fastForward(25000); await p.waitForTimeout(80);
  const lead = await ev(p, () => { const n = document.querySelector('.lead-name'); return n && n.getAttribute('data-open-lead'); });
  await ev(p, () => document.getElementById('callBtn').click()); await p.waitForTimeout(250);
  await ev(p, () => document.querySelector('.out-btn[data-outcome="interested"]').click()); await p.waitForTimeout(600);
  return { cx, p, errs, lead };
}
const sheet = p => ev(p, () => {
  const b = document.getElementById('fuBody'), chips = [...b.querySelectorAll('.fu-days .fu-chip')];
  return { open: document.getElementById('fuSheet').classList.contains('show'), book: (document.getElementById('fuBook') || {}).textContent,
    days: chips.map(x => ({ t: x.innerText.replace(/\s+/g, ' ').trim(), on: x.classList.contains('on'), d: x.getAttribute('data-fu-day'), r: x.getBoundingClientRect().right, h: x.getBoundingClientRect().height })),
    later: [...b.querySelectorAll('.fu-later .fu-chip small')].map(x => x.textContent), vw: innerWidth, sw: document.documentElement.scrollWidth };
});

(async () => {
  const br = await chromium.launch();
  const CF = [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 390, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }];
  for (const o of ['insurance', 'solar', 'mca']) for (const c of CF) {
    const tag = o + '/' + c.n;
    // Wed Nov 25, 2:30 PM ET: the day before Thanksgiving.
    let { cx, p, errs, lead } = await fuSheet(br, o, c, '2026-11-25T19:30:00Z');
    let s = await sheet(p);
    const tm = s.days.find(d => d.d === '2026-11-26'), fr = s.days.find(d => d.d === '2026-11-27');
    check(tag + ' Wed: follow-up sheet open', s.open, s);
    check(tag + ' Wed: suggested time is Fri 27, not Thanksgiving', /^Book Fri 27 /.test(s.book || '') && fr && fr.on && tm && !tm.on, s);
    check(tag + ' Wed: Tomorrow chip says Thanksgiving', tm && tm.t === 'Tomorrow Thanksgiving', tm);
    check(tag + ' Wed: no other chip says a holiday', s.days.filter(d => /Thanksgiving|Christmas|New Year/.test(d.t)).length === 1, s.days);
    check(tag + ' Wed: chips fit, no sideways scroll', s.days.every(d => d.r <= s.vw + 0.5) && s.sw <= s.vw + 1, s);
    check(tag + ' Wed: day chips at least 40 px tall', s.days.every(d => d.h >= 40), s.days.map(d => d.h));
    const task = await ev(p, id => window.__ho.tasks(id).map(t => new Date(t.dueAt).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric' })), lead);
    check(tag + ' Wed: the Interested follow-up is saved for Friday', task.length === 1 && /^Fri/.test(task[0]), task);
    // Thanksgiving can still be picked by hand.
    await ev(p, () => document.querySelector('#fuBody .fu-days [data-fu-day="2026-11-26"]').click()); await p.waitForTimeout(200);
    s = await sheet(p);
    const tk2 = await ev(p, id => window.__ho.tasks(id).map(t => new Date(t.dueAt).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short' })), lead);
    check(tag + ' Wed: tapping Tomorrow (Thanksgiving) still books it', s.days.find(d => d.d === '2026-11-26').on && (/Tomorrow/.test(s.book || '') || (tk2.length === 1 && tk2[0] === 'Thu')), [s.book, tk2]);
    check(tag + ' Wed: no page errors', !errs.length, errs);
    await cx.close();
    // Tue Nov 24: an ordinary day, nothing changes.
    ({ cx, p, errs } = await fuSheet(br, o, c, '2026-11-24T19:30:00Z'));
    s = await sheet(p);
    check(tag + ' Tue: suggested time is Tomorrow (Wed 25) 10 AM', /^Book Tomorrow 10/.test(s.book || '') && s.days.find(d => d.d === '2026-11-25').on, s.book);
    check(tag + ' Tue: Thursday chip says Thanksgiving', (s.days.find(d => d.d === '2026-11-26') || {}).t === 'Thu 26 Thanksgiving', s.days);
    check(tag + ' Tue: no page errors', !errs.length, errs);
    if (c.n === 'p-light') await p.screenshot({ path: (process.env.OUT || '/tmp') + '/holiday_followups_' + o + '.png' }).catch(() => {});
    await cx.close();
  }
  // "In 30 days" from Nov 25 suggestion never lands on Christmas: from Fri Nov 20 at 10 AM + 30 = Sun Dec 20 (fine); from a
  // suggested Fri Nov 27 the 30-day pick is Dec 27. Use a clock whose 30-day pick is Christmas: suggestion Wed Nov 25 (from Tue Nov 24).
  {
    const { cx, p, errs } = await fuSheet(br, 'insurance', CF[0], '2026-11-24T19:30:00Z');
    const s = await sheet(p);
    check('Tue Nov 24: "In 30 days" skips Christmas (Dec 25) to Dec 26', s.later[0] === 'Dec 26', s.later);
    check('Tue Nov 24 (30-day check): no page errors', !errs.length, errs);
    await cx.close();
  }

  // ---------- Send to a closer ----------
  async function handoff(iso, w) {
    const ctx = await br.newContext({ timezoneId: 'America/New_York' });
    await ctx.clock.install({ time: new Date(iso) });
    const errs = [];
    const boot = await ctx.newPage();
    await boot.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await boot.goto(BASE + '#mockbench'); await boot.waitForTimeout(500);
    await boot.evaluate(() => {
      const db = demoSeed();
      localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
      localStorage.setItem('__mockauth', JSON.stringify({ 'demo@dovetail-f863c.firebaseapp.com': { uid: 'dAdm', pw: 'test' }, 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' }, 'mia@dovetail-f863c.firebaseapp.com': { uid: 'dR3', pw: 'test' } }));
    });
    await boot.close();
    const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: 844 }); p.on('pageerror', e => errs.push(e.message));
    await p.route(/gstatic\.com\/firebasejs/, r => r.abort());
    await p.addInitScript(() => { try { sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR3', email: 'mia@dovetail-f863c.firebaseapp.com' })); } catch (x) {}
      window.addEventListener('click', ev => { const a = ev.target.closest && ev.target.closest('a[href^="tel:"]'); if (a) ev.preventDefault(); }); });
    await p.goto(BASE); await p.waitForTimeout(2800);
    const lead = await ev(p, () => { const n = document.querySelector('.lead-name'); return { name: n.textContent, id: n.getAttribute('data-open-lead') }; });
    await ev(p, () => document.getElementById('callBtn').click()); await p.waitForTimeout(400);
    await ev(p, id => document.querySelector('[data-qf-open="' + id + '"]').click(), lead.id); await p.waitForTimeout(300);
    const groups = await ev(p, () => [...document.querySelectorAll('#featModalBody .qf-opts')].map(g => g.querySelector('.qf-opt').getAttribute('data-qf-k')));
    const inputs = await ev(p, () => [...document.querySelectorAll('#featModalBody [data-qf-in]')].map(i => i.getAttribute('data-qf-in')));
    for (const k of groups) await ev(p, k => { if (!document.querySelector('#featModalBody [data-qf-k="' + k + '"].on')) document.querySelector('#featModalBody [data-qf-k="' + k + '"]').click(); }, k);
    for (let i = 0; i < inputs.length; i++) await p.fill('#featModalBody [data-qf-in="' + inputs[i] + '"]', i === 0 ? '61' : 'x' + i);
    await p.waitForTimeout(150);
    await p.click('#qfSend'); await p.waitForTimeout(300);
    return { ctx, p, errs, lead };
  }
  const tmPick = p => ev(p, () => { const b = document.querySelector('[data-ho-when="tm"]'); return b ? b.textContent : null; });
  for (const w of [390, 1280]) {
    let { ctx, p, errs } = await handoff('2026-11-25T11:30:00-05:00', w);
    check(w + ' closer sheet Wed Nov 25: next-day pick is "Fri 10 AM"', await tmPick(p) === 'Fri 10 AM', await tmPick(p));
    await ev(p, () => document.querySelector('[data-ho-when="tm"]').click()); await p.waitForTimeout(200);
    let go = await ev(p, () => document.getElementById('hoGo').textContent);
    check(w + ' closer sheet Wed: Send button names Friday', /Fri/.test(go) && !/Thu/.test(go), go);
    // A time before the lead's calling hours (7 AM their time, the demo leads are on Eastern or later... pick 6 AM ours).
    await ev(p, () => document.querySelector('[data-ho-when="pick"]').click()); await p.waitForTimeout(100);
    await p.fill('#hoAt', '2026-11-27T06:00'); await p.waitForTimeout(200);
    let sl = await ev(p, () => { const s = document.getElementById('hoSlot'), b = s.querySelector('[data-ho-free]'), r = b && b.getBoundingClientRect(); return { t: s.innerText, bad: s.classList.contains('bad'), btn: b ? b.textContent : null, h: r ? r.height : 0, right: r ? r.right : 0, vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    check(w + ' closer sheet: 6 AM says it is before the lead\'s calling hours', /before .*calling hours/.test(sl.t) && sl.bad && /^Use /.test(sl.btn || ''), sl);
    check(w + ' closer sheet: the fix button fits, no sideways scroll', sl.right <= sl.vw + 0.5 && sl.sw <= sl.vw + 1, sl);
    if (process.env.OUT) await p.screenshot({ path: process.env.OUT + '/holiday_followups_closer_' + w + '.png' }).catch(() => {});
    await ev(p, () => document.querySelector('#hoSlot [data-ho-free]').click()); await p.waitForTimeout(200);
    sl = await ev(p, () => ({ t: document.getElementById('hoSlot').innerText, bad: document.getElementById('hoSlot').classList.contains('bad'), v: document.getElementById('hoAt').value }));
    check(w + ' closer sheet: Use moves it inside their hours and the warning goes', !/calling hours/.test(sl.t) && !sl.bad && sl.v > '2026-11-27T06:00', sl);
    check(w + ' closer sheet Wed: no page errors', !errs.length, errs);
    await ctx.close();
    ({ ctx, p, errs } = await handoff('2026-11-27T11:30:00-05:00', w));
    check(w + ' closer sheet Fri Nov 27: next-day pick is "Mon 10 AM" (not "Tomorrow")', await tmPick(p) === 'Mon 10 AM', await tmPick(p));
    check(w + ' closer sheet Fri: no page errors', !errs.length, errs);
    await ctx.close();
    ({ ctx, p, errs } = await handoff('2026-11-24T11:30:00-05:00', w));
    check(w + ' closer sheet Tue Nov 24: next-day pick is "Tomorrow 10 AM"', await tmPick(p) === 'Tomorrow 10 AM', await tmPick(p));
    await ev(p, () => document.querySelector('[data-ho-when="tm"]').click()); await p.waitForTimeout(200);
    sl = await ev(p, () => ({ t: document.getElementById('hoSlot').innerText, bad: document.getElementById('hoSlot').classList.contains('bad') }));
    check(w + ' closer sheet Tue: 10 AM is inside hours, no warning', !/calling hours/.test(sl.t) && !sl.bad, sl);
    check(w + ' closer sheet Tue: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await br.close();
  console.log(`holiday_followups: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
