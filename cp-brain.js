/* VPEX Copilot Brain: an AI that follows the whole call, the rep and the lead, and runs entirely on this computer (nothing
   said on the call leaves it, and it costs nothing). index.html loads this only for the VPEX owner's own login, with
   Copilot Elite (see elBrain*). Two engines, best first:
   1. Chrome's built-in AI (Gemini Nano, the Prompt API: LanguageModel), Chrome 148+ on a capable Windows, Mac or Linux
      computer. Chrome downloads the model once (about 4 GB).
   2. An open model run by the browser itself (WebLLM + Qwen3, over WebGPU), Chrome or Edge on a computer with a usable
      graphics chip. Downloaded once (about 1 GB for 1.7B, 0.5 GB for 0.6B) and kept by the browser.
   For each new sentence it answers, as JSON held to a schema: who said it (rep or lead), what the lead is doing (one of
   the playbook's objection ids, a buying signal, agreement, a question, small talk), where the call is, the rep's best
   next move toward the close, and a short note on the rep's own line. Copilot shows the playbook's answer for what it
   hears; the brain never writes the rebuttal itself. */
(function () {
  "use strict";
  var WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm@0.2.83";
  var MODELS = ["Qwen3-1.7B-q4f16_1-MLC", "Qwen3-0.6B-q4f16_1-MLC", "Llama-3.2-1B-Instruct-q4f16_1-MLC"];
  var B = { kind: "", state: "off", progress: 0, err: "", session: null, engine: null, model: "", busy: false };
  var LANG = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };

  function LM() { return typeof self !== "undefined" && self.LanguageModel ? self.LanguageModel : null; }
  // What this computer can run: { builtin: "available"|"downloadable"|"downloading"|"unavailable"|"none", gpu: bool }
  function check() {
    var lm = LM(), gpu = !!(typeof navigator !== "undefined" && navigator.gpu);
    var p = lm && lm.availability ? Promise.resolve(lm.availability(LANG)).catch(function () { return "unavailable"; }) : Promise.resolve("none");
    return p.then(function (a) { return { builtin: a || "unavailable", gpu: gpu }; });
  }

  function system(ctx) {
    return "You follow a live sales phone call for a rep selling " + ctx.floor + ". One microphone hears both people: the REP (who is selling) and the LEAD (who is being sold to). " +
      "Each time you get the call so far, newest line last. For the NEWEST line decide:\n" +
      "speaker: rep or lead (the rep introduces himself, pitches, asks questions, answers objections and asks for the order; the lead answers, objects, asks about price or next steps, agrees or refuses). Use unclear only if you truly can't tell.\n" +
      "move: what the LEAD is doing in that line, one id from the list (if the rep said it, the lead's last move). Pick the closest objection even when it's said in unusual words. Use buy when the lead asks how to start, the minimum, price per share, how many shares, or says yes. Use agree when the lead goes along (yeah, makes sense, I hear you). Use none for small talk.\n" +
      "stage: open, discover, objection, trial or close.\n" +
      "next: the rep's single best next move toward the close, one short sentence the rep can act on now. Always move toward the close. Never promise returns, approvals or savings, never invent deadlines or facts.\n" +
      "check: if the rep said the newest line, one short note on it (what was good or what to do next), else empty.\n" +
      "facts: up to 2 short facts the LEAD stated about themselves in the newest line (their money, family, timing, what they own now), in their own words. Never guess; empty if none.\n" +
      "Reply with JSON only.";
  }
  function userMsg(ctx) {
    var lines = ctx.lines.slice(-10), n = lines.length;
    return "Lead moves (id = meaning):\n" + ctx.ideas.map(function (x) { return x[0] + " = " + x[1]; }).join("\n") +
      "\nbuy = ready to go ahead, asks how to start, the minimum, price per share or next steps\nagree = goes along with the rep\nquestion = asks about the company or the product\nnone = small talk or nothing\n\n" +
      "Call so far" + (ctx.stage ? " (stage was " + ctx.stage + ")" : "") + ":\n" +
      lines.map(function (l, i) { return (i === n - 1 ? "NEWEST: " : (i + 1) + ". ") + String(l).slice(0, 220); }).join("\n");
  }
  function schema(ctx) {
    return { type: "object", additionalProperties: false, required: ["speaker", "move", "stage", "next", "check"], properties: {
      speaker: { type: "string", enum: ["rep", "lead", "unclear"] },
      move: { type: "string", enum: ctx.ideas.map(function (x) { return x[0]; }).concat(["buy", "agree", "question", "none"]) },
      stage: { type: "string", enum: ["open", "discover", "objection", "trial", "close"] },
      next: { type: "string", maxLength: 180 },
      check: { type: "string", maxLength: 160 },
      facts: { type: "array", maxItems: 2, items: { type: "string", maxLength: 90 } } } };
  }
  function parse(txt, ctx) {
    var s = String(txt || "").replace(/^[\s\S]*?(\{)/, "$1").replace(/\}[^}]*$/, "}"), j;
    try { j = JSON.parse(s); } catch (e) { return null; }
    var moves = ctx.ideas.map(function (x) { return x[0]; }).concat(["buy", "agree", "question", "none"]);
    if (!j || moves.indexOf(j.move) < 0) return null;
    return { speaker: ["rep", "lead"].indexOf(j.speaker) >= 0 ? j.speaker : "unclear", move: j.move,
      stage: ["open", "discover", "objection", "trial", "close"].indexOf(j.stage) >= 0 ? j.stage : "", next: String(j.next || "").slice(0, 180), check: String(j.check || "").slice(0, 160),
      facts: Array.isArray(j.facts) ? j.facts.filter(function (f) { return typeof f === "string" && f.trim(); }).slice(0, 2).map(function (f) { return f.trim().slice(0, 90); }) : [] };
  }

  // ----- engine 1: Chrome's built-in AI -----
  function startBuiltin(onProgress) {
    var lm = LM(); if (!lm) return Promise.reject(new Error("no-builtin"));
    B.state = "loading";
    return lm.create(Object.assign({
      initialPrompts: [{ role: "system", content: "You classify lines of a live sales call and reply with JSON only." }],
      monitor: function (m) { m.addEventListener("downloadprogress", function (e) { B.progress = e.loaded || 0; if (onProgress) onProgress(B.progress); }); }
    }, LANG)).then(function (s) { B.session = s; B.kind = "builtin"; B.model = "Gemini Nano (Chrome)"; B.state = "on"; return B.kind; });
  }
  function askBuiltin(ctx) {
    // the system prompt can only open a session, so there's one session per floor; each line is asked on a copy of it
    var lm = LM(), sys = system(ctx);
    var ready = B.sys === sys && B.floorSession ? Promise.resolve(B.floorSession)
      : lm.create(Object.assign({ initialPrompts: [{ role: "system", content: sys }] }, LANG)).then(function (s) {
          try { if (B.floorSession && B.floorSession.destroy) B.floorSession.destroy(); } catch (e) {}
          B.floorSession = s; B.sys = sys; return s; });
    return ready.then(function (base) {
      return Promise.resolve(base.clone ? base.clone() : base).then(function (s) {
        var done = function () { if (s !== base && s.destroy) s.destroy(); };
        return s.prompt(userMsg(ctx), { responseConstraint: schema(ctx) }).then(function (r) { done(); return r; }, function (e) { done(); throw e; });
      });
    });
  }

  // ----- engine 2: an open model in the browser (WebLLM) -----
  function loadWebLLM() { return window.__vpexWebLLM ? Promise.resolve(window.__vpexWebLLM) : import(WEBLLM_URL); }
  function startWebLLM(onProgress, small) {
    if (!(navigator && navigator.gpu)) return Promise.reject(new Error("no-gpu"));
    B.state = "loading";
    return loadWebLLM().then(function (w) {
      var have = ((w.prebuiltAppConfig || {}).model_list || []).map(function (m) { return m.model_id; });
      var list = small ? MODELS.slice(1) : MODELS, id = list.filter(function (m) { return !have.length || have.indexOf(m) >= 0; })[0] || list[0];
      return w.CreateMLCEngine(id, { initProgressCallback: function (r) { B.progress = r && typeof r.progress === "number" ? r.progress : B.progress; if (onProgress) onProgress(B.progress, r && r.text); } })
        .then(function (eng) { B.engine = eng; B.kind = "webllm"; B.model = id.replace(/-q4f16_1-MLC$/, ""); B.state = "on"; return B.kind; });
    });
  }
  function askWebLLM(ctx) {
    var req = { messages: [{ role: "system", content: system(ctx) }, { role: "user", content: userMsg(ctx) + (/qwen3/i.test(B.model) ? " /no_think" : "") }],
      temperature: 0, max_tokens: 220, response_format: { type: "json_object", schema: JSON.stringify(schema(ctx)) } };
    var go = function (r) { return B.engine.chat.completions.create(r).then(function (x) { return x.choices[0].message.content; }); };
    return go(Object.assign({ extra_body: { enable_thinking: false } }, req)).catch(function () { return go(req); });
  }

  // ----- public -----
  function start(pref, onProgress) {
    B.err = "";
    var tryWeb = function (e) { if (pref === "builtin") throw e; return startWebLLM(onProgress, pref === "small"); };
    var p = pref === "webllm" || pref === "small" ? startWebLLM(onProgress, pref === "small") : startBuiltin(onProgress).catch(tryWeb);
    return p.catch(function (e) { B.state = "off"; B.err = String(e && e.message || e); throw e; });
  }
  function judge(ctx) {   // ctx: { floor, ideas: [[id, meaning]], lines: [...], stage }
    if (B.state !== "on") return Promise.reject(new Error("off"));
    var t0 = Date.now();
    return (B.kind === "builtin" ? askBuiltin(ctx) : askWebLLM(ctx)).then(function (txt) {
      var r = parse(txt, ctx); if (r) r.ms = Date.now() - t0; return r;
    });
  }
  function stop() {
    try { if (B.session && B.session.destroy) B.session.destroy(); } catch (e) {}
    try { if (B.floorSession && B.floorSession.destroy) B.floorSession.destroy(); } catch (e) {}
    B.floorSession = null; B.sys = "";
    try { if (B.engine && B.engine.unload) B.engine.unload(); } catch (e) {}
    B.session = B.engine = null; B.state = "off"; B.kind = ""; B.model = "";
  }
  window.VPEXBrain = { check: check, start: start, judge: judge, stop: stop, info: function () { return { kind: B.kind, state: B.state, model: B.model, progress: B.progress, err: B.err }; },
    _prompt: function (ctx) { return { system: system(ctx), user: userMsg(ctx), schema: schema(ctx) }; } };
})();
