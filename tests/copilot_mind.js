// VPEX regression check (copilot_mind): the Copilot's reasoning engine (cp-mind.js), run in Node on realistic call
// situations: where the deal is, what the objection really is (brush-off, real concern, timing, trust…), the next best
// move with what/why/do/say/aim and evidence, qualification first, stepping back, switching a failing approach,
// memory across calls, follow-up timing, mistakes and compliance on the rep's own words, the lifecycle (Radar),
// team coaching and patterns. Run: node tests/copilot_mind.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctxv = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'cp-mind.js'), 'utf8'), { window: ctxv });
const M = ctxv.VPEXMind;
let pass = 0, fail = 0;
const check = (n, ok, info) => { if (ok) pass++; else { fail++; console.log('FAIL', n, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } };
const NOW = Date.parse('2026-11-09T15:00:00Z');
let t = NOW;
const ev = (kind, idea, text) => ({ kind, idea, text: text || idea, at: (t += 5000) });
const call = (o) => Object.assign({ stage: 'open', events: [], lines: [], leadLines: [], repLines: [], counts: {}, objs: [], discovered: false }, o);
const counts = (events) => { const c = {}; events.filter(e => e.kind === 'obj').forEach(e => { c[e.idea] = (c[e.idea] || 0) + 1; }); return c; };
const mk = (o) => { const events = o.events || []; const lines = o.lines || events.map(e => e.text); return { ind: o.ind || 'investments', now: NOW, lead: Object.assign({ first: 'Pat', qf: {}, qfLabels: { accredited: 'Accredited', check: 'Check size' }, calls: 0 }, o.lead || {}),
  mem: o.mem || {}, call: call(Object.assign({ events, lines, leadLines: o.leadLines || events.map(e => e.text), counts: counts(events), objs: [...new Set(events.filter(e => e.kind === 'obj').map(e => e.idea))] }, o.call || {})),
  objName: { price: 'the price', spouse: 'talking it over at home', advisor: 'your advisor' }, objLabel: { spouse: "I need to talk to my spouse.", price: "It's too expensive." } }; };
const ALL5 = (p) => p && p.title && p.what && p.why && p.do && p.aim && Array.isArray(p.evidence);
const NO_PROMISE = (p) => !M.PROMISE.test(' ' + [p.say, p.do, p.what, p.why, p.aim].join(' ').toLowerCase() + ' ');
let p;

// --- the next best move ---
p = M.plan(mk({}));
check('open: first call → Open, the IPO question, every part filled', p.kind === 'open' && /involved in an IPO before/.test(p.say) && /Pat/.test(p.say) && ALL5(p), p);
p = M.plan(mk({ mem: { calls: 1, lastObj: 'spouse' }, lead: { calls: 1, nextTask: { what: 'Call with both' } } }));
check('memory: returning lead who had to talk to the spouse → pick up there', p.kind === 'resume' && /talk it over/.test(p.say) && p.evidence.some(e => e.src === 'record' && /Last time/.test(e.t)) && p.evidence.some(e => /Booked: Call with both/.test(e.t)), p);
p = M.plan(mk({ events: [ev('obj', 'notint', "not interested")] }));
check('early "not interested" → a brush-off: earn 60 seconds, not a rebuttal war', p.kind === 'engage' && /15 seconds/.test(p.say) && p.evidence.some(e => e.src === 'inferred'), p);
p = M.plan(mk({ events: [ev('obj', 'notint', "not interested"), ev('obj', 'notint', "i said i'm not interested")] }));
check('second "not interested" → check timing-or-never, then step back', p.kind === 'stepback' && /timing, or is this something you'd never/.test(p.say), p);
p = M.plan(mk({ events: [ev('obj', 'notint', 'no thanks')], mem: { o: { notint: [2, NOW - 86400000] } } }));
check('memory: said no twice on earlier calls → step back now', p.kind === 'stepback', p);
p = M.plan(mk({ call: { discovered: true, stage: 'objection' }, events: [ev('obj', 'guarantee', 'is it guaranteed')] }));
check('"is it guaranteed" → risk concern, use the playbook card, then trial close', p.kind === 'handle' && p.cat === 'risk' && p.card && /trial close/.test(p.after) && ALL5(p), p);
p = M.plan(mk({ call: { discovered: true, stage: 'objection' }, events: [ev('obj', 'price', 'too expensive'), ev('obj', 'spouse', 'talk to my wife')] }));
check('two different concerns → isolate the real one first', p.kind === 'isolate' && /Other than talking it over at home, is there anything else/.test(p.say) && p.card, p);
p = M.plan(mk({ call: { discovered: true, stage: 'objection' }, events: [ev('obj', 'price', 'too expensive'), ev('obj', 'price', 'still too much'), ev('obj', 'price', 'way too expensive')] }));
check('same concern 3 times → change the approach (right-size), say why', p.kind === 'switch' && /right-size/.test(p.do) && /comfortable/.test(p.say), p);
p = M.plan(mk({ call: { discovered: true, stage: 'objection' }, events: [ev('obj', 'price', 'too expensive'), ev('obj', 'price', 'still too much')], mem: { t: ['price-a', 'price-b', 'price-inv'] } }));
check('memory: 3 answers already tried with this person and it came back → change the approach', p.kind === 'switch' && p.evidence.some(e => /3 answers already tried/.test(e.t)), p);
p = M.plan(mk({ call: { discovered: true, stage: 'objection' }, events: [ev('obj', 'spouse', 'my wife'), ev('obj', 'spouse', 'wife again'), ev('obj', 'spouse', 'really need my wife')] }));
check('spouse 3 times → stop selling one person: book the call with both', p.kind === 'switch' && /Book the call with both/.test(p.do), p);
p = M.plan(mk({ events: [ev('buy', 'buy', "what's the minimum")] }));
check('buying signal, accredited unknown → confirm first (rule), then ask', p.kind === 'qualify' && /accredited investor/.test(p.say) && p.evidence.some(e => e.src === 'unknown'), p);
p = M.plan(mk({ events: [ev('buy', 'buy', "what's the minimum")], lead: { qf: { accredited: 'Yes', check: '$50K' } } }));
check('buying signal, qualified → ask for the commitment (risks first on investments)', p.kind === 'close' && /cover the risks/.test(p.do) && p.card, p);
p = M.plan(mk({ events: [ev('size', 'size', 'can i start smaller')], lead: { qf: { accredited: 'Yes', check: '$50K' } } }));
check('"can I start smaller" counts as a buying signal', p.kind === 'close', p);
p = M.plan(mk({ lead: { qf: { accredited: 'No' } }, events: [ev('buy', 'buy', 'how do i start')] }));
check('not accredited (on record) → stop, never work around the rule', p.kind === 'disqualify' && /Never help anyone around the rule/.test(p.do) && p.evidence[0].src === 'record', p);
p = M.plan(mk({ ind: 'solar', events: [ev('obj', 'rent', 'i rent')] }));
check('solar renter (heard) → not qualified', p.kind === 'disqualify' && p.evidence[0].src === 'heard', p);
p = M.plan(mk({ ind: 'realestate', lead: { qf: { agent: 'Yes' } } }));
check('real estate lead with an agent → don\'t pitch', p.kind === 'disqualify', p);
p = M.plan(mk({ events: [ev('obj', 'price', 'too expensive'), ev('dnc', 'dnc', 'take me off your list')] }));
check('do-not-call → respect it, whatever else happened', p.kind === 'respect' && /take you off our list/.test(p.say) && p.confidence === 'high', p);
p = M.plan(mk({ call: { discovered: true, stage: 'objection' }, events: [ev('obj', 'price', 'too expensive'), ev('agree', '', 'yeah that makes sense')] }));
check('agreement after an answer → trial close', p.kind === 'trial' && /does the idea make sense/.test(p.say), p);
p = M.plan(mk({ call: { discovered: true, stage: 'trial' }, events: [ev('obj', 'price', 'too expensive'), ev('agree', '', 'yeah'), ev('agree', '', 'i guess so')] }));
check('agreement twice → ask now', p.kind === 'close' && p.closeOnly, p);
p = M.plan(mk({ call: { discovered: true, stage: 'discover' }, lines: ['a', 'b', 'c', 'd'], leadLines: ['x', 'y'] }));
check('discovery with a must-know answer missing → ask it (accredited first)', p.kind === 'ask' && /accredited/.test(p.say), p);
p = M.plan(mk({ call: { discovered: true, stage: 'discover' }, lines: ['a', 'b', 'c', 'd'], leadLines: ['x', 'y'], lead: { qf: { accredited: 'Yes', check: '$100K', timeline: 'Now', source: 'Cash', interest: 'AI' } } }));
check('everything known → present 2-3 reasons, then trial close', p.kind === 'present' && /trial close/.test(p.do), p);
p = M.plan(mk({ ind: 'mca', call: { discovered: true, stage: 'discover' }, lines: ['a', 'b', 'c'], leadLines: ['x', 'y'] }));
check('business funding: asks for monthly deposits first', p.kind === 'ask' && /monthly deposits/.test(p.say), p);
p = M.plan(mk({ ind: 'insurance' }));
check('insurance opener', p.kind === 'open' && /protecting your family/.test(p.say), p);
// nothing in any plan promises anything
const sample = [mk({}), mk({ events: [ev('obj', 'guarantee', 'is it guaranteed')] }), mk({ events: [ev('obj', 'price', 'x'), ev('obj', 'price', 'y'), ev('obj', 'price', 'z')] }), mk({ events: [ev('buy', 'buy', 'min')], lead: { qf: { accredited: 'Yes', check: '1' } } })];
['value', 'means', 'trust', 'authority', 'hesitation', 'risk', 'brushoff', 'statusquo', 'info', 'timing', 'credibility', 'qualification', 'disinterest'].forEach(k => sample.push(mk({ call: { discovered: true }, events: [ev('obj', Object.keys(M.CAT).find(i => M.CAT[i] === k) || 'notint', 'a'), ev('obj', Object.keys(M.CAT).find(i => M.CAT[i] === k) || 'notint', 'b'), ev('obj', Object.keys(M.CAT).find(i => M.CAT[i] === k) || 'notint', 'c')] })));
check('no plan ever promises returns or outcomes', sample.every(s => NO_PROMISE(M.plan(s))), sample.map(s => M.plan(s).say).filter(x => M.PROMISE.test(' ' + x.toLowerCase() + ' ')));
check('every category has what/why/do/aim', Object.keys(M.KIND).every(k => ['label', 'what', 'why', 'do', 'aim'].every(f => M.KIND[k][f])));

// --- how likely it is to move: evidence only ---
let g = M.progress(mk({ events: [ev('buy', 'buy', 'min'), ev('buy', 'buy', 'shares')] }));
check('progress: two buying signals → ready, with heard evidence, and unknowns listed', g.band === 'ready' && g.evidence.some(e => e.src === 'heard') && g.evidence.some(e => e.src === 'unknown') && /Missing 2 must-know/.test(g.sure), g);
g = M.progress(mk({ events: [ev('obj', 'notint', 'no'), ev('obj', 'notint', 'no')] }));
check('progress: two no\'s → cooling', g.band === 'cooling', g);
g = M.progress(mk({ lead: { qf: { accredited: 'No' } } }));
check('progress: not accredited → not qualified (record)', g.band === 'notq' && g.evidence[0].src === 'record', g);
g = M.progress(mk({}));
check('progress: nothing yet → no clear signal (no made-up number)', g.band === 'open' && !/%/.test(JSON.stringify(g)), g);

// --- reading the person ---
let r = M.readPerson(["what are the numbers on this", "how does it work exactly", "i'd want to see the financials and the valuation", "what's the cap table look like"]);
check('read: analytical + experienced, labeled inferred', r.style && r.style.k === 'analytical' && r.style.src === 'inferred' && r.soph && r.soph.k === 'experienced', r);
r = M.readPerson(["what's an ipo", "my wife and the kids come first", "i want to feel comfortable"]);
check('read: newer to this; relationship-first; family motive (heard)', r.soph.k === 'new' && r.style.k === 'amiable' && r.motives.some(m => m.k === 'family' && m.src === 'heard'), r);
r = M.readPerson(['hello']);
check('read: not enough said → no guesses', !r.style && !r.soph && !r.motives.length, r);

// --- mistakes and compliance on the rep's words ---
let a = M.alerts(mk({ call: { repLines: ["trust me this is guaranteed to double"] } }));
check('alert: a promise → stop, with what to say instead', a.some(x => x.k === 'promise' && x.level === 'stop' && /Nobody can promise/.test(x.t)), a);
a = M.alerts(mk({ call: { repLines: ["the company will go public next year"] } }));
check('alert: "will go public" is a promise too', a.some(x => x.k === 'promise'), a);
a = M.alerts(mk({ call: { repLines: ["nobody can promise what it will do"] } }));
check('alert: the honest version is fine', !a.some(x => x.k === 'promise'), a);
const b1 = ev('buy', 'buy', "what's the minimum");
a = M.alerts(mk({ events: [b1], lines: [b1.text, 'so let me tell you about the company', 'it was founded in'] }));
check('alert: buying signal, then the pitch went on → go back and ask', a.some(x => x.k === 'missedbuy'), a);
a = M.alerts(mk({ events: [b1], lines: [b1.text, "it's twenty five thousand", "i'll put you down for the shares"] }));
check('alert: they closed after the signal → no missed-signal alert', !a.some(x => x.k === 'missedbuy'), a);
a = M.alerts(mk({ events: [ev('obj', 'money', 'money is tight')], call: { repLines: ['you could just put it on a credit card'] } }));
check('alert: stretching after "money is tight" → stop (rule 5)', a.some(x => x.k === 'stretch' && x.level === 'stop'), a);
a = M.alerts(mk({ events: [ev('close', '', 'close now')], call: { stage: 'close' } }));
check('alert: closing before discovery → ask a question first', a.some(x => x.k === 'earlyclose'), a);
check('alert: investments close with accredited unknown → confirm it', a.some(x => x.k === 'accredited'), a);
check('alert: investments close with no risk talk → say the risks', a.some(x => x.k === 'risk'), a);
a = M.alerts(mk({ events: [ev('close', '', 'close')], call: { stage: 'close', discovered: true }, lines: ['you could lose the full amount and it is illiquid'], lead: { qf: { accredited: 'Yes' } } }));
check('alert: qualified and risks said → no compliance nags', !a.some(x => x.k === 'risk' || x.k === 'accredited'), a);
a = M.alerts(mk({ call: { brain: true, repLines: ['word '.repeat(35), 'word '.repeat(35), 'word '.repeat(35)] } }));
check('alert: a long monologue (with the brain) → ask a question', a.some(x => x.k === 'monologue'), a);
const d1 = ev('dnc', 'dnc', 'stop calling me');
a = M.alerts(mk({ events: [d1], lines: [d1.text, 'but let me just tell you'] }));
check('alert: kept going after a do-not-call → stop', a.some(x => x.k === 'dnc' && x.level === 'stop'), a);

// --- memory across calls ---
let mem = M.remember({}, { events: [ev('obj', 'price', 'p'), ev('obj', 'spouse', 's'), ev('buy', 'buy', 'b')], shown: ['price-a', 'close-inv-a'], stage: 'trial', facts: [{ t: 'Has most money in index funds', src: 'ai' }] }, 'callback', NOW);
check('remember: concerns, tries, signals, stage, last concern, facts', mem.calls === 1 && mem.o.price[0] === 1 && mem.o.spouse[0] === 1 && mem.t.join() === 'price-a,close-inv-a' && mem.s.buy === 1 && mem.st === 'trial' && mem.lastObj === 'spouse' && mem.f.length === 1 && mem.out === 'callback', mem);
mem = M.remember(mem, { events: [ev('obj', 'price', 'p2')], shown: ['price-a', 'price-b'], stage: 'objection' }, 'notinterested', NOW + 86400000);
check('remember: second call adds up, keeps the furthest stage, no duplicate tries', mem.calls === 2 && mem.o.price[0] === 2 && mem.t.join() === 'price-a,close-inv-a,price-b' && mem.st === 'trial', mem);
mem = M.remember({ o: { price: [3, NOW - 200 * 86400000] } }, { events: [] }, '', NOW);
check('remember: concerns older than six months are dropped', !mem.o.price, mem);
check('remember: never mutates the old memory', (() => { const m0 = { o: { price: [1, NOW] } }; M.remember(m0, { events: [ev('obj', 'price', 'x')] }, '', NOW); return m0.o.price[0] === 1; })());

// --- follow-up timing ---
let f = M.followup(mk({ mem: { lastObj: 'spouse' } }), 'callback');
check('follow-up: spouse → next evening, both on the call', f.days === 1 && f.hour === 19 && f.evening && /both/.test(f.what), f);
f = M.followup(mk({ mem: { lastObj: 'think' } }), 'callback');
check('follow-up: thinking it over → within a day', f.days === 1 && /fresh/.test(f.why), f);
f = M.followup(mk({ mem: { lastObj: 'money' } }), 'callback');
check('follow-up: money tight → about a month, no pushing', f.days === 30, f);
f = M.followup(mk({ mem: { s: { buy: 2 }, lastObj: 'price' } }), 'interested');
check('follow-up: buying signals → today or tomorrow, finish the paperwork', f.soon && /paperwork/.test(f.what), f);
f = M.followup(mk({ mem: { o: { notint: [2, NOW] } } }), 'notinterested');
check('follow-up: said no twice → none', f === null, f);
f = M.followup(mk({ mem: {} }), 'notinterested');
check('follow-up: one no → a respectful check-in in 90 days', f.days === 90, f);

// --- the lifecycle (Radar, profile) ---
const T = [['email', 'Email sent'], ['docs', 'Docs sent'], ['returned', 'Docs returned'], ['funded', 'Account funded']];
let lc = M.lifecycle(mk({ lead: { stage: 'Committed', calls: 4, reached: true, track: T, prog: { email: 1, docs: 1 }, nextTask: { what: 'Docs', over: false }, lastCallAt: NOW - 86400000, qf: { accredited: 'Yes', check: '$50K' } } }));
check('lifecycle: committed, docs sent → next: docs returned', lc.phase === 'document' && /Docs returned/.test(lc.nba.title) && lc.bucket === 'moving', lc);
lc = M.lifecycle(mk({ lead: { stage: 'Committed', calls: 4, reached: true, track: T, prog: { email: 1, docs: 1, returned: 1, funded: 1 }, nextTask: { what: 'x' }, qf: { accredited: 'Yes', check: '1' } } }));
check('lifecycle: funded → service and referral', lc.phase === 'done' && /referral/.test(lc.nba.why), lc);
lc = M.lifecycle(mk({ lead: { calls: 0 } }));
check('lifecycle: never called → early', lc.phase === 'new' && lc.bucket === 'early', lc);
lc = M.lifecycle(mk({ lead: { calls: 3, reached: false } }));
check('lifecycle: tried, never reached → reach them', lc.phase === 'reach', lc);
lc = M.lifecycle(mk({ lead: { calls: 2, reached: true, outcome: 'interested', interestedBefore: true, qf: {} } }));
check('lifecycle: interested but not qualified → qualify first, blocker listed', lc.phase === 'qualify' && lc.blockers.some(b => b.src === 'unknown') && /accredited/.test(lc.nba.say), lc);
lc = M.lifecycle(mk({ lead: { calls: 2, reached: true, outcome: 'interested', interestedBefore: true, qf: { accredited: 'Yes', check: '$50K' }, nextTask: { what: 'Call', over: true, lateDays: 3 }, lastCallAt: NOW - 10 * 86400000 } }));
check('lifecycle: interested, overdue 3 days, 10 days quiet → stalling, urgent', lc.bucket === 'stalling' && lc.nba.urgent && lc.evidence.some(e => /3 days late/.test(e.t)) && lc.evidence.some(e => /No contact in 10 days/.test(e.t)), lc);
lc = M.lifecycle(mk({ lead: { calls: 3, reached: true, outcome: 'notinterested', interestedBefore: true, qf: { accredited: 'Yes', check: '1' }, nextTask: { what: 'x' } } }));
check('lifecycle: no after interest → at risk', lc.bucket === 'atrisk', lc);
lc = M.lifecycle(mk({ lead: { calls: 2, reached: true, outcome: 'callback', qf: { accredited: 'Yes', check: '1' } }, mem: { o: { spouse: [2, NOW] } } }));
check('lifecycle: open concern, no next step → resolve it, stalling', lc.phase === 'resolve' && lc.bucket === 'stalling' && lc.blockers.some(b => /No next step/.test(b.t)) && lc.blockers.some(b => /×2/.test(b.t)), lc);
lc = M.lifecycle(mk({ lead: { calls: 1, reached: true, qf: { accredited: 'No' } } }));
check('lifecycle: not accredited → not qualified', lc.bucket === 'notq' && lc.priority < 0, lc);
lc = M.lifecycle(mk({ lead: { dnc: true, calls: 1 } }));
check('lifecycle: do not call → leave it', lc.bucket === 'closed', lc);
const hi = M.lifecycle(mk({ lead: { stage: 'Committed', calls: 4, reached: true, track: T, prog: { email: 1 }, checkValue: 250000, nextTask: { what: 'x', over: true, lateDays: 1 }, qf: { accredited: 'Yes', check: '$250K' } } }));
const lo = M.lifecycle(mk({ lead: { calls: 1, reached: true, qf: { accredited: 'Yes', check: '$10K' }, nextTask: { what: 'x' } } }));
check('lifecycle: a big committed deal with an overdue step outranks an early conversation', hi.priority > lo.priority, [hi.priority, lo.priority]);

// --- the team ---
const tips = M.coach([{ uid: 'a', name: 'Ana', calls: 200, talked: 60, interested: 12, warm: 10, warmNoNext: 1, followOver: 0 }, { uid: 'b', name: 'Ben', calls: 220, talked: 66, interested: 3, warm: 6, warmNoNext: 0, followOver: 1 },
  { uid: 'c', name: 'Cy', calls: 180, talked: 54, interested: 10, warm: 9, warmNoNext: 5, followOver: 0 }, { uid: 'd', name: 'Di', calls: 150, talked: 20, interested: 4, warm: 3, warmNoNext: 0, followOver: 0 },
  { uid: 'e', name: 'Ed', calls: 160, talked: 50, interested: 9, warm: 5, warmNoNext: 0, followOver: 4 }, { uid: 'f', name: 'Fay', calls: 8, talked: 2, interested: 1, warm: 1, warmNoNext: 0, followOver: 0 }]);
const tip = n => tips.find(x => x.name === n).tip.k;
check('coach: low conversion → discovery and trial close', tip('Ben') === 'convert', tips);
check('coach: warm leads without a next step', tip('Cy') === 'nextstep', tips);
check('coach: low reach → other hours', tip('Di') === 'reach', tips);
check('coach: overdue follow-ups first', tip('Ed') === 'followup', tips);
check('coach: too few calls to judge', tip('Fay') === 'volume', tips);
check('coach: on track', tip('Ana') === 'ok', tips);
const pat = M.patterns([{ cats: ['value', 'trust'], out: 'interested' }, { cats: ['trust'], out: 'notinterested' }, { cats: ['trust'], out: 'callback' }]);
check('patterns: by kind of concern, most common first, with the win count', pat[0].cat === 'trust' && pat[0].n === 3 && pat[0].w === 1 && pat[1].cat === 'value' && pat[1].rate === 1, pat);

console.log(`copilot_mind: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
