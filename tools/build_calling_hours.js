// Builds 404.html (any missing address: short links go to the right page) and vpexdialer.com/calling-hours/ (calling-hours/index.html, plus one page per state: calling-hours/<state>/index.html, and sitemap.xml) from tools/calling_hours_template.html and the calling-hours
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
// Hand-written explainer pages (not built here), linked from their state's facts box and listed in the sitemap.
const EXPLAIN = { PA: ['/calling-hours/pennsylvania/2026-law-changes/', 'What changed in Pennsylvania on Oct 18, 2026 →'] };
const slug = st => NAMES[st].toLowerCase().replace(/[^a-z]+/g, '-');
const ZONE_WORD = { 'America/New_York': 'Eastern', 'America/Chicago': 'Central', 'America/Denver': 'Mountain', 'America/Phoenix': 'Mountain (Arizona doesn’t change clocks)',
  'America/Los_Angeles': 'Pacific', 'America/Anchorage': 'Alaska', 'Pacific/Honolulu': 'Hawaii (no daylight saving)' };
// Parts of a state on another clock than its main time zone (the checker uses the main one)
const SPLIT = { FL: 'the western panhandle is on Central time', TX: 'far West Texas (El Paso) is on Mountain time', TN: 'East Tennessee is on Eastern time',
  KY: 'western Kentucky is on Central time', IN: 'a few northwest and southwest counties are on Central time', MI: 'four Upper Peninsula counties are on Central time',
  ID: 'the northern panhandle is on Pacific time', OR: 'most of Malheur County is on Mountain time', ND: 'the southwest is on Mountain time',
  SD: 'the western half is on Mountain time', NE: 'the western panhandle is on Mountain time', KS: 'a few western counties are on Mountain time',
  AK: 'the western Aleutian Islands are on Hawaii-Aleutian time' };
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function build(only) {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const rules = rulesFrom(src), legal = legalFrom(src);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(rules + '\nthis.SH = STATE_HOURS; this.HL = hourLabel; this.ZO = ZONE_OF;', ctx);
  const SH = ctx.SH, HL = ctx.HL, ZO = ctx.ZO, win = w => HL(w[0]) + '–' + HL(w[1]);
  const fmtDate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const strict = Object.keys(SH).sort((a, b) => NAMES[a].localeCompare(NAMES[b]));
  const rows = strict.map(st => {
    const r = SH[st];
    const hours = win(r.h) + (r.from ? ' (from ' + fmtDate(r.from) + ')' : '');
    return '<tr><td>' + NAMES[st] + '</td><td>' + hours + '</td><td>' + (r.sat ? win(r.sat) : 'Same') + '</td><td>' + (r.sun === false ? 'No calls' : r.sunH ? win(r.sunH) : 'Same') +
      '</td><td>' + (r.hol ? 'No calls' : 'Allowed') + '</td><td>' + (r.max3 ? '3 per 24 hours' : 'No state limit') + '</td></tr>';
  }).join('\n      ');
  const list = a => a.map(s => NAMES[s]).join(', ').replace(/, ([^,]+)$/, ' and $1');
  const all = Object.keys(NAMES).sort((a, b) => NAMES[a].localeCompare(NAMES[b]));
  const opts = all.map(st => '<option value="' + st + '">' + NAMES[st] + '</option>').join('');
  const month = /as of ([A-Z][a-z]+ \d{4})/.exec(legal)[1], year = month.slice(-4);
  // One plain sentence (or a few) with the state's rule, used in the lede, the description and the facts box
  function summary(st) {
    const r = SH[st], n = NAMES[st];
    if (!r) return 'Sales calls to a lead in ' + n + ' follow the federal rule: 8 AM to 9 PM in the lead’s local time, every day. ' + n + ' has no stricter calling hours in VPEX’s rules.';
    const extra = [];
    if (r.sat) extra.push(win(r.sat) + ' on Saturdays');
    if (r.sunH) extra.push(win(r.sunH) + ' on Sundays');
    let s = 'Sales calls to a lead in ' + n + ' are allowed ' + win(r.h) + ' in the lead’s local time' + (extra.length ? ' (' + extra.join(', ') + ')' : '') + '.';
    const bans = []; if (r.sun === false) bans.push('Sundays'); if (r.hol) bans.push('federal legal holidays');
    if (bans.length) s += ' No sales calls on ' + bans.join(' or ') + '.';
    if (r.max3) s += ' No more than 3 sales calls to the same person in 24 hours.';
    if (r.from) s += ' These hours apply from ' + fmtDate(r.from) + (r.before ? ' (' + win(r.before.h) + ' before that)' : '') + '.';
    return s;
  }
  function facts(st) {
    const r = SH[st] || { h: [8, 21] }, n = NAMES[st], z = ZO[st];
    const row = (k, v) => '<dt>' + k + '</dt><dd>' + v + '</dd>';
    const wk = win(r.h) + (r.from ? ' (from ' + fmtDate(r.from) + ')' : '');
    return '\n  <section class="card facts" aria-labelledby="facts-h">\n    <h2 id="facts-h">' + n + ' calling hours for sales calls</h2>\n    <dl>' +
      row('Monday to Friday', wk) + row('Saturday', r.sat ? win(r.sat) : wk) +
      row('Sunday', r.sun === false ? 'No sales calls' : r.sunH ? win(r.sunH) : wk) +
      row('Federal holidays', r.hol ? 'No sales calls (including the weekday a holiday is observed on)' : 'Normal hours') +
      row('Calls per person', r.max3 ? 'No more than 3 in 24 hours' : 'No state limit in VPEX’s rules') +
      row('Time zone', (ZONE_WORD[z.iana] || z.iana) + (SPLIT[st] ? '. Note: ' + SPLIT[st] + '.' : '')) +
      '</dl>\n    <p class="fine">' + summary(st) + ' Rules that only cover autodialers or prerecorded messages aren’t included. ' + legal + '</p>\n' +
      (EXPLAIN[st] ? '    <a class="more" href="' + EXPLAIN[st][0] + '">' + EXPLAIN[st][1] + '</a>\n' : '') +
      (r.hol ? '    <a class="hol" href="/calling-hours/holidays/">Holiday dates with no sales calls in ' + n + ' →</a>\n' : '') + '  </section>\n';
  }
  function page(st) {
    const n = st && NAMES[st];
    const links = all.map(s => '<a href="/calling-hours/' + slug(s) + '/"' + (s === st ? ' aria-current="page"' : '') + '>' + NAMES[s] + (SH[s] ? '<b aria-label="stricter">•</b>' : '') + '</a>').join('');
    const fill = st ? {
      TITLE: n + ' telemarketing calling hours (' + year + '): can I call this lead now? | VPEX',
      DESC: esc(summary(st) + ' Free live checker with their local time and when calls open again. Updated ' + month + '.'),
      PATH: '/calling-hours/' + slug(st) + '/', OG_TITLE: esc('Can I call a lead in ' + n + ' right now?'),
      OG_DESC: esc(n + ' calling hours for sales calls: their local time, today’s window and when calls open again. Free, from VPEX.'),
      H1: 'Can I call a lead in ' + n + ' <em>right now?</em>', LEDE: summary(st), CRUMB: '<a class="crumb" href="/calling-hours/">← All states</a>\n  ',
      STATE_BLOCK: facts(st), PRE: st, UTM_C: '&amp;utm_campaign=' + st.toLowerCase()
    } : {
      TITLE: 'Telemarketing calling hours by state (' + year + '): can I call this lead now? | VPEX',
      DESC: 'Free checker: pick a state and see if a sales call is allowed right now, in the lead\'s local time. 8 AM to 9 PM federal rule, plus the ' + strict.length + ' states with stricter hours, Sunday and holiday bans and 3-call limits. Updated ' + month + '.',
      PATH: '/calling-hours/', OG_TITLE: 'Can I call this lead right now? Calling hours by state',
      OG_DESC: 'Pick a state: their local time, today\'s calling window and when calls open again. Free, from VPEX.',
      H1: 'Can I call this lead <em>right now?</em>',
      LEDE: 'Pick the lead\'s state. You\'ll see their local time, today\'s calling window, and when calls open again if it\'s closed. Federal rule: 8 AM to 9 PM their time. ' + strict.length + ' states are stricter.',
      CRUMB: '', STATE_BLOCK: '', PRE: '', UTM_C: ''
    };
    Object.assign(fill, { RULES: rules.replace(/^/gm, '  '), TABLE: rows, OPTIONS: opts, NAMES: JSON.stringify(NAMES), LEGAL: legal, N_STRICT: String(strict.length),
      HOL_STATES: list(strict.filter(s => SH[s].hol)), MAX3_STATES: list(strict.filter(s => SH[s].max3)), UPDATED: month, YEAR: year, STATE_LINKS: links });
    const tpl = fs.readFileSync(path.join(__dirname, 'calling_hours_template.html'), 'utf8');
    return tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => { if (!(k in fill)) throw new Error('unknown placeholder ' + k); return fill[k]; });
  }
  return page(only || '');
}
// vpexdialer.com/calling-hours/holidays/: the federal holidays (with observed days) from the compliance month to the end of next year, from the app's own
// holidayNames(), and the states that ban sales calls on them (STATE_HOURS hol). Rebuilt with the rest whenever the rules or the compliance month change.
const HOL_PATH = '/calling-hours/holidays/';
function holidays() {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const rules = rulesFrom(src), legal = legalFrom(src);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(rules + '\n' + grab(src, /function holidayNames\(/) + '\nthis.SH = STATE_HOURS; this.HN = holidayNames; this.UH = usHolidays;', ctx);
  const SH = ctx.SH, list = a => a.map(s => NAMES[s]).join(', ').replace(/, ([^,]+)$/, ' and $1');
  const hol = Object.keys(SH).filter(s => SH[s].hol).sort((a, b) => NAMES[a].localeCompare(NAMES[b]));
  const month = /as of ([A-Z][a-z]+ \d{4})/.exec(legal)[1], y0 = Number(month.slice(-4));
  const m0 = ('0' + (new Date(month + ' 1 UTC').getUTCMonth() + 1)).slice(-2), start = y0 + '-' + m0 + '-01';
  const fmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const days = [];
  [y0, y0 + 1].forEach(y => { const n = ctx.HN(y), u = ctx.UH(y); Object.keys(n).sort().forEach(d => { if (d >= start && u[d]) days.push([d, n[d]]); }); });
  const tg = days.find(x => /^Thanksgiving$/.test(x[1]));
  const after = tg ? new Date(Date.parse(tg[0] + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10) : '';
  const U = 'utm_source=calling-hours&amp;utm_medium=tool&amp;utm_campaign=holidays';
  const fill = {
    TITLE: 'Can telemarketers call on holidays? Holiday calling bans by state (' + y0 + '–' + (y0 + 1) + ') | VPEX',
    DESC: esc('No sales calls on federal holidays in ' + list(hol) + ', including the weekday a holiday is observed on. Every holiday date from ' + month + ' through ' + (y0 + 1) + ', plus the days to check yourself. Free, from VPEX.'),
    OG_TITLE: 'Can I make sales calls on a holiday?', OG_DESC: esc('Holiday calling bans in ' + list(hol) + ', with every date through ' + (y0 + 1) + '. Free, from VPEX.'),
    LEDE: esc('Federal law doesn’t ban sales calls on holidays: the 8 AM to 9 PM rule applies. But ' + hol.length + ' states ban sales calls on federal legal holidays: ' + list(hol) + '. That includes the weekday a holiday is observed on.'),
    RANGE: month.replace(/ \d{4}$/, '') + ' ' + y0 + ' to December ' + (y0 + 1), HOL_STATES: list(hol), HOL_STATES_SHORT: hol.join(', ').replace(/, ([^,]+)$/, ' and $1'),
    ROWS: days.map(x => '<tr data-d="' + x[0] + '"><td>' + fmt(x[0]) + '</td><td>' + esc(x[1]) + '</td></tr>').join('\n      '),
    DAY_AFTER: after ? fmt(after) : 'the Friday after', LEGAL: legal, CHECKED: 'November 14, 2026', U
  };
  const tpl = fs.readFileSync(path.join(__dirname, 'holidays_template.html'), 'utf8');
  return tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => { if (!(k in fill)) throw new Error('unknown placeholder ' + k); return fill[k]; });
}
// Every page: { 'calling-hours/index.html': html, 'calling-hours/pennsylvania/index.html': html, … }
function buildAll() {
  const out = { 'calling-hours/index.html': build() };
  Object.keys(NAMES).forEach(st => { out['calling-hours/' + slug(st) + '/index.html'] = build(st); });
  out['calling-hours/holidays/index.html'] = holidays();
  return out;
}
function siteUrls() {
  return ['/', '/phoneburner-alternative/', '/batchdialer-alternative/', '/mojo-dialer-alternative/', '/power-dialer-for-insurance-agents/', '/power-dialer-for-real-estate-agents/', '/power-dialer-for-business-funding/', '/power-dialer-for-auto-sales/', '/power-dialer-for-solar-sales/', '/calling-hours/', HOL_PATH].concat(Object.keys(EXPLAIN).map(st => EXPLAIN[st][0]), Object.keys(NAMES).sort((a, b) => NAMES[a].localeCompare(NAMES[b])).map(st => '/calling-hours/' + slug(st) + '/'));
}
function sitemap() {
  const urls = siteUrls();
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(u => '  <url><loc>https://vpexdialer.com' + u + '</loc></url>\n').join('') + '</urlset>\n';
}
// 404.html: GitHub Pages serves it for any address that doesn't exist. Short or mistyped addresses (/calling-hours/pa, /Texas-calling-hours,
// /trial, /solar, /demo/auto, /IG) go straight to the right page; anything else gets demos, the trial, the checker and the industry pages.
function notFound() {
  const states = {};
  Object.keys(NAMES).forEach(st => { states[st.toLowerCase()] = slug(st); states[NAMES[st].toLowerCase().replace(/[^a-z]/g, '')] = slug(st); });
  const pages = siteUrls().filter(u => u !== '/').concat(['/ig/']);
  const tpl = fs.readFileSync(path.join(__dirname, 'not_found_template.html'), 'utf8');
  return tpl.replace(/\{\{([A-Z]+)\}\}/g, (m, k) => { if (k === 'STATES') return JSON.stringify(states); if (k === 'PAGES') return JSON.stringify(pages); throw new Error('unknown placeholder ' + k); });
}
module.exports = { build, buildAll, holidays, sitemap, siteUrls, notFound, slug, NAMES };
if (require.main === module) {
  const pages = buildAll();
  for (const [rel, html] of Object.entries(pages)) { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); fs.writeFileSync(path.join(ROOT, rel), html); }
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap());
  fs.writeFileSync(path.join(ROOT, '404.html'), notFound());
  console.log('wrote ' + Object.keys(pages).length + ' calling-hours pages, sitemap.xml and 404.html');
}
