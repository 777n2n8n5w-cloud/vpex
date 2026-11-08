/* VPEX Copilot Mind: the reasoning layer of Copilot Elite (owner only for now; index.html loads it with cp-elite.js).
   Hearing (keywords, and the on-device AI when it's on) turns the call into events: what the lead raised, buying
   signals, agreement, the rep's own lines. This file turns those events, plus what VPEX already knows about the lead
   (stage, qualifying answers, call history, follow-ups, memory from earlier calls), into one judgment:
     where the deal is in its whole lifecycle, what is really going on with this person and why, what's missing,
     how likely it is to move forward (evidence, never a made-up percentage), and the single best next move:
     what's happening · why · what to do · what to say · what it's meant to achieve.
   The goal is a properly completed, funded deal for a qualified person, which is not the same as "always close":
   sometimes the best move is a question, the facts, trust, a booked time with the decision-maker, or stepping back.
   Rules that never bend: no invented facts, returns, valuations or approvals ([brackets] are for the rep's own true
   facts); everything shown says whether it was heard on this call, is on record, or is an inference; a clear no or a
   do-not-call request ends the push; never push anyone past what they can afford to lose; qualification first.
   Pure functions on plain data: no DOM, no network, nothing stored here (tests/copilot_mind.js runs it in Node). */
