// Every script on the site must parse: inline <script> blocks in every page, the site's .js
// files, and every JSON-LD block (search engines drop a page's rich results if it doesn't parse). A syntax error in the
// app's one big script would blank the whole app, so this runs on every push (.github/workflows/vpex-app-tests.yml).
//   node tools/check_scripts.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SKIP = /^(\.git|node_modules|functions\/node_modules|instagram-bot|studio)(\/|$)/;
const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(path.join(ROOT, d))) {
    const rel = d ? d + '/' + n : n; if (SKIP.test(rel)) continue;
    const st = fs.statSync(path.join(ROOT, rel));
    // tools/ holds page templates with {placeholders}; the pages built from them are checked
    if (st.isDirectory()) { if (!/^(tests|tools)$/.test(rel)) walk(rel); }
    else if (/\.html$/.test(n) || (/\.js$/.test(n) && !/^(tests|functions|tools|scripts|instagram)\//.test(rel))) files.push(rel);
  }
})('');
let bad = 0, n = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (f.endsWith('.js')) { n++; try { new vm.Script(src, { filename: f }); } catch (e) { bad++; console.log('FAIL ' + f + ': ' + e.message); } continue; }
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(src))) {
    const attrs = m[1], body = m[2], line = src.slice(0, m.index).split('\n').length;
    if (/\bsrc=/.test(attrs) || !body.trim()) continue;
    n++;
    if (/type=["']?application\/(ld\+)?json/i.test(attrs)) { try { JSON.parse(body); } catch (e) { bad++; console.log('FAIL ' + f + ':' + line + ' JSON: ' + e.message); } continue; }
    if (/type=["']?module/i.test(attrs)) continue;
    if (/type=["']?(?!text\/javascript|application\/javascript)[a-z]/i.test(attrs)) continue;   // templates and the like
    try { new vm.Script(body, { filename: f + ':' + line }); } catch (e) { bad++; console.log('FAIL ' + f + ':' + line + ': ' + e.message); }
  }
}
// A save that makes a missing record only on "not found" silently fails for reps: for them the database answers
// "permission denied" when the record isn't there (their rule reads the old record). That lost every rep's calls from
// Nov 15 to Nov 24. The app must use updateOrCreate() for these; this fails the check if the old pattern comes back.
{
  const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), lines = app.split('\n');
  lines.forEach((ln, i) => {
    if (!/["']not-found["']/.test(ln)) return;
    if (/function updateOrCreate\(|if \(code === "not-found"\) return ref\.set\(make/.test(ln + (lines[i - 3] || '') + (lines[i - 2] || '') + (lines[i - 1] || ''))) return;   // the helper itself
    if (/err\("not-found"/.test(ln)) return;                                         // the in-page test database raising it
    bad++; console.log('FAIL index.html:' + (i + 1) + ': handles "not found" on its own; a rep gets "permission denied" for a missing record: use updateOrCreate()');
  });
}
console.log('scripts checked: ' + n + ' in ' + files.length + ' files, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
