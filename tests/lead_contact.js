// VPEX regression check (lead_contact). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/lead_contact.js
// Contact details: each lead has a main number, other numbers (with a label) and an email. Uploads, pasted lists,
// contact cards (.vcf) and Add one put them in their own spots instead of the notes; the profile shows them and anyone
// working the lead can edit them; the Dial card calls the other numbers; older leads move theirs out of the notes once.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-10-20T14:00:00Z';   // Tue 10:00 AM in New York
async function open(br, c, hash) {
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York', acceptDownloads: true });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis/, r => r.abort());
  await page.goto(BASE + (hash || '#demo-insurance')); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const click = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('missing ' + s); el.click(); }, sel);
const lead = (page, q) => page.evaluate(q => (window.__mockLeadFull(q) || [])[0] || null, q);
const toast = page => page.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map(t => t.textContent).join(' | '));
const setVal = (page, sel, v) => page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const openLead = async (page, id) => { await page.evaluate(id => { const b = document.createElement('button'); b.setAttribute('data-open-lead', id); document.body.appendChild(b); b.click(); b.remove(); }, id); await page.waitForTimeout(400); };
const upload = async (page, name, body, mime) => {
  await click(page, '#addLeadsBtn'); await page.waitForTimeout(300);
  await page.setInputFiles('#leadFileInput', { name, mimeType: mime || 'text/csv', buffer: Buffer.from(body) });
  await page.waitForTimeout(600);
  const prev = await page.evaluate(() => (document.getElementById('uploadPreview') || {}).innerText || '');
  await click(page, '#submitUpload'); await page.waitForTimeout(600);
  return prev;
};
const CSV = 'Name,Home Phone,Mobile Phone,Work Phone,Email,Email 2,State,Company\n' +
  'Dana Whitfield,(305) 555-0181,(305) 555-0182,(786) 555-0183,Dana.W@Example.com,dana.alt@example.com,FL,Coastal Marine\n' +
  'Ray Okafor,(512) 555-0184,,,n/a,,TX,\n' +
  'Lena Brooks,,(212) 555-0185,(212) 555-0185,lena@example.com,,NY,\n';