(function (root) {
  "use strict";

  // ---------- 1. What kind of resistance it is ----------
  var CAT = { price: "value", payment: "value", money: "means", liquid: "means", think: "hesitation", watch: "hesitation", send: "brushoff", stall: "brushoff",
    later: "timing", busy: "timing", wait: "timing", trust: "trust", number: "trust", bad: "trust", phone: "trust", who: "credibility", what: "credibility",
    spouse: "authority", advisor: "authority", decide: "authority", already: "statusquo", diy: "statusquo", elsewhere: "statusquo", realestate: "statusquo",
    self: "statusquo", browse: "statusquo", info: "info", roof: "info", guarantee: "risk", conservative: "risk", market: "risk", notwork: "risk",
    accredited: "qualification", rent: "qualification", credit: "qualification", old: "qualification", notint: "brushoff", size: "signal", buy: "signal" };
  var KIND = {
    brushoff: { label: "Brush-off", what: "A reflex brush-off before they know why you called.", why: "Most people say this to any call they didn't expect. It isn't a decision yet.",
      do: "Acknowledge it, give your 15-second reason, and ask one easy question.", aim: "Earn 60 seconds of real attention." },
    disinterest: { label: "Not interested", what: "They've said no more than once.", why: "It may truly not fit, or they don't see why yet. Pushing harder now costs trust.",
      do: "Ask once whether it's the timing or never. If never, thank them and step back.", aim: "Keep the door open, or end it cleanly." },
    timing: { label: "Timing", what: "Interest may be there; the timing isn't.", why: "They're busy right now, or waiting on something specific.",
      do: "Pin down the real time and book it now.", aim: "A booked callback, not a vague later." },
    authority: { label: "Decision-maker", what: "Someone else shares this decision.", why: "They don't want to decide alone. Going around the partner or advisor backfires.",
      do: "Find out where they stand themselves, then set a call with both of them.", aim: "The decision-maker on the next call." },
    value: { label: "Value", what: "They don't see it as worth the price yet.", why: "Usually the value isn't clear yet, not that the money isn't there.",
      do: "Separate price from value and find what it would need to be worth to them.", aim: "Agreement that it's worth it at some size." },
    means: { label: "Money", what: "The money may not be free right now.", why: "It can be real (tied up, a tight month) or a softer no.",
      do: "Respect it. Right-size it or find when funds free up. Never push past what they can afford to lose.", aim: "A size they're comfortable holding, or a dated follow-up." },
    risk: { label: "Risk", what: "They're worried about losing money.", why: "That's prudent, and with this kind of opportunity the risk is real.",
      do: "Be straight about the risk, right-size it, and tie it back to their reasons.", aim: "An informed decision at a size they can hold." },
    trust: { label: "Trust", what: "They don't trust you or the firm yet.", why: "An unknown caller asking about money. They may have been burned before.",
      do: "Slow down and invite checking: documents, registration, your direct line. Don't push the close yet.", aim: "Enough trust for a next step." },
    credibility: { label: "Credibility", what: "They're sizing you up.", why: "People decide whether the person is worth listening to before they hear the idea.",
      do: "Give a short, true introduction of you and the firm, then hand it back with a question.", aim: "Earn the right to keep talking." },
    info: { label: "Information", what: "They need facts before they can decide.", why: "Something about how it works, the company or the terms isn't clear yet.",
      do: "Answer exactly what they asked, offer the documents, and book a review.", aim: "Real understanding, then a review call." },
    hesitation: { label: "On the fence", what: "They're on the fence.", why: "Usually one concern hasn't been answered yet.",
      do: "Isolate the real concern, then answer that one thing.", aim: "Name the one thing in the way." },
    statusquo: { label: "Happy as is", what: "They're comfortable with what they have.", why: "Adding something new feels like effort and risk.",
      do: "Don't knock what they have. Find the gap and position this as an addition.", aim: "Agreement there's a gap worth a look." },
    qualification: { label: "Qualifying", what: "They may not qualify.", why: "Some offers have rules about who can take part.",
      do: "Confirm the facts. If they don't qualify, stop: never work around the rule.", aim: "A clean yes or no on qualifying." },
    signal: { label: "Buying signal", what: "They're picturing owning it.", why: "Questions about the minimum, the shares or how to start mean they're ready to hear the ask.",
      do: "Answer in one line, then ask for the commitment.", aim: "A commitment, and the paperwork started." }
  };

  // ---------- 2. What a floor needs to know before a commitment ----------
  // must: needed before the ask; stop: an answer that means not qualified (never work around it).
  var QUAL = {
    investments: [
      { k: "accredited", must: true, stop: /^no$/i, q: "Quick one before we go further: do you qualify as an accredited investor? Happy to explain what that means." },
      { k: "check", must: true, q: "If this made sense, what size position would you be comfortable holding, even if it takes years to play out?" },
      { k: "timeline", q: "Is this something you'd look at now, or later this year?" },
      { k: "source", q: "Would this come from cash or from a retirement account?" },
      { k: "interest", q: "What areas interest you most right now: AI, fintech, something else?" }],
    insurance: [{ k: "product", must: true, q: "What are you mainly looking to protect: final expenses, income for the family, or something else?" },
      { k: "age", must: true, q: "And may I ask your age? It decides which plans you qualify for." }, { k: "budget", q: "What would feel comfortable each month?" },
      { k: "coverage", q: "Roughly how much coverage did you have in mind?" }, { k: "carrier", q: "Do you have anything in place right now?" }],
    realestate: [{ k: "side", must: true, q: "Are you thinking about selling, buying, or both?" }, { k: "agent", must: true, stop: /^yes$/i, q: "Are you working with an agent right now?" },
      { k: "timeframe", q: "What's your timeframe looking like?" }, { k: "price", q: "What price range are you thinking?" }, { k: "why", q: "What's got you thinking about a move?" }],
    mca: [{ k: "revenue", must: true, q: "Roughly what are your monthly deposits running?" }, { k: "tib", must: true, q: "How long have you been in business?" },
      { k: "need", q: "How much would make a real difference right now?" }, { k: "positions", q: "Do you have any advances open right now?" }, { k: "credit", q: "Ballpark, where's your credit at?" }],
    auto: [{ k: "vehicle", must: true, q: "What are you looking to get into?" }, { k: "timeframe", q: "When are you hoping to be in it?" },
      { k: "payment", q: "What payment would feel comfortable?" }, { k: "trade", q: "Do you have a trade-in?" }, { k: "credit", q: "How's your credit these days, roughly?" }],
    solar: [{ k: "owner", must: true, stop: /^no$/i, q: "Do you own the home?" }, { k: "bill", must: true, q: "About what's your electric bill a month?" },
      { k: "owners", must: true, q: "Can everyone on the title be at the consultation?" }, { k: "roof", q: "How old is the roof, roughly?" }, { k: "credit", q: "Is your credit around 650 or better?" }]
  };
  function missingInfo(ind, qf) {
    qf = qf || {};
    return (QUAL[ind] || []).filter(function (x) { var v = qf[x.k]; return v === undefined || v === null || String(v).trim() === "" || /^not sure$/i.test(String(v)); });
  }
  function notQualified(ind, qf, events) {
    qf = qf || {};
    var bad = (QUAL[ind] || []).filter(function (x) { return x.stop && x.stop.test(String(qf[x.k] || "")); })[0];
    if (bad) return { k: bad.k, src: "record", t: bad.k === "accredited" ? "Accredited: No (on record)" : bad.k === "owner" ? "Owns the home: No (on record)" : bad.k === "agent" ? "Has an agent: Yes (on record)" : bad.k + ": " + qf[bad.k] };
    var rent = (events || []).filter(function (e) { return e.idea === "rent"; })[0];
    if (ind === "solar" && rent) return { k: "owner", src: "heard", t: "Said they rent (heard)" };
    return null;
  }

  // ---------- 3. Reading the person (inferences, always labeled as such) ----------
  var STYLE = {
    analytical: { re: /\b(numbers?|financials?|valuation|terms|how (does|do) (it|this|that) work|percent|data|revenue|cap table|exactly|specifically|details|breakdown|math)\b/g,
      label: "Analytical", tip: "Lead with facts and documents. Skip the hype." },
    driver: { re: /\b(make it quick|bottom line|get to the point|just tell me|quickly|cut to|what'?s the deal|i'?m busy|slammed|in a hurry)\b/g,
      label: "Direct", tip: "Be brief. Give the bottom line first, then one question." },
    amiable: { re: /\b(wife|husband|family|kids|grandkids|trust|comfortable|feel|relationship|my son|my daughter|together)\b/g,
      label: "Relationship-first", tip: "Slow down, build rapport, and include the family." },
    expressive: { re: /\b(love|amazing|exciting|awesome|wow|cool|incredible|crazy|fun)\b/g,
      label: "Expressive", tip: "Match their energy, paint the picture, then pin down details." }
  };
  var SOPH = /\b(valuation|cap table|ppm|accredited|secondary|lock ?up|lockup|pre ?ipo|series [a-f]|term sheet|dilution|preferred|liquidation|allocation|spv|carried interest|k ?1)\b/g;
  var NOVICE = /\b(what'?s an ipo|what is an ipo|what does accredited mean|what'?s accredited|never invested|i don'?t know much about|how does (this|investing) work|new to this)\b/;
  var MOTIVE = [["retirement", /\b(retire|retirement|retiring)\b/, "Retirement"], ["family", /\b(kids|grandkids|family|college|my son|my daughter|legacy)\b/, "Family"],
    ["growth", /\b(growth|upside|grow|ai|tech|next big)\b/, "Growth"], ["diversify", /\b(diversif\w*|spread (it|my money))\b/, "Diversification"], ["income", /\b(income|dividends?|cash flow)\b/, "Income"]];
  function count(re, txt) { re.lastIndex = 0; var m = String(txt).match(re); return m ? m.length : 0; }
  function readPerson(leadLines) {
    var txt = " " + (leadLines || []).join(" ").toLowerCase() + " ", out = { style: null, soph: null, motives: [] };
    var best = null;
    Object.keys(STYLE).forEach(function (k) { var n = count(STYLE[k].re, txt); if (n >= 2 && (!best || n > best.n)) best = { k: k, n: n }; });
    if (best) out.style = { k: best.k, label: STYLE[best.k].label, tip: STYLE[best.k].tip, src: "inferred", why: best.n + " cues in what they said" };
    var s = count(SOPH, txt);
    if (NOVICE.test(txt)) out.soph = { k: "new", label: "Newer to this", tip: "Explain plainly, one idea at a time.", src: "inferred" };
    else if (s >= 2) out.soph = { k: "experienced", label: "Experienced investor", tip: "Skip the basics. Talk terms, structure and risk directly.", src: "inferred" };
    MOTIVE.forEach(function (m) { if (m[1].test(txt)) out.motives.push({ k: m[0], label: m[2], src: "heard" }); });
    return out;
  }

  // ---------- 4. Diagnosis: what this objection really is, here ----------
  function diagnose(ev, call, mem) {
    var idea = ev.idea, cat = CAT[idea] || "info", counts = call.counts || {}, early = !call.discovered && call.stage !== "trial" && call.stage !== "close";
    var memN = mem && mem.o && mem.o[idea] ? mem.o[idea][0] : 0, ev2 = [];
    if (idea === "notint") {
      if ((counts.notint || 0) >= 2 || memN >= 2) { cat = "disinterest"; ev2.push({ t: "Said not interested " + ((counts.notint || 0) + memN) + " times (heard)", src: "heard" }); }
      else if (!early) cat = "disinterest";
      else ev2.push({ t: "Came before they knew why you called (inferred)", src: "inferred" });
    }
    if ((idea === "send" || idea === "stall") && !early) cat = "hesitation";
    if ((idea === "send" || idea === "stall") && early) ev2.push({ t: "Came before any real conversation (inferred)", src: "inferred" });
    var times = (counts[idea] || 0) + memN;
    var genuine = times >= 2 || call.stage === "trial" || call.stage === "close" ? true : early && (cat === "brushoff") ? false : null;
    if (times >= 2) ev2.push({ t: "Raised " + times + " times" + (memN ? " (incl. earlier calls)" : "") + ": likely the real concern", src: memN ? "record" : "heard" });
    return { cat: cat, genuine: genuine, kind: KIND[cat], evidence: ev2, times: times };
  }

  // ---------- 5. How likely it is to move forward: evidence only ----------
  function progress(ctx) {
    var c = ctx.call || {}, m = ctx.mem || {}, L = ctx.lead || {}, sc = 0, ev = [], ind = ctx.ind;
    var n = function (k) { return (c.events || []).filter(function (e) { return e.kind === k; }).length; };
    var buy = n("buy"), size = n("size"), agree = n("agree"), objs = (c.events || []).filter(function (e) { return e.kind === "obj"; });
    if (buy) { sc += Math.min(6, buy * 3); ev.push({ t: buy + " buying signal" + (buy > 1 ? "s" : "") + " this call", src: "heard", s: +1 }); }
    if (size) { sc += 2; ev.push({ t: "Talked about the amount", src: "heard", s: +1 }); }
    if (agree) { sc += Math.min(3, agree); ev.push({ t: "Went along " + agree + " time" + (agree > 1 ? "s" : ""), src: "heard", s: +1 }); }
    var no = objs.filter(function (e) { return e.idea === "notint"; }).length;
    if (no) { sc -= 2 * no; ev.push({ t: "Said not interested" + (no > 1 ? " " + no + " times" : ""), src: "heard", s: -1 }); }
    var rep = Object.keys(c.counts || {}).filter(function (k) { return c.counts[k] >= 2; });
    if (rep.length) { sc -= rep.length; ev.push({ t: "Same concern more than once", src: "heard", s: -1 }); }
    if (L.interestedBefore) { sc += 1; ev.push({ t: "Was interested on an earlier call", src: "record", s: +1 }); }
    if ((m.s || {}).buy) { sc += 1; ev.push({ t: "Gave buying signals on earlier calls", src: "record", s: +1 }); }
    if (L.stage === "Committed") { sc += 4; ev.push({ t: "Committed (on record)", src: "record", s: +1 }); }
    var miss = missingInfo(ind, L.qf).filter(function (x) { return x.must; });
    miss.forEach(function (x) { ev.push({ t: "Unknown: " + (L.qfLabels && L.qfLabels[x.k] || x.k), src: "unknown", s: 0 }); });
    var nq = notQualified(ind, L.qf, c.events);
    var band = nq ? "notq" : sc >= 6 ? "ready" : sc >= 3 ? "leaning" : sc >= 0 ? "open" : "cooling";
    var label = { notq: "Not qualified", ready: "Ready to commit", leaning: "Leaning in", open: "No clear signal yet", cooling: "Cooling off" }[band];
    if (nq) ev.unshift({ t: nq.t, src: nq.src, s: -1 });
    return { band: band, label: label, score: sc, evidence: ev, sure: miss.length ? "Missing " + miss.length + " must-know answer" + (miss.length > 1 ? "s" : "") : "" };
  }

  // ---------- 6. Mistakes and compliance on the rep's own words ----------
  var PROMISE = /\b(it'?s|this is) (guaranteed|a sure thing|risk ?free|a no ?brainer|a lock)\b|\byou (can'?t|cannot|won'?t) lose\b|\bno (risk|downside)\b|\b(it|this|they|the company) (will|is going to|'?s going to|are going to) (definitely )?(go public|ipo|double|triple|10x|explode|take off|make you)\b|\bi (promise|guarantee) (you|it|this)\b|\byou'?ll (make|double|triple)\b|\bguaranteed (return|returns|to)\b/;
  var CLOSE_RE = /\b(put you down|title your accounts?|individually,? joint|which (works|is) better|(tomorrow|tonight|today) at \w+|morning or (the )?afternoon|let'?s get (you|it|the paperwork) (started|going|set up)|send you the (subscription|documents|paperwork|agreement)|how many shares (would|do|should) you|are you ready to|shall we get|sign you up)\b/;
  var STRETCH = /\b(stretch|borrow|take (out )?a loan|max out|credit card|dip into|find the money|cash out your)\b/;
  var RISK_TALK = /\b(risk|risks|illiquid|lock ?up|lose (some|all|the full|everything|it)|may not (go public|happen|list)|could be delayed|no guarantee)\b/;
  var QUESTION = /^(what|how|when|which|would|do|does|is|are|can|could|have|has|did|where|who|why|if)\b/;
  function alerts(ctx) {
    var c = ctx.call || {}, out = [], ev = c.events || [], lines = c.lines || [], ind = ctx.ind;
    var rep = (c.repLines || []);
    rep.forEach(function (l) { if (PROMISE.test(" " + l.toLowerCase() + " ")) out.push({ k: "promise", level: "stop", t: "That sounds like a promise. Take it back: “Nobody can promise what it will do. Here's why we like it, and here are the risks.”", src: "heard", q: l }); });
    var dnc = ev.filter(function (e) { return e.kind === "dnc"; })[0];
    if (dnc && lines.length && lines[lines.length - 1] !== dnc.text) out.push({ k: "dnc", level: "stop", t: "They asked not to be called. Confirm, add them to Do Not Call, and end the call politely.", src: "heard" });
    var buys = ev.filter(function (e) { return e.kind === "buy" || e.kind === "size"; });
    var lastBuy = buys[buys.length - 1];
    if (lastBuy) {
      var after = lines.slice(lines.lastIndexOf(lastBuy.text) + 1), closed = ev.some(function (e) { return e.kind === "close" && e.at >= lastBuy.at; }) || after.some(function (l) { return CLOSE_RE.test(l.toLowerCase()); });
      if (after.length >= 2 && !closed) out.push({ k: "missedbuy", level: "warn", t: "They gave a buying signal (“" + clip(lastBuy.text) + "”) and the call moved on. Go back to it and ask.", src: "heard" });
    }
    var means = ev.filter(function (e) { return e.kind === "obj" && CAT[e.idea] === "means"; }).pop();
    if (means && rep.some(function (l) { return STRETCH.test(l.toLowerCase()); })) out.push({ k: "stretch", level: "stop", t: "Never push past what they can afford to lose. Right-size it instead.", src: "heard" });
    var nos = ev.filter(function (e) { return e.kind === "obj" && e.idea === "notint"; });
    if (nos.length >= 2) { var aft = lines.slice(lines.lastIndexOf(nos[nos.length - 1].text) + 1); if (aft.length >= 3 && !ev.some(function (e) { return e.kind === "agree" && e.at > nos[nos.length - 1].at; })) out.push({ k: "pushing", level: "warn", t: "Two clear no's and the pitch kept going. Ask timing-or-never once, then step back.", src: "heard" }); }
    var closeTry = ev.filter(function (e) { return e.kind === "close"; })[0] || (rep.some(function (l) { return CLOSE_RE.test(l.toLowerCase()); }) ? { at: Infinity } : null);
    if (closeTry && !c.discovered && (c.leadLines || []).length < 2) out.push({ k: "earlyclose", level: "warn", t: "Asking for the order before you know what matters to them. Ask one discovery question first.", src: "inferred" });
    if (ind === "investments" && (c.stage === "close" || closeTry)) {
      var qf = (ctx.lead || {}).qf || {};
      if (!/^yes$/i.test(String(qf.accredited || ""))) out.push({ k: "accredited", level: "warn", t: "Before any commitment, confirm they're accredited. It's verified before money moves.", src: "record" });
      if (!lines.some(function (l) { return RISK_TALK.test(l.toLowerCase()); })) out.push({ k: "risk", level: "info", t: "Before they commit, say the risks out loud: illiquid, the IPO may be delayed or never happen, and they can lose the full amount.", src: "heard" });
    }
    if (c.brain && rep.length >= 3) {
      var tail = rep.slice(-3), words = tail.join(" ").split(/\s+/).length;
      if (words >= 90 && !tail.some(function (l) { return QUESTION.test(l.toLowerCase().trim()); })) out.push({ k: "monologue", level: "info", t: "You've talked a while without a question. Ask one and let them talk.", src: "heard" });
    }
    return out;
  }
  function clip(t) { t = String(t || ""); return t.length > 48 ? t.slice(0, 46) + "…" : t; }

  // ---------- 7. The next best move ----------
  var OPEN = { investments: "{first}, have you ever been involved in an IPO before?", insurance: "Is protecting your family something you've been thinking about lately?",
    realestate: "Are you still thinking about selling, or did you decide to keep it?", mca: "If you had extra working capital this month, what would you put it to?",
    auto: "What are you driving now, and what's got you looking?", solar: "About what's your electric bill running a month?" };
  var TRIAL = { investments: "Putting the buying aside, does the idea make sense?", all: "Putting that aside for a second, does this make sense for you?" };
  var SWITCH = {
    value: { do: "This answer isn't landing. Stop defending the price: right-size it.", say: "Let's make it easy. What amount would you be comfortable with, even if it takes longer than we expect?", aim: "A size that fits, instead of a price fight." },
    means: { do: "Don't push. Find when the money frees up and book that.", say: "Fair enough. When does that free up? Let's talk then, no pressure before.", aim: "A dated follow-up that respects their situation." },
    trust: { do: "Trust won't come from more talking on this call. Send your credentials and book a short follow-up.", say: "Let me send you everything so you can check us out, then we talk Thursday. Morning or afternoon?", aim: "Time and proof, then a second conversation." },
    authority: { do: "Stop selling the person who can't decide alone. Book the call with both.", say: "Let's do this right: when can the three of us talk, tonight or tomorrow evening?", aim: "The decision-maker on the next call." },
    hesitation: { do: "Ask them to decide on a date, not now.", say: "Totally fair. When would you be able to give me a yes or a no, Friday or Monday?", aim: "A decision date instead of an open loop." },
    risk: { do: "Go smaller and honest: let them start at a size they could lose.", say: "Let's size it so that if the worst happens, it doesn't change your life. What number is that for you?", aim: "A size they can hold with eyes open." },
    brushoff: { do: "They're not engaging. Book a better time or let it go.", say: "Sounds like now's not the time. Is there a better day, or should I leave it here?", aim: "End with a booked time or a clean goodbye." },
    statusquo: { do: "They're attached to what they have. Ask for a small side-by-side later.", say: "Keep what you have. Would you look at a side-by-side next week, just to compare?", aim: "A low-stakes next look." },
    info: { do: "More explaining won't do it now. Send the documents and book the review.", say: "Let me send it in writing and walk you through it tomorrow. Morning or afternoon?", aim: "A review with the facts in front of them." },
    timing: { do: "Respect the timing. Book the exact time.", say: "When's the best time to catch you, later today or tomorrow morning?", aim: "A booked callback." },
    credibility: { do: "Hand it back to them: ask about their situation.", say: "Enough about me. What are you invested in right now?", aim: "A real conversation about them." },
    qualification: { do: "Confirm the facts plainly.", say: "Let me make sure this is even right for you: [the qualifying question].", aim: "A clean yes or no." },
    disinterest: { do: "Step back and keep the relationship.", say: "I appreciate your time. Mind if I check back in a few months?", aim: "A clean, respectful ending." }
  };
  function fill(s, ctx) { return String(s || "").replace(/\{first\}/g, (ctx.lead && ctx.lead.first) || "{first}"); }
  function lastOf(ev, kinds) { for (var i = ev.length - 1; i >= 0; i--) if (kinds.indexOf(ev[i].kind) >= 0) return ev[i]; return null; }
  function plan(ctx) {
    var c = ctx.call || {}, L = ctx.lead || {}, m = ctx.mem || {}, ind = ctx.ind, ev = c.events || [];
    var trial = TRIAL[ind] || TRIAL.all, miss = missingInfo(ind, L.qf), must = miss.filter(function (x) { return x.must; });
    var base = function (o) { o.evidence = o.evidence || []; o.confidence = o.confidence || "medium"; return o; };
    // a do-not-call request ends everything
    var dnc = lastOf(ev, ["dnc"]);
    if (dnc) return base({ kind: "respect", title: "Respect it", what: "They asked not to be called again.", why: "It's their right, and the law.", do: "Confirm, add them to Do Not Call, end politely.",
      say: "Understood. I'll take you off our list right now. Have a good day.", aim: "A clean, compliant ending.", evidence: [{ t: "“" + clip(dnc.text) + "”", src: "heard" }], confidence: "high" });
    // not qualified: stop
    var nq = notQualified(ind, L.qf, ev);
    if (nq) return base({ kind: "disqualify", title: "Not qualified: stop here", what: "They don't meet the requirement.", why: "Some offers have rules about who can take part, and they protect the client and you.",
      do: "Thank them and end it. Never help anyone around the rule.", say: "I appreciate your time. Based on that, this one isn't the right fit, and I'd rather tell you now.", aim: "A clean, honest ending.", evidence: [nq], confidence: "high" });
    var last = lastOf(ev, ["obj", "buy", "size", "agree", "trial", "close"]);
    // a buying signal: qualify if needed, then ask
    if (last && (last.kind === "buy" || last.kind === "size")) {
      var needQ = must[0];
      if (needQ) return base({ kind: "qualify", title: "Confirm first, then ask", what: "They're showing they want in.", why: "But a must-know answer is still missing, and it decides whether they can go ahead.",
        do: "Answer them in one line, then ask this before taking the order.", say: needQ.q, aim: "Qualify cleanly, then close.", evidence: [{ t: "“" + clip(last.text) + "”", src: "heard" }, { t: "Unknown: " + (L.qfLabels && L.qfLabels[needQ.k] || needQ.k), src: "unknown" }], confidence: "high", card: true });
      return base({ kind: "close", title: "Ask for the commitment", what: KIND.signal.what, why: KIND.signal.why, do: ind === "investments" ? "Answer in one line, cover the risks, then put them down and lock the details." : KIND.signal.do,
        say: "", card: true, aim: KIND.signal.aim, evidence: [{ t: "“" + clip(last.text) + "”", src: "heard" }], confidence: "high" });
    }
    // an objection: diagnose it and pick the approach
    if (last && last.kind === "obj") {
      var d = diagnose(last, c, m), k = d.kind, evid = [{ t: "“" + clip(last.text) + "”", src: "heard" }].concat(d.evidence);
      var tried = ((m.t || []).filter(function (id) { return id.indexOf(last.idea) === 0 || (ctx.ideaOf && ctx.ideaOf[id] === last.idea); }).length);
      if (d.cat === "disinterest") return base({ kind: "stepback", title: "Check, then step back", what: k.what, why: k.why, do: k.do, say: "Fair enough. So I don't bother you: is it the timing, or is this something you'd never look at?", aim: k.aim, evidence: evid, confidence: "high" });
      if (d.times >= 3 || (tried >= 3 && d.times >= 2)) { var sw = SWITCH[d.cat] || SWITCH.info;
        return base({ kind: "switch", title: "Change the approach", what: "The same concern keeps coming back.", why: "The answers so far haven't resolved it. Repeating them pushes the person away.", do: sw.do, say: sw.say, aim: sw.aim, evidence: evid.concat([{ t: tried ? tried + " answers already tried with this person" : "Raised " + d.times + " times", src: tried ? "record" : "heard" }]), confidence: "high" }); }
      if (d.cat === "brushoff") return base({ kind: "engage", title: "Earn the next 60 seconds", what: k.what, why: k.why, do: k.do, say: "Totally fair, you didn't expect my call. Give me 15 seconds on why I called, and you tell me if it's worth a real conversation. Fair? [Your 15-second reason.]", aim: k.aim, evidence: evid, confidence: d.genuine === false ? "medium" : "low" });
      var distinct = (c.objs || []).length;
      if (distinct >= 2 && !c.again && d.cat !== "qualification") return base({ kind: "isolate", title: "Isolate it", what: "A second, different concern just came up.", why: "When concerns stack up, one of them is usually the real one. Find it before answering everything.",
        do: "Ask if this is the last thing in the way, then answer it.", say: "Other than " + (ctx.objName && ctx.objName[last.idea] || "that") + ", is there anything else stopping you from going ahead?", aim: "One clear concern to solve.", evidence: evid, card: true, cat: d.cat });
      return base({ kind: "handle", title: k.label + ": " + (d.genuine ? "a real concern" : "answer it"), what: k.what, why: k.why, do: k.do, say: "", card: true, aim: k.aim, evidence: evid, cat: d.cat, confidence: d.genuine ? "high" : "medium",
        after: "Then trial close: “" + trial + "”" });
    }
    if (last && last.kind === "agree") {
      var prev = lastOf(ev.slice(0, ev.indexOf(last)), ["trial", "agree", "obj"]);
      if (prev && (prev.kind === "trial" || prev.kind === "agree")) return base({ kind: "close", title: "Ask for the commitment", what: "They agreed again.", why: "Two yeses in a row means they're ready to hear the ask.", do: "Ask now, then stop talking.", say: "", card: true, closeOnly: true, aim: "A commitment.", evidence: [{ t: "“" + clip(last.text) + "”", src: "heard" }], confidence: "high" });
      return base({ kind: "trial", title: "Trial close", what: "They're going along with you.", why: "Agreement after an answer is the moment to check where they stand.", do: "Ask the trial close. If they say yes, go straight to the ask.", say: trial, aim: "Confirm it makes sense before asking for the order.", evidence: [{ t: "“" + clip(last.text) + "”", src: "heard" }], confidence: "medium" });
    }
    if (last && last.kind === "trial") return base({ kind: "trialwait", title: "Let them answer", what: "You asked the trial close.", why: "Their answer tells you whether to close or find the concern.", do: "Wait for the answer. Yes: ask for the order. Anything else: find the one concern.", say: trial, aim: "A yes, or the real concern.", confidence: "medium" });
    if (last && last.kind === "close") return base({ kind: "silence", title: "Stop talking", what: "You asked for the order.", why: "Whoever speaks first after the ask usually gives ground.", do: "Wait for their answer, then lock the details.", say: "", aim: "Their answer.", confidence: "medium" });
    // nothing raised yet: open, then discover, then present
    var returning = (m.calls || 0) > 0 || (L.calls || 0) > 0;
    if (!c.discovered && (c.leadLines || []).length < 2 && (c.lines || []).length < 3) {
      var memEv = [], prevObj = m.lastObj;
      if (returning && prevObj) memEv.push({ t: "Last time: “" + (ctx.objLabel && ctx.objLabel[prevObj] || prevObj) + "”", src: "record" });
      if (L.nextTask && L.nextTask.what) memEv.push({ t: "Booked: " + L.nextTask.what, src: "record" });
      if (returning && prevObj) {
        var pick = { authority: "Did you get a chance to talk it over? What did they think?", info: "Did you get a chance to look at what I sent? What stood out?", timing: "Is now a better time? I'll be quick.",
          hesitation: "Last time you wanted to think it over. What's on your mind now?", means: "Last time timing on the money was the issue. Has anything changed?", trust: "Did you get a chance to check us out? Any questions I can answer?" }[CAT[prevObj]] || "Last time we talked about " + (ctx.objName && ctx.objName[prevObj] || "a few things") + ". Where are you with it now?";
        return base({ kind: "resume", title: "Pick up where you left off", what: "You've spoken before (" + Math.max(m.calls || 0, L.calls || 0) + " call" + (Math.max(m.calls || 0, L.calls || 0) > 1 ? "s" : "") + ").", why: "Starting over makes them repeat themselves. Showing you remember builds trust.",
          do: "Open with what they told you last time.", say: "{first}, it's [your name] with [firm]. " + pick, aim: "Continue the conversation, not restart it.", evidence: memEv, confidence: "high" });
      }
      return base({ kind: "open", title: "Open", what: returning ? "A returning lead." : "First real conversation.", why: "The first 15 seconds decide whether they keep listening.",
        do: "Your name, the firm, why you called, then one easy question. Let them talk.", say: fill(OPEN[ind] || OPEN.investments, ctx), aim: "Get them talking about themselves.", evidence: memEv, confidence: "medium" });
    }
    if (must.length && c.stage !== "trial" && c.stage !== "close") {
      var q = must[0];
      return base({ kind: "ask", title: "Ask what's missing", what: "You don't know something you'll need before any commitment.", why: "Recommending before qualifying wastes their time and yours, and skips a rule.",
        do: "Ask this naturally, then listen.", say: q.q, aim: "Know whether and how this fits them.", evidence: [{ t: "Unknown: " + (L.qfLabels && L.qfLabels[q.k] || q.k), src: "unknown" }], confidence: "high" });
    }
    if (miss.length && c.stage !== "trial" && c.stage !== "close" && !c.asked) {
      return base({ kind: "ask", title: "Learn a bit more", what: "They're talking. A few details would sharpen your pitch.", why: "Their own reasons are what they'll buy for.",
        do: "Ask one question, then tie your pitch to their answer.", say: miss[0].q, aim: "Their reasons, in their words.", evidence: [{ t: "Unknown: " + (L.qfLabels && L.qfLabels[miss[0].k] || miss[0].k), src: "unknown" }], confidence: "medium" });
    }
    return base({ kind: "present", title: "Present, then trial close", what: "You know enough to make your case.", why: "Two or three reasons tied to what they told you beat a long pitch.",
      do: "Give your 2-3 strongest reasons, tied to their words, then ask the trial close.", say: trial, aim: "A yes to the idea, before the ask.", confidence: "medium" });
  }

  // ---------- 8. After the call: remember, and plan the follow-up ----------
  var STAGE_ORDER = ["open", "discover", "objection", "trial", "close"];
  function remember(mem, call, outcome, now) {
    mem = JSON.parse(JSON.stringify(mem || {})); now = now || Date.now();
    mem.v = 1; mem.calls = (mem.calls || 0) + 1; mem.last = now; if (outcome) mem.out = outcome;
    var o = mem.o || (mem.o = {});
    (call.events || []).forEach(function (e) { if (e.kind === "obj") { var x = o[e.idea] || (o[e.idea] = [0, 0]); x[0]++; x[1] = now; } });
    var s = mem.s || (mem.s = {}); (call.events || []).forEach(function (e) { if (e.kind === "buy" || e.kind === "size" || e.kind === "agree") s[e.kind] = (s[e.kind] || 0) + 1; });
    mem.t = (mem.t || []).concat((call.shown || []).filter(function (id) { return (mem.t || []).indexOf(id) < 0; })).slice(-40);
    if (call.stage && STAGE_ORDER.indexOf(call.stage) > STAGE_ORDER.indexOf(mem.st || "open")) mem.st = call.stage;
    var objs = (call.events || []).filter(function (e) { return e.kind === "obj"; });
    if (objs.length) mem.lastObj = objs[objs.length - 1].idea;
    if (call.facts && call.facts.length) mem.f = (mem.f || []).concat(call.facts.filter(function (f) { return !(mem.f || []).some(function (g) { return g.t === f.t; }); })).slice(-8);
    if (call.nba) mem.nba = call.nba;
    Object.keys(o).forEach(function (k) { if (now - o[k][1] > 180 * 86400000) delete o[k]; });   // half a year on, it's history
    return mem;
  }
  // When to follow up and why: { days, hour, evening, what, why, note }. The app turns it into a time inside the lead's calling hours.
  function followup(ctx, outcome) {
    var m = ctx.mem || {}, last = m.lastObj, cat = last ? CAT[last] : "", s = m.s || {}, ind = ctx.ind;
    if (outcome === "notinterested") {
      if ((m.o && m.o.notint && m.o.notint[0] >= 2)) return null;
      return { days: 90, hour: 10, what: "Check in", why: "They said no for now. A respectful check-in in a few months keeps the door open.", note: "Said not interested. Check timing, no pitch." };
    }
    if (s.buy && (ctx.lead || {}).stage !== "Committed") return { days: 0, hour: null, soon: true, what: ind === "investments" ? "Finish the paperwork" : "Lock in the next step", why: "They gave buying signals. Strike while it's warm: today or tomorrow.", note: "Gave buying signals" + (last ? "; last concern: " + (ctx.objLabel && ctx.objLabel[last] || last) : "") + "." };
    var plan = {
      authority: { days: 1, hour: 19, evening: true, what: "Call with both", why: "They wanted to involve someone else. Evenings are when couples and partners can both be on.", note: "Wanted to talk it over. Get the decision-maker on this call." },
      hesitation: { days: 1, hour: null, what: "Follow up while it's fresh", why: "They're thinking it over. Within a day, the conversation is still fresh; longer, it fades.", note: "On the fence. Isolate the one concern." },
      info: { days: 1, hour: 10, what: "Review what you sent", why: "They need the facts. Send them now and review together tomorrow.", note: "Wanted information. Review the documents together." },
      brushoff: { days: 2, hour: 10, what: "Try again", why: "A brush-off isn't a no. Try at a different time of day.", note: "Brushed off. Lead with the 15-second reason." },
      timing: { days: 1, hour: null, what: "Call back at their time", why: "Interest may be there; they needed a better time. Use the time they gave you if they named one.", note: "Bad timing. Use the time they asked for." },
      means: { days: 30, hour: 10, what: "Check in when funds free up", why: "Money was tight or tied up. Pushing now loses them; checking back when it frees up doesn't.", note: "Money tight/tied up. Ask if it has freed up; right-size." },
      trust: { days: 2, hour: 10, what: "Follow up after they've checked you out", why: "Trust takes time and proof. Send credentials, then call in a couple of days.", note: "Trust concern. Send credentials first." },
      credibility: { days: 2, hour: 10, what: "Follow up", why: "They were sizing you up. A prompt, prepared follow-up builds credibility.", note: "Sizing us up. Be prepared and brief." },
      risk: { days: 2, hour: 10, what: "Walk through the risks", why: "Risk was the concern. A calm, honest walkthrough with documents is the next step.", note: "Risk concern. Cover risks honestly; right-size." },
      value: { days: 1, hour: 10, what: "Revisit the value", why: "Price was the concern. Come back with what it would need to be worth to them.", note: "Price/value concern. Find what it needs to be worth." },
      statusquo: { days: 7, hour: 10, what: "Side-by-side look", why: "They're comfortable with what they have. A low-pressure comparison in a week.", note: "Happy as is. Offer a side-by-side." },
      qualification: { days: 0, hour: null, what: "Confirm they qualify", why: "Qualifying is open. Confirm before anything else.", note: "Qualification open. Confirm first." }
    }[cat];
    if (plan) return plan;
    if (outcome === "interested") return { days: 1, hour: 10, what: "Next step", why: "They're interested. Keep the momentum: next business day.", note: "Interested." };
    return null;
  }

  // ---------- 9. Outside the call: where every deal stands (Radar, the lead profile) ----------
  // lead: { stage, outcome, calls, reached, lastCallAt, interestedBefore, qf, prog {email, docs, returned, funded}, track, amount, checkValue,
  //         nextTask {what, due, over, lateDays}, dnc, stalled, stageAt }
  function lifecycle(ctx) {
    var L = ctx.lead || {}, m = ctx.mem || {}, ind = ctx.ind, now = ctx.now || Date.now(), ev = [], blockers = [];
    var day = 86400000, since = L.lastCallAt ? Math.floor((now - L.lastCallAt) / day) : null;
    var nq = notQualified(ind, L.qf, []), miss = missingInfo(ind, L.qf), must = miss.filter(function (x) { return x.must; });
    var openObj = Object.keys(m.o || {}).sort(function (a, b) { return m.o[b][0] - m.o[a][0]; });
    var res = function (phase, bucket, nba, pri) { return { phase: phase, bucket: bucket, nba: nba, evidence: ev, blockers: blockers, priority: pri || 0 }; };
    if (L.dnc) { ev.push({ t: "On the Do Not Call list", src: "record" }); return res("lost", "closed", { title: "Leave it", why: "They asked not to be called." }, -1); }
    if (nq) { ev.push(nq); return res("notq", "notq", { title: "Not qualified", why: "They don't meet the requirement. Don't pursue." }, -1); }
    if (L.stage === "Closed Lost") { ev.push({ t: "Closed lost", src: "record" }); return res("lost", "closed", { title: "Closed lost", why: "Re-engage only if something changes." }, -1); }
    // where in the lifecycle
    var phase, nba;
    var P = L.prog || {}, track = L.track || [];
    if (L.stage === "Committed" || L.stage === "Funded" || L.stage === "Closed") {
      if (track.length) {
        var nextStep = track.filter(function (t) { return !P[t[0]]; })[0];
        if (!nextStep) { phase = "done"; nba = { title: "Service and referral", why: "Funded. Keep them updated; once they've seen how you operate, ask for a referral." }; }
        else { phase = "document"; nba = { title: nextStep[1] + ": next", why: "Committed. The deal isn't done until the paperwork and funding are: " + nextStep[1].toLowerCase() + " is the open step." }; ev.push({ t: "Committed; open step: " + nextStep[1], src: "record" }); }
      } else { phase = "document"; nba = { title: "Finish the closing steps", why: "Committed. Walk the closing steps to completion." }; }
    } else if (!L.calls) { phase = "new"; nba = { title: "First call", why: "Never called. Call in their best hours." }; }
    else if (!L.reached) { phase = "reach"; nba = { title: "Reach them", why: (L.calls) + " tries, no conversation yet. Try a different time of day, then text." }; }
    else if (must.length) { phase = "qualify"; nba = { title: "Qualify: " + (L.qfLabels && L.qfLabels[must[0].k] || must[0].k), why: "A must-know answer is missing before any commitment.", say: must[0].q }; must.forEach(function (x) { blockers.push({ t: "Unknown: " + (L.qfLabels && L.qfLabels[x.k] || x.k), src: "unknown" }); }); }
    else if (openObj.length && L.outcome !== "interested") { phase = "resolve"; var top = openObj[0], cat = CAT[top]; nba = { title: "Resolve: " + (ctx.objLabel && ctx.objLabel[top] || top), why: (KIND[cat] || KIND.info).do }; }
    else if (L.outcome === "interested" || L.interestedBefore) { phase = "advance"; nba = { title: "Move to commitment", why: "Interested and qualified. Present, trial close, then ask." }; }
    else { phase = "educate"; nba = { title: "Show the value", why: "Talked, no clear interest yet. Find what matters to them." }; }
    openObj.slice(0, 3).forEach(function (k) { var c = CAT[k]; blockers.push({ t: (ctx.objLabel && ctx.objLabel[k] || k) + (m.o[k][0] > 1 ? " ×" + m.o[k][0] : "") + " · " + (KIND[c] || KIND.info).label, src: "record", cat: c }); });
    // momentum: is it moving, stalling, at risk?
    var nt = L.nextTask, bucket = "moving", pri = 0, val = L.checkValue || Number(L.amount) || 0;
    if ((m.s || {}).buy) ev.push({ t: "Gave buying signals before", src: "record" });
    if (L.interestedBefore) ev.push({ t: "Said interested", src: "record" });
    if (nt && nt.over) { bucket = "stalling"; ev.push({ t: "Follow-up " + (nt.lateDays ? nt.lateDays + " day" + (nt.lateDays > 1 ? "s" : "") + " late" : "late"), src: "record" }); }
    if (!nt && phase !== "done" && phase !== "new" && L.reached) { bucket = "stalling"; blockers.push({ t: "No next step booked", src: "record" }); }
    if (since !== null && since >= 7 && phase !== "done" && (L.interestedBefore || phase === "document" || phase === "advance")) { bucket = "stalling"; ev.push({ t: "No contact in " + since + " days", src: "record" }); }
    var noCount = m.o && m.o.notint ? m.o.notint[0] : 0;
    if (L.outcome === "notinterested" && L.interestedBefore) { bucket = "atrisk"; ev.push({ t: "Said not interested after showing interest", src: "record" }); }
    if (noCount >= 2) { bucket = "atrisk"; ev.push({ t: "Not interested ×" + noCount, src: "record" }); }
    if (openObj.some(function (k) { return CAT[k] === "trust" && m.o[k][0] >= 2; })) { bucket = bucket === "moving" ? "atrisk" : bucket; ev.push({ t: "Trust concern raised more than once", src: "record" }); }
    if (L.stalled) { bucket = "atrisk"; ev.push({ t: "Parked after no progress", src: "record" }); }
    if (phase === "new" || phase === "reach") bucket = "early";
    if (phase === "done") bucket = "done";
    // priority: value, how close it is, and urgency (evidence only)
    var close = { document: 5, advance: 4, resolve: 3, qualify: 2, educate: 1, reach: 0.5, new: 0.3, done: 0 }[phase] || 0;
    pri = close * 10 + Math.min(10, val / 25000) + (nt && nt.over ? 6 : 0) + ((m.s || {}).buy ? 4 : 0) + (bucket === "atrisk" ? 3 : 0) - (bucket === "early" ? 5 : 0);
    if (nt && nt.over) nba = Object.assign({}, nba, { title: (nba.title || "Follow up") + " (overdue)", urgent: true });
    return res(phase, bucket, nba, Math.round(pri * 10) / 10);
  }

  // ---------- 10. The team: one targeted tip per rep, from their own numbers ----------
  // reps: [{ uid, name, calls, talked, interested, warm, warmNoNext, followOver }]
  function coach(reps) {
    var med = function (f) { var a = reps.map(f).filter(function (x) { return isFinite(x); }).sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 0; };
    var reach = function (r) { return r.calls ? r.talked / r.calls : NaN; }, conv = function (r) { return r.talked ? r.interested / r.talked : NaN; };
    var mReach = med(reach), mConv = med(conv);
    return reps.map(function (r) {
      var tip = null;
      if (r.calls < 20) tip = { t: "Not enough calls yet to coach (" + r.calls + ").", k: "volume" };
      else if (r.followOver >= 3) tip = { t: r.followOver + " follow-ups overdue. Warm leads cool fast: clear these before new dials.", k: "followup" };
      else if (r.warm && r.warmNoNext / r.warm >= 0.3) tip = { t: r.warmNoNext + " of " + r.warm + " warm leads have no next step. End every good call with a booked time.", k: "nextstep" };
      else if (isFinite(conv(r)) && mConv && conv(r) < mConv * 0.6) tip = { t: "Turns " + Math.round(conv(r) * 100) + "% of conversations into interest (team " + Math.round(mConv * 100) + "%). Work on discovery and the trial close.", k: "convert" };
      else if (isFinite(reach(r)) && mReach && reach(r) < mReach * 0.6) tip = { t: "Reaches " + Math.round(reach(r) * 100) + "% (team " + Math.round(mReach * 100) + "%). Try other hours and leave fewer dead-air voicemails.", k: "reach" };
      else tip = { t: "On track. Keep the follow-ups tight.", k: "ok" };
      return { uid: r.uid, name: r.name, tip: tip, reach: reach(r), conv: conv(r) };
    });
  }

  // ---------- 11. What works: outcomes by kind of concern ----------
  function patterns(calls) {   // calls: [{ cats: [...], out }]
    var by = {};
    calls.forEach(function (c) { (c.cats || []).forEach(function (k) { var b = by[k] || (by[k] = { n: 0, w: 0 }); b.n++; if (c.out === "interested") b.w++; }); });
    return Object.keys(by).map(function (k) { return { cat: k, label: (KIND[k] || {}).label || k, n: by[k].n, w: by[k].w, rate: by[k].n ? by[k].w / by[k].n : 0 }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  root.VPEXMind = { v: 1, CAT: CAT, KIND: KIND, QUAL: QUAL, missingInfo: missingInfo, notQualified: notQualified, readPerson: readPerson, diagnose: diagnose,
    progress: progress, alerts: alerts, plan: plan, remember: remember, followup: followup, lifecycle: lifecycle, coach: coach, patterns: patterns,
    PROMISE: PROMISE, CLOSE_RE: CLOSE_RE };
})(typeof window !== "undefined" ? window : this);
