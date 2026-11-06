/* VPEX Signature themes: the few things CSS can't do alone. Loaded only with sig.css (index.html: ensureSigAssets).
   VPEXSig.mount(id, opts) is called whenever the theme is applied; any non-signature id tears everything down.
   Nothing here reads or writes app data; the only app value used is opts.liveAt() (when Call was tapped). */
(function () {
  "use strict";
  var cur = null, mo = null, bodyMo = null, tick = null, cleanups = [], seen = typeof WeakSet === "function" ? new WeakSet() : null;
  var NS = "http://www.w3.org/2000/svg";

  function art() {
    var a = document.getElementById("sigArt");
    if (!a) { a = document.createElement("div"); a.id = "sigArt"; a.setAttribute("aria-hidden", "true"); document.body.insertBefore(a, document.body.firstChild); }
    return a;
  }
  function over(make) {
    var o = document.getElementById("sigOver");
    if (!o && make) { o = document.createElement("div"); o.id = "sigOver"; o.setAttribute("aria-hidden", "true"); document.body.appendChild(o); }
    return o;
  }
  function stop() {
    if (mo) { mo.disconnect(); mo = null; }
    if (bodyMo) { bodyMo.disconnect(); bodyMo = null; }
    if (tick) { clearInterval(tick); tick = null; }
    while (cleanups.length) cleanups.pop()();
    var a = document.getElementById("sigArt"); if (a) a.innerHTML = "";
    var o = over(false); if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  /* Urushi: the cracks in the lacquer, gold filling them one by one as the day's calls build (CSS reads --goal-p) */
  var SEAMS = [
    "M-10 210 L48 196 L71 214 L118 188 L139 201 L186 170 L204 183 L251 152 L268 166 L322 134 L340 142 L410 118",
    "M410 520 L362 532 L344 517 L297 548 L276 538 L238 571 L214 560 L176 596 L151 589 L118 624 L96 618 L-10 660",
    "M186 170 L180 132 L194 101 L188 62 L201 30 L196 -10",
    "M238 571 L246 612 L231 648 L240 690 L228 732 L236 810",
    "M-10 402 L34 410 L52 396 L88 420 L104 412 L131 438",
    "M410 330 L371 322 L354 338 L318 316 L301 327 L276 304"
  ];
  function seams() {
    var svg = document.createElementNS(NS, "svg"), raf = 0;
    svg.setAttribute("focusable", "false");
    // drawn in screen pixels (the crack shapes are stretched to the screen), so lines stay hairline-thin at any size
    function draw() {
      raf = 0;
      var W = Math.max(1, innerWidth), H = Math.max(1, innerHeight), sx = W / 400, sy = H / 800;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.innerHTML = '<defs><linearGradient id="sgGold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + W + '" y2="' + H + '">' +
        '<stop offset="0" stop-color="#A57A26"/><stop offset=".35" stop-color="#FBE6A8"/><stop offset=".6" stop-color="#C99D41"/><stop offset="1" stop-color="#F2D68A"/></linearGradient></defs>';
      SEAMS.forEach(function (d, i) {
        var dd = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, function (m, x, y) { return (x * sx).toFixed(1) + " " + (y * sy).toFixed(1); });
        ["sg-crack", "sg-glow", "sg-gold"].forEach(function (cls) {
          var p = document.createElementNS(NS, "path");
          p.setAttribute("d", dd); p.setAttribute("class", cls); p.setAttribute("pathLength", "1");
          if (cls !== "sg-crack") p.style.setProperty("--i", String(i));
          svg.appendChild(p);
        });
      });
    }
    draw(); art().appendChild(svg);
    var onResize = function () { if (!raf) raf = requestAnimationFrame(draw); };
    addEventListener("resize", onResize); cleanups.push(function () { removeEventListener("resize", onResize); if (raf) cancelAnimationFrame(raf); });
  }

  /* ---- shared: small ornaments that live inside the app's own elements ----
     The app redraws the lead card often, so card ornaments are put back after every redraw (cheap: one query).
     Text in them comes only from what's already on screen (the "90 left" line, today's count, the header name). */
  function txt(sel) { var e = document.querySelector(sel); return e ? (e.textContent || "").trim() : ""; }
  function num(sel) { var m = /\d[\d,]*/.exec(txt(sel)); return m ? Number(m[0].replace(/,/g, "")) : 0; }
  function who() { var t = txt(".brand .sub") || txt("#headerSub"); return (t.split(/[\s\u00b7]+/)[0] || "").slice(0, 18); }
  function left() { var c = document.querySelector("#mainArea .card"), m = c && /(\d[\d,]*)\s+left/.exec(c.textContent || ""); return m ? Number(m[1].replace(/,/g, "")) : 0; }
  function setText(n, v) { if (n && n.textContent !== v) n.textContent = v; }
  function inCard(make, update) {
    var main = document.getElementById("mainArea"); if (!main) return;
    function put() {
      var c = main.querySelector(".card"); if (!c) return;
      var o = c.querySelector(":scope > .sg-orn");
      if (!o) { o = make(); o.classList.add("sg-orn"); o.setAttribute("aria-hidden", "true"); c.appendChild(o); }
      if (update) update(o);
    }
    put();
    var m = new MutationObserver(put); m.observe(main, { childList: true, subtree: true, characterData: true });
    cleanups.push(function () { m.disconnect(); main.querySelectorAll(".sg-orn").forEach(function (x) { x.remove(); }); });
  }
  function inHeader(make) {
    var b = document.querySelector("header.top .brand .name"); if (!b) return null;
    var o = make(); o.classList.add("sg-horn"); o.setAttribute("aria-hidden", "true"); b.appendChild(o);
    cleanups.push(function () { if (o.parentNode) o.parentNode.removeChild(o); });
    return o;
  }
  // a layer above the app's sheets for the moment a call is logged (it never takes a tap)
  function stampLayer() {
    var o = document.getElementById("sigStamp");
    if (!o) { o = document.createElement("div"); o.id = "sigStamp"; o.setAttribute("aria-hidden", "true"); document.body.appendChild(o); cleanups.push(function () { if (o.parentNode) o.parentNode.removeChild(o); }); }
    return o;
  }
  function every(ms, fn) { fn(); var t = setInterval(function () { if (!document.hidden) fn(); }, ms); cleanups.push(function () { clearInterval(t); }); }
  function svgEl(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  /* Horologe: a chronograph subdial for today's calls, a date window and a power reserve for your pace */
  function horologe() {
    var top = document.querySelector("#progressWrap .rh-top");
    if (top && !top.querySelector(".hz-sub")) {
      var w = document.createElement("div"); w.className = "hz-sub"; w.setAttribute("aria-hidden", "true");
      var svg = svgEl("svg", { viewBox: "0 0 64 64", focusable: "false" });
      svg.appendChild(svgEl("circle", { cx: 32, cy: 32, r: 30, "class": "hz-ring" }));
      svg.appendChild(svgEl("circle", { cx: 32, cy: 32, r: 25.5, "class": "hz-snail" }));
      for (var i = 0; i < 60; i++) { var a = i * 6 * Math.PI / 180, r1 = i % 5 ? 27.5 : 24.5;
        svg.appendChild(svgEl("line", { x1: (32 + Math.sin(a) * 29).toFixed(2), y1: (32 - Math.cos(a) * 29).toFixed(2), x2: (32 + Math.sin(a) * r1).toFixed(2), y2: (32 - Math.cos(a) * r1).toFixed(2), "class": i % 5 ? "hz-t" : "hz-T" })); }
      [["12", 32, 15.5], ["3", 48.5, 34.4], ["6", 32, 53], ["9", 15.6, 34.4]].forEach(function (n, k) { var t = svgEl("text", { x: n[1], y: n[2], "class": "hz-n" + (k ? "" : " hz-n12") }); t.textContent = n[0]; svg.appendChild(t); });
      var hand = svgEl("g", { "class": "hz-hand" });
      hand.appendChild(svgEl("path", { d: "M32 37 L31.1 33 L32 9 L32.9 33 Z" })); hand.appendChild(svgEl("circle", { cx: 32, cy: 32, r: 2.6 }));
      svg.appendChild(hand); svg.appendChild(svgEl("circle", { cx: 32, cy: 32, r: 1, "class": "hz-pin" }));
      w.appendChild(svg); top.insertBefore(w, top.firstChild);
      cleanups.push(function () { if (w.parentNode) w.parentNode.removeChild(w); });
    }
    var win = inHeader(function () {
      var d = document.createElement("div"); d.className = "hz-date";
      d.innerHTML = '<span class="hz-dw"></span><span class="hz-dd"></span><span class="hz-pr" title=""><i></i></span>'; return d; });
    if (win) every(60000, function () {
      var now = new Date();
      setText(win.querySelector(".hz-dw"), now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase());
      setText(win.querySelector(".hz-dd"), String(now.getDate()));
    });
  }

  /* Urushi: a vermilion seal pressed onto the screen when a lead says yes, and seigaiha waves in gold at the foot */
  function urushi() {
    stampLayer().insertAdjacentHTML("beforeend", '<div class="ur-seal"><span>縁</span></div>');
    el("ur-waves"); el("ur-mon");
  }

  /* Premiere: every lead is a ticket; the slate names the scene while you're on a call */
  function premiereTicket() {
    inCard(function () { var d = document.createElement("div"); d.className = "pm-stub"; d.innerHTML = '<b>Admit one</b><span class="pm-row"></span><span class="pm-seat"></span>'; return d; },
      function (o) { var l = left(), n = num("#todayNum"); setText(o.querySelector(".pm-row"), l ? "Row " + l : "Tonight"); setText(o.querySelector(".pm-seat"), "Seat " + (n + 1)); });
    var o = over(true), sl = document.createElement("div"); sl.className = "pm-slate";
    sl.innerHTML = '<span class="pm-rec"></span><span class="pm-scene"></span>'; o.appendChild(sl);
    var sync = function () { setText(sl.querySelector(".pm-scene"), "Scene " + (num("#todayNum") + 1) + (innerWidth >= 700 && who() ? " \u00b7 " + who() : "") + " \u00b7 Rolling"); };
    var m = new MutationObserver(sync); m.observe(document.body, { attributes: true, attributeFilter: ["class"] }); sync();
    cleanups.push(function () { m.disconnect(); });
  }

  /* Blueprint: a title block on every drawing (the lead card), a north arrow, and an Approved stamp for a yes */
  function blueprint() {
    inCard(function () {
      var d = document.createElement("div"); d.className = "bp-title";
      d.innerHTML = '<span class="bp-k">Dwg no.</span><span class="bp-v bp-dwg"></span><span class="bp-k">Scale</span><span class="bp-v">1:1</span>' +
        '<span class="bp-k">Drawn</span><span class="bp-v bp-by"></span><span class="bp-k">Date</span><span class="bp-v bp-dt"></span>'; return d;
    }, function (o) {
      var l = left(), d = new Date();
      setText(o.querySelector(".bp-dwg"), "VX-" + String(l || num("#progNum") || 1).padStart(4, "0"));
      setText(o.querySelector(".bp-by"), (who() || "VPEX").toUpperCase());
      setText(o.querySelector(".bp-dt"), String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0") + "." + String(d.getFullYear()).slice(2));
    });
    var a = art(), n = document.createElement("div"); n.className = "bp-north";
    n.innerHTML = '<svg viewBox="0 0 80 96" focusable="false"><circle cx="40" cy="56" r="30"/><circle cx="40" cy="56" r="24" class="bp-in"/><path d="M40 18 L48 56 L40 50 L32 56 Z" class="bp-nf"/><path d="M40 94 L32 56 L40 62 L48 56 Z"/>' +
      '<path d="M4 56 H76 M40 22 V90" class="bp-x"/><text x="40" y="12">N</text></svg>';
    a.appendChild(n);
    var o = stampLayer(); o.insertAdjacentHTML("beforeend", '<div class="bp-stamp"><b>Approved</b><span class="bp-st"></span></div>');
    var st = o.querySelector(".bp-st"); every(60000, function () { setText(st, new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " \u00b7 " + (who() || "VPEX")); });
  }

  /* Prism: light follows your pointer across the cards (computers), and a prism splits it in the header */
  function prism() {
    el("pr-beam"); el("pr-caustic");
    inCard(function () { var d = document.createElement("div"); d.className = "pr-sheen"; return d; });
    inHeader(function () { var d = document.createElement("div"); d.className = "pr-prism";
      d.innerHTML = '<svg viewBox="0 0 44 20" focusable="false"><path d="M0 10.5 L16 9.5" class="pr-in"/><path d="M16 17 L22 3 L28 17 Z" class="pr-glass"/>' +
        '<path d="M25 9 L44 3" stroke="#E5484D"/><path d="M25 9.6 L44 6.5" stroke="#F5A524"/><path d="M25.2 10.2 L44 10" stroke="#30A46C"/><path d="M25.2 10.8 L44 13.5" stroke="#3E63DD"/><path d="M25.4 11.4 L44 17" stroke="#8E4EC6"/></svg>'; return d; });
    if (!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches)) return;
    var raf = 0, ev = null, root = document.documentElement;
    var mv = function (e) { ev = e; if (!raf) raf = requestAnimationFrame(function () {
      raf = 0; var c = document.querySelector("#mainArea .card"); if (!c || !ev) return;
      var r = c.getBoundingClientRect(); c.style.setProperty("--mx", Math.round(ev.clientX - r.left) + "px"); c.style.setProperty("--my", Math.round(ev.clientY - r.top) + "px");
      root.style.setProperty("--pr-x", (ev.clientX / Math.max(1, innerWidth)).toFixed(3)); }); };
    addEventListener("pointermove", mv, { passive: true });
    cleanups.push(function () { removeEventListener("pointermove", mv); if (raf) cancelAnimationFrame(raf); root.style.removeProperty("--pr-x"); });
  }

  /* Amalfi: majolica on the walls, a lemon by the name, and the painted tiles for a yes and for the goal */
  function amalfi() {
    el("am-tiles");
    inHeader(function () { var d = document.createElement("span"); d.className = "am-lemon"; return d; });
    stampLayer().insertAdjacentHTML("beforeend", '<div class="am-stamp am-yes"><i></i><b>Perfetto!</b><span>Interested</span></div><div class="am-stamp am-goal"><i></i><b>Bravissimo!</b><span>Goal reached</span></div>');
  }

  /* Premiere: curtains either side of the screen on wide displays; Prism: a ray split across the page */
  function el(cls) { var d = document.createElement("div"); d.className = cls; art().appendChild(d); return d; }

  /* Horologe: each new Call button's seconds hand starts where the real clock's seconds are */
  function stampSeconds(root) {
    var list = (root || document).querySelectorAll ? (root || document).querySelectorAll(".call-btn") : [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i]; if (seen && seen.has(b)) continue;
      if (seen) seen.add(b);
      b.style.setProperty("--sig-s0", ((Date.now() / 1000) % 60).toFixed(2));
    }
  }

  /* Premiere: the letterbox, its timecode, the shutter and the wrap title */
  function premiere(opts) {
    var o = over(true);
    o.innerHTML = '<div class="pm-grain"></div><div class="pm-bar pm-top"></div><div class="pm-bar pm-bot"><span class="pm-tc">00:00</span></div>' +
      '<div class="pm-shut"></div><div class="pm-wrap">That’s a wrap</div>';
    el("pm-flare"); el("pm-curtain pm-cl"); el("pm-curtain pm-cr");
    var tc = o.querySelector(".pm-tc");
    function paint() {
      var at = (opts && opts.liveAt && opts.liveAt()) || 0, s = at ? Math.max(0, Math.floor((Date.now() - at) / 1000)) : 0;
      if (s > 5400) s = 0;
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
      tc.textContent = (h ? h + ":" + (m < 10 ? "0" : "") : (m < 10 ? "0" : "")) + m + ":" + (x < 10 ? "0" : "") + x;
    }
    function sync() {
      var live = document.body.classList.contains("st-live");
      if (live && !tick) { paint(); tick = setInterval(function () { if (!document.hidden) paint(); }, 1000); }
      if (!live && tick) { clearInterval(tick); tick = null; }
    }
    bodyMo = new MutationObserver(sync); bodyMo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    sync();
  }

  function mount(id, opts) {
    if (id === cur) return;
    stop(); cur = id;
    if (!id || id.indexOf("sig-") !== 0) { cur = null; return; }
    if (id === "sig-urushi") { seams(); urushi(); }
    if (id === "sig-premiere") { premiere(opts); premiereTicket(); }
    if (id === "sig-blueprint") blueprint();
    if (id === "sig-prism") prism();
    if (id === "sig-amalfi") amalfi();
    if (id === "sig-horologe") {
      horologe();
      stampSeconds(document);
      mo = new MutationObserver(function () { stampSeconds(document.getElementById("mainArea") || document); });
      mo.observe(document.getElementById("mainArea") || document.body, { childList: true, subtree: true });
    }
  }
  /* a short cross-fade when the theme changes, so it reads as deliberate */
  function fade() {
    var r = document.documentElement; r.classList.remove("sig-switching"); void r.offsetWidth; r.classList.add("sig-switching");
    clearTimeout(fade.t); fade.t = setTimeout(function () { r.classList.remove("sig-switching"); }, 520);
  }
  window.VPEXSig = { mount: mount, fade: fade, current: function () { return cur; } };
})();