(async () => {
  const br = await chromium.launch();
  // ---------------- uploads, pasted lists, contact cards, Add one ----------------
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' });
    const prev = await upload(page, 'list.csv', CSV);
    check('preview counts emails and other numbers', /2 with an email/.test(prev) && /1 with other numbers/.test(prev), prev);
    let d = await lead(page, 'Dana Whitfield');
    check('the mobile number is the main one', d && d.phoneRaw === '(305) 555-0182', d && d.phoneRaw);
    check('home and work numbers go to Other numbers, with their labels', d && JSON.stringify(d.alts) === JSON.stringify([{ n: '(305) 555-0181', l: 'Home' }, { n: '(786) 555-0183', l: 'Work' }]), d && d.alts);
    check('the email goes to Email (lower case)', d && d.email === 'dana.w@example.com', d && d.email);
    check('the notes keep the company and the second email, not the numbers or first email', d && /Coastal Marine/.test(d.notes) && /Email 2: dana\.alt@example\.com/.test(d.notes) && !/555-018[123]/.test(d.notes) && !/Dana\.W@/i.test(d.notes) && !/Alt:/.test(d.notes), d && d.notes);
    const r = await lead(page, 'Ray Okafor');
    check('a cell that isn\'t an email stays in the notes', r && !r.email && /n\/a/.test(r.notes) && !r.alts, r);
    const l = await lead(page, 'Lena Brooks');
    check('the same number twice isn\'t added as another number', l && l.phoneRaw === '(212) 555-0185' && !l.alts && l.email === 'lena@example.com', l);
    // no header row
    await upload(page, 'raw.csv', 'Jo Park,908-555-0186,jo.park@example.com,973-555-0187,Prefers mornings\n');
    const j = await lead(page, 'Jo Park');
    check('a list without headers: email and second number find their spots', j && j.email === 'jo.park@example.com' && j.alts && j.alts[0].n === '973-555-0187' && j.notes === 'Prefers mornings', j);
    // contact cards
    await upload(page, 'contacts.vcf', 'BEGIN:VCARD\nVERSION:3.0\nFN:Mia Castillo\nTEL;TYPE=CELL:(415) 555-0188\nTEL;TYPE=WORK:(415) 555-0189\nEMAIL:mia@example.com\nEND:VCARD\n', 'text/vcard');
    const m = await lead(page, 'Mia Castillo');
    check('a contact card: second number and email in their spots', m && m.phoneRaw === '(415) 555-0188' && m.alts && m.alts[0].n === '(415) 555-0189' && m.alts[0].l === 'Work' && m.email === 'mia@example.com' && !/mia@/.test(m.notes), m);
    // pasted
    await click(page, '#addLeadsBtn'); await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tab-btn')].find(x => /paste/i.test(x.textContent)); if (b) b.click(); }); await page.waitForTimeout(200);
    await setVal(page, '#pasteArea', 'Sam Lee, (212) 555-0190, sam@example.com, (646) 555-0191, call Friday');
    await click(page, '#submitPaste'); await page.waitForTimeout(500);
    const s = await lead(page, 'Sam Lee');
    check('a pasted line: email and other number in their spots', s && s.email === 'sam@example.com' && s.alts && s.alts[0].n === '(646) 555-0191' && s.notes === 'call Friday', s);
    // add one
    await click(page, '#addLeadsBtn'); await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tab-btn')].find(x => /one|single|add a lead/i.test(x.textContent)); if (b) b.click(); }); await page.waitForTimeout(200);
    await setVal(page, '#singleName', 'Ava Stone'); await setVal(page, '#singlePhone', '(201) 555-0192'); await setVal(page, '#singleEmail', 'not-an-email');
    await click(page, '#submitSingle'); await page.waitForTimeout(200);
    check('Add one: a bad email is caught', /doesn’t look right/.test(await page.evaluate(() => document.getElementById('singleError').textContent)));
    await setVal(page, '#singleEmail', 'Ava@Example.com'); await click(page, '#submitSingle'); await page.waitForTimeout(400);
    const a = await lead(page, 'Ava Stone');
    check('Add one: email saved', a && a.email === 'ava@example.com', a);
    check('no page errors (adding)', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------------- the profile: show, edit, validate ----------------
  for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 320, s: 'light' }, { n: 'desk', w: 1280, s: 'light' }]) {
    const { ctx, page, errs } = await open(br, c);
    const id = await page.evaluate(() => document.querySelector('.lead-name[data-open-lead]').getAttribute('data-open-lead'));
    await page.evaluate(id => window.__mockEditLead(id, 'alts', [{ n: '(212) 555-0150', l: 'Mobile' }, { n: '(646) 555-0144', l: 'Work' }, { n: '(718) 555-0177', l: 'Home' }]), id);
    await page.evaluate(() => { window.__mockEditLead(document.querySelector('.lead-name[data-open-lead]').getAttribute('data-open-lead'), 'notes', 'Wants coverage for their spouse too | NY'); });
    await page.waitForTimeout(300);
    let L = await lead(page, id);
    // Dial card
    const pills = await page.evaluate(() => [...document.querySelectorAll('.lead-alts .alt-pill')].map(p => p.textContent.replace(/\s+/g, ' ').trim()));
    check(c.n + ' Dial card shows 2 other numbers and "+1 more"', pills.join('|') === 'Mobile (212) 555-0150|Work (646) 555-0144|+1 more', pills);
    check(c.n + ' the other numbers stay on one line', await page.evaluate(() => { const r = [...document.querySelectorAll('.lead-alts .alt-pill')].map(p => Math.round(p.getBoundingClientRect().top)); return new Set(r).size === 1; }));
    check(c.n + ' fits the screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Profile
    await openLead(page, id);
    const card = await page.evaluate(() => { const b = document.getElementById('lpContact'); return { text: b.innerText.replace(/\s+/g, ' '), mail: (b.querySelector('a[href^="mailto:"]') || {}).href, calls: [...b.querySelectorAll('a[data-num]')].map(a => a.getAttribute('data-num') + '>' + a.getAttribute('href')) }; });
    check(c.n + ' profile lists the other numbers and the email', /Mobile \(212\) 555-0150/.test(card.text) && /Work \(646\) 555-0144/.test(card.text) && /Home \(718\) 555-0177/.test(card.text) && card.mail === 'mailto:' + L.email, card);
    check(c.n + ' each other number calls that number', card.calls.length === 3 && /^\(212\) 555-0150>tel:(\/\/)?\+?1?2125550150$/.test(card.calls[0]), card.calls);
    await click(page, '[data-ct-copy]'); await page.waitForTimeout(150);
    check(c.n + ' copy a number', /Number copied/.test(await toast(page)), await toast(page));
    await click(page, '#lpEditContact'); await page.waitForTimeout(200);
    check(c.n + ' Edit contact opens the form', await page.evaluate(() => document.querySelectorAll('#lpContact [data-ct-n]').length === 3 && !!document.getElementById('ctEmail')));
    check(c.n + ' the form fits the screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#lpContact input, #lpContact select')].every(e => e.getBoundingClientRect().right <= innerWidth + 0.5)));
    // validation
    await setVal(page, '#ctEmail', 'nope@'); await click(page, '#ctSave'); await page.waitForTimeout(150);
    check(c.n + ' a bad email is caught', /doesn’t look right/.test(await page.evaluate(() => document.getElementById('ctErr').textContent)));
    await setVal(page, '#ctEmail', L.email);
    await setVal(page, '#ctPhone', '555-01'); await click(page, '#ctSave'); await page.waitForTimeout(150);
    check(c.n + ' a short main number is caught', /needs 10 digits/.test(await page.evaluate(() => document.getElementById('ctErr').textContent)));
    const other = await page.evaluate(id => { const fs = JSON.parse(localStorage.getItem('__mockfs')); for (const k in fs) if (/leadChunks\/c/.test(k)) for (const x in fs[k].leads) if (x !== id) return fs[k].leads[x]; }, id);
    await setVal(page, '#ctPhone', other.phoneRaw); await click(page, '#ctSave'); await page.waitForTimeout(150);
    check(c.n + ' a number already on another lead is caught', (await page.evaluate(() => document.getElementById('ctErr').textContent)).indexOf('already on ' + other.name) > -1);
    await setVal(page, '#ctPhone', L.phoneRaw);
    // edit: Make main, remove one, add one, change email and state
    await click(page, '[data-ct-main="1"]'); await page.waitForTimeout(150);
    check(c.n + ' Make main swaps it with the main number', await page.evaluate(() => document.getElementById('ctPhone').value) === '(646) 555-0144' && await page.evaluate(() => document.querySelector('[data-ct-n="1"]').value) === '(212) 555-0115');
    await click(page, '[data-ct-del="2"]'); await page.waitForTimeout(100);
    await click(page, '#ctAddNum'); await page.waitForTimeout(100);
    await setVal(page, '[data-ct-n="2"]', '9175550178'); await setVal(page, '[data-ct-l="2"]', 'Home');
    await setVal(page, '#ctEmail', 'Anthony.R@Example.com'); await setVal(page, '#ctState', 'NJ'); await setVal(page, '#ctName', 'Anthony J. Ross');
    await click(page, '#ctSave'); await page.waitForTimeout(500);
    L = await lead(page, id);
    check(c.n + ' saved: new main number', L.phoneRaw === '(646) 555-0144' && L.phone === '+16465550144', [L.phoneRaw, L.phone]);
    check(c.n + ' saved: other numbers with labels', JSON.stringify(L.alts) === JSON.stringify([{ n: '(212) 555-0150', l: 'Mobile' }, { n: '(212) 555-0115', l: 'Other' }, { n: '9175550178', l: 'Home' }]), L.alts);
    check(c.n + ' saved: email, state and name', L.email === 'anthony.r@example.com' && L.st === 'NJ' && L.name === 'Anthony J. Ross', [L.email, L.st, L.name]);
    check(c.n + ' saved: says so', /Contact saved/.test(await toast(page)), await toast(page));
    const after = await page.evaluate(() => ({ card: document.getElementById('lpContact').innerText.replace(/\s+/g, ' '), tl: (document.querySelector('.lp-tl') || {}).innerText || '', where: document.getElementById('leadModalBody').innerText }));
    check(c.n + ' profile shows the new details', /\(646\) 555-0144/.test(after.card) && /anthony\.r@example\.com/.test(after.card) && /Home \(917\) 555-0178/.test(after.card), after.card);
    check(c.n + ' timeline records the change', /Contact details updated/.test(after.tl), after.tl.slice(0, 200));
    check(c.n + ' local time follows the new state', /NJ · /.test(after.where));
    // clear the email: the Add email link comes back
    await click(page, '#lpEditContact'); await setVal(page, '#ctEmail', ''); await click(page, '#ctSave'); await page.waitForTimeout(400);
    L = await lead(page, id);
    check(c.n + ' email can be cleared', !L.email && await page.evaluate(() => !!document.querySelector('#lpContact [data-ct-edit="email"]')), L.email);
    await click(page, '[data-ct-edit="email"]'); await page.waitForTimeout(150);
    check(c.n + ' "+ Add email" opens the form on the email box', await page.evaluate(() => document.activeElement && document.activeElement.id === 'ctEmail'));
    await click(page, '#ctCancel'); await page.waitForTimeout(200);
    check(c.n + ' Cancel leaves it as it was', !(await lead(page, id)).email && await page.evaluate(() => !document.getElementById('ctSave')));
    check(c.n + ' no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------------- calling another number from the Dial card ----------------
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' });
    const id = await page.evaluate(() => document.querySelector('.lead-name[data-open-lead]').getAttribute('data-open-lead'));
    await page.evaluate(id => window.__mockEditLead(id, 'alts', [{ n: '(212) 555-0150', l: 'Mobile' }, { n: '(646) 555-0144', l: 'Work' }]), id);
    await page.waitForTimeout(200);
    await page.evaluate(() => { const a = document.querySelector('[data-alt-call="0"]'); a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await page.waitForTimeout(400);
    check('tapping Mobile starts the call', await page.evaluate(() => !document.getElementById('outcomesRow').classList.contains('disabled')) && /Dialing Mobile \(212\) 555-0150/.test(await toast(page)), await toast(page));
    await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="noanswer"]').click()); await page.waitForTimeout(600);
    const calls = await page.evaluate(id => window.__mockCallsFor(id), id);
    const last = calls[calls.length - 1];
    check('the call log records the number dialed', last && last.phoneRaw === '(212) 555-0150' && last.alt === 'Mobile' && last.phone === '+12125550150', last);
    // an other number on the Do Not Call list can't be called
    await page.evaluate(() => { document.getElementById('adminBtn').click(); }); await page.waitForTimeout(300);
    await page.evaluate(() => { document.querySelector('[data-hub-cat="leads"]').click(); }); await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('hubDnc').click()); await page.waitForTimeout(300);
    await setVal(page, '#dncAdd', '(646) 555-0144');
    await click(page, '#dncSave'); await page.waitForTimeout(900);
    const added = await page.evaluate(() => /646/.test(document.body.innerText) || true);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    if (added) {
      await openLead(page, id);
      const row = await page.evaluate(() => [...document.querySelectorAll('#lpContact .lp-ct-row')].map(r => r.innerText.replace(/\s+/g, ' ')).join(' | '));
      check('an other number on the Do Not Call list says so and can\'t be tapped', /Work \(646\) 555-0144 · Do not call/.test(row) && await page.evaluate(() => ![...document.querySelectorAll('#lpContact a[data-num]')].some(a => /646/.test(a.getAttribute('data-num')))), row);
    }
    // and on the Dial card it's struck through, not a link
    await page.evaluate(() => { const d = document.getElementById('lpDone'); if (d) d.click(); }); await page.waitForTimeout(300);
    await page.evaluate(() => { const nx = document.getElementById('nextLeadBtn'); if (nx) nx.click(); }); await page.waitForTimeout(300);
    await page.evaluate(() => { const cur = document.querySelector('.lead-name[data-open-lead]').getAttribute('data-open-lead'); window.__mockEditLead(cur, 'alts', [{ n: '(646) 555-0144', l: 'Work' }, { n: '(212) 555-0150', l: 'Mobile' }]); });
    await page.waitForTimeout(200);
    check('on the Dial card it\'s struck through, not tappable', await page.evaluate(() => { const p = [...document.querySelectorAll('.lead-alts .alt-pill')]; const w = p.find(x => /646/.test(x.textContent)); return !!w && w.classList.contains('off') && !w.hasAttribute('href'); }));
    check('no page errors (calling)', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------------- a Bad number lead gets a new number and goes back in the queue ----------------
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'light' });
    const id = await page.evaluate(() => document.querySelector('.lead-name[data-open-lead]').getAttribute('data-open-lead'));
    await page.evaluate(() => document.getElementById('copyBtn').click()); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="badnum"]').click()); await page.waitForTimeout(600);
    let L = await lead(page, id);
    check('Bad number marks the lead', L.badNumber === true && L.status === 'done', [L.badNumber, L.status]);
    await openLead(page, id);
    await click(page, '#lpEditContact'); await setVal(page, '#ctPhone', '(212) 555-0179'); await click(page, '#ctSave'); await page.waitForTimeout(500);
    L = await lead(page, id);
    check('a new main number puts it back in the queue', L.badNumber === false && L.status === 'pending' && L.phoneRaw === '(212) 555-0179' && /back in your queue/.test(await toast(page)), [L.badNumber, L.status, await toast(page)]);
    check('no page errors (bad number)', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------------- search finds other numbers; exports carry the new columns ----------------
  {
    const { ctx, page, errs } = await open(br, { w: 1280, s: 'light' });
    const id = await page.evaluate(() => document.querySelector('.lead-name[data-open-lead]').getAttribute('data-open-lead'));
    await page.evaluate(id => window.__mockEditLead(id, 'alts', [{ n: '(917) 555-0166', l: 'Work' }]), id);
    const name = (await lead(page, id)).name;
    await page.evaluate(() => { const b = document.querySelector('[aria-label="Search"], #searchBtn'); if (b) b.click(); }); await page.waitForTimeout(300);
    await setVal(page, '#gsQ', '9175550166'); await page.waitForTimeout(400);
    check('search by an other number finds the lead', (await page.evaluate(() => (document.getElementById('searchOverlay') || {}).innerText || '')).indexOf(name) > -1);
    await page.keyboard.press('Escape');
    // a call, then export the call log
    await page.evaluate(() => document.getElementById('copyBtn').click()); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#outcomesRow [data-outcome="noanswer"]').click()); await page.waitForTimeout(600);
    const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.evaluate(() => document.getElementById('menuExportBtn').click());
    const d = await dl;
    const csv = d ? require('fs').readFileSync(await d.path(), 'utf8') : '';
    check('call log export has an Email column', /^﻿?Name,Phone,Email,Outcome,Notes,Time/.test(csv) && csv.indexOf('@example.com') > -1, csv.slice(0, 200));
    check('no page errors (search, export)', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------------- older leads: emails and "Alt:" numbers move out of the notes once ----------------
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' });
    const ids = await page.evaluate(() => {
      const fs = JSON.parse(localStorage.getItem('__mockfs')), out = [];
      for (const k in fs) if (/leadChunks\/c/.test(k)) for (const x in fs[k].leads) { if (out.length < 3 && !fs[k].leads[x].alts) out.push([k, x]); }
      const [a, b, c] = out;
      delete fs[a[0]].leads[a[1]].email; fs[a[0]].leads[a[1]].notes = 'Asked about whole life | jo.old@example.com | Alt: (305) 555-0170, (786) 555-0171 | FL';
      delete fs[b[0]].leads[b[1]].email; fs[b[0]].leads[b[1]].notes = 'Email: pat.old@example.com | Status: warm';
      delete fs[c[0]].leads[c[1]].email; fs[c[0]].leads[c[1]].notes = 'Met at jo@ the fair | Alt: call after 5';
      localStorage.setItem('__mockfs', JSON.stringify(fs));
      return out.map(x => x[1]);
    });
    // a rep's app leaves them alone
    await page.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); fs['members/dAdm'].role = 'rep'; localStorage.setItem('__mockfs', JSON.stringify(fs)); });
    await page.reload(); await page.waitForTimeout(3000);
    let A = await lead(page, ids[0]);
    check('a rep\'s app doesn\'t move anything', A && /jo\.old@example\.com/.test(A.notes) && !A.email, A && A.notes);
    // the admin's app moves them
    await page.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); fs['members/dAdm'].role = 'admin'; localStorage.setItem('__mockfs', JSON.stringify(fs)); });
    await page.reload(); await page.waitForTimeout(3500);
    A = await lead(page, ids[0]);
    const B = await lead(page, ids[1]), C = await lead(page, ids[2]);
    check('email and Alt numbers move to their spots', A.email === 'jo.old@example.com' && JSON.stringify(A.alts) === JSON.stringify([{ n: '(305) 555-0170', l: 'Other' }, { n: '(786) 555-0171', l: 'Other' }]), A);
    check('the rest of the notes stay, in order', A.notes === 'Asked about whole life | FL', A.notes);
    check('"Email: x" moves too', B.email === 'pat.old@example.com' && B.notes === 'Status: warm', B);
    check('anything not clearly an email or numbers stays', !C.email && !C.alts && C.notes === 'Met at jo@ the fair | Alt: call after 5', C);
    const saved = await page.evaluate(id => { const fs = JSON.parse(localStorage.getItem('__mockfs')); for (const k in fs) if (/leadChunks\/c/.test(k) && fs[k].leads[id]) return fs[k].leads[id]; }, ids[0]);
    check('the move is saved for the team', saved && saved.email === 'jo.old@example.com' && saved.notes === 'Asked about whole life | FL', saved);
    check('no page errors (older leads)', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log('lead_contact: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
