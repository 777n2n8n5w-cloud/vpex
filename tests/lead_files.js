// VPEX regression check (lead_files). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/lead_files.js
// Files on a lead: photos and documents attached from the lead's profile. Part 1 runs in the demo, where files stay
// in the browser. Part 2 runs the real upload code against a stand-in for the office's file storage and checks
// every request: who's asking, where the file goes, what's sent, and what happens when the server says no.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765/index.html');
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info)); } };
const NOW = '2026-10-20T14:00:00Z';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
async function open(br, c, opt) {
  opt = opt || {};
  const ctx = await br.newContext({ viewport: { width: c.w, height: 844 }, colorScheme: c.s, isMobile: c.w < 500, hasTouch: c.w < 500, timezoneId: 'America/New_York' });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.clock.install({ time: new Date(NOW) });
  await page.route(/gstatic\.com\/firebasejs|fonts\.googleapis/, r => r.abort());
  if (opt.cloud) await page.addInitScript(() => { window.__lfTestCloud = true; });
  await page.goto(BASE + '#demo-' + (opt.ind || 'insurance')); await page.waitForTimeout(2500);
  return { ctx, page, errs };
}
const click = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('missing ' + s); el.click(); }, sel);
// A camera-sized photo (3024 x 4032), made in the browser
const photo = async page => Buffer.from(await page.evaluate(() => new Promise(res => {
  const c = document.createElement('canvas'); c.width = 3024; c.height = 4032; const x = c.getContext('2d');
  x.fillStyle = '#7a5a40'; x.fillRect(0, 0, 3024, 4032); x.fillStyle = '#f4f4ef'; x.fillRect(400, 500, 2200, 3000);
  for (let i = 0; i < 3000; i++) { x.fillStyle = `hsl(${i % 360},40%,${30 + i % 40}%)`; x.fillRect((i * 97) % 3024, (i * 131) % 4032, 18, 18); }
  c.toBlob(b => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(b); }, 'image/jpeg', 0.95);
})), 'base64');
const openProfile = async page => { await click(page, '.lead-name[data-open-lead]'); await page.waitForTimeout(500); return page.evaluate(() => document.getElementById('lfBox').getAttribute('data-lf-lead')); };
const tiles = page => page.evaluate(() => [...document.querySelectorAll('#lfBox .lf-tile')].map(t => ({ cls: t.className, text: t.innerText.replace(/\s+/g, ' ').trim(), img: (t.querySelector('img') || {}).src || '' })));
const lfMeta = (page, id) => page.evaluate(id => { const fs = JSON.parse(localStorage.getItem('__mockfs') || '{}'); for (const k of Object.keys(fs)) { if (/leadChunks\/[^_]/.test(k) && fs[k].leads && fs[k].leads[id]) return fs[k].leads[id].files || []; } return null; }, id);
const idbKeys = page => page.evaluate(() => new Promise(res => { const q = indexedDB.open('vpex_demo_files', 1); q.onupgradeneeded = () => q.result.createObjectStore('f');
  q.onsuccess = () => { const r = q.result.transaction('f').objectStore('f').getAllKeys(); r.onsuccess = () => res(r.result); }; }));
const idbImage = (page, key) => page.evaluate(key => new Promise(res => { const q = indexedDB.open('vpex_demo_files', 1);
  q.onsuccess = () => { const r = q.result.transaction('f').objectStore('f').get(key); r.onsuccess = () => { const b = r.result; if (!b) return res(null); const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, type: b.type, size: b.size }); im.src = URL.createObjectURL(b); }; }; }), key);
const toast = page => page.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map(t => t.textContent).join(' | '));
const viewer = page => page.evaluate(() => { const v = document.getElementById('lfViewer'), a = document.getElementById('lfvOpen'), im = document.getElementById('lfvImg');
  return { shown: v.classList.contains('show'), title: (v.querySelector('.lfv-t') || {}).innerText || '', href: a ? a.getAttribute('href') || '' : '', dl: a ? a.hasAttribute('download') : false, del: !!document.getElementById('lfvDel'), img: im ? im.naturalWidth : -1, wait: (document.getElementById('lfvWait') || {}).hidden }; });

