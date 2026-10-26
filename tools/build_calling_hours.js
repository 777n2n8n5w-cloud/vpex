// Builds vpexdialer.com/calling-hours/ (calling-hours/index.html) from tools/calling_hours_template.html and the calling-hours
// rules in index.html, so the free checker always matches the app. Run after changing STATE_HOURS: node tools/build_calling_hours.js
// tests/calling_hours_page.js fails if the committed page is out of date.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };

function grab(src, re) {
  const m = re.exec(src); if (!m) throw new Error('not found in index.html: ' + re);
  let i = src.indexOf('{', m.index), d = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; }
  return src.slice(m.index, j + 1) + (/^\s*var /.test(m[0]) ? ';' : '');
}
function rulesFrom(src) {
  const zs = src.indexOf('  var ZONE_OF = {};'), ze = src.indexOf('  })();', zs);
  if (zs < 0 || ze < 0) throw new Error('ZONE_OF block not found in index.html');
  const zone = src.slice(zs, ze + 7).replace(/^  /gm, '');
  const rest = [/var STATE_HOURS = /, /function usHolidays\(/, /function stateRule\(/, /function hourLabel\(/, /function dayWindow\(/].map(r => grab(src, r));
  return [zone, rest[0], 'var HOLIDAYS = {};', ...rest.slice(1)].join('\n');
}
function legalFrom(src) {
  const m = /Based on published state rules as of [A-Z][a-z]+ \d{4}\. Not legal advice\./.exec(src);
  if (!m) throw new Error('compliance line not found in index.html');
  return m[0];
}
function build() {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const rules = rulesFrom(src), legal = legalFrom(src);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(rules + '\nthis.SH = STATE_HOURS; this.HL = hourLabel;', ctx);
  const SH = ctx.SH, HL = ctx.HL, win = w => HL(w[0]) + '–' + HL(w[1]);
  const fmtDate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const strict = Object.keys(SH).sort((a, b) => NAMES[a].localeCompare(NAMES[b]));
  const rows = strict.map(st => {
    const r = SH[st];
    const hours = win(r.h) + (r.from ? ' (from ' + fmtDate(r.from) + ')' : '');
    return '<tr><td>' + NAMES[st] + '</td><td>' + hours + '</td><td>' + (r.sat ? win(r.sat) : 'Same') + '</td><td>' + (r.sun === false ? 'No calls' : r.sunH ? win(r.sunH) : 'Same') +
      '</td><td>' + (r.hol ? 'No calls' : 'Allowed') + '</td><td>' + (r.max3 ? '3 per 24 hours' : 'No state limit') + '</td></tr>';
  }).join('\n      ');
  const list = a => a.map(s => NAMES[s]).join(', ').replace(/, ([^,]+)$/, ' and $1');
  const opts = Object.keys(NAMES).sort((a, b) => NAMES[a].localeCompare(NAMES[b])).map(st => '<option value="' + st + '">' + NAMES[st] + '</option>').join('');
  const month = /as of ([A-Z][a-z]+ \d{4})/.exec(legal)[1];
  let out = fs.readFileSync(path.join(__dirname, 'calling_hours_template.html'), 'utf8');
  const fill = { RULES: rules.replace(/^/gm, '  '), TABLE: rows, OPTIONS: opts, NAMES: JSON.stringify(NAMES), LEGAL: legal, N_STRICT: String(strict.length),
    HOL_STATES: list(strict.filter(s => SH[s].hol)), MAX3_STATES: list(strict.filter(s => SH[s].max3)), UPDATED: month, YEAR: month.slice(-4) };
  out = out.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => { if (!(k in fill)) throw new Error('unknown placeholder ' + k); return fill[k]; });
  return out;
}
module.exports = { build, NAMES };
if (require.main === module) {
  const dir = path.join(ROOT, 'calling-hours'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), build());
  console.log('wrote calling-hours/index.html');
}
