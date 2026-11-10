// VPEX regression check (pickup_learn): "Best time to answer" learns by day and hour, and from each lead's own calls.
//  - The floor's pick-up rate by the lead's own weekday and hour (Thursday 4 PM isn't Monday 4 PM), leaning on the
//    hour-only rate until a day and hour has calls.
//  - A lead who let it ring this morning comes up later in the day; one who picked up at 5 PM before is favored near 5.
//  - Each lead shows its best time; the Answer times report has a day-by-hour map with the best slots.
//   python3 -m http.server 8765 (repo root), then NODE_PATH=<playwright> node tests/pickup_learn.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let pass = 0, fail = 0; const check = (n, ok, i) => { if (ok) pass++; else { fail++; console.log('FAIL', n, i === undefined ? '' : JSON.stringify(i)); } };
const NOW = Date.UTC(2026, 10, 12, 15, 30);          // Thu Nov 12, 10:30 AM in New York
const et = (d, h, m) => new Date(Date.UTC(2026, 10, d, h + 5, m)).toISOString();   // November: New York is UTC-5
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: NOW });
  await page.route(/gstatic\.com\/firebasejs|fonts\.g|cloudfunctions/, r => r.abort());
  await page.goto(BASE + '#mockbench'); await page.waitForTimeout(500);
  await page.evaluate(() => { const db = demoSeed(); localStorage.setItem('vpex_mockbench', '1'); localStorage.setItem('__mockfs', JSON.stringify(db));
    localStorage.setItem('__mockauth', JSON.stringify({ 'sam@dovetail-f863c.firebaseapp.com': { uid: 'dR2', pw: 'test' } }));
    sessionStorage.setItem('__mocksess', JSON.stringify({ uid: 'dR2', email: 'sam@dovetail-f863c.firebaseapp.com' })); });
  await page.goto(BASE); await page.waitForTimeout(3000);
  const ny = await page.evaluate(() => window.__mockLeads().map(l => window.__mockLeadFull(l.id)[0]).filter(l => l.st === 'NY' && !l.dnc).map(l => l.id));
  const fresh = await page.evaluate(ids => ids.filter(id => !window.__mockCallsFor(id).length), ny);
  check('demo has New York leads to work with', ny.length >= 6, ny.length);
  check('and some with no calls yet', fresh.length >= 3, fresh.length);
  const [A, B, C] = fresh, pool = ny.filter(id => fresh.indexOf(id) > 2 || fresh.indexOf(id) < 0);
  const calls = []; let n = 0;
  const add = (d, h, count, yesEvery) => { for (let i = 0; i < count; i++) calls.push({ id: 'pk' + (n++), leadId: pool[i % pool.length], name: 'x', timestamp: et(d, h, i % 50), outcomeKey: i % yesEvery === 0 ? 'interested' : 'noanswer', outcome: '' }); };
  add(5, 16, 60, 1.25);   // Thursday 4 PM: most pick up
  add(9, 16, 60, 10);     // Monday 4 PM: few do
  add(5, 10, 40, 5);      // Thursday 10 AM
  add(10, 12, 40, 3);     // Tuesday noon
  for (let i = 0; i < 60; i++) if (calls[i].outcomeKey === 'noanswer' && i % 5) calls[i].outcomeKey = 'interested';
  calls.push({ id: 'a1', leadId: A, timestamp: et(9, 10, 5), outcomeKey: 'noanswer' }, { id: 'a2', leadId: A, timestamp: et(10, 10, 20), outcomeKey: 'voicemail' }, { id: 'a3', leadId: A, timestamp: et(11, 9, 50), outcomeKey: 'noanswer' });
  calls.push({ id: 'b1', leadId: B, timestamp: et(10, 17, 10), outcomeKey: 'callback' });
  await page.evaluate(c => window.__mockPushCalls(c), calls);
  const m = await page.evaluate(() => window.__mockModel());
  check('the floor\'s model is learned (over 150 calls)', m.learned && m.n >= 200, [m.learned, m.n]);
  check('Thursday 4 PM beats Monday 4 PM (day and hour, not hour alone)', m.dscore[4][16] > m.dscore[1][16] + 0.3, [m.dscore[4][16], m.dscore[1][16]]);
  check('a day and hour with no calls leans on that hour (between the two)', m.dscore[3][16] > m.dscore[1][16] && m.dscore[3][16] < m.dscore[4][16], [m.dscore[1][16], m.dscore[3][16], m.dscore[4][16]]);
  const a = await page.evaluate(id => window.__mockBest(id, [10, 13, 16]), A), b = await page.evaluate(id => window.__mockBest(id, [10, 16, 17]), B), c = await page.evaluate(id => window.__mockBest(id, [10]), C);
  check('a lead who let it ring three mornings counts for less in the morning', a.f[0] < 0.7 && a.f[1] === 1 && a.f[2] === 1, a.f);
  check('a lead who picked up near 5 PM counts for more near 5 PM', b.f[2] > 1.2 && b.f[1] > 1.2 && b.f[0] === 1, b.f);
  check('so right now (10:30 AM), the fresh lead comes before the one who keeps missing mornings', (await page.evaluate(ids => window.__mockSmart(ids), [A, C]))[0] === C && c.score > a.score, [a.score, c.score]);
  check('best time for the morning-misser: 4–5 PM today', a.best && /^4 PM–5 PM$/.test(a.best.label), a.best);
  check('the lead line says when is best', /best 4 PM–5 PM/.test(a.where), a.where);
  await page.evaluate(() => window.__mockScore('answers')); await page.waitForTimeout(400);
  const rep = await page.evaluate(() => { const b = document.getElementById('scoreModalBody'); return { sum: (b.querySelector('.aw-sum') || {}).innerText || '', cells: b.querySelectorAll('.aw-c').length, rows: b.querySelectorAll('.ans-row').length, wide: b.scrollWidth <= b.clientWidth + 1 }; });
  check('Answer times: a day-by-hour map, 7 days by 13 hours', rep.cells === 91 && rep.rows === 13, rep);
  check('Answer times: names the best day and hour', /^Best: Thu 4 PM \(\d+%\)/.test(rep.sum), rep.sum);
  check('Answer times: fits a phone', rep.wide);
  check('no page errors', !errs.length, errs);
  await br.close();
  console.log('pickup_learn: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