(async () => {
  const br = await chromium.launch();
  // ---------------- Part 1: the demo (files stay in the browser) ----------------
  for (const c of [{ n: 'p-dark', w: 390, s: 'dark' }, { n: 'p-light', w: 320, s: 'light' }]) {
    const { ctx, page, errs } = await open(br, c);
    const big = await photo(page);
    const leadId = await openProfile(page);
    let t = await tiles(page);
    check(c.n + ' empty Files section with an Add tile', t.length === 1 && /Add a photo or file/.test(t[0].text), t);
    check(c.n + ' demo note', /In the demo, files stay in this browser/.test(await page.evaluate(() => document.getElementById('lfBox').innerText)));
    check(c.n + ' picker takes photos and documents', await page.evaluate(() => document.getElementById('lfInput').accept) === 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf');
    await page.setInputFiles('#lfInput', [
      { name: 'image.jpg', mimeType: 'image/jpeg', buffer: big },
      { name: 'Quote - Ross.pdf', mimeType: 'application/pdf', buffer: PDF },
      { name: 'Policy summary.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK docx') },
      { name: 'leads.csv', mimeType: '', buffer: Buffer.from('name,phone\nA,1') },
      { name: 'setup.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') }]);
    await page.waitForTimeout(150);
    check(c.n + ' a program file is turned away', /“setup\.exe” isn’t a photo, PDF, Word, Excel, CSV or text file/.test(await toast(page)), await toast(page));
    await page.waitForTimeout(3000);
    t = await tiles(page);
    const names = t.map(x => x.text);
    check(c.n + ' four files, newest first, then Add', t.length === 5 && /lf-add/.test(t[4].cls) && t.filter(x => /img/.test(x.cls)).length === 1 && t.filter(x => /doc/.test(x.cls)).length === 3, names);
    check(c.n + ' file types are labelled', names.some(x => /^PDF Quote - Ross\.pdf/.test(x)) && names.some(x => /^DOC Policy summary\.docx/.test(x)) && names.some(x => /^CSV leads\.csv/.test(x)), names);
    const photoTile = t.find(x => /img/.test(x.cls));
    check(c.n + ' camera shot gets a dated name', /^Photo Oct 20 10:00 AM\.jpg$/.test(photoTile.text), photoTile.text);
    check(c.n + ' the photo shows a preview', /^blob:/.test(photoTile.img), photoTile.img);
    check(c.n + ' count in the heading', /Files\s*4/.test(await page.evaluate(() => document.querySelector('#lfBox .lf-head').innerText)));
    await page.waitForTimeout(2500);
    const meta = await lfMeta(page, leadId);
    const pm = (meta || []).find(f => /^image/.test(f.t));
    check(c.n + ' the lead keeps a short record of each file', meta && meta.length === 4 && meta.every(f => f.id && f.n && f.t && f.s > 0 && f.at && f.by === 'dAdm' && f.bn === 'You') && pm && pm.th === 1, meta);
    const keys = await idbKeys(page);
    check(c.n + ' saved: 4 files plus 1 preview', keys.length === 5 && keys.every(k => k.indexOf('local/leadFiles/' + leadId + '/') === 0), keys);
    const stored = await idbImage(page, 'local/leadFiles/' + leadId + '/' + pm.id), th = await idbImage(page, 'local/leadFiles/' + leadId + '/' + pm.id + '_t');
    check(c.n + ' a big photo is resized to 2000 px', stored && stored.h === 2000 && stored.w === 1500 && stored.type === 'image/jpeg' && stored.size < big.length, stored);
    check(c.n + ' the preview is small', th && th.h === 360 && th.size < 60000, th);
    await page.evaluate(() => document.getElementById('lpDone').click()); await page.waitForTimeout(300); await openProfile(page);
    const tl = await page.evaluate(() => (document.querySelector('.lp-tl') || {}).innerText || '');
    check(c.n + ' the timeline shows the uploads', /Photo added — Photo Oct 20/.test(tl) && /File added — Quote - Ross\.pdf/.test(tl), tl.slice(0, 200));
    check(c.n + ' fits the screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // open the photo
    await page.evaluate(() => document.querySelector('#lfBox .lf-tile.img').click()); await page.waitForTimeout(700);
    let v = await viewer(page);
    check(c.n + ' photo opens full screen', v.shown && v.img === 1500 && v.wait === true && /Photo · \d+ KB · You, Oct 20/.test(v.title) && /^blob:/.test(v.href) && !v.dl && v.del, v);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(c.n + ' Escape closes it', !(await viewer(page)).shown);
    // open a document, then delete it
    await page.evaluate(() => [...document.querySelectorAll('#lfBox .lf-tile.doc')].find(x => /pdf/i.test(x.innerText)).click()); await page.waitForTimeout(500);
    v = await viewer(page);
    check(c.n + ' a document opens with Open (saves as a file here)', v.shown && /^PDF · 1 KB/.test(v.title.split('\n')[1] || '') && /^blob:/.test(v.href) && v.dl, v);
    await click(page, '#lfvDel'); await page.waitForTimeout(150);
    check(c.n + ' Delete asks first, above the viewer', await page.evaluate(() => { const m = document.getElementById('confirmModal'); return m.classList.contains('show') && +getComputedStyle(m).zIndex > +getComputedStyle(document.getElementById('lfViewer')).zIndex; }));
    await click(page, '#confirmOkBtn'); await page.waitForTimeout(500);
    t = await tiles(page);
    check(c.n + ' the deleted file is gone everywhere', t.length === 4 && !t.some(x => /Quote/.test(x.text)) && (await idbKeys(page)).length === 4 && (await page.waitForTimeout(2500), (await lfMeta(page, leadId)).length === 3) && /File deleted/.test(await toast(page)), t.map(x => x.text));
    check(c.n + ' no page errors', errs.length === 0, errs);
    if (c.n !== 'p-dark') { await ctx.close(); continue; }
    // after a reload
    await page.reload(); await page.waitForTimeout(2500);
    await openProfile(page); await page.waitForTimeout(500);
    t = await tiles(page);
    check('after a reload the files and preview are still there', t.length === 4 && /^blob:/.test((t.find(x => /img/.test(x.cls)) || {}).img || ''), t);
    // 20 files is the most
    const realFiles = await lfMeta(page, leadId);
    await page.evaluate(id => { const many = []; for (let i = 0; i < 20; i++) many.push({ id: 'z' + i, n: 'Scan ' + i + '.pdf', t: 'application/pdf', s: 1000, at: 1, by: 'dAdm', bn: 'You' }); window.__mockEditLead(id, 'files', many); }, leadId);
    await page.evaluate(() => document.getElementById('lpDone').click()); await page.waitForTimeout(300);
    await openProfile(page);
    t = await tiles(page);
    check('at 20 files there is no Add tile', t.length === 20 && !t.some(x => /lf-add/.test(x.cls)), t.length);
    await page.evaluate(([id, f]) => window.__mockEditLead(id, 'files', f), [leadId, realFiles]);
    await page.evaluate(() => document.getElementById('lpDone').click()); await page.waitForTimeout(300);
    // removing the lead removes its files
    await click(page, '#removeLeadBtn'); await page.waitForTimeout(200);
    check('removing the lead says its files go too', /Their files are deleted too\./.test(await page.evaluate(() => document.getElementById('confirmMessage').textContent)));
    await click(page, '#confirmOkBtn'); await page.waitForTimeout(600);
    check('removing the lead deletes its files', (await idbKeys(page)).length === 0, await idbKeys(page));
    check('no page errors (part 1 extras)', errs.length === 0, errs);
    await ctx.close();
  }
  // ---- a rep can delete their own files, not someone else's ----
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' });
    const leadId = await openProfile(page);
    await page.setInputFiles('#lfInput', [{ name: 'Admin notes.pdf', mimeType: 'application/pdf', buffer: PDF }]); await page.waitForTimeout(1200);
    await page.evaluate(() => { const fs = JSON.parse(localStorage.getItem('__mockfs')); fs['members/dAdm'].role = 'rep'; localStorage.setItem('__mockfs', JSON.stringify(fs)); });
    await page.waitForTimeout(1500);
    await page.reload(); await page.waitForTimeout(2500);
    await page.evaluate(id => { const el = document.querySelector('[data-open-lead="' + id + '"]'); if (el) el.click(); }, leadId); await page.waitForTimeout(500);
    const inProfile = await page.evaluate(() => !!document.getElementById('lfBox'));
    if (inProfile) {
      await page.evaluate(id => { const l = JSON.parse(localStorage.getItem('__mockfs')); window.__mockEditLead(id, 'files', [{ id: 'x1', n: 'From Jordan.pdf', t: 'application/pdf', s: 900, at: 1, by: 'dR1', bn: 'Jordan Lee' }]); }, leadId);
      await page.evaluate(() => document.getElementById('lpDone').click()); await page.waitForTimeout(300);
      await page.evaluate(id => document.querySelector('[data-open-lead="' + id + '"]').click(), leadId); await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('#lfBox .lf-tile.doc').click()); await page.waitForTimeout(500);
      check("rep: the viewer names who added it", /Jordan Lee, /.test((await viewer(page)).title), (await viewer(page)).title);
      check("rep: can open a teammate's file but not delete it", (await viewer(page)).shown && !(await viewer(page)).del);
      await page.keyboard.press('Escape');
      await page.setInputFiles('#lfInput', [{ name: 'My photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }]); await page.waitForTimeout(1200);
      await page.evaluate(() => document.querySelector('#lfBox .lf-tile.img').click()); await page.waitForTimeout(500);
      check('rep: can delete their own', (await viewer(page)).del);
    } else check('rep: profile opens', false);
    check('rep: no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  // ---- file names are shown exactly (no industry word swaps) ----
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'light' }, { ind: 'realestate' });
    await openProfile(page);
    await page.setInputFiles('#lfInput', [{ name: 'Investor Committed offer.pdf', mimeType: 'application/pdf', buffer: PDF }]); await page.waitForTimeout(1200);
    check('real estate: the file name is shown as is', (await tiles(page)).some(x => /Investor Committed offer\.pdf/.test(x.text)), await tiles(page));
    check('real estate: no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  // ---------------- Part 2: the real upload code against a stand-in file server ----------------
  {
    const { ctx, page, errs } = await open(br, { w: 390, s: 'dark' }, { cloud: true });
    const BUCKET = 'dovetail-f863c.firebasestorage.app', API = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o';
    const store = {}, log = []; let mode = 'ok', delay = 0;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' };
    await page.route(u => u.href.indexOf(API) === 0, async route => {
      const rq = route.request(), u = new URL(rq.url()), h = rq.headers(), m = rq.method();
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = u.pathname.length > ('/v0/b/' + BUCKET + '/o').length ? decodeURIComponent(u.pathname.slice(('/v0/b/' + BUCKET + '/o/').length)) : u.searchParams.get('name');
      log.push({ m, path, auth: h['authorization'], proto: h['x-goog-upload-protocol'] || '', ct: h['content-type'] || '', alt: u.searchParams.get('alt'), token: u.searchParams.get('token') });
      if (mode === 'deny') return route.fulfill({ status: 403, headers: cors, contentType: 'application/json', body: '{"error":{"code":403}}' });
      if (mode === 'down') return route.abort('internetdisconnected');
      if (h['authorization'] !== 'Firebase token' && !u.searchParams.get('token')) return route.fulfill({ status: 401, headers: cors, body: '' });
      if (m === 'POST') {
        if (delay) await new Promise(r => setTimeout(r, delay));
        const body = rq.postDataBuffer(), bd = /boundary=([^;]+)/.exec(h['content-type'])[1], txt = body.toString('latin1');
        const parts = txt.split('--' + bd), mdPart = parts[1], md = JSON.parse(mdPart.slice(mdPart.indexOf('\r\n\r\n') + 4).trim());
        const media = parts[2], start = txt.indexOf(media) + media.indexOf('\r\n\r\n') + 4, end = txt.lastIndexOf('\r\n--' + bd + '--');
        const ctype = /Content-Type: ([^\r\n]+)/.exec(media)[1];
        store[path] = { md, bytes: body.slice(start, end), type: ctype, token: 'tok' + Object.keys(store).length };
        log[log.length - 1].md = md;
        return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ name: path, bucket: BUCKET, contentType: ctype, size: String(store[path].bytes.length), downloadTokens: store[path].token }) });
      }
      const f = store[path];
      if (m === 'DELETE') { if (!f) return route.fulfill({ status: 404, headers: cors, body: '' }); delete store[path]; return route.fulfill({ status: 204, headers: cors, body: '' }); }
      if (!f) return route.fulfill({ status: 404, headers: cors, body: '{}' });
      if (u.searchParams.get('alt') === 'media') return f.token === u.searchParams.get('token') ? route.fulfill({ status: 200, headers: cors, contentType: f.type, body: f.bytes }) : route.fulfill({ status: 403, headers: cors, body: '' });
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ name: path, downloadTokens: f.token }) });
    });
    const big = await photo(page);
    const leadId = await openProfile(page);
    const office = await page.evaluate(() => (localStorage.getItem('vpex_office') || ''));
    await page.setInputFiles('#lfInput', [{ name: 'IMG_2207.JPG', mimeType: 'image/jpeg', buffer: big }, { name: 'Quote.pdf', mimeType: 'application/pdf', buffer: PDF }]);
    await page.waitForTimeout(4000);
    const posts = log.filter(x => x.m === 'POST');
    const pre = office ? 'offices/' + office + '/leadFiles/' + leadId + '/' : 'team/leadFiles/' + leadId + '/';
    check('cloud: 3 uploads (photo preview, photo, PDF)', posts.length === 3 && /_t$/.test(posts[0].path) && posts[1].path + '_t' === posts[0].path && posts.every(p => p.path.indexOf(pre) === 0), posts.map(p => p.path));
    check('cloud: every request carries the login token', log.every(x => x.auth === 'Firebase token' || x.token), log.map(x => x.auth));
    check('cloud: sent the way Firebase expects (multipart)', posts.every(p => p.proto === 'multipart' && /^multipart\/related; boundary=vpex/.test(p.ct)), posts.map(p => p.ct));
    const md = posts[1].md, mdPdf = posts[2].md;
    check('cloud: file details name the uploader and the lead', md.name === posts[1].path && md.contentType === 'image/jpeg' && md.metadata.uid === 'dAdm' && md.metadata.lead === leadId && /private/.test(md.cacheControl), md);
    check('cloud: PDF sent as a PDF', mdPdf.contentType === 'application/pdf' && store[posts[2].path].bytes.equals(PDF), mdPdf);
    check('cloud: photo was resized before it left the phone', store[posts[1].path].bytes.length < big.length / 2, [store[posts[1].path].bytes.length, big.length]);
    let t = await tiles(page);
    const imgT = t.find(x => /img/.test(x.cls));
    check('cloud: preview loads through its private link', imgT && imgT.img === API + '/' + encodeURIComponent(posts[0].path) + '?alt=media&token=' + store[posts[0].path].token, imgT);
    check('cloud: the preview image really loads', await page.evaluate(() => { const i = document.querySelector('#lfBox .lf-tile.img img'); return i && i.complete && i.naturalWidth > 0; }));
    check('cloud: name kept from the phone', t.some(x => /IMG_2207\.JPG/.test(x.text)), t.map(x => x.text));
    await page.evaluate(() => [...document.querySelectorAll('#lfBox .lf-tile.doc')][0].click()); await page.waitForTimeout(600);
    let v = await viewer(page);
    check('cloud: Open goes to the file in a new tab', v.href === API + '/' + encodeURIComponent(posts[2].path) + '?alt=media&token=' + store[posts[2].path].token && !v.dl, v);
    check('cloud: Open link really serves the PDF', (await page.evaluate(h => fetch(h).then(r => r.status + ' ' + r.headers.get('content-type')), v.href)) === '200 application/pdf');
    await click(page, '#lfvDel'); await click(page, '#confirmOkBtn'); await page.waitForTimeout(800);
    check('cloud: Delete removes it from storage', log.some(x => x.m === 'DELETE' && x.path === posts[2].path) && !store[posts[2].path], log.filter(x => x.m === 'DELETE'));
    // the server says no, then no connection, then a retry that works
    mode = 'deny';
    await page.setInputFiles('#lfInput', [{ name: 'Deny.pdf', mimeType: 'application/pdf', buffer: PDF }]); await page.waitForTimeout(800);
    t = await tiles(page);
    check('cloud: a refused upload says so, with Retry', t.some(x => /lf-job err/.test(x.cls) && /Deny\.pdf Not allowed Retry/.test(x.text)), t.map(x => x.text));
    mode = 'down';
    await click(page, '[data-lf-retry]'); await page.waitForTimeout(800);
    t = await tiles(page);
    check('cloud: no connection says so', t.some(x => /err/.test(x.cls) && /No connection/.test(x.text)), t.map(x => x.text));
    mode = 'ok';
    await click(page, '[data-lf-retry]'); await page.waitForTimeout(1200);
    t = await tiles(page);
    check('cloud: Retry uploads it', !t.some(x => /err/.test(x.cls)) && t.some(x => /Deny\.pdf/.test(x.text)), t.map(x => x.text));
    // a file that finishes after the profile was closed says so
    delay = 1500;
    await page.setInputFiles('#lfInput', [{ name: 'Late.pdf', mimeType: 'application/pdf', buffer: PDF }]); await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('lpDone').click());
    await page.waitForTimeout(2500); delay = 0;
    check('cloud: a file that finishes later says so', /File added for \w+: Late\.pdf/.test(await toast(page)), await toast(page));
    await openProfile(page);
    const before = Object.keys(store).length;
    await page.evaluate(() => [...document.querySelectorAll('#lfBox .lf-tile .lf-jb [data-lf-drop]')].forEach(b => b.click()));
    // removing the lead removes its files from storage
    await page.evaluate(() => document.getElementById('lpDone').click()); await page.waitForTimeout(300);
    await click(page, '#removeLeadBtn'); await click(page, '#confirmOkBtn'); await page.waitForTimeout(1200);
    check('cloud: removing the lead deletes its files and previews', before === 4 && Object.keys(store).length === 0, Object.keys(store));
    check('cloud: no page errors', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close();
  console.log('lead_files: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
